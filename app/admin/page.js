'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function Admin() {
  const s = createClient()
  
  const [profile, setProfile] = useState(null)
  const [products, setProducts] = useState([])
 const [orders, setOrders] = useState([])
const [orderItems, setOrderItems] = useState([])
const [reportRows, setReportRows] = useState([])
const [reportColumns, setReportColumns] = useState([])
const [reportFromId, setReportFromId] = useState('')
const [reportToId, setReportToId] = useState('')
const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(null)
const [translating, setTranslating] = useState(null)

const translateProduct = async (p) => {
  setTranslating(p.id)
  setMsg('')

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name_pl: p.name_pl || '',
        description_pl: p.description_pl || ''
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Błąd tłumaczenia')
    }

    setProducts(ps =>
      ps.map(x =>
        x.id === p.id
          ? {
              ...x,
              name_en: data.name_en || '',
              description_en: data.description_en || ''
            }
          : x
      )
    )

    setMsg(`Przetłumaczono: ${p.name_pl}`)
  } catch (error) {
    setMsg(`BŁĄD TŁUMACZENIA: ${error.message}`)
  }

  setTranslating(null)
}
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await s.auth.getUser()

      if (!user) {
        location.href = '/login'
        return
      }

      const { data: p } = await s
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!p?.is_admin) {
        setMsg('Brak uprawnień administratora.')
        return
      }

      setProfile(p)

      const { data: ps, error: pe } = await s
        .from('products')
        .select('*')
        .order('sort_order')

      if (pe) {
        setMsg(`Błąd pobierania produktów: ${pe.message}`)
        return
      }

      setProducts(ps || [])

      const { data: os } = await s
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      setOrders(os || [])
      const { data: oi, error: oie } = await s
  .from('order_items')
  .select('*')

if (oie) {
  setMsg(`Błąd pobierania pozycji zamówień: ${oie.message}`)
  return
}

setOrderItems(oi || [])
    })()
  }, [])
const getProductGroup = (p) => {
  const name = (p.name_pl || '').trim().toUpperCase()

  if (name.startsWith('KR ')) return 3
  if (name.startsWith('M ')) return 1
  if (name.startsWith('K ')) return 2
  if (name.startsWith('P ')) return 4
  if (name.startsWith('B ')) return 5

  return 99
}
const generateReportPreview = () => {
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )

  let selectedOrders = [...sortedOrders]

  const fromIndex = reportFromId
    ? sortedOrders.findIndex(o => String(o.id) === String(reportFromId))
    : 0

  const toIndex = reportToId
    ? sortedOrders.findIndex(o => String(o.id) === String(reportToId))
    : sortedOrders.length - 1

  if (reportFromId || reportToId) {
    const start = Math.min(
      fromIndex >= 0 ? fromIndex : 0,
      toIndex >= 0 ? toIndex : sortedOrders.length - 1
    )
    const end = Math.max(
      fromIndex >= 0 ? fromIndex : 0,
      toIndex >= 0 ? toIndex : sortedOrders.length - 1
    )

    selectedOrders = sortedOrders.slice(start, end + 1)
  }

  const orderById = new Map(
    selectedOrders.map(o => [o.id, o])
  )

  const customerMap = new Map()

for (const o of selectedOrders) {
  const key = o.email || o.customer_name || o.id

  if (!customerMap.has(key)) {
    customerMap.set(key, {
      key,
      label:
        (o.customer_name || '') +
        (o.email ? ` — ${o.email}` : '')
    })
  }
}

