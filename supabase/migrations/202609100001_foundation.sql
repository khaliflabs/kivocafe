-- Additive KIVO test-payment foundation. Service-only RPCs own monetary writes.
create type public.order_status as enum ('draft','payment_pending','paid','accepted','preparing','ready','collected','cancelled','refunded','payment_failed');
create type public.payment_status as enum ('requires_payment_method','requires_confirmation','processing','succeeded','failed','cancelled','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stores (
  id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Stable local catalogue slugs remain primary keys, avoiding a second ID map on mobile.
create table public.categories (
  id text primary key, name text not null, sort_order integer not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id text primary key, category_id text not null references public.categories(id), name text not null,
  description text not null, price_pence integer not null check (price_pence > 0 and price_pence <= 100000),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_variants (
  id text primary key, product_id text not null references public.products(id), name text not null,
  price_pence integer not null check (price_pence > 0 and price_pence <= 100000), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(product_id,name)
);
create table public.product_option_groups (
  id text primary key, product_id text not null references public.products(id), name text not null,
  required boolean not null default false, max_selections integer not null default 1 check(max_selections between 1 and 10),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_options (
  id text primary key, group_id text not null references public.product_option_groups(id), name text not null,
  price_pence integer not null default 0 check(price_pence between 0 and 100000), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  request_id uuid not null, request_fingerprint text not null, store_id uuid not null references public.stores(id),
  status public.order_status not null default 'draft', currency text not null default 'gbp' check(currency='gbp'),
  subtotal_pence integer not null check(subtotal_pence > 0), total_pence integer not null check(total_pence = subtotal_pence and total_pence <= 100000),
  quote_expires_at timestamptz not null default now()+interval '15 minutes',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,request_id)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id), variant_id text references public.product_variants(id),
  name text not null, variant_name text, quantity integer not null check(quantity between 1 and 20),
  unit_price_pence integer not null check(unit_price_pence > 0), line_total_pence integer not null check(line_total_pence = unit_price_pence * quantity),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_item_options (
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_id text not null references public.product_options(id), name text not null, price_pence integer not null check(price_pence>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(order_item_id,option_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id),
  stripe_payment_intent_id text not null unique, stripe_customer_id text, stripe_payment_method_id text,
  amount_pence integer not null check(amount_pence>0), currency text not null check(currency='gbp'),
  status public.payment_status not null default 'requires_payment_method',
  card_brand text, card_last4 text check(card_last4 ~ '^[0-9]{4}$'),
  card_exp_month integer check(card_exp_month between 1 and 12), card_exp_year integer check(card_exp_year>=2026),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stripe_events (
  stripe_event_id text primary key, event_type text not null, status text not null check(status in ('processed','ignored')),
  processed_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade, product_id text not null references public.products(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(user_id,product_id)
);
create table public.rewards_accounts (
  user_id uuid primary key references auth.users(id), points integer not null default 0 check(points>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.rewards_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.rewards_accounts(user_id),
  order_id uuid not null unique references public.orders(id), points integer not null check(points>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.promotions (
  id uuid primary key default gen_random_uuid(), title text not null, active boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_user_created on public.orders(user_id,created_at desc);
create index orders_queue on public.orders(status,created_at);
create index order_items_order on public.order_items(order_id);
create index order_item_options_item on public.order_item_options(order_item_id);
create index products_category on public.products(category_id);
create index variants_product on public.product_variants(product_id);
create index groups_product on public.product_option_groups(product_id);
create index options_group on public.product_options(group_id);
create index rewards_user on public.rewards_transactions(user_id,created_at);

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','stores','categories','products','product_variants','product_option_groups','product_options','orders','order_items','order_item_options','payments','stripe_events','favorites','rewards_accounts','rewards_transactions','promotions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
    if t <> 'stripe_events' then
      execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
    end if;
  end loop;
end $$;
grant select on public.categories,public.products,public.product_variants,public.product_option_groups,public.product_options,public.stores,public.promotions to anon,authenticated;
create policy catalog_read on public.categories for select to anon,authenticated using(true);
create policy catalog_read on public.products for select to anon,authenticated using(active);
create policy catalog_read on public.product_variants for select to anon,authenticated using(active and exists(select 1 from public.products p where p.id=product_id and p.active));
create policy catalog_read on public.product_option_groups for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.active));
create policy catalog_read on public.product_options for select to anon,authenticated using(active and exists(select 1 from public.product_option_groups g where g.id=group_id));
create policy catalog_read on public.stores for select to anon,authenticated using(active);
create policy catalog_read on public.promotions for select to anon,authenticated using(active);
grant select on public.profiles,public.orders,public.order_items,public.order_item_options,public.rewards_accounts,public.rewards_transactions to authenticated;
grant update(display_name) on public.profiles to authenticated;
create policy own_profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy own_order_read on public.orders for select to authenticated using(user_id=(select auth.uid()));
create policy own_item_read on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));
create policy own_option_read on public.order_item_options for select to authenticated using(exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and o.user_id=(select auth.uid())));
grant select,insert,delete on public.favorites to authenticated;
create policy own_favorites on public.favorites for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_rewards_read on public.rewards_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy own_rewards_history on public.rewards_transactions for select to authenticated using(user_id=(select auth.uid()));
-- payments and stripe_events deliberately have no customer grants/policies.
create function public.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id); return new; end $$;
create trigger kivo_new_profile after insert on auth.users for each row execute function public.new_profile();

create function public.require_paid_reward() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.orders o join public.payments p on p.order_id=o.id where o.id=new.order_id and o.user_id=new.user_id and p.status='succeeded' and o.status in ('paid','accepted','preparing','ready','collected')) then
    raise exception 'REWARD_NOT_ELIGIBLE';
  end if;
  return new;
end $$;
create trigger reward_eligibility before insert or update on public.rewards_transactions for each row execute function public.require_paid_reward();

create function public.create_order(p_user uuid,p_request uuid,p_items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare oid uuid; sid uuid; line jsonb; prod public.products; v public.product_variants; g public.product_option_groups;
  opt public.product_options; qty integer; unit integer; total integer:=0; iid uuid; selected text[]; n integer;
begin
  -- Serialize same-user retries; order and snapshots commit together, never partially.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_request::text,0));
  select id into oid from public.orders where user_id=p_user and request_id=p_request;
  if oid is not null then
    if not exists(select 1 from public.orders where id=oid and request_fingerprint=encode(sha256(convert_to(p_items::text,'UTF8')),'hex')) then raise exception 'INVALID_BASKET'; end if;
    return oid;
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'INVALID_BASKET'; end if;
  select id into sid from public.stores where active order by id limit 1;
  if sid is null then raise exception 'STORE_UNAVAILABLE'; end if;
  insert into public.orders(user_id,request_id,request_fingerprint,store_id,subtotal_pence,total_pence) values(p_user,p_request,encode(sha256(convert_to(p_items::text,'UTF8')),'hex'),sid,1,1) returning id into oid;
  for line in select value from jsonb_array_elements(p_items) loop
    if (line - array['productId','variantId','optionIds','quantity']) <> '{}'::jsonb then raise exception 'INVALID_BASKET'; end if;
    if jsonb_typeof(line->'quantity')<>'number' or (line->>'quantity') !~ '^[0-9]+$' then raise exception 'INVALID_QUANTITY'; end if;
    qty=(line->>'quantity')::integer;
    if qty is null or qty not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;
    select * into prod from public.products where id=line->>'productId' and active for share;
    if not found then raise exception 'INVALID_PRODUCT'; end if;
    unit=prod.price_pence; v=null;
    if exists(select 1 from public.product_variants where product_id=prod.id) then
      select * into v from public.product_variants where id=line->>'variantId' and product_id=prod.id and active for share;
      if not found then raise exception 'INVALID_VARIANT'; end if;
      unit=v.price_pence;
    elsif line->>'variantId' is not null then raise exception 'INVALID_VARIANT'; end if;
    if jsonb_typeof(coalesce(line->'optionIds','[]'::jsonb)) <> 'array' then raise exception 'INVALID_OPTIONS'; end if;
    select coalesce(array_agg(value),'{}') into selected from jsonb_array_elements_text(coalesce(line->'optionIds','[]'::jsonb));
    if cardinality(selected)>10 or cardinality(selected)<>(select count(distinct x) from unnest(selected) x) then raise exception 'INVALID_OPTIONS'; end if;
    for g in select * from public.product_option_groups where product_id=prod.id loop
      select count(*) into n from public.product_options where group_id=g.id and active and id=any(selected);
      if n>g.max_selections or (g.required and n=0) then raise exception 'OPTIONS_REQUIRED'; end if;
    end loop;
    for opt in select * from public.product_options where id=any(selected) and active loop
      if not exists(select 1 from public.product_option_groups where id=opt.group_id and product_id=prod.id) then raise exception 'INVALID_OPTIONS'; end if;
      unit=unit+opt.price_pence;
    end loop;
    if cardinality(selected)<>(select count(*) from public.product_options where id=any(selected) and active) then raise exception 'INVALID_OPTIONS'; end if;
    total=total+unit*qty;
    if total>100000 then raise exception 'BASKET_LIMIT'; end if;
    insert into public.order_items(order_id,product_id,variant_id,name,variant_name,quantity,unit_price_pence,line_total_pence)
      values(oid,prod.id,v.id,prod.name,v.name,qty,unit,unit*qty) returning id into iid;
    insert into public.order_item_options(order_item_id,option_id,name,price_pence)
      select iid,id,name,price_pence from public.product_options where id=any(selected);
  end loop;
  update public.orders set subtotal_pence=total,total_pence=total where id=oid;
  return oid;
end $$;

create function public.prepare_payment(p_user uuid,p_order uuid) returns public.orders
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order and user_id=p_user for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status not in ('draft','payment_pending','payment_failed') then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if o.status='draft' and o.quote_expires_at<now() then raise exception 'QUOTE_EXPIRED'; end if;
  -- A crash between Stripe creation and DB record must not outlive Stripe's 24h idempotency window.
  if o.created_at<now()-interval '23 hours' and not exists(select 1 from public.payments where order_id=o.id) then raise exception 'QUOTE_EXPIRED'; end if;
  update public.orders set status='payment_pending' where id=o.id returning * into o;
  return o;
end $$;

create function public.record_payment(p_user uuid,p_order uuid,p_intent text,p_amount integer) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders; existing public.payments;
begin
  select * into o from public.orders where id=p_order and user_id=p_user for update;
  if not found or o.total_pence<>p_amount or o.status not in ('payment_pending','payment_failed') then raise exception 'PAYMENT_MISMATCH'; end if;
  select * into existing from public.payments where order_id=p_order;
  if found and (existing.stripe_payment_intent_id<>p_intent or existing.amount_pence<>p_amount) then raise exception 'PAYMENT_MISMATCH'; end if;
  insert into public.payments(order_id,stripe_payment_intent_id,amount_pence,currency) values(p_order,p_intent,p_amount,'gbp') on conflict(order_id) do nothing;
end $$;

create function public.cancel_draft(p_user uuid,p_order uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order and user_id=p_user for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status='cancelled' then return; end if;
  if o.status<>'draft' then raise exception 'ORDER_NOT_CANCELLABLE'; end if;
  update public.orders set status='cancelled' where id=p_order;
end $$;

create function public.apply_stripe_event(p_event text,p_type text,p_intent text,p_order uuid,p_user uuid,p_amount integer,p_currency text)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders; pay public.payments; inserted text;
begin
  insert into public.stripe_events(stripe_event_id,event_type,status) values(p_event,p_type,'processed') on conflict do nothing returning stripe_event_id into inserted;
  if inserted is null then return false; end if;
  select * into o from public.orders where id=p_order for update;
  select * into pay from public.payments where order_id=p_order for update;
  if o.id is null or pay.id is null or pay.stripe_payment_intent_id<>p_intent or o.user_id<>p_user or o.total_pence<>p_amount or pay.amount_pence<>p_amount or p_currency<>'gbp' then
    raise exception 'PAYMENT_MISMATCH'; -- rolls back event claim, allowing a safe retry
  end if;
  if p_type='payment_intent.succeeded' then
    if o.status in ('payment_pending','payment_failed') then
      update public.payments set status='succeeded' where id=pay.id;
      update public.orders set status='paid' where id=o.id;
    elsif o.status not in ('paid','accepted','preparing','ready','collected','refunded') then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
  elsif p_type in ('payment_intent.payment_failed','payment_intent.canceled') then
    if o.status in ('payment_pending','payment_failed') and pay.status<>'succeeded' then
      update public.payments set status=case when p_type='payment_intent.canceled' then 'cancelled'::public.payment_status else 'failed'::public.payment_status end where id=pay.id;
      update public.orders set status=case when p_type='payment_intent.canceled' then 'cancelled'::public.order_status else 'payment_failed'::public.order_status end where id=o.id;
    end if; -- Never regress a verified paid order on a delayed failure event.
  else raise exception 'UNSUPPORTED_EVENT'; end if;
  return true;
end $$;

-- Functions otherwise default to PUBLIC EXECUTE, even when table RLS is enabled.
revoke all on function public.create_order(uuid,uuid,jsonb),public.prepare_payment(uuid,uuid),public.record_payment(uuid,uuid,text,integer),public.cancel_draft(uuid,uuid),public.apply_stripe_event(text,text,text,uuid,uuid,integer,text),public.new_profile(),public.touch_updated_at(),public.require_paid_reward() from public,anon,authenticated;
grant execute on function public.create_order(uuid,uuid,jsonb),public.prepare_payment(uuid,uuid),public.record_payment(uuid,uuid,text,integer),public.cancel_draft(uuid,uuid),public.apply_stripe_event(text,text,text,uuid,uuid,integer,text) to service_role;
