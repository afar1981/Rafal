'use client'
import {useEffect,useMemo,useState} from 'react'
import {createClient} from '../lib/supabase-browser'

const fallback=[
['Baleron Wiejski Extra','Country-Style Baleron Extra'],
['Boczek Wiejski Extra','Country-Style Pork Belly Extra'],
['Kabanosy Wiejskie Extra','Country-Style Kabanos Extra'],
['Kaszanka Wiejska Extra','Country-Style Blood Sausage Extra'],
['Kiełbasa Szynkowa Extra','Ham Sausage Extra'],
['Kiełbasa Wiejska z Galaretką Extra','Country-Style Sausage with Aspic Extra'],
['Kiełbasa Zwyczajna Extra','Traditional Sausage Extra'],
['Kiełbasa Żywiecka Extra','Żywiecka Sausage Extra'],
['Kiszka Wiejska Extra','Country-Style Kiszka Extra'],
['Rolada Boczkowa Extra','Pork Belly Roulade Extra'],
['Salceson Wiejski Extra','Country-Style Head Cheese Extra'],
['Schab z Wędzarni Extra','Smoked Pork Loin Extra'],
['Szynka Dymiona Extra','Smoked Ham Extra'],
['Szynka od Bacy Extra','Highlander-Style Ham Extra'],
['Szynka od Juhasa Extra','Shepherd-Style Ham Extra'],
['Szynka Ogniem Wędzona Extra','Fire-Smoked Ham Extra'],
['Szynka Polska Extra','Polish Ham Extra'],
['Szynka z Wędzarni Extra','Smoked Ham from the Smokehouse Extra'],
['Żeberka Wiejskie Extra','Country-Style Smoked Ribs Extra'],
['Baleron Wiejski','Country-Style Baleron'],
['Bekon Wiejski','Country-Style Bacon'],
['Boczek Wiejski','Country-Style Pork Belly'],
['Kabanos Pieczony Wiejski','Country-Style Roasted Kabanos'],
['Kiełbasa Krakowska Wiejska','Country-Style Krakowska Sausage'],
['Kiełbasa na Szynce Wiejska','Country-Style Ham Sausage'],
['Kiełbasa Schabowa Wiejska','Country-Style Pork Loin Sausage'],
['Kiełbasa Szlachecka Wiejska','Country-Style Noble Sausage'],
['Kiełbasa Szynkowa Wiejska','Country-Style Ham Sausage'],
['Kiełbasa Wiejska','Country-Style Sausage'],
['Kiełbasa Wieprzowo Cielęca Wiejska','Country-Style Pork & Veal Sausage'],
['Polędwiczka Pieczona Wiejska','Country-Style Roasted Pork Tenderloin'],
['Polędwiczka w Ziołach Wiejska','Country-Style Herb Pork Tenderloin'],
['Rolada Boczkowa Wiejska','Country-Style Pork Belly Roulade'],
['Schab Pieczony Wiejski','Country-Style Roasted Pork Loin'],
['Schab Tradycyjny Wiejski','Traditional Country-Style Pork Loin'],
['Schab w Siatce Wiejski','Country-Style Pork Loin in Netting'],
['Szynka Chłopska Wiejska','Country-Style Peasant Ham'],
['Szynka Pieczona na Ogniu Wiejska','Country-Style Fire-Roasted Ham'],
['Szynka Szlachecka Wiejska','Country-Style Noble Ham'],
['Szynka Tradycyjna Wiejska','Traditional Country-Style Ham'],
['Szynka w Siatce Wiejska','Country-Style Ham in Netting'],
['Wędzonka Wiejska','Country-Style Smoked Pork'],
['Baleron Swojski','Homestyle Baleron'],
['Kiełbasa Sucha Czosnkowa Swojska','Homestyle Dry Garlic Sausage'],
['Boczek Jacka Swojski','Jacek’s Homestyle Pork Belly'],
['Rolada Schabowa Swojska','Homestyle Pork Loin Roulade'],
['Kiełbasa Podsuszano Swojska','Homestyle Semi-Dry Sausage'],
['Szynka Płaska Swojska','Homestyle Flat Ham'],
['Schab Swojski','Homestyle Pork Loin'],
['Szynka Swojska','Homestyle Ham'],
['Szynkowa Gruba Swojska','Homestyle Thick Ham Sausage']
]

function imgFor(id){
  return `/images/${String(id).padStart(2,'0')}.jpg`
}

