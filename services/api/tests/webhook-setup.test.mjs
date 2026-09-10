import { test } from "node:test";
import assert from "node:assert/strict";
import { configureLocalWebhook } from "../scripts/configure-local-webhook.mjs";
test("human setup helper uses secret stdin and test-only Stripe environment", () => {
  let stored = false;
  configureLocalWebhook((command, args, options) => {
    if (args.includes("--only-names"))
      return JSON.stringify(stored ? { STRIPE_WEBHOOK_SECRET: {} } : {});
    if (command === "stripe") {
      assert.equal(args.includes("--live"), false);
      assert.equal(options.env.STRIPE_API_KEY, "sk_test_fixture");
      assert.equal(
        Object.hasOwn(options.env, "SUPABASE_SERVICE_ROLE_KEY"),
        false,
      );
      return "whsec_ephemeralfixture";
    }
    if (args.includes("get")) return "sk_test_fixture";
    assert.equal(options.input, "whsec_ephemeralfixture");
    assert.equal(args.includes(options.input), false);
    stored = true;
    return "";
  });
  assert.equal(stored, true);
});
test("helper cannot overwrite an existing signing secret", () => {
  assert.throws(
    () =>
      configureLocalWebhook(() =>
        JSON.stringify({ STRIPE_WEBHOOK_SECRET: {} }),
      ),
    /refusing/,
  );
});
test("helper rejects live key and malformed signing secret", () => {
  for (const key of ["sk_live_fixture", "sk_test_fixture"])
    assert.throws(() =>
      configureLocalWebhook((cmd, args) =>
        args.includes("--only-names")
          ? "{}"
          : cmd === "stripe"
            ? "invalid"
            : key,
      ),
    );
});
