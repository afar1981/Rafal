'use client'
import {useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase-browser';

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

export default function Orders(){
  const s=createClient();
  const [cart,setCart]=useState([]);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState({});
  const [msg,setMsg]=useState('');
  const [sending,setSending]=useState(false);
  const [lang,setLang]=useState('pl');

  useEffect(()=>{
    const savedLang=localStorage.getItem('pt-lang');
if(savedLang==='en'||savedLang==='pl')setLang(savedLang);
    
    const raw=localStorage.getItem('pt-cart');
    if(raw)try{setCart(JSON.parse(raw))}catch{}
    ;(async()=>{
      const {data:{user}}=await s.auth.getUser();
      if(!user){location.href='/login';return}
      setUser(user);
      const {data}=await s.from('profiles').select('*').eq('id',user.id).single();
      if(data)setProfile(data)
    })()
  },[]);

  useEffect(()=>{
    localStorage.setItem('pt-cart',JSON.stringify(cart))
  },[cart]);

  const total=cart.reduce((a,x)=>a+(Number(x.price)||0)*Number(x.qty),0);
  const remove=i=>setCart(c=>c.filter((_,n)=>n!==i));
const changeQty=(i,delta)=>{
  setCart(c=>c.map((x,n)=>{
    if(n!==i) return x

    const newQty=Math.max(1,Number(x.qty)+delta)

    return {
      ...x,
      qty:newQty
    }
  }))
}
  const submit=async e=>{
    e.preventDefault();
    if(!cart.length){
  setMsg(lang==='pl'?'Koszyk jest pusty.':'Cart is empty.');
  return
}
    setSending(true);
    setMsg('');

    const payload={
      language: lang,
      customer_name:profile.full_name||user.email,
      company:profile.company||'',
      email:user.email,
      phone:profile.phone||'',
      delivery_address:profile.address||'',
      notes:e.currentTarget.notes.value,
      total,
      currency:'GBP',
      items:cart.map(x=>({
        product_id:x.id,
        name_pl:x.name_pl,
        name_en:x.name_en,
        quantity:Number(x.qty),
        unit:x.unit,
        price:Number(x.price)||0,
        line_total:(Number(x.price)||0)*Number(x.qty)
      }))
    };

    const r=await fetch('/api/orders',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });

    const data=await r.json();
    setSending(false);

if(!r.ok){
  setMsg(data.error||'Nie udało się złożyć zamówienia.');
  return
}

setCart([]);
setMsg(lang==='pl'?'Zamówienie zostało złożone.':'Your order has been placed.')
  };

  return <main className="auth wide">
    <a href="/"><img src="/images/logo.png" className="authlogo"/></a>
<h1>{lang==='pl'?'Podsumowanie zamówienia':'Order summary'}</h1>

    {(() => {
      const schedule=getDeliverySchedule()
      return (
        <div style={{
          marginBottom:'16px',
          padding:'14px 16px',
          border:'2px solid #6b3f2a',
          borderRadius:'12px',
          background:'#fffaf5',
          color:'#4f4540',
          fontWeight:'700',
          fontSize:'14px',
          lineHeight:'1.5'
        }}>
          🚚 {lang==='pl'
            ? <>Najbliższa dostawa: <b>{schedule.deliveryStartText} – {schedule.deliveryEndText}</b><br/>📅 Zamów do: <b>soboty {schedule.cutoffText}, godz. 15:00</b></>
            : <>Next delivery: <b>{schedule.deliveryStartTextEn} – {schedule.deliveryEndTextEn}</b><br/>📅 Order by: <b>Saturday {schedule.cutoffTextEn}, 3:00 PM</b></>}
        </div>
      )
    })()}

    <div className="panel">
      {cart.map((x,i)=>
        <div className="cartline" key={i}>
         <div>
  <b>{lang==='pl' ? x.name_pl : x.name_en}</b>

  {x.is_promotion &&
    (!x.promotion_from || x.promotion_from <= new Date().toISOString().slice(0,10)) &&
    (!x.promotion_to || x.promotion_to >= new Date().toISOString().slice(0,10)) && (
      <div style={{
        marginTop:'4px',
        color:'#d71920',
        fontWeight:'800',
        fontSize:'13px'
      }}>
        🔥 {lang==='pl' ? 'PROMOCJA' : 'SPECIAL OFFER'}:
        {' '}
        {x.promotion_from
          ? x.promotion_from.split('-').reverse().join('.')
          : ''}
        {' '}
        – {' '}
        {x.promotion_to
          ? x.promotion_to.split('-').reverse().join('.')
          : ''}
      </div>
    )}

  <div className="small">
  {lang==='pl' ? x.name_en : x.name_pl}
</div>

<div style={{
  display:'flex',
  alignItems:'center',
  gap:'8px',
  marginTop:'7px'
}}>
  <button
    type="button"
    onClick={()=>changeQty(i,-1)}
    style={{
      width:'30px',
      height:'30px',
      padding:0,
      fontSize:'18px',
      fontWeight:'700'
    }}
  >
    −
  </button>

  <b style={{
    minWidth:'55px',
    textAlign:'center'
  }}>
    {x.qty} {x.unit}
  </b>

  <button
    type="button"
    onClick={()=>changeQty(i,1)}
    style={{
      width:'30px',
      height:'30px',
      padding:0,
      fontSize:'18px',
      fontWeight:'700'
    }}
  >
    +
  </button>
</div>
</div>
          <div>
            <b>{((Number(x.price)||0)*x.qty).toFixed(2)} £</b>
            <button onClick={()=>remove(i)}>{lang==='pl'?'Usuń':'Remove'}</button>
          </div>
        </div>
      )}
<div style={{
  marginTop:'18px',
  marginBottom:'14px',
  padding:'14px 16px',
  border:'2px solid #d71920',
  borderRadius:'12px',
  background:'#fff1f1',
  fontSize:'13px',
  lineHeight:'1.5',
  color:'#4f4540'
}}>
  <div style={{
    color:'#d71920',
    fontSize:'15px',
    fontWeight:'800',
    marginBottom:'6px'
  }}>
    {lang==='pl'
      ?'📌 WAŻNA INFORMACJA – PRODUKTY NA WAGĘ'
      :'📌 IMPORTANT INFORMATION – PRODUCTS SOLD BY WEIGHT'}
  </div>

  <div>
    {lang==='pl'
      ?'Produkty są ważone przed wysyłką. Podana cena jest ceną za 1 kg produktu, natomiast zamówienie składane jest w sztukach. Ostateczna cena zostanie wyliczona na podstawie rzeczywistej wagi przygotowanego produktu.'
      :'Products are weighed before dispatch. The displayed price is the price per 1 kg, while orders are placed by number of pieces. The final price will be calculated based on the actual weight of the prepared product.'}
  </div>
</div>
     <div className="grand">{lang==='pl'?'Razem:':'Total:'} {total.toFixed(2)} £</div>

      <form onSubmit={submit}>
        <label>
    {lang==='pl'?'Uwagi do zamówienia':'Order notes'}
          <textarea name="notes" placeholder={lang==='pl'?'Np. termin dostawy, dodatkowe informacje…':'E.g. delivery date, additional information…'} />
        </label>

        <button disabled={sending||!cart.length} className="primary btnfull">
{sending
  ?(lang==='pl'?'Wysyłanie…':'Sending…')
  :(lang==='pl'?'Złóż zamówienie':'Place order')}
        </button>
      </form>

      {msg&&<p className="notice">{msg}</p>}
    <a href="/">{lang==='pl'?'← Wróć do oferty':'← Back to products'}</a>
    </div>
  </main>
}
