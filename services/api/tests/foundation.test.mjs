import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import Stripe from "stripe";
import { buildApp } from "../src/app.ts";
import { requireTestKey } from "../src/config.ts";
import { canTransition, pence } from "../src/domain.ts";
import { redact, loggerOptions } from "../src/logging.ts";
import { database, alice, bob, basket } from "./database.mjs";
import { catalog } from "../scripts/catalog.mjs";
let db, repo, app, noWebhook;
let calls = 0;
// Ephemeral unit-test signing material only; no environment or account secret.
const signingSecret = randomBytes(32).toString("hex");
const stripe = new Stripe("unit-test-only");
const intents = new Map();
stripe.paymentIntents.create = async (params, options) => {
  if (intents.has(options.idempotencyKey))
    return intents.get(options.idempotencyKey);
  calls++;
  const intent = {
    ...params,
    id: `pi_fixture${calls}`,
    client_secret: "unit-test-client-result",
    status: "requires_payment_method",
    livemode: false,
  };
  intents.set(options.idempotencyKey, intent);
  return intent;
};
stripe.paymentIntents.retrieve = async (id) =>
  [...intents.values()].find((i) => i.id === id);
before(async () => {
  ({ db, repo } = await database());
  app = buildApp({ repository: repo, stripe, webhookSecret: signingSecret });
  noWebhook = buildApp({ repository: repo, stripe });
});
after(async () => {
  await app?.close();
  await noWebhook?.close();
  await db?.close();
});
const request = (method, url, payload, token = "alice") =>
  app.inject({
    method,
    url,
    payload,
    headers: { authorization: `Bearer ${token}` },
  });
async function order() {
  const r = await request("POST", "/orders", basket());
  assert.equal(r.statusCode, 201, r.body);
  return r.json().order;
}
test("health is safe and public", async () =>
  assert.deepEqual((await app.inject("/health")).json(), {
    status: "ok",
    service: "kivo-api",
  }));
test("seed has exact 49 products / 11 categories / strawberry variants", () => {
  assert.equal(catalog.products.length, 49);
  assert.equal(catalog.categories.length, 11);
  assert.deepEqual(
    catalog.product_variants.map((v) => v.price_pence),
    [495, 995],
  );
  assert.equal(pence(8.95), 895);
  assert.equal(pence(6.99), 699);
  assert.throws(() => pence(1.001));
});
test("create snapshots authoritative pricing; retries reuse order", async () => {
  const b = basket();
  const a = await request("POST", "/orders", b);
  const retry = await request("POST", "/orders", b);
  assert.equal(a.statusCode, 201, a.body);
  assert.equal(a.json().order.total_pence, 1790);
  assert.equal(a.json().order.id, retry.json().order.id);
});
for (const [name, item, status] of [
  ["unknown product", { productId: "missing", quantity: 1 }, 409],
  [
    "unknown variant",
    { productId: "chocolate-strawberries", variantId: "bad", quantity: 1 },
    409,
  ],
  [
    "missing variant",
    { productId: "chocolate-strawberries", quantity: 1 },
    409,
  ],
  [
    "unknown option",
    { productId: "king-ferrero", optionIds: ["bad"], quantity: 1 },
    409,
  ],
  [
    "unavailable required sauce",
    { productId: "strawberry-choc-waffle", quantity: 1 },
    409,
  ],
  ["zero quantity", { productId: "king-ferrero", quantity: 0 }, 400],
  ["negative quantity", { productId: "king-ferrero", quantity: -1 }, 400],
  ["excessive quantity", { productId: "king-ferrero", quantity: 21 }, 400],
  ["fractional quantity", { productId: "king-ferrero", quantity: 1.5 }, 400],
  ["client price", { productId: "king-ferrero", quantity: 1, price: 1 }, 400],
])
  test(`reject ${name}`, async () =>
    assert.equal(
      (await request("POST", "/orders", basket([item]))).statusCode,
      status,
    ));
test("client totals rejected", async () =>
  assert.equal(
    (await request("POST", "/orders", { ...basket(), total: 1 })).statusCode,
    400,
  ));
test("valid variant snapshots correct price", async () =>
  assert.equal(
    (
      await request(
        "POST",
        "/orders",
        basket([
          {
            productId: "chocolate-strawberries",
            variantId: "chocolate-strawberries:ten",
            quantity: 2,
          },
        ]),
      )
    ).json().order.total_pence,
    1990,
  ));
