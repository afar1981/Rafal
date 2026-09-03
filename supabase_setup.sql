-- Run after the original schema. This adds automatic profiles and admin RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company, phone, address, email, approved, is_admin)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'company',''),
          coalesce(new.raw_user_meta_data->>'phone',''),
          coalesce(new.raw_user_meta_data->>'address',''),
          new.email,
          false,
          false)
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and is_admin=true and approved=true); $$;

-- Admins can manage products.
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());

-- Admins can view all orders/items and profiles.
drop policy if exists "admins view all orders" on public.orders;
create policy "admins view all orders" on public.orders for select using (public.is_admin() or auth.uid()=user_id);
drop policy if exists "admins view all order items" on public.order_items;
create policy "admins view all order items" on public.order_items for select using (public.is_admin() or exists(select 1 from public.orders o where o.id=order_items.order_id and o.user_id=auth.uid()));
drop policy if exists "admins view all profiles" on public.profiles;
create policy "admins view all profiles" on public.profiles for select using (public.is_admin() or auth.uid()=id);

-- Allow an authenticated customer to create their own order and items.
drop policy if exists "users can create own orders" on public.orders;
create policy "users can create own orders" on public.orders for insert with check (auth.uid()=user_id);
drop policy if exists "users can create own order items" on public.order_items;
create policy "users can create own order items" on public.order_items for insert with check (exists(select 1 from public.orders o where o.id=order_items.order_id and o.user_id=auth.uid()));

-- IMPORTANT: after registering your own account, run the next line once with your email:
-- update public.profiles set is_admin=true, approved=true where email='rwitkowski1981@gmail.com';
