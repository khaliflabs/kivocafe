import { createClient } from "@supabase/supabase-js";
import { ApiError, type Basket, type Order } from "./domain.ts";
export interface PaymentEvent {
  id: string;
  type: string;
  intent: string;
  order: string;
  user: string;
  amount: number;
  currency: string;
}
export interface Repository {
  authenticate(token: string): Promise<string | null>;
  create(user: string, basket: Basket): Promise<string>;
  list(user: string): Promise<Order[]>;
  get(user: string, id: string): Promise<Order | null>;
  prepare(user: string, id: string): Promise<Order>;
  payment(id: string): Promise<string | null>;
  record(
    user: string,
    id: string,
    intent: string,
    amount: number,
  ): Promise<void>;
  cancel(user: string, id: string): Promise<void>;
  event(event: PaymentEvent): Promise<boolean>;
}
export function databaseError(error: { message: string } | null) {
  if (!error) return;
  const allowed = [
    "INVALID_BASKET",
    "INVALID_PRODUCT",
    "INVALID_VARIANT",
    "INVALID_OPTIONS",
    "OPTIONS_REQUIRED",
    "INVALID_QUANTITY",
    "BASKET_LIMIT",
    "QUOTE_EXPIRED",
    "ORDER_NOT_PAYABLE",
    "ORDER_NOT_CANCELLABLE",
    "ORDER_NOT_FOUND",
    "PAYMENT_MISMATCH",
    "INVALID_PAYMENT_TRANSITION",
    "STORE_UNAVAILABLE",
  ];
  const code = allowed.find((code) => error.message === code);
  throw new ApiError(
    code === "ORDER_NOT_FOUND" ? 404 : code ? 409 : 503,
    code ?? "DATABASE_UNAVAILABLE",
  );
}
export function createRepository(url: string, key: string): Repository {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(name, args);
    databaseError(error);
    return data;
  };
  return {
    async authenticate(token) {
      const { data, error } = await db.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    create: (user, basket) =>
      rpc("create_order", {
        p_user: user,
        p_request: basket.requestId,
        p_items: basket.items,
      }),
    async list(user) {
      const { data, error } = await db
        .from("orders")
        .select("*,order_items(*,order_item_options(*))")
        .eq("user_id", user)
        .order("created_at", { ascending: false })
        .limit(100);
      databaseError(error);
      return data ?? [];
    },
    async get(user, id) {
      const { data, error } = await db
        .from("orders")
        .select("*,order_items(*,order_item_options(*))")
        .eq("id", id)
        .eq("user_id", user)
        .maybeSingle();
      databaseError(error);
      return data;
    },
    prepare: (user, id) =>
      rpc("prepare_payment", { p_user: user, p_order: id }),
    async payment(id) {
      const { data, error } = await db
        .from("payments")
        .select("stripe_payment_intent_id")
        .eq("order_id", id)
        .maybeSingle();
      databaseError(error);
      return data?.stripe_payment_intent_id ?? null;
    },
    async record(user, id, intent, amount) {
      await rpc("record_payment", {
        p_user: user,
        p_order: id,
        p_intent: intent,
        p_amount: amount,
      });
    },
    async cancel(user, id) {
      await rpc("cancel_draft", { p_user: user, p_order: id });
    },
    event: (e) =>
      rpc("apply_stripe_event", {
        p_event: e.id,
        p_type: e.type,
        p_intent: e.intent,
        p_order: e.order,
        p_user: e.user,
        p_amount: e.amount,
        p_currency: e.currency,
      }),
  };
}
