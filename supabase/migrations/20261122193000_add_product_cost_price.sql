alter table public.products
add column if not exists cost_price numeric(10,2);

comment on column public.products.cost_price is
'Internal purchase cost in GBP; visible only in admin panel.';