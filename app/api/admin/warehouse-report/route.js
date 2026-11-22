import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase-server'
import { Resend } from 'resend'
import ExcelJS from 'exceljs'

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function warehouseAscii(value) {
  return String(value ?? '').replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, char => ({
    'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
    'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z'
  })[char])
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

    const columns = [...customerMap.values()].sort((a, b) => {
  const aDelicje = /delicje/i.test(a.label || '')
  const bDelicje = /delicje/i.test(b.label || '')
  return Number(aDelicje) - Number(bDelicje)
})
    const orderById = new Map(sortedOrders.map(o => [String(o.id), o]))
    const totals = new Map()

    for (const item of orderItems || []) {
      const order = orderById.get(String(item.order_id))
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

    const groupRank = name => {
      const value = String(name || '').trim().toUpperCase()
      if (/^JAJ/.test(value) || /\bJAJKA\b/.test(value)) return 99
      if (value.startsWith('PRL')) return 4
      if (value.startsWith('KR')) return 2
      if (value.startsWith('M')) return 0
      if (value.startsWith('B')) return 1
      if (value.startsWith('K')) return 3
      if (value.startsWith('G')) return 5
      return 6
    }
    const rows = [...totals.keys()]
      .sort((a, b) => {
        const ga = groupRank(a)
        const gb = groupRank(b)
        if (ga !== gb) return ga - gb
        const ai = productOrder.has(a) ? productOrder.get(a) : 999999
        const bi = productOrder.has(b) ? productOrder.get(b) : 999999
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

    // Prawdziwy plik XLSX — Gmail i Excel poprawnie odczytują obrót nagłówków.
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'POLSKA TRADYCJA'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('Raport magazynowy', {
      views: [{ state: 'frozen', ySplit: 2, xSplit: 1 }]
    })

    worksheet.columns = [
      { header: 'PRODUKT', key: 'product', width: 42 },
      ...columns.map((c, index) => ({
        header: warehouseAscii(c.label),
        key: `shop_${index}`,
        width: 6
      })),
      { header: 'TOTAL', key: 'total', width: 10 }
    ]

    worksheet.mergeCells(1, 1, 1, columns.length + 2)
    const titleCell = worksheet.getCell(1, 1)
    titleCell.value = 'POLSKA TRADYCJA — Raport magazynowy'
    titleCell.font = { bold: true, size: 14 }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
    worksheet.getRow(1).height = 26

    const headerRow = worksheet.getRow(2)
    headerRow.values = ['PRODUKT', ...columns.map(c => warehouseAscii(c.label)), 'TOTAL']
    headerRow.height = 112
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 9 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF999999' } },
        left: { style: 'thin', color: { argb: 'FF999999' } },
        bottom: { style: 'thin', color: { argb: 'FF999999' } },
        right: { style: 'thin', color: { argb: 'FF999999' } }
      }
      cell.alignment = colNumber > 1 && colNumber < columns.length + 2
        ? { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true }
        : { vertical: 'middle', horizontal: 'center', wrapText: true }
    })

    rows.forEach(row => {
      const values = [
        row.name,
        ...row.values.map(value => value === 0 ? null : value),
        row.total
      ]
      const excelRow = worksheet.addRow(values)
      excelRow.height = 25
      excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 ? 'left' : 'center',
          wrapText: colNumber === 1
        }
        if (colNumber === columns.length + 2) {
          cell.font = { bold: true }
        }
      })
    })

    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: rows.length + 2, column: columns.length + 2 }
    }
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    }

    const xls = Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')

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
        ? `raport-magazynowy-${firstDate}-${lastDate}.xlsx`
        : 'raport-magazynowy.xlsx'

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
          content: xls,
          content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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