test("order creation is atomic on second invalid item", async () => {
  const before = (await repo.list(alice)).length;
  await request(
    "POST",
    "/orders",
    basket([
      { productId: "king-ferrero", quantity: 1 },
      { productId: "invalid", quantity: 1 },
    ]),
  );
  assert.equal((await repo.list(alice)).length, before);
});
test("authentication and cross-user ownership apply to read/cancel/pay", async () => {
  assert.equal((await app.inject("/orders")).statusCode, 401);
  const o = await order();
  for (const [method, path] of [
    ["GET", ""],
    ["POST", "/cancel"],
    ["POST", "/payment-intent"],
  ])
    assert.equal(
      (
        await request(
          method,
          `/orders/${o.id}${path}`,
          method === "POST" ? {} : undefined,
          "bob",
        )
      ).statusCode,
      404,
    );
  assert.equal(
    (await request("GET", "/orders", undefined, "bob")).json().orders.length,
    0,
  );
});
test("customer cannot mark paid", async () =>
  assert.equal(
    (await request("POST", `/orders/${(await order()).id}/mark-paid`, {}))
      .statusCode,
    404,
  ));
test("draft cancellation works", async () =>
  assert.equal(
    (await request("POST", `/orders/${(await order()).id}/cancel`, {})).json()
      .order.status,
    "cancelled",
  ));
