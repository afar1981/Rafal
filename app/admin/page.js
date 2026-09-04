'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'

export default function Admin() {
  const s = createClient()
  const [profile, setProfile] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(null)

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
    })()
  }, [])

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
    .select('*')
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

    if (
      price !== null &&
      (!Number.isFinite(price) || price < 0)
    ) {
      setMsg(`Błędna cena: ${p.name_pl}`)
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
      image_url: p.image_url || null
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

        <div className="adminlist">

          {products.map(p => (

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

        <h2>Ostatnie zamówienia</h2>

        <div className="orders">

          {orders.map(o => (

            <div
              className="order"
              key={o.id}
            >

              <b>#{o.id}</b>
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
