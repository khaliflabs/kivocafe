create function public.enforce_order_transition() returns trigger language plpgsql set search_path='' as $$
begin
  if new.user_id<>old.user_id or new.request_id<>old.request_id or new.store_id<>old.store_id then raise exception 'ORDER_IDENTITY_IMMUTABLE'; end if;
  if old.status<>'draft' and (new.total_pence<>old.total_pence or new.subtotal_pence<>old.subtotal_pence) then raise exception 'ORDER_PRICE_IMMUTABLE'; end if;
  if new.status=old.status then return new; end if;
  if not (
    (old.status='draft' and new.status in ('payment_pending','cancelled')) or
    (old.status='payment_pending' and new.status in ('paid','payment_failed','cancelled')) or
    (old.status='payment_failed' and new.status in ('payment_pending','paid','cancelled')) or
    (old.status='paid' and new.status in ('accepted','refunded')) or
    (old.status='accepted' and new.status in ('preparing','refunded')) or
    (old.status='preparing' and new.status in ('ready','refunded')) or
    (old.status='ready' and new.status in ('collected','refunded')) or
    (old.status='collected' and new.status='refunded')
  ) then raise exception 'INVALID_ORDER_TRANSITION'; end if;
  if new.status='paid' and not exists(select 1 from public.payments where order_id=new.id and status='succeeded' and amount_pence=new.total_pence) then raise exception 'PAYMENT_NOT_VERIFIED'; end if;
  if new.status='refunded' and not exists(select 1 from public.payments where order_id=new.id and status='refunded') then raise exception 'REFUND_NOT_VERIFIED'; end if;
  return new;
end $$;
create trigger order_transition before update on public.orders for each row execute function public.enforce_order_transition();
revoke all on function public.enforce_order_transition() from public,anon,authenticated;
