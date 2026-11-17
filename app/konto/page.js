'use client'
import {useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase-browser';

export default function Account(){
  const s=createClient();
  const [f,setF]=useState(null);
  const [msg,setMsg]=useState('');
  const [orders,setOrders]=useState([]);
  const [items,setItems]=useState([]);
  const [ordersMsg,setOrdersMsg]=useState('Ładowanie zamówień...');
  const [expanded,setExpanded]=useState(null);

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await s.auth.getUser();
      if(!user){location.href='/login';return}
      const [{data:profile},{data:customerOrders,error:ordersError}]=await Promise.all([
        s.from('profiles').select('*').eq('id',user.id).single(),
        s.from('orders').select('*').eq('user_id',user.id).order('created_at',{ascending:false})
      ]);
      setF(profile||{id:user.id,email:user.email});
      if(ordersError){
        setOrdersMsg('Nie udało się pobrać historii zamówień. Spróbuj ponownie później.');
        return;
      }
      const list=customerOrders||[];
      setOrders(list);
      if(!list.length){setOrdersMsg('Nie masz jeszcze żadnych zamówień.');return}
      const {data:orderItems,error:itemsError}=await s
        .from('order_items').select('*').in('order_id',list.map(o=>o.id));
      if(itemsError){
        setOrdersMsg('Nie udało się pobrać produktów z zamówień.');
        return;
      }
      setItems(orderItems||[]);
      setOrdersMsg('');
    })();
  },[]);

  if(!f)return <main className="auth"><p>Ładowanie…</p></main>;

  const save=async e=>{
    e.preventDefault();
    const {error}=await s.from('profiles').update({
      full_name:f.full_name,company:f.company,phone:f.phone,address:f.address
    }).eq('id',f.id);
    setMsg(error?error.message:'Zapisano.');
  };

  const statusLabel=status=>({
    new:'Nowe',
    processing:'W realizacji',
    dispatched:'Wysłane',
    completed:'Zrealizowane',
    cancelled:'Anulowane'
  }[String(status||'').toLowerCase()]||status||'—');

  const money=(value,currency)=>`${Number(value||0).toFixed(2)} ${currency||'GBP'}`;

  return <main className="auth" style={{maxWidth:'850px'}}>
    <a href="/"><img src="/images/logo.png" className="authlogo"/></a>
    <h1>Moje konto</h1>
    <form onSubmit={save} className="panel">
      <label>E-mail<input disabled value={f.email||''}/></label>
      <label>Imię i nazwisko<input value={f.full_name||''} onChange={e=>setF({...f,full_name:e.target.value})}/></label>
      <label>Firma<input value={f.company||''} onChange={e=>setF({...f,company:e.target.value})}/></label>
      <label>Telefon<input value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/></label>
      <label>Adres<input value={f.address||''} onChange={e=>setF({...f,address:e.target.value})}/></label>
      <button className="primary btnfull">Zapisz</button>
      {msg&&<p className="notice">{msg}</p>}
    </form>

    <section className="panel" style={{marginTop:'24px'}}>
      <h2>📦 Moje zamówienia</h2>
      <p>Historia Twoich zakupów w POLSKA TRADYCJA.</p>
      {ordersMsg&&<p>{ordersMsg}</p>}
      {orders.map(order=>{
        const orderProducts=items.filter(item=>item.order_id===order.id);
        const isOpen=expanded===order.id;
        return <article key={order.id} style={{
          border:'1px solid #dfd5c9',borderRadius:'12px',padding:'14px',
          marginTop:'12px',background:'#fffdf9'
        }}>
          <div style={{display:'flex',justifyContent:'space-between',gap:'12px',flexWrap:'wrap',alignItems:'center'}}>
            <div>
              <strong>Zamówienie #{order.order_number||order.id}</strong>
              <div style={{fontSize:'14px',color:'#75685e',marginTop:'4px'}}>
                {new Date(order.created_at).toLocaleString('pl-PL')}
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <strong>{money(order.total,order.currency)}</strong>
              <div style={{fontSize:'14px',marginTop:'4px'}}>{statusLabel(order.status)}</div>
            </div>
          </div>
          <button type="button" className="primary" style={{marginTop:'12px'}}
            onClick={()=>setExpanded(isOpen?null:order.id)}>
            {isOpen?'Ukryj szczegóły':'Pokaż szczegóły'}
          </button>
          {isOpen&&<div style={{marginTop:'14px',borderTop:'1px solid #e8ded4',paddingTop:'12px'}}>
            <h3>Produkty</h3>
            {orderProducts.length?orderProducts.map(item=><div key={item.id||item.product_id} style={{
              display:'flex',justifyContent:'space-between',gap:'12px',padding:'7px 0',
              borderBottom:'1px solid #eee6df'
            }}>
              <span>{item.product_name_pl||item.product_name_en||'Produkt'} — {item.quantity} {item.unit}</span>
              <strong>{money(item.line_total,order.currency)}</strong>
            </div>):<p>Brak pozycji do wyświetlenia.</p>}
            <p><b>Telefon:</b> {order.phone||'—'}</p>
            <p><b>Adres dostawy:</b> {order.delivery_address||'—'}</p>
            <p><b>Uwagi:</b> {order.notes||'Brak'}</p>
            <p><b>Łączna wartość:</b> {money(order.total,order.currency)}</p>
          </div>}
        </article>
      })}
    </section>
    <a href="/">← Wróć do oferty</a>
  </main>;
}