test("live key rejected; test mode accepted", () => {
  assert.throws(() => requireTestKey("sk_" + "live_not_allowed"));
  assert.equal(requireTestKey("sk_" + "test_unit"), "sk_" + "test_unit");
});
test("missing webhook config disables payments and webhook", async () => {
  const o = await order();
  const count = calls;
  assert.equal(
    (
      await noWebhook.inject({
        method: "POST",
        url: `/orders/${o.id}/payment-intent`,
        payload: {},
        headers: { authorization: "Bearer alice" },
      })
    ).statusCode,
    503,
  );
  assert.equal(
    (
      await noWebhook.inject({
        method: "POST",
        url: "/webhooks/stripe",
        payload: {},
      })
    ).statusCode,
    503,
  );
  assert.equal(calls, count);
});
test("PaymentIntent is server-priced and idempotent", async () => {
  const o = await order();
  const count = calls;
  for (let i = 0; i < 2; i++) {
    const r = await request("POST", `/orders/${o.id}/payment-intent`, {});
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().amountPence, 1790);
    assert.equal(r.headers["cache-control"], "no-store");
  }
  assert.equal(calls, count + 1);
  assert.equal((await repo.get(alice, o.id)).status, "payment_pending");
  assert.equal(
    (await request("POST", `/orders/${o.id}/payment-intent`, { amount: 1 }))
      .statusCode,
    400,
  );
});
async function webhook(
  o,
  overrides = {},
  type = "payment_intent.succeeded",
  eventId = `evt_${randomBytes(8).toString("hex")}`,
) {
  const intent = {
    id: await repo.payment(o.id),
    amount: o.total_pence,
    amount_received: o.total_pence,
    currency: "gbp",
    metadata: { kivo_order_id: o.id, user_id: alice },
    status: "succeeded",
    livemode: false,
    ...overrides,
  };
  const payload = JSON.stringify({
    id: eventId,
    type,
    livemode: false,
    data: { object: intent },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: signingSecret,
  });
  return app.inject({
    method: "POST",
    url: "/webhooks/stripe",
    payload,
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
  });
}
test("missing and invalid signatures rejected", async () => {
  assert.equal(
    (await app.inject({ method: "POST", url: "/webhooks/stripe", payload: {} }))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/webhooks/stripe",
        payload: {},
        headers: { "stripe-signature": "invalid" },
      })
    ).statusCode,
    400,
  );
});
test("signed mismatches rejected, retryable event not consumed", async () => {
  const o = await order();
  await request("POST", `/orders/${o.id}/payment-intent`, {});
  for (const change of [
    { amount: 1, amount_received: 1 },
    { currency: "usd" },
    { metadata: { kivo_order_id: o.id, user_id: bob } },
    { id: "pi_wrong" },
    { livemode: true },
  ])
    assert.ok((await webhook(o, change)).statusCode >= 400);
  assert.equal((await repo.get(alice, o.id)).status, "payment_pending");
});
test("verified success atomic, duplicate safe, late failure cannot regress paid", async () => {
  const o = await order();
  await request("POST", `/orders/${o.id}/payment-intent`, {});
  const id = `evt_${randomBytes(8).toString("hex")}`;
  for (let i = 0; i < 2; i++) {
    const r = await webhook(o, {}, "payment_intent.succeeded", id);
    assert.equal(r.statusCode, 200, r.body);
  }
  assert.equal((await repo.get(alice, o.id)).status, "paid");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from stripe_events where stripe_event_id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
  await webhook(
    o,
    { status: "requires_payment_method" },
    "payment_intent.payment_failed",
  );
  assert.equal((await repo.get(alice, o.id)).status, "paid");
});
test("RLS own rows only; writes and privileged RPC forbidden", async () => {
  const o = await order();
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${bob}'`);
  try {
    assert.equal(
      (await db.query("select * from orders where id=$1", [o.id])).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from order_items where order_id=$1", [o.id]))
        .rows.length,
      0,
    );
    await assert.rejects(
      db.query("update orders set status='paid' where id=$1", [o.id]),
    );
    await assert.rejects(
      db.query("select public.prepare_payment($1,$2)", [bob, o.id]),
    );
    await assert.rejects(db.query("select * from payments"));
  } finally {
    await db.exec("reset role");
  }
});
test("reward cannot originate from unpaid order", async () => {
  const o = await order();
  await db.query(
    "insert into rewards_accounts(user_id) values($1) on conflict do nothing",
    [alice],
  );
  await assert.rejects(
    db.query(
      "insert into rewards_transactions(user_id,order_id,points) values($1,$2,10)",
      [alice, o.id],
    ),
    /REWARD_NOT_ELIGIBLE/,
  );
});
test("staff domain allows legal flow and rejects jumps", () => {
  for (const [a, b] of [
    ["paid", "accepted"],
    ["accepted", "preparing"],
    ["preparing", "ready"],
    ["ready", "collected"],
    ["payment_pending", "payment_failed"],
  ])
    assert.equal(canTransition(a, b), true);
  for (const [a, b] of [
    ["draft", "paid"],
    ["paid", "collected"],
    ["refunded", "paid"],
    ["collected", "preparing"],
  ])
    assert.equal(canTransition(a, b), false);
});
test("sanitizer redacts nested sensitive fields; logs allowlist only", () => {
  const result = redact({
    authorization: "secret",
    nested: {
      client_secret: "secret",
      cvc: "secret",
      password: "secret",
      supabase_service_role_key: "secret",
    },
    ok: "safe",
  });
  assert.equal(JSON.stringify(result).includes('"secret"'), false);
  assert.deepEqual(
    loggerOptions.serializers.req({
      method: "POST",
      body: { password: "secret" },
      headers: { authorization: "secret" },
    }),
    { method: "POST" },
  );
});
test("schema contains no raw-card columns; all tables enable RLS", async () => {
  const columns = (
    await db.query(
      "select column_name from information_schema.columns where table_schema='public'",
    )
  ).rows.map((c) => c.column_name);
  for (const forbidden of [
    "card_number",
    "pan",
    "cvc",
    "cvv",
    "pin",
    "track_data",
  ])
    assert.equal(columns.includes(forbidden), false);
  const tables = (
    await db.query(
      "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'",
    )
  ).rows;
  assert.equal(tables.length, 16);
  assert.ok(tables.every((t) => t.relrowsecurity));
  const source = await readFile(
    new URL("../src/app.ts", import.meta.url),
    "utf8",
  );
  assert.ok(!source.includes("mark-paid"));
});

test('request ID cannot be reused for a different basket',async()=>{
  const b=basket();assert.equal((await request('POST','/orders',b)).statusCode,201);
  b.items[0].quantity=3;
  assert.equal((await request('POST','/orders',b)).statusCode,409);
});
for(const [type,status] of [['payment_intent.payment_failed','payment_failed'],['payment_intent.canceled','cancelled']])test(`verified ${type} transitions pending order`,async()=>{
  const o=await order();await request('POST',`/orders/${o.id}/payment-intent`,{});
  const result=await webhook(o,{status:type.endsWith('canceled')?'canceled':'requires_payment_method'},type);
  assert.equal(result.statusCode,200,result.body);assert.equal((await repo.get(alice,o.id)).status,status);
});
test('database rejects staff status jumps and payment changes after reservation',async()=>{
  const o=await order();await request('POST',`/orders/${o.id}/payment-intent`,{});
  await assert.rejects(db.query("update orders set status='collected' where id=$1",[o.id]),/INVALID_ORDER_TRANSITION/);
  await assert.rejects(db.query('update orders set total_pence=1,subtotal_pence=1 where id=$1',[o.id]),/ORDER_PRICE_IMMUTABLE/);
});
