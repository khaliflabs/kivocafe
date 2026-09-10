import { test } from "node:test";
import assert from "node:assert/strict";
import {
  safeListenerLine,
  startLocalRuntime,
} from "../scripts/local-runtime.mjs";
test("listener startup secret is compared but never printed", () => {
  const expected = "whsec_unitfixture";
  const safe = safeListenerLine(
    `Ready! Your webhook signing secret is ${expected}`,
    expected,
  );
  assert.equal(safe, "Listener signing secret match: PASS");
  assert.ok(!safe.includes(expected));
  assert.throws(() => safeListenerLine("Ready whsec_wrong", expected));
});
test("listener allowlists IDs and statuses, drops all other output", () => {
  assert.equal(
    safeListenerLine(" --> payment_intent.succeeded [evt_unit]", "unused"),
    "Stripe event: payment_intent.succeeded evt_unit",
  );
  assert.equal(
    safeListenerLine("<-- [200] POST url [evt_unit]", "unused"),
    "Stripe delivery: event=evt_unit HTTP=200",
  );
  for (const raw of [
    "Authorization: Bearer sensitive",
    "sk_test_do_not_echo",
    "password=secret",
    '{"client_secret":"sensitive"}',
  ])
    assert.equal(safeListenerLine(raw, "unused"), undefined);
});
test("runtime rejects arbitrary mode and absent staging context", () => {
  assert.throws(() => startLocalRuntime("production"));
  assert.throws(() => startLocalRuntime("listener"));
});
