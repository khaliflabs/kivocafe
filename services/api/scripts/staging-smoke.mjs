import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { configFromEnv } from "../src/config.ts";
import { buildApp } from "../src/app.ts";
import { createRepository } from "../src/repository.ts";
if (
  process.env.DOPPLER_PROJECT !== "kivo" ||
  process.env.DOPPLER_CONFIG !== "stg"
)
  throw new Error("KIVO staging only");
const c = configFromEnv();
const admin = createClient(c.SUPABASE_URL, c.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repo = createRepository(c.SUPABASE_URL, c.SUPABASE_SERVICE_ROLE_KEY);
const app = buildApp({
  repository: repo,
  stripe: new Stripe(c.STRIPE_SECRET_KEY),
}); // Deliberately no payment activation.
const users = [];
const orders = [];
try {
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const email = `kivo-smoke-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString("base64url");
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(created.error);
    users.push(created.data.user.id);
    const client = createClient(
      c.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const signed = await client.auth.signInWithPassword({ email, password });
    assert.ifError(signed.error);
    sessions.push({ client, token: signed.data.session.access_token });
  }
  const headers = { authorization: `Bearer ${sessions[0].token}` };
  const created = await app.inject({
    method: "POST",
    url: "/orders",
    headers,
    payload: {
      requestId: randomUUID(),
      items: [{ productId: "king-ferrero", quantity: 2 }],
    },
  });
  assert.equal(created.statusCode, 201);
  const order = created.json().order;
  orders.push(order.id);
  assert.equal(order.total_pence, 1790);
  const own = await sessions[0].client
    .from("orders")
    .select("id")
    .eq("id", order.id);
  assert.ifError(own.error);
  assert.equal(own.data.length, 1);
  const other = await sessions[1].client
    .from("orders")
    .select("id")
    .eq("id", order.id);
  assert.ifError(other.error);
  assert.equal(other.data.length, 0);
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: `/orders/${order.id}`,
        headers: { authorization: `Bearer ${sessions[1].token}` },
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/orders/${order.id}/payment-intent`,
        headers,
        payload: {},
      })
    ).statusCode,
    503,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/orders/${order.id}/cancel`,
        headers,
        payload: {},
      })
    ).json().order.status,
    "cancelled",
  );
  for (const s of sessions)
    assert.ifError((await s.client.auth.signOut()).error);
  console.log(
    "Real staging auth, order pricing, RLS ownership, cancellation and disabled-payment smoke: PASS",
  );
} catch {
  console.error(
    "Staging smoke failed (details withheld to protect credentials).",
  );
  process.exitCode = 1;
} finally {
  for (const id of orders) {
    const r = await admin.from("orders").delete().eq("id", id);
    if (r.error) {
      console.error("Test order cleanup failed");
      process.exitCode = 1;
    }
  }
  for (const id of users) {
    const r = await admin.auth.admin.deleteUser(id);
    if (r.error) {
      console.error("Test account cleanup failed");
      process.exitCode = 1;
    }
  }
  await app.close();
  console.log("Temporary staging smoke fixtures cleanup completed.");
}
