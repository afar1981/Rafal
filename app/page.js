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

function getDeliverySchedule(){
  const now=new Date()
  const day=now.getDay()
  const afterCutoff=day===6 && (
    now.getHours()>15 ||
    (now.getHours()===15 && now.getMinutes()>0) ||
    (now.getHours()===15 && now.getMinutes()===0 && now.getSeconds()>0)
  )

  let daysToCutoff=(6-day+7)%7
  if(day===6 && afterCutoff) daysToCutoff=7

  const cutoff=new Date(now)
  cutoff.setHours(0,0,0,0)
  cutoff.setDate(cutoff.getDate()+daysToCutoff)

  const deliveryStart=new Date(cutoff)
  deliveryStart.setDate(deliveryStart.getDate()+9)

  const deliveryEnd=new Date(deliveryStart)
  deliveryEnd.setDate(deliveryEnd.getDate()+3)

  const formatDate=(date,language)=>{
    return new Intl.DateTimeFormat(language==='pl'?'pl-PL':'en-GB',{
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    }).format(date)
  }

  return {
    cutoff,
    deliveryStart,
    deliveryEnd,
    cutoffText:formatDate(cutoff,'pl'),
    cutoffTextEn:formatDate(cutoff,'en'),
    deliveryStartText:formatDate(deliveryStart,'pl'),
    deliveryStartTextEn:formatDate(deliveryStart,'en'),
    deliveryEndText:formatDate(deliveryEnd,'pl'),
    deliveryEndTextEn:formatDate(deliveryEnd,'en')
  }
}

export default function Home(){
  const supabase=useMemo(()=>createClient(),[])
  const [products,setProducts]=useState([])
  const [q,setQ]=useState('')
  const [category,setCategory]=useState('ALL')
  const [lang,setLang]=useState(()=>typeof window!=='undefined'?(localStorage.getItem('pt-lang')||'pl'):'pl')
  const [cart,setCart]=useState([])
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
useEffect(()=>{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js')
      .catch(()=>{})
  }
},[])
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

 const today=new Date().toISOString().slice(0,10)

const filtered=products.filter(p=>
  (category==='ALL' || p.category===category) &&
  (p.name_pl+' '+p.name_en).toLowerCase().includes(q.toLowerCase())
)

const getProductGroup = (p) => {
  const name = (p.name_pl || '').trim().toUpperCase()

  if (name.startsWith('KR ')) return 3
  if (name.startsWith('M ')) return 1
  if (name.startsWith('K ')) return 2
  if (name.startsWith('P ')) return 4
  if (name.startsWith('B ')) return 5

  return 99
}

const ordered=[...filtered].sort((a,b)=>{
  const ap=a.is_promotion &&
    (!a.promotion_from || a.promotion_from<=today) &&
    (!a.promotion_to || a.promotion_to>=today)

  const bp=b.is_promotion &&
    (!b.promotion_from || b.promotion_from<=today) &&
    (!b.promotion_to || b.promotion_to>=today)

  // Promocje zawsze pierwsze
  if (Number(bp) !== Number(ap)) {
    return Number(bp)-Number(ap)
  }

  // Pozostałe produkty grupujemy po skrócie
  const groupA = getProductGroup(a)
  const groupB = getProductGroup(b)

  if (groupA !== groupB) {
    return groupA - groupB
  }

  // W obrębie grupy zachowujemy obecne sort_order
  return Number(a.sort_order || 0) - Number(b.sort_order || 0)
})

