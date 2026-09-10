import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cartPence,
  serializeCheckout,
  parseOrder,
  paymentAvailable,
} from "./contracts.ts";
test("cart totals are integer pence, variants preserved", () => {
  assert.equal(
    cartPence([
      { productId: "chocolate-strawberries", variantId: "ten", quantity: 2 },
    ]),
    1990,
  );
  assert.throws(() => cartPence([{ productId: "king-ferrero", quantity: 0 }]));
});
test("checkout sends IDs and quantities, never prices", () => {
  const r = serializeCheckout(
    [{ productId: "chocolate-strawberries", variantId: "six", quantity: 2 }],
    "request",
  );
  assert.deepEqual(r.items, [
    {
      productId: "chocolate-strawberries",
      variantId: "chocolate-strawberries:six",
      quantity: 2,
      optionIds: [],
    },
  ]);
  assert.ok(!JSON.stringify(r).includes("price"));
  assert.throws(() =>
    serializeCheckout([{ productId: "king-ferrero", quantity: 21 }], "request"),
  );
  assert.throws(
    () =>
      serializeCheckout(
        [{ productId: "strawberry-choc-waffle", quantity: 1 }],
        "request",
      ),
    /Sauce/,
  );
});
test("order DTO validates status, currency and pence", () => {
  const order = {
    id: "00000000-0000-4000-8000-000000000001",
    status: "paid",
    currency: "gbp",
    total_pence: 895,
    subtotal_pence: 895,
    created_at: "2026-09-10T12:00:00Z",
  };
  assert.equal(parseOrder(order).status, "paid");
  for (const change of [
    { status: "client_success" },
    { total_pence: 8.95 },
    { currency: "usd" },
    { created_at: "invalid" },
  ])
    assert.throws(() => parseOrder({ ...order, ...change }));
});
test("payment fallback preserves web/native previews and rejects live keys", () => {
  assert.equal(paymentAvailable("web", true, "pk_test_unit"), false);
  assert.equal(paymentAvailable("ios", false, "pk_test_unit"), false);
  assert.equal(paymentAvailable("ios", true, undefined), false);
  assert.equal(paymentAvailable("android", true, "pk_live_unit"), false);
  assert.equal(paymentAvailable("ios", true, "pk_test_unit"), true);
});
