import { z } from "zod";
export const itemInput = z
  .object({
    productId: z.string().min(1).max(100),
    variantId: z.string().min(1).max(120).optional(),
    optionIds: z.array(z.string().min(1).max(150)).max(10).default([]),
    quantity: z.number().int().min(1).max(20),
  })
  .strict();
export const orderInput = z
  .object({ requestId: z.uuid(), items: z.array(itemInput).min(1).max(50) })
  .strict();
export type Basket = z.infer<typeof orderInput>;
export const orderId = z.uuid();
export type OrderStatus =
  | "draft"
  | "payment_pending"
  | "paid"
  | "accepted"
  | "preparing"
  | "ready"
  | "collected"
  | "cancelled"
  | "refunded"
  | "payment_failed";
export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  subtotal_pence: number;
  total_pence: number;
  currency: "gbp";
  created_at: string;
  order_items?: unknown[];
}
export function pence(gbp: number): number {
  const amount = Math.round(gbp * 100);
  if (
    !Number.isFinite(gbp) ||
    amount <= 0 ||
    !Number.isSafeInteger(amount) ||
    Math.abs(gbp * 100 - amount) > 1e-7
  )
    throw new Error("INVALID_PRICE");
  return amount;
}
const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ["payment_pending", "cancelled"],
  payment_pending: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["payment_pending", "paid", "cancelled"],
  paid: ["accepted", "refunded"],
  accepted: ["preparing", "refunded"],
  preparing: ["ready", "refunded"],
  ready: ["collected", "refunded"],
  collected: ["refunded"],
  cancelled: [],
  refunded: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from].includes(to);
}
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