const promotionCount=ordered.filter(p=>
  p.is_promotion &&
  (!p.promotion_from || p.promotion_from<=today) &&
  (!p.promotion_to || p.promotion_to>=today)
).length
const activePromotions=products.filter(p=>
  p.is_promotion &&
  (!p.promotion_from || p.promotion_from<=today) &&
  (!p.promotion_to || p.promotion_to>=today)
).slice(0,4)
 const goToProduct = (id) => {
    setCategory('ALL')
    setQ('')

    setTimeout(() => {
      const element = document.getElementById(`product-${id}`)
      if (element) {
        element.scrollIntoView({ behavior:'smooth', block:'center' })
        element.style.outline='4px solid #d71920'
        element.style.outlineOffset='6px'
        element.style.transition='outline 0.2s ease'
        setTimeout(() => {
          element.style.outline=''
          element.style.outlineOffset=''
        }, 2200)
      }
    }, 80)
  }

 const add=(p,qty,unit)=>{
  qty=Math.max(1,Math.round(Number(qty)||1))

  const today=new Date().toISOString().slice(0,10)

  const promotionActive =
    p.is_promotion &&
    (!p.promotion_from || p.promotion_from<=today) &&
    (!p.promotion_to || p.promotion_to>=today) &&
    p.promotion_price != null

  const cartPrice = promotionActive
    ? Number(p.promotion_price)
    : Number(p.price)||0

  setCart(c=>{
    const i=c.findIndex(x=>x.id===p.id&&x.unit===unit)

    if(i>=0){
      const n=[...c]
      n[i]={
        ...n[i],
        qty:n[i].qty+qty,
        price:cartPrice
      }
      return n
    }

    return [
      ...c,
      {
        ...p,
        qty,
        unit,
        price:cartPrice
      }
    ]
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
<button onClick={()=>{
  const newLang=lang==='pl'?'en':'pl';
  setLang(newLang);
  localStorage.setItem('pt-lang',newLang);
}}>
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

        <a className="btn" href="#kontakt">
  {lang==='pl'?'Kontakt':'Contact'}
</a>

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
            {lang==='pl'?'Oferta & Zamówienia':'Products & Orders'}
          </h1>

          <p>
            {lang==='pl'
              ?'Wybierz produkty, ilość i dodaj do koszyka.'
              :'Choose products, quantity and add to cart.'}
          </p>

          {(() => {
            const schedule=getDeliverySchedule()
            return (
              <div style={{
                marginTop:'18px',
                padding:'14px 18px',
                border:'3px solid #d71920',
                borderRadius:'14px',
                background:'#6b3f2a',
                color:'#fff',
                boxShadow:'0 5px 14px rgba(107,63,42,0.25)',
                fontWeight:'700',
                fontSize:'15px',
                lineHeight:'1.6',
                textAlign:'center'
              }}>
                🚚 {lang==='pl'
                  ? <>Najbliższa dostawa: <b>{schedule.deliveryStartText} – {schedule.deliveryEndText}</b><br/>📅 Zamów do: <b>soboty {schedule.cutoffText}, godz. 15:00</b></>
                  : <>Next delivery: <b>{schedule.deliveryStartTextEn} – {schedule.deliveryEndTextEn}</b><br/>📅 Order by: <b>Saturday {schedule.cutoffTextEn}, 3:00 PM</b></>}
              </div>
            )
          })()}
        </div>
      </section>
    
{activePromotions.length > 0 && (
 <section style={{
  margin:'18px 0',
  padding:'14px',
  border:'2px solid #d71920',
  borderRadius:'16px',
  background:'#fff7f7',
  position:'relative',
  overflow:'hidden'
}}>
  <div className="promo-percent-bg" aria-hidden="true">
  %　　%　　　%　　　%　　　%　　　%　　　%　　　%　　　%
　　%　　　%　　　%　　　%　　　%　　　%　　　%　　　%
%　　　%　　　%　　　%　　　%　　　%　　　%　　　%　　　%
　　%　　　%　　　%　　　%　　　%　　　%　　　%　　　%
</div>
    <div className="promo-title-wrap">
  <div className="promo-title">
   🔥 🔥 🔥 {lang==='pl'?'PROMOCJE 🔥 🔥 PROMOCJE 🔥 🔥 PROMOCJE🔥 🔥PROMOCJE🔥 🔥 PROMOCJE🔥 🔥  PROMOCJE 🔥 🔥 PROMOCJE🔥  🔥 PROMOCJE🔥 🔥  PROMOCJE 🔥 🔥 PROMOCJE🔥  ':'SPECIAL OFFERS🔥 🔥 SPECIAL OFFERS🔥 🔥 SPECIAL OFFERS 🔥 🔥 SPECIAL OFFERS 🔥 🔥  SPECIAL OFFERS 🔥 🔥 SPECIAL OFFERS '} 🔥🔥
  </div>
</div>

    <div style={{
      display:'grid',
     gridTemplateColumns:'repeat(auto-fit,minmax(240px,320px))',
justifyContent:'center',
      gap:'10px'
    }}>
      {activePromotions.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={()=>goToProduct(p.id)}
          style={{
            display:'flex',
            alignItems:'center',
            gap:'10px',
            padding:'10px',
            background:'#fff',
            borderRadius:'12px',
            border:'1px solid #f0caca',
            cursor:'pointer',
            textAlign:'left',
            width:'100%'
          }}
        >
          <img
            src={p.image_url || imgFor(p.id)}
            alt={p.name_pl}
            style={{
              width:'58px',
              height:'58px',
              objectFit:'cover',
              borderRadius:'9px'
            }}
          />

          <div>
            <div style={{fontWeight:'800'}}>
              {lang==='pl' ? p.name_pl : p.name_en}
            </div>

            {p.promotion_price != null && (
              <div style={{
                fontWeight:'800',
                color:'#d71920'
              }}>
                £{Number(p.promotion_price).toFixed(2)} / kg
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  </section>
)}
     <div style={{
      marginTop:'14px',
      textAlign:'center',
      fontSize:'15px',
      fontWeight:'700',
      color:'#7a1f1f'
    }}>
      🔥 {lang==='pl'
        ? 'Skorzystaj z promocji! Minimalna wartość zamówienia produktów promocyjnych wynosi £50.00.'
        : 'Take advantage of our promotions! The minimum order value for promotional products is £50.00.'}🔥
    </div> 
      <div style={{
        margin:'18px 0 12px',
        background:'#6b3f2a',
        borderRadius:'12px',
        padding:'8px',
        overflowX:'auto',
        whiteSpace:'nowrap',
        WebkitOverflowScrolling:'touch'
      }}>
        <div style={{display:'flex',gap:'6px',width:'max-content'}}>
          {[
            ['ALL','WSZYSTKIE','ALL'],
            ['KIEŁBASY','KIEŁBASY','SAUSAGES'],
            ['SZYNKI','SZYNKI','HAMS'],
            ['BALERONY','BALERONY','PORK NECKS'],
            ['SCHABY','SCHABY','PORK LOINS'],
            ['POLĘDWICZKI','POLĘDWICZKI','TENDERLOINS'],
            ['ŻEBERKA','ŻEBERKA','RIBS'],
            ['WĘDZONKI','WĘDZONKI','SMOKED MEATS'],
            ['BOCZKI','BOCZKI','BACON'],
            ['KASZANKI','KASZANKI','BLOOD SAUSAGES'],
            ['SALCESONY','SALCESONY','HEAD CHEESE'],
            ['PASZTETY','PASZTETY','PÂTÉS'],
            ['JAJKA','JAJKA','EGGS'],
            ['OSCYPKI','OSCYPKI','OSCYPEK CHEESE']
          ].map(([value,pl,en])=>
            <button
              key={value}
              type="button"
              onClick={()=>setCategory(value)}
              style={{
                border:'1px solid rgba(255,255,255,0.7)',
                borderRadius:'9px',
                padding:'9px 13px',
                background:category===value?'#fff':'transparent',
                color:category===value?'#d71920':'#fff',
                fontWeight:'800',
                fontSize:'13px',
                cursor:'pointer'
              }}
            >
              {lang==='pl'?pl:en}
            </button>
          )}
        </div>
      </div>

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
            {ordered.map(p=>
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

    <section id="kontakt" style={{
      maxWidth:'1180px',
      margin:'30px auto 0',
      padding:'0 16px 20px'
    }}>
      <div style={{
        padding:'18px',
        border:'2px solid #d71920',
        borderRadius:'14px',
        background:'#6b3f2a',
        color:'#fff',
        textAlign:'center'
      }}>
        <div style={{fontSize:'20px',fontWeight:'800',marginBottom:'8px'}}>
          📞 {lang==='pl'?'KONTAKT':'CONTACT'}
        </div>
        <div>
          📧 <a href="mailto:polskatradycja.orders@gmail.com" style={{color:'#fff',fontWeight:'800',textDecoration:'underline'}}>
            polskatradycja.orders@gmail.com
          </a>
        </div>
        <div style={{marginTop:'6px'}}>
          📱 <a href="tel:+447440613008" style={{color:'#fff',fontWeight:'800',textDecoration:'underline'}}>
            +44 7440 613008
          </a>
        </div>
      </div>
    </section>

    <footer>
      © POLSKA TRADYCJA · Zamówienia online
    </footer>
  </>
}

function LeafFall(){
  const leaves=Array.from({length:16});

  return <>
    <style>{`.autumn-leaves{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:9999}.autumn-leaf{position:absolute;top:-45px;width:18px;height:24px;opacity:.78;animation:autumnFall linear infinite;will-change:transform;background:#8b5a2b;clip-path:polygon(50% 0%,62% 14%,78% 10%,72% 27%,92% 35%,76% 43%,88% 58%,67% 58%,72% 77%,56% 70%,50% 100%,44% 70%,28% 77%,33% 58%,12% 58%,24% 43%,8% 35%,28% 27%,22% 10%,38% 14%)}.autumn-leaf::after{content:"";position:absolute;left:48%;top:18%;width:2px;height:68%;background:rgba(255,255,255,.35);transform:rotate(8deg);border-radius:2px}.autumn-leaf:nth-child(even){background:#c49a3a}.autumn-leaf:nth-child(3n){background:#a86f2d}.autumn-leaf:nth-child(1){left:4%;animation-duration:9s;animation-delay:-2s}.autumn-leaf:nth-child(2){left:11%;animation-duration:12s;animation-delay:-7s}.autumn-leaf:nth-child(3){left:18%;animation-duration:10s;animation-delay:-4s}.autumn-leaf:nth-child(4){left:27%;animation-duration:14s;animation-delay:-9s}.autumn-leaf:nth-child(5){left:35%;animation-duration:11s;animation-delay:-1s}.autumn-leaf:nth-child(6){left:43%;animation-duration:13s;animation-delay:-6s}.autumn-leaf:nth-child(7){left:51%;animation-duration:9s;animation-delay:-5s}.autumn-leaf:nth-child(8){left:59%;animation-duration:12s;animation-delay:-8s}.autumn-leaf:nth-child(9){left:67%;animation-duration:10s;animation-delay:-3s}.autumn-leaf:nth-child(10){left:75%;animation-duration:14s;animation-delay:-10s}.autumn-leaf:nth-child(11){left:83%;animation-duration:11s;animation-delay:-7s}.autumn-leaf:nth-child(12){left:91%;animation-duration:13s;animation-delay:-2s}.autumn-leaf:nth-child(13){left:15%;animation-duration:15s;animation-delay:-11s}.autumn-leaf:nth-child(14){left:31%;animation-duration:15s;animation-delay:-12s}.autumn-leaf:nth-child(15){left:64%;animation-duration:12s;animation-delay:-9s}.autumn-leaf:nth-child(16){left:88%;animation-duration:16s;animation-delay:-13s}@keyframes autumnFall{0%{transform:translate3d(0,-45px,0) rotate(0deg)}25%{transform:translate3d(42px,25vh,0) rotate(115deg)}50%{transform:translate3d(-35px,50vh,0) rotate(230deg)}75%{transform:translate3d(45px,75vh,0) rotate(320deg)}100%{transform:translate3d(-25px,110vh,0) rotate(420deg)}}@media(max-width:600px){.autumn-leaf{width:14px;height:19px;opacity:.62}}`}</style>
    <div className="autumn-leaves" aria-hidden="true">
      {leaves.map((_,i)=><span className="autumn-leaf" key={i}/>)}
    </div>
  </>
}

function Product({p,lang,add}){
  const weightPriced=p.unit==='kg'

  const [qty,setQty]=useState(1)
const [added,setAdded]=useState(false)
  const [unit,setUnit]=useState(
    weightPriced
      ? 'pcs'
      : (p.unit||'pcs')
  )

  return <article id={`product-${p.id}`} className="card">

    <div className="photo">
      <img
        src={p.image_url||imgFor(p.id)}
        onError={e=>{
          e.currentTarget.src='/images/logo.png'
        }}
        alt={p.name_pl}
        draggable={false}
        onContextMenu={e=>e.preventDefault()}
        style={{userSelect:'none',WebkitUserDrag:'none'}}
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
{p.is_promotion && (
  <div style={{
    marginTop:'14px',
    marginBottom:'12px',
    padding:'12px 14px',
    border:'2px solid #e53935',
    borderRadius:'12px',
    background:'#fff1f1',
    textAlign:'center'
  }}>
    <div style={{
      fontSize:'20px',
      fontWeight:'800',
      color:'#d71920',
      letterSpacing:'0.5px'
    }}>
    🔥🔥 {lang === 'pl' ? 'PROMOCJA' : 'SPECIAL OFFER'} 🔥🔥
    </div>

    {p.promotion_from && p.promotion_to && (
      <div style={{
        marginTop:'6px',
        fontSize:'14px',
        fontWeight:'700',
        color:'#b71c1c'
      }}>
        📅 {lang === 'pl' ? 'Od' : 'From'}{' '}
        {p.promotion_from.split('-').reverse().join('.')}
        {' '}
        {lang === 'pl' ? 'do' : 'to'}{' '}
        {p.promotion_to.split('-').reverse().join('.')}
      </div>
    )}
  </div>
)}
{weightPriced &&
        <div className="weight-note">
          {lang==='pl'
            ?'Cena za 1 kg. Produkt jest ważony przed wysyłką. Cena końcowa zależy od rzeczywistej wagi.'
            :'Price per 1 kg. The product is weighed before dispatch. Final price depends on the actual weight.'}
        </div>
      }

      <div className="row">

     <div className="price">
  {p.is_promotion && p.promotion_price != null ? (
    <>
      <span style={{textDecoration:'line-through', fontSize:'0.9em', opacity:0.6}}>
        {p.price != null
          ? `£${Number(p.price).toFixed(2)}`
          : 'Cena ustalana indywidualnie'}
      </span>
      <br />
      <span style={{color:'red', fontSize:'1.35em', fontWeight:'700'}}>
        £{Number(p.promotion_price).toFixed(2)}
      </span>
    </>
  ) : (
    p.price != null
      ? `£${Number(p.price).toFixed(2)}`
      : 'Cena ustalana indywidualnie'
  )}
  {' / '}
  {weightPriced ? 'kg' : unit}
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
  onClick={()=>{
    add(
      p,
      qty,
      weightPriced?'pcs':unit
    )

    setAdded(true)

    setTimeout(()=>{
      setAdded(false)
    },2500)
  }}
  style={{
    transition:'all 0.2s ease',
    transform:added?'scale(1.05)':'scale(1)'
  }}
>
  {added
    ? (lang==='pl' ? '✅ Dodano do koszyka' : '✅ Added to cart')
    : (lang==='pl' ? 'Dodaj do koszyka' : 'Add to cart')}
</button>

      </div>

    </div>
  </article>
}
