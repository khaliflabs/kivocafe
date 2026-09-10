import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { configFromEnv } from "../src/config.ts";

// Explicit opt-in: never part of secret-free Stage G. No raw card data is used.
if (
  process.argv[2] !== "--confirm-test" ||
  process.env.DOPPLER_PROJECT !== "kivo" ||
  process.env.DOPPLER_CONFIG !== "stg"
)
  throw new Error("Explicit KIVO staging test approval required");
const config = configFromEnv();
if (!config.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_PUBLISHABLE_KEY)
  throw new Error("Required staging configuration absent");
const stripe = new Stripe(config.STRIPE_SECRET_KEY);
const db = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const auth = createClient(
  config.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const base = "http://127.0.0.1:3001";
const receipt = {
  schema_version: 1,
  repository: "KhalifLabs/kivocafe",
  application_source_sha: execFileSync(
    "git",
    ["-c", "safe.directory=/home/kivo/projects/kivocafe", "rev-parse", "HEAD"],
    { encoding: "utf8" },
  ).trim(),
  validation_script_sha256: createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .digest("hex"),
  mode: "test",
  checks: {},
  orders: [],
  stripe_objects_retained: true,
  stripe_event_tombstones_retained: true,
};
let user;
let token;
let phase = "preflight";
let completed = false;
function pass(name) {
  receipt.checks[name] = "passed";
  console.log(`${name}: PASS`);
}
async function select(query) {
  const r = await query;
  if (r.error) throw new Error("Database query failed");
  return r.data;
}
async function api(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`API HTTP ${r.status}`);
  return r.json();
}
async function waitFor(label, check) {
  for (let i = 0; i < 40; i++) {
    const result = await check();
    if (result) return result;
    await pause(1500);
  }
  throw new Error(`${label} timeout`);
}
async function createOrder() {
  const { order } = await api("/orders", {
    requestId: randomUUID(),
    items: [{ productId: "matilda-cake", quantity: 2 }],
  });
  receipt.orders.push({ user_id: user, order_id: order.id });
  assert.equal(order.total_pence, 990);
  assert.equal(order.subtotal_pence, 990);
  assert.equal(order.currency, "gbp");
  assert.equal(order.status, "draft");
  return order;
}
async function initialize(order) {
  const first = await api(`/orders/${order.id}/payment-intent`, {});
  const second = await api(`/orders/${order.id}/payment-intent`, {});
  assert.equal(first.amountPence, 990);
  assert.equal(first.currency, "gbp");
  assert.ok(first.paymentIntentClientSecret);
  assert.ok(
    first.paymentIntentClientSecret === second.paymentIntentClientSecret,
  );
  const payments = await select(
    db
      .from("payments")
      .select("stripe_payment_intent_id,amount_pence,currency,status")
      .eq("order_id", order.id),
  );
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount_pence, 990);
  assert.equal(payments[0].currency, "gbp");
  const intent = await stripe.paymentIntents.retrieve(
    payments[0].stripe_payment_intent_id,
  );
  assert.equal(intent.livemode, false);
  assert.equal(intent.amount, 990);
  assert.equal(intent.currency, "gbp");
  assert.equal(intent.metadata.kivo_order_id, order.id);
  assert.equal(intent.metadata.user_id, user);
  assert.equal(
    (await api(`/orders/${order.id}`)).order.status,
    "payment_pending",
  );
  Object.assign(
    receipt.orders.find((o) => o.order_id === order.id),
    { payment_intent_id: intent.id, amount_pence: 990, currency: "gbp" },
  );
  return intent;
}
async function findProcessedEvent(intent, type) {
  return waitFor(type, async () => {
    const events = await stripe.events.list({
      type,
      created: { gte: intent.created - 2 },
      limit: 100,
    });
    const event = events.data.find((e) => e.data.object.id === intent.id);
    if (!event) return null;
    assert.equal(event.livemode, false);
    const stored = await select(
      db
        .from("stripe_events")
        .select("stripe_event_id,status")
        .eq("stripe_event_id", event.id),
    );
    return stored.length === 1 && stored[0].status === "processed"
      ? event
      : null;
  });
}
try {
  const health = await fetch(`${base}/health`).then((r) => r.json());
  assert.deepEqual(health, { status: "ok", service: "kivo-api" });
  pass("health");
  for (const signature of [undefined, "invalid"]) {
    const headers = { "Content-Type": "application/json" };
    if (signature) headers["Stripe-Signature"] = signature;
    const r = await fetch(`${base}/webhooks/stripe`, {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(r.status, 400);
  }
  pass("invalid_signatures_rejected");
  phase = "create temporary authenticated customer";
  const email = `kivo-payment-validation-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString("base64url");
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw new Error("Fixture creation failed");
  user = created.data.user.id;
  receipt.fixture_user_id = user;
  const login = await auth.auth.signInWithPassword({ email, password });
  if (login.error) throw new Error("Fixture sign-in failed");
  token = login.data.session.access_token;
  pass("staging_auth");
  phase = "create authoritative successful order";
  const order = await createOrder();
  pass("authoritative_pricing");
  phase = "initialize PaymentIntent";
  const intent = await initialize(order);
  pass("payment_intent_identity_and_retry");
  pass("pending_before_confirmation");
  phase = "confirm Stripe TEST PaymentIntent";
  const confirmed = await stripe.paymentIntents.confirm(
    intent.id,
    { payment_method: "pm_card_visa" },
    { idempotencyKey: `kivo-test-confirm-${order.id}` },
  );
  assert.equal(confirmed.livemode, false);
  assert.equal(confirmed.status, "succeeded");
  phase = "wait for actual Stripe CLI signed success";
  const event = await findProcessedEvent(intent, "payment_intent.succeeded");
  assert.equal((await api(`/orders/${order.id}`)).order.status, "paid");
  const payment = await select(
    db
      .from("payments")
      .select("status,amount_pence,currency")
      .eq("order_id", order.id)
      .single(),
  );
  assert.equal(payment.status, "succeeded");
  assert.equal(payment.amount_pence, 990);
  assert.equal(payment.currency, "gbp");
  Object.assign(receipt.orders[0], {
    event_id: event.id,
    order_status: "paid",
    payment_status: "succeeded",
  });
  pass("real_signed_cli_delivery");
  pass("database_order_and_payment_paid");
  phase = "duplicate event replay";
  // CLI-local destinations have no dashboard endpoint ID for `events resend`.
  // First delivery above MUST already be Stripe-originated. Replay that exact
  // Stripe-retrieved event with an SDK signature; never fabricate a payment event.
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: config.STRIPE_WEBHOOK_SECRET,
  });
  const replay = await fetch(`${base}/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },
    body: payload,
  });
  assert.equal(replay.status, 200);
  assert.equal((await api(`/orders/${order.id}`)).order.status, "paid");
  assert.equal(
    (await select(db.from("payments").select("id").eq("order_id", order.id)))
      .length,
    1,
  );
  assert.equal(
    (
      await select(
        db
          .from("stripe_events")
          .select("stripe_event_id")
          .eq("stripe_event_id", event.id),
      )
    ).length,
    1,
  );
  assert.equal(
    (
      await select(
        db.from("rewards_transactions").select("id").eq("order_id", order.id),
      )
    ).length,
    0,
  );
  receipt.duplicate_method =
    "SDK-signed replay of the same Stripe-retrieved event after confirmed real CLI delivery";
  pass("duplicate_event_idempotency");
  phase = "separate cancellation fixture";
  const canceled = await createOrder();
  const cancelIntent = await initialize(canceled);
  await api(`/orders/${canceled.id}/cancel`, {});
  const cancelEvent = await findProcessedEvent(
    cancelIntent,
    "payment_intent.canceled",
  );
  assert.equal((await api(`/orders/${canceled.id}`)).order.status, "cancelled");
  const cancelPayment = await select(
    db.from("payments").select("status").eq("order_id", canceled.id).single(),
  );
  assert.equal(cancelPayment.status, "cancelled");
  Object.assign(receipt.orders[1], {
    event_id: cancelEvent.id,
    order_status: "cancelled",
    payment_status: "cancelled",
  });
  assert.equal((await api(`/orders/${order.id}`)).order.status, "paid");
  pass("real_signed_cancellation");
  completed = true;
} catch (error) {
  console.error(
    `Payment validation stopped during: ${phase}. ${/^API HTTP \d+$/.test(error.message) ? error.message : "Details suppressed to protect credentials."}`,
  );
  process.exitCode = 1;
} finally {
  if (completed) {
    try {
      for (const o of receipt.orders) {
        await select(db.from("payments").delete().eq("order_id", o.order_id));
        await select(
          db.from("orders").delete().eq("id", o.order_id).eq("user_id", user),
        );
        assert.equal(
          (await select(db.from("orders").select("id").eq("id", o.order_id)))
            .length,
          0,
        );
      }
      const signout = await auth.auth.signOut();
      assert.ok(!signout.error, "Signout failed");
      const deleted = await db.auth.admin.deleteUser(user);
      assert.ok(!deleted.error, "Fixture cleanup failed");
      pass("temporary_database_fixtures_removed");
    } catch {
      console.error(
        "Fixture cleanup incomplete; retain safe receipt IDs for investigation.",
      );
      process.exitCode = 1;
    }
  } else
    console.log(
      "Incomplete fixtures retained for safe diagnosis; no catalog or configuration deleted.",
    );
  receipt.completed_at = new Date().toISOString();
  receipt.result = completed && !process.exitCode ? "passed" : "failed";
  await writeFile(
    "/tmp/kivo-stripe-payment-e2e-receipt.json",
    JSON.stringify(receipt, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify(receipt)); // Only allowlisted IDs, counts, checks and source identity.
}
