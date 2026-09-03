# POLSKA TRADYCJA – ZAMÓWIENIA

Next.js + Supabase app. Features: product catalogue, PL/EN, search, cart, customer accounts, profiles, order history, admin panel, optional order email via Resend.

## Vercel env
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- RESEND_API_KEY (optional until email provider is configured)
- ORDER_EMAIL_TO (default rwitkowski1981@gmail.com)
- ORDER_EMAIL_FROM (verified sender/domain required by Resend)

Never expose Supabase secret/service-role keys in the browser.
