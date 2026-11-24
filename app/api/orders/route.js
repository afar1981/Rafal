import {NextResponse} from 'next/server';
import {createClient} from '../../../lib/supabase-server';
import {Resend} from 'resend';

export async function POST(req){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();

    if(!user)
      return NextResponse.json({error:'Musisz być zalogowany.'},{status:401});

    const body=await req.json();

    if(!body.items?.length)
      return NextResponse.json({error:'Koszyk jest pusty.'},{status:400});
const {data:orderNumberData,error:numberError}=await supabase
  .rpc('next_order_number');

if(numberError) throw numberError;

const orderNumber=orderNumberData.order_number;
const orderWeek=orderNumberData.order_week;
    const {data:order,error}=await supabase
      .from('orders')
      .insert({
        user_id:user.id,
        customer_name:body.customer_name,
        company:body.company,
        email:body.email,
        phone:body.phone,
        delivery_address:body.delivery_address,
        notes:body.notes,
        total:body.total,
        currency:body.currency,
        status:'new',
        order_number:orderNumber,
        order_week:orderWeek
      })
.select('id, order_number')
      .single();

    if(error) throw error;

    const items=body.items.map(i=>({
      order_id:order.id,
      product_id:i.product_id,
      product_name_pl:i.name_pl,
      product_name_en:i.name_en,
      quantity:i.quantity,
      unit:i.unit,
      price:i.price,
      line_total:i.line_total
    }));

    const {error:itemError}=await supabase
      .from('order_items')
      .insert(items);

    if(itemError) throw itemError;

    // Read current promotion settings so the internal order email can
    // clearly flag only products actually ordered at their active promo price.
    const productIds=[...new Set(body.items.map(i=>i.product_id).filter(Boolean))];
    let promotionById=new Map();
    if(productIds.length){
      const {data:promotionProducts}=await supabase
        .from('products')
        .select('id, price, promotion_price, is_promotion, promotion_from, promotion_to')
        .in('id',productIds);

      const today=new Date().toISOString().slice(0,10);
      promotionById=new Map((promotionProducts||[]).map(p=>{
        const active=!!p.is_promotion &&
          (!p.promotion_from || p.promotion_from<=today) &&
          (!p.promotion_to || p.promotion_to>=today) &&
          p.promotion_price!=null;
        return [String(p.id),{
          active,
          regularPrice:Number(p.price),
          promoPrice:Number(p.promotion_price)
        }];
      }));
    }

    if(
      process.env.RESEND_API_KEY &&
      process.env.ORDER_EMAIL_TO &&
      process.env.ORDER_EMAIL_FROM
    ){
      const resend=new Resend(process.env.RESEND_API_KEY);

      const html=`
        <h2>Nowe zamówienie POLSKA TRADYCJA</h2>

        <p>
          <b>Klient:</b> ${body.customer_name}<br>
          <b>Firma:</b> ${body.company||''}<br>
          <b>E-mail:</b> ${body.email}<br>
          <b>Telefon:</b> ${body.phone||''}<br>
          <b>Adres:</b> ${body.delivery_address||''}
        </p>

        <h3>Produkty</h3>

        <ul>
          ${body.items.map(i=>{
            const promotion=promotionById.get(String(i.product_id));
            const orderedAtPromo=promotion?.active &&
              Number(i.price).toFixed(2)===Number(promotion.promoPrice).toFixed(2);
            if(orderedAtPromo){
              return `
                <li style="list-style:none;margin:0 0 12px 0;padding:12px;border:2px solid #d71920;border-radius:8px;background:#fff1f1">
                  <div style="font-size:16px;font-weight:900;color:#d71920;margin-bottom:6px">🔥 PRODUKT W PROMOCJI 🔥</div>
                  <div style="font-weight:800;color:#222">${i.name_pl}</div>
                  <div style="margin-top:5px;color:#666;text-decoration:line-through">Cena regularna: £${Number(promotion.regularPrice).toFixed(2)} / ${i.unit}</div>
                  <div style="font-size:16px;font-weight:900;color:#d71920">CENA PROMOCYJNA: £${Number(i.price).toFixed(2)} / ${i.unit}</div>
                  <div style="margin-top:5px;color:#222">Ilość: ${i.quantity} ${i.unit} — wartość: ${Number(i.line_total||0).toFixed(2)} ${body.currency}</div>
                </li>
              `;
            }
            return `<li style="margin-bottom:6px">${i.name_pl} — ${i.quantity} ${i.unit} — ${Number(i.line_total||0).toFixed(2)} ${body.currency}</li>`;
          }).join('')}
        </ul>

        <p>
          <b>Razem: ${(body.total||0).toFixed(2)} ${body.currency}</b>
        </p>

        <p>Uwagi: ${body.notes||''}</p>
      `;

      await resend.emails.send({
        from:process.env.ORDER_EMAIL_FROM,
        to:process.env.ORDER_EMAIL_TO,
       subject:`Nowe zamówienie #${order.order_number}`,
        html
      });

     await resend.emails.send({
  from:process.env.ORDER_EMAIL_FROM,
  to:body.email,
  subject:body.language==='pl'
  ? `Potwierdzenie zamówienia #${order.order_number} – POLSKA TRADYCJA`
  : `Order confirmation #${order.order_number} – POLSKA TRADYCJA`,
  html:body.language==='pl'
    ? `
        <h2>Dziękujemy za złożenie zamówienia!</h2>
        <p>Otrzymaliśmy Twoje zamówienie <b>#${order.order_number}</b>.</p>
        <h3>Podsumowanie zamówienia</h3>
        <p>
          <b>Klient:</b> ${body.customer_name}<br>
          <b>E-mail:</b> ${body.email}<br>
          <b>Telefon:</b> ${body.phone||'—'}<br>
          <b>Adres dostawy:</b> ${body.delivery_address||'—'}
        </p>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;border-color:#ddd">
          <thead><tr><th align="left">Produkt</th><th>Ilość</th><th align="right">Cena</th><th align="right">Wartość</th></tr></thead>
          <tbody>
            ${body.items.map(i=>`<tr><td>${i.name_pl}</td><td align="center">${i.quantity} ${i.unit}</td><td align="right">${Number(i.price||0).toFixed(2)} ${body.currency}</td><td align="right">${Number(i.line_total||0).toFixed(2)} ${body.currency}</td></tr>`).join('')}
          </tbody>
        </table>
        <p style="font-size:18px"><b>Razem: ${(body.total||0).toFixed(2)} ${body.currency}</b></p>
        <p><b>Uwagi do zamówienia:</b><br>${body.notes||'Brak'}</p>
        <p>Wszystkie nasze produkty są sprzedawane na wagę i <b>każdy produkt jest ważony przed wysyłką</b>. Ostateczna cena może się nieznacznie różnić i zależy od rzeczywistej wagi produktów.</p>
        <p>Twoje zamówienie zostanie teraz przygotowane do realizacji. W razie potrzeby skontaktujemy się z Tobą.</p>
        <p><b>POLSKA TRADYCJA</b><br>Dziękujemy za zakupy!</p>
      `
    : `
        <h2>Thank you for placing your order!</h2>
        <p>We have received your order <b>#${order.order_number}</b>.</p>
        <h3>Order summary</h3>
        <p>
          <b>Customer:</b> ${body.customer_name}<br>
          <b>Email:</b> ${body.email}<br>
          <b>Phone:</b> ${body.phone||'—'}<br>
          <b>Delivery address:</b> ${body.delivery_address||'—'}
        </p>
        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;border-color:#ddd">
          <thead><tr><th align="left">Product</th><th>Quantity</th><th align="right">Price</th><th align="right">Line total</th></tr></thead>
          <tbody>
            ${body.items.map(i=>`<tr><td>${i.name_en}</td><td align="center">${i.quantity} ${i.unit}</td><td align="right">${Number(i.price||0).toFixed(2)} ${body.currency}</td><td align="right">${Number(i.line_total||0).toFixed(2)} ${body.currency}</td></tr>`).join('')}
          </tbody>
        </table>
        <p style="font-size:18px"><b>Total: ${(body.total||0).toFixed(2)} ${body.currency}</b></p>
        <p><b>Order notes:</b><br>${body.notes||'None'}</p>
        <p>All our products are sold by weight and <b>each product is weighed before dispatch</b>. The final price may vary slightly and will depend on the actual weight of the products.</p>
        <p>Your order will now be prepared for processing. If necessary, we will contact you.</p>
        <p><b>POLSKA TRADYCJA</b><br>Thank you for shopping with us!</p>
      `
});
    }

   return NextResponse.json({
  order_id:order.id,
  order_number:order.order_number
});

  }catch(e){
    return NextResponse.json(
      {error:e.message||'Błąd serwera'},
      {status:500}
    );
  }
}
