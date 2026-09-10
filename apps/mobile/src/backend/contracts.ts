import { getProduct, unitPrice } from "../menu/menuLogic.ts";
import type { CartLine } from "../menu/menuTypes.ts";
export const statuses = [
  "draft",
  "payment_pending",
  "paid",
  "accepted",
  "preparing",
  "ready",
  "collected",
  "cancelled",
  "refunded",
  "payment_failed",
] as const;
export type OrderStatus = (typeof statuses)[number];
export interface OrderDTO {
  id: string;
  status: OrderStatus;
  total_pence: number;
  subtotal_pence: number;
  currency: "gbp";
  created_at: string;
  order_items?: {
    id: string;
    name: string;
    variant_name?: string;
    quantity: number;
    line_total_pence: number;
  }[];
}
export function parseOrder(value: unknown): OrderDTO {
  const o = value as OrderDTO;
  if (
    !o ||
    typeof o.id !== "string" ||
    !/^[a-f0-9-]{36}$/.test(o.id) ||
    !statuses.includes(o.status) ||
    o.currency !== "gbp" ||
    !Number.isSafeInteger(o.total_pence) ||
    o.total_pence <= 0 ||
    o.subtotal_pence !== o.total_pence ||
    !Number.isFinite(Date.parse(o.created_at))
  )
    throw new Error("Invalid order response");
  return o;
}
export function serializeCheckout(lines: CartLine[], requestId: string) {
  if (!lines.length || lines.length > 50)
    throw new Error("Choose up to 50 selections.");
  return {
    requestId,
    items: lines.map((line) => {
      const product = getProduct(line.productId);
      if (
        !product ||
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 20
      )
        throw new Error("Choose between 1 and 20 of each selection.");
      unitPrice(product, line.variantId);
      if (product.optionGroups?.some((g) => g.required && !g.options.length))
        throw new Error(
          "Sauce choices are not ready for checkout. Please remove this selection for now.",
        );
      return {
        productId: line.productId,
        variantId: line.variantId
          ? `${line.productId}:${line.variantId}`
          : undefined,
        quantity: line.quantity,
        optionIds: [],
      };
    }),
  };
}
export function cartPence(lines: CartLine[]) {
  return lines.reduce((sum, line) => {
    const p = getProduct(line.productId);
    if (!p) throw new Error("Unknown product");
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    )
      throw new Error("Invalid quantity");
    return sum + Math.round(unitPrice(p, line.variantId) * 100) * line.quantity;
  }, 0);
}
export function paymentAvailable(
  platform: string,
  nativeModule: boolean,
  key?: string,
) {
  return platform !== "web" && nativeModule && !!key?.startsWith("pk_test_");
}
export const paidStatuses: OrderStatus[] = [
  "paid",
  "accepted",
  "preparing",
  "ready",
  "collected",
];
