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
      .select('id')
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
          ${body.items.map(i=>`
            <li>
              ${i.name_pl} — ${i.quantity} ${i.unit} —
              ${(i.line_total||0).toFixed(2)} ${body.currency}
            </li>
          `).join('')}
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

        <p>
          Otrzymaliśmy Twoje zamówienie
       <b>#${order.order_number}</b>
        </p>

        <p>
          <b>Wartość zamówienia:</b>
          ${(body.total||0).toFixed(2)} ${body.currency}
        </p>

        <p>
          Wszystkie nasze produkty są sprzedawane na wagę i
          <b>każdy produkt jest ważony przed wysyłką</b>.
          Ostateczna cena zamówienia może się nieznacznie różnić
          od kwoty podanej przy składaniu zamówienia i zależy od
          rzeczywistej wagi produktów.
        </p>

        <p>
          Twoje zamówienie zostanie teraz przygotowane do realizacji.
        </p>

        <p>
          W razie potrzeby skontaktujemy się z Tobą.
        </p>

        <p>
          <b>POLSKA TRADYCJA</b><br>
          Dziękujemy za zakupy!
        </p>
      `
    : `
        <h2>Thank you for placing your order!</h2>

        <p>
          We have received your order
      <b>#${order.order_number}</b>
        </p>

        <p>
          <b>Order total:</b>
          ${(body.total||0).toFixed(2)} ${body.currency}
        </p>

        <p>
          All our products are sold by weight and
          <b>each product is weighed before dispatch</b>.
          The final order total may vary slightly from the amount
          shown when placing the order and will depend on the
          actual weight of the products.
        </p>

        <p>
          Your order will now be prepared for processing.
        </p>

        <p>
          If necessary, we will contact you.
        </p>

        <p>
          <b>POLSKA TRADYCJA</b><br>
          Thank you for shopping with us!
        </p>
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
