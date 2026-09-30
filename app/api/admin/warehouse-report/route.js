import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { Resend } from 'resend'

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Musisz być zalogowany.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json(
        { error: 'Brak uprawnień administratora.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const orderIds = Array.isArray(body.order_ids)
      ? body.order_ids
      : []

    if (!orderIds.length) {
      return NextResponse.json(
        { error: 'Nie wybrano żadnych zamówień.' },
        { status: 400 }
      )
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .in('id', orderIds)

    if (ordersError) throw ordersError

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)

    if (itemsError) throw itemsError

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('name_pl, sort_order')
      .order('sort_order')

    if (productsError) throw productsError

    const sortedOrders = [...(orders || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    )

    const customerMap = new Map()

    for (const order of sortedOrders) {
      const key = order.email || order.customer_name || order.id

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          key,
          label: order.company || order.email || order.customer_name || 'Klient'
        })
      }
    }

    const columns = [...customerMap.values()]
    const orderById = new Map(sortedOrders.map(o => [o.id, o]))
    const totals = new Map()

    for (const item of orderItems || []) {
      const order = orderById.get(item.order_id)
      if (!order) continue

      const name =
        item.product_name_pl ||
        item.product_name_en ||
        'Produkt'

      if (!totals.has(name)) {
        totals.set(name, new Map())
      }

      const byCustomer = totals.get(name)
      const customerKey =
        order.email ||
        order.customer_name ||
        order.id

      byCustomer.set(
        customerKey,
        (byCustomer.get(customerKey) || 0) +
        Number(item.quantity || 0)
      )
    }

    const productOrder = new Map(
      (products || []).map((p, index) => [
        p.name_pl,
        index
      ])
    )

    const rows = [...totals.keys()]
      .sort((a, b) => {
        const ai = productOrder.has(a)
          ? productOrder.get(a)
          : 999999

        const bi = productOrder.has(b)
          ? productOrder.get(b)
          : 999999

        if (ai !== bi) return ai - bi

        return a.localeCompare(b, 'pl')
      })
      .map(name => {
        const byCustomer = totals.get(name)

        const values = columns.map(c =>
          Number(byCustomer.get(c.key) || 0)
        )

        return {
          name,
          values,
          total: values.reduce(
            (sum, value) => sum + value,
            0
          )
        }
      })

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Wybrane zamówienia nie zawierają produktów.' },
        { status: 400 }
      )
    }

    const headerCells = columns
      .map(c => `<th>${esc(c.label)}</th>`)
      .join('')

    const bodyRows = rows
      .map(row => {
        const cells = row.values
          .map(value => `<td>${value}</td>`)
          .join('')

        return `
          <tr>
            <td><b>${esc(row.name)}</b></td>
            ${cells}
            <td><b>${row.total}</b></td>
          </tr>
        `
      })
      .join('')

    const xls = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; }
  th, td { border: 1px solid #999; padding: 7px; }
  th { background: #eee; font-weight: bold; }
  td { text-align: center; }
  td:first-child { text-align: left; }
</style>
</head>
<body>
<h2>POLSKA TRADYCJA — Raport magazynowy</h2>
<table>
<thead>
<tr>
<th>PRODUKT</th>
${headerCells}
<th>TOTAL</th>
</tr>
</thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body>
</html>`

    if (
      !process.env.RESEND_API_KEY ||
      !process.env.ORDER_EMAIL_TO ||
      !process.env.ORDER_EMAIL_FROM
    ) {
      return NextResponse.json(
        { error: 'Brak konfiguracji e-mail RESEND.' },
        { status: 500 }
      )
    }

    const firstDate = sortedOrders[0]
      ? new Date(sortedOrders[0].created_at).toISOString().slice(0, 10)
      : ''

    const lastDate = sortedOrders[sortedOrders.length - 1]
      ? new Date(
          sortedOrders[sortedOrders.length - 1].created_at
        ).toISOString().slice(0, 10)
      : ''

    const filename =
      firstDate && lastDate
        ? `raport-magazynowy-${firstDate}-${lastDate}.xls`
        : 'raport-magazynowy.xls'

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { error: sendError } = await resend.emails.send({
      from: process.env.ORDER_EMAIL_FROM,
      to: process.env.ORDER_EMAIL_TO,
      subject: `Raport magazynowy — ${firstDate} – ${lastDate}`,
      html: `
        <h2>Raport magazynowy POLSKA TRADYCJA</h2>
        <p>
          Przygotowano raport dla
          <b>${sortedOrders.length} zamówień</b>
          i <b>${rows.length} produktów</b>.
        </p>
        <p>Raport znajduje się w załączniku Excel.</p>
      `,
      attachments: [
        {
          filename,
          content: Buffer.from(xls, 'utf-8').toString('base64'),
          content_type: 'application/vnd.ms-excel'
        }
      ]
    })

    if (sendError) throw sendError

    return NextResponse.json({
      ok: true,
      orders: sortedOrders.length,
      products: rows.length
    })
  } catch (error) {
    console.error('Warehouse report error:', error)

    return NextResponse.json(
      { error: error.message || 'Błąd wysyłania raportu.' },
      { status: 500 }
    )
  }
}