export default function Home(){
  const supabase=useMemo(()=>createClient(),[])
  const [products,setProducts]=useState([])
  const [q,setQ]=useState('')
  const [lang,setLang]=useState('pl')
  const [cart,setCart]=useState([])
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      setUser(user)

      const {data}=await supabase
        .from('products')
        .select('*')
        .eq('active',true)
        .order('sort_order')

      if(data?.length){
        setProducts(data)
      }else{
        setProducts(
          fallback.map((x,i)=>({
            id:i+1,
            name_pl:x[0],
            name_en:x[1],
            price:null,
            currency:'GBP',
            unit:'kg',
            active:true
          }))
        )
      }

      setLoading(false)
    })()
  },[supabase])

  useEffect(()=>{
    const raw=localStorage.getItem('pt-cart')
    if(raw){
      try{
        setCart(JSON.parse(raw))
      }catch{}
    }
  },[])

  useEffect(()=>{
    localStorage.setItem('pt-cart',JSON.stringify(cart))
  },[cart])

  const filtered=products.filter(
    p=>(p.name_pl+' '+p.name_en).toLowerCase().includes(q.toLowerCase())
  )

  const add=(p,qty,unit)=>{
    qty=Math.max(1,Math.round(Number(qty)||1))

    setCart(c=>{
      const i=c.findIndex(x=>x.id===p.id&&x.unit===unit)

      if(i>=0){
        const n=[...c]
        n[i]={...n[i],qty:n[i].qty+qty}
        return n
      }

      return [...c,{...p,qty,unit}]
    })
  }

  const count=cart.reduce((s,x)=>s+x.qty,0)
  const total=cart.reduce((s,x)=>s+(Number(x.price)||0)*x.qty,0)

  return <>
    <header>
      <div className="top">
        <a href="/" className="brand">
          <img src="/images/logo.png" alt="Polska Tradycja"/>
        </a>

        <nav>
          <button onClick={()=>setLang(lang==='pl'?'en':'pl')}>
            PL / EN
          </button>

          {user ? <>
          <a className="btn" href="/konto">{lang==='pl'?'Konto':'Account'}</a>
         <a className="btn" href="/zamowienia">{lang==='pl'?'Zamówienia':'Orders'}</a>

            {user.email&&
              <button onClick={async()=>{
                await supabase.auth.signOut()
                location.reload()
              }}>
         {lang==='pl'?'Wyloguj':'Log out'}
              </button>
            }
          </> : <>
            <a className="btn" href="/login">{lang==='pl'?'Zaloguj':'Log in'}</a>
            <a className="primary btn" href="/rejestracja">{lang==='pl'?'Rejestracja':'Register'}</a>
          </>}

        <a className="primary btn" href="/zamowienia#koszyk">
  {lang==='pl'?'Koszyk':'Cart'} ({Math.round(count*100)/100})
</a>
        
        </nav>
      </div>
    </header>

    <main>
      <section className="hero">
        <div>
          <span className="eyebrow">POLSKA TRADYCJA</span>

          <h1>
            {lang==='pl'?'Oferta i zamówienia':'Products & orders'}
          </h1>

          <p>
            {lang==='pl'
              ?'Wybierz produkty, ilość i dodaj do koszyka.'
              :'Choose products, quantity and add to cart.'}
          </p>
        </div>
      </section>

      <div className="toolbar">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder={
            lang==='pl'
              ?'Szukaj produktu…'
              :'Search products…'
          }
        />

        <span className="count">
          {filtered.length} produktów
        </span>
      </div>

      {loading
        ? <div className="empty">Ładowanie oferty…</div>
        : <section className="products">
            {filtered.map(p=>
              <Product
                key={p.id}
                p={p}
                lang={lang}
                add={add}
              />
            )}
          </section>
      }
    </main>

    <footer>
      © POLSKA TRADYCJA · Zamówienia online
    </footer>
  </>
}

function Product({p,lang,add}){
  const weightPriced=p.unit==='kg'

  const [qty,setQty]=useState(1)

  const [unit,setUnit]=useState(
    weightPriced
      ? 'pcs'
      : (p.unit||'pcs')
  )

  return <article className="card">

    <div className="photo">
      <img
        src={p.image_url||imgFor(p.id)}
        onError={e=>{
          e.currentTarget.src='/images/logo.png'
        }}
        alt={p.name_pl}
      />
    </div>

    <div className="info">

      <div className="names">
        <div>
          <div className="namepl">
            {lang==='pl'?p.name_pl:p.name_en}
          </div>

          <div className="nameen">
            {lang==='pl'?p.name_en:p.name_pl}
          </div>
        </div>

        <span className="badge">
          {weightPriced
            ? (lang==='pl'?'szt.':'pcs')
            : unit}
        </span>
      </div>

      <p className="desc">
        {lang==='pl'
          ?(p.description_pl||'Tradycyjny produkt POLSKA TRADYCJA.')
          :(p.description_en||'Traditional POLSKA TRADYCJA product.')}
      </p>

      {weightPriced &&
        <div className="weight-note">
          {lang==='pl'
            ?'Cena za 1 kg. Produkt jest ważony przed wysyłką. Cena końcowa zależy od rzeczywistej wagi.'
            :'Price per 1 kg. The product is weighed before dispatch. Final price depends on the actual weight.'}
        </div>
      }

      <div className="row">

        <div className="price">
          {p.price!=null
            ?`£${Number(p.price).toFixed(2)}`
            :'Cena ustalana indywidualnie'}
          {' / '}
          {weightPriced?'kg':unit}
        </div>

        {!weightPriced &&
          <div>
            <select
              value={unit}
              onChange={e=>setUnit(e.target.value)}
            >
              <option value="kg">kg</option>
              <option value="pcs">pieces (pcs)</option>
            </select>
          </div>
        }

      </div>

      <div className="qtyrow">

        <input
          type="number"
          min="1"
          step="1"
          value={qty}
          onChange={e=>setQty(e.target.value)}
        />

        <span className="unit-label">
          {weightPriced
            ?(lang==='pl'?'szt.':'pcs')
            :unit}
        </span>

        <button
          className="primary add"
          onClick={()=>add(
            p,
            qty,
            weightPriced?'pcs':unit
          )}
        >
          {lang==='pl'
            ?'Dodaj do koszyka'
            :'Add to cart'}
        </button>

      </div>

    </div>
  </article>
}
