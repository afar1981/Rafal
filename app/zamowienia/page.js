'use client'
import {useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase-browser';

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

    <div className="panel">
      {cart.map((x,i)=>
        <div className="cartline" key={i}>
          <div>
            <b>{x.name_pl}</b>
            <div className="small">{x.name_en} · {x.qty} {x.unit}</div>
          </div>
          <div>
            <b>{((Number(x.price)||0)*x.qty).toFixed(2)} £</b>
            <button onClick={()=>remove(i)}>{lang==='pl'?'Usuń':'Remove'}</button>
          </div>
        </div>
      )}

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