const columns = [...customerMap.values()]

  const totals = new Map()

  for (const item of orderItems) {
    const order = orderById.get(item.order_id)

    if (!order) continue

    const name =
      item.product_name_pl ||
      item.product_name_en ||
      'Produkt'

    if (!totals.has(name)) {
      totals.set(name, new Map())
    }

const byOrder = totals.get(name)

const customerKey =
  order.email ||
  order.customer_name ||
  order.id

byOrder.set(
  customerKey,
  (byOrder.get(customerKey) || 0) +
  Number(item.quantity || 0)
)
  }

  const productOrder = new Map(
    products.map((p, index) => [
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
      const byOrder = totals.get(name)

      const values = columns.map(c =>
        Number(byOrder.get(c.key) || 0)
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

  setReportColumns(columns)
  setReportRows(rows)

  setMsg(
    `Raport testowy przygotowany: ${rows.length} produktów, ${columns.length} zamówień.`
  )
}
const orderedProducts = [...products].sort((a, b) => {
  const groupA = getProductGroup(a)
  const groupB = getProductGroup(b)

  if (groupA !== groupB) {
    return groupA - groupB
  }

  return Number(a.sort_order || 0) - Number(b.sort_order || 0)
})
  const change = (id, field, value) => {
    setProducts(ps =>
      ps.map(x =>
        x.id === id
          ? { ...x, [field]: value }
          : x
      )
    )
  }

 const uploadImage = async (p, file) => {
  if (!file) return

  setSaving(p.id)
  setMsg('')

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${p.id}-${Date.now()}.${ext}`

  const { error: uploadError } = await s.storage
    .from('product-images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    })

  if (uploadError) {
    setMsg(`BŁĄD UPLOADU: ${uploadError.message}`)
    setSaving(null)
    return
  }

  const { data: publicData } = s.storage
    .from('product-images')
    .getPublicUrl(path)

  const image_url = publicData.publicUrl

  const { data, error } = await s
  .from('products')
  .update({ image_url })
  .eq('id', p.id)
  .select('id, image_url')
  .single()

  if (error) {
    setMsg(`BŁĄD ZAPISU ZDJĘCIA: ${error.message}`)
    setSaving(null)
    return
  }

  setProducts(ps =>
    ps.map(x => x.id === p.id ? { ...x, ...data } : x)
  )

  setMsg(`Zdjęcie zapisane: ${p.name_pl}`)
  setSaving(null)
}
  const save = async (p) => {
    setSaving(p.id)
    setMsg('')

    const price =
      p.price === '' || p.price == null
        ? null
        : Number(p.price)
    const promotionPrice =
      p.promotion_price === '' || p.promotion_price == null
        ? null
        : Number(p.promotion_price)
    if (
      price !== null &&
      (!Number.isFinite(price) || price < 0)
    ) {
      setMsg(`Błędna cena: ${p.name_pl}`)
      setSaving(null)
      return
    }
    if (
      promotionPrice !== null &&
      (!Number.isFinite(promotionPrice) || promotionPrice < 0)
    ) {
      setMsg(`Błędna cena promocyjna: ${p.name_pl}`)
      setSaving(null)
      return
    }
    const payload = {
      price,
      currency: 'GBP',
      unit: p.unit || 'kg',
      active: !!p.active,
      name_pl: p.name_pl || '',
      name_en: p.name_en || '',
      description_pl: p.description_pl || '',
      description_en: p.description_en || '',
      image_url: p.image_url || null,
    is_promotion: !!p.is_promotion,
promotion_from: p.promotion_from || null,
promotion_to: p.promotion_to || null,
promotion_price: promotionPrice
    }

    const { data, error } = await s
      .from('products')
      .update(payload)
      .eq('id', p.id)
      .select('*')
      .single()

    if (error) {
      setMsg(`BŁĄD ZAPISU: ${error.message}`)
      setSaving(null)
      return
    }

    if (!data) {
      setMsg('BŁĄD ZAPISU: Supabase nie zwrócił produktu.')
      setSaving(null)
      return
    }

    setProducts(ps =>
      ps.map(x =>
        x.id === p.id
          ? { ...x, ...data }
          : x
      )
    )

    setMsg(
      `Zapisano: ${data.name_pl} — £${
        data.price == null
          ? 'brak ceny'
          : Number(data.price).toFixed(2)
      }`
    )

    setSaving(null)
  }

  if (!profile) {
    return (
      <main className="auth">
        <img
          src="/images/logo.png"
          className="authlogo"
        />

        <h1>Panel administratora</h1>

        <p className={msg ? 'error' : ''}>
          {msg || 'Ładowanie…'}
        </p>

        <a href="/">← Wróć</a>
      </main>
    )
  }

  return (
    <main className="admin">

      <header className="adminhead">
        <img src="/images/logo.png" />
        <a href="/">Oferta</a>
      </header>

      <h1>Panel administratora</h1>

      {msg && (
        <p className="notice">
          {msg}
        </p>
      )}

      <section>

        <h2>Produkty</h2>

        <p>
  Tutaj możesz zmieniać cenę, nazwy,
  opisy, jednostkę oraz aktywność produktu.
</p>

<button
  type="button"
  onClick={async () => {
    setMsg('Tworzenie nowego produktu...')

    const nextSortOrder =
      products.length > 0
        ? Math.max(...products.map(x => Number(x.sort_order) || 0)) + 1
        : 1

    const { data, error } = await s
      .from('products')
      .insert({
        name_pl: 'Nowy produkt',
        name_en: 'New product',
        description_pl: '',
        description_en: '',
        price: null,
        currency: 'GBP',
        unit: 'kg',
        image_url: null,
        active: false,
        sort_order: nextSortOrder,
        is_promotion: false,
        promotion_from: null,
        promotion_to: null,
        promotion_price: null
      })
      .select('*')
      .single()

    if (error) {
      setMsg(`BŁĄD DODAWANIA PRODUKTU: ${error.message}`)
      return
    }

    setProducts(ps => [...ps, data])
    setMsg(`Dodano nowy produkt #${data.id}`)
  }}
  style={{
    marginBottom:'16px',
    fontSize:'16px'
  }}
>
  ➕ Dodaj nowy produkt
</button>

<div className="adminlist">

    {orderedProducts.map(p => (

            <div
              className="adminrow"
              key={p.id}
            >

              <img
                src={
                  p.image_url ||
                  `/images/${String(p.id).padStart(2, '0')}.jpg`
                }
              />

              <div>

                <b>{p.name_pl}</b>

                <label>
                  Nazwa PL
                  <input
                    value={p.name_pl || ''}
                    onChange={e =>
                      change(
                        p.id,
                        'name_pl',
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Nazwa EN
                  <input
                    value={p.name_en || ''}
                    onChange={e =>
                      change(
                        p.id,
                        'name_en',
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Cena £ / kg
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.price ?? ''}
                    onChange={e =>
                      change(
                        p.id,
                        'price',
                        e.target.value
                      )
                    }
                    placeholder="np. 7.50"
                  />
                </label>

                <label>
                  Jednostka
                  <select
                    value={p.unit || 'kg'}
                    onChange={e =>
                      change(
                        p.id,
                        'unit',
                        e.target.value
                      )
                    }
                  >
                    <option value="kg">kg</option>
                    <option value="pcs">pcs</option>
                  </select>
                </label>

                <label>
                  Krótki opis PL
                  <textarea
                    rows="2"
                    value={p.description_pl || ''}
                    onChange={e =>
                      change(
                        p.id,
                        'description_pl',
                        e.target.value
                      )
                    }
                    placeholder="Krótki opis produktu..."
                  />
                </label>
<label>
  Cena promocyjna £ / kg
  <input
    type="number"
    min="0"
    step="0.01"
    value={p.promotion_price ?? ''}
    onChange={e =>
  change(
    p.id,
    'promotion_price',
    e.target.value === '' ? null : Number(e.target.value)
  )
}
    placeholder="np. 6.99"
  />
</label>
      <button
  type="button"
  onClick={() => translateProduct(p)}
  disabled={translating === p.id}
  style={{
    marginBottom:'10px'
  }}
>
  {translating === p.id
    ? 'Tłumaczenie...'
    : '🇬🇧 Tłumacz z PL'}
</button>
                <label>
                  Short description EN
                  <textarea
                    rows="2"
                    value={p.description_en || ''}
                    onChange={e =>
                      change(
                        p.id,
                        'description_en',
                        e.target.value
                      )
                    }
                    placeholder="Short product description..."
                  />
                </label>

                <label>
                  Zdjęcie produktu — adres pliku
                  <input
                    value={p.image_url || ''}
                    onChange={e =>
                      change(
                        p.id,
                        'image_url',
                        e.target.value
                      )
                    }
                    placeholder="/images/01.jpg"
                  />
                </label>


<label>
  Zmień zdjęcie produktu
  <input
    type="file"
    accept="image/*"
    onChange={e => uploadImage(p, e.target.files?.[0])}
    disabled={saving === p.id}
  />
</label>

<label>
  <input
    type="checkbox"
    checked={!!p.is_promotion}
onChange={e => {
  const checked = e.target.checked

  if (!checked) {
    change(p.id, 'is_promotion', false)
    return
  }

  if (
    products.filter(
      x => x.id !== p.id && x.is_promotion
    ).length >= 4
  ) {
    setMsg('Możesz mieć maksymalnie 4 produkty w promocji.')
    return
  }

  change(p.id, 'is_promotion', true)
}}

     
  />
  {' '}PROMOCJA (maks. 4 produkty)
</label>

<label>
  Promocja — od
  <input
    type="date"
    value={p.promotion_from || ''}
    onChange={e =>
      change(
        p.id,
        'promotion_from',
        e.target.value || null
      )
    }
  />
</label>

<label>
  Promocja — do
  <input
    type="date"
    value={p.promotion_to || ''}
    onChange={e =>
      change(
        p.id,
        'promotion_to',
        e.target.value || null
      )
    }
  />
</label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!p.active}
                    onChange={e =>
                      change(
                        p.id,
                        'active',
                        e.target.checked
                      )
                    }
                  />
                  {' '}aktywny
                </label>

                <button
                  onClick={() => save(p)}
                  disabled={saving === p.id}
                >
                  {saving === p.id
                    ? 'Zapisywanie...'
                    : 'Zapisz produkt'}
                </button>

              </div>

            </div>

          ))}

        </div>

      </section>

      <section>
</section>

<section>
  <h2>📦 Raport magazynowy</h2>

  <p>
    Zamknij bieżące zamówienia i przygotuj raport dla magazynu.
  </p>

  <div style={{
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px'
  }}>
    <label style={{ minWidth: '280px' }}>
      Od zamówienia
      <select
        value={reportFromId}
        onChange={e => setReportFromId(e.target.value)}
        style={{ width: '100%' }}
      >
        <option value="">Od początku</option>
        {[...orders]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(o => (
            <option key={o.id} value={o.id}>
              #{o.order_number ?? '—'} — {new Date(o.created_at).toLocaleDateString('pl-PL')} — {o.customer_name || o.email || 'Klient'}
            </option>
          ))}
      </select>
    </label>

    <label style={{ minWidth: '280px' }}>
      Do zamówienia
      <select
        value={reportToId}
        onChange={e => setReportToId(e.target.value)}
        style={{ width: '100%' }}
      >
        <option value="">Do najnowszego</option>
        {[...orders]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(o => (
            <option key={o.id} value={o.id}>
              #{o.order_number ?? '—'} — {new Date(o.created_at).toLocaleDateString('pl-PL')} — {o.customer_name || o.email || 'Klient'}
            </option>
          ))}
      </select>
    </label>
  </div>

  <button
  type="button"
  onClick={generateReportPreview}
  style={{
    fontSize: '16px',
    padding: '12px 18px',
    marginBottom: '20px'
  }}
>
  🧪 PRZYGOTUJ RAPORT TESTOWY
</button>
    {reportRows.length > 0 && (
  <div style={{
    overflowX: 'auto',
    marginTop: '10px',
    marginBottom: '20px'
  }}>
    <table style={{
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: '13px'
    }}>
      <thead>
        <tr>
          <th style={{
            border: '1px solid #ccc',
            padding: '8px',
            textAlign: 'left'
          }}>
            PRODUKT
          </th>

          {reportColumns.map(c => (
            <th
              key={c.key}
              style={{
                border: '1px solid #ccc',
                padding: '8px'
              }}
            >
              {c.label}
            </th>
          ))}

          <th style={{
            border: '1px solid #ccc',
            padding: '8px'
          }}>
            TOTAL
          </th>
        </tr>
      </thead>

      <tbody>
        {reportRows.map(row => (
          <tr key={row.name}>
            <td style={{
              border: '1px solid #ccc',
              padding: '8px',
              fontWeight: '600'
            }}>
              {row.name}
            </td>

            {row.values.map((value, index) => (
              <td
                key={index}
                style={{
                  border: '1px solid #ccc',
                  padding: '8px',
                  textAlign: 'center'
                }}
              >
                {value}
              </td>
            ))}

            <td style={{
              border: '1px solid #ccc',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '700'
            }}>
              {row.total}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
</section>

<section>

  <h2>Ostatnie zamówienia</h2>
    

        <div className="orders">

          {orders.map(o => (

            <div
              className="order"
              key={o.id}
            >

              <b>#{o.order_number}</b>
              {' · '}
              {new Date(
                o.created_at
              ).toLocaleString('pl-PL')}
              {' · '}
              {o.customer_name}
              {' · '}
              {o.total} {o.currency}
              {' · '}
              <span>{o.status}</span>

              <div>
                {o.email}
                {' · '}
                {o.phone}
                {' · '}
                {o.delivery_address}
              </div>

            </div>

          ))}

        </div>

      </section>

    </main>
  )
}
