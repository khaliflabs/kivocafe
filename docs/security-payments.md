# KIVO test-payment security

## Data boundaries

Mobile → KIVO API → Supabase holds identity, catalogue and order records.
Mobile → Stripe PaymentSheet → Stripe handles card entry.
Stripe → signed webhook → KIVO API → Supabase confirms payment.

Raw card data does **not** flow through KIVO API. KIVO never intentionally receives,
logs or stores PAN, CVC/CVV, PIN or track data. There are no custom card fields or
raw-card database columns. PaymentSheet is the official Stripe native UI.
This reduces PCI scope; it is not a claim of PCI certification or a substitute for
the merchant's applicable compliance assessment.

## Secrets and authentication

Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`. Migration tools alone need `SUPABASE_DB_PASSWORD`.
All come from Doppler `kivo/stg`; no `.env`, source or GitHub application secrets.
Stage H continues to use its existing narrow GitHub `DOPPLER_TOKEN` bootstrap.

Mobile public aliases are limited to `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` and a
non-secret `EXPO_PUBLIC_API_URL`. The local preview launcher explicitly selects
these values, never the entire Doppler environment. No server key enters Expo config.
Supabase owns email/password authentication. Native session tokens are chunked in
SecureStore (manifest written last); web previews keep sessions in memory only.
Server authorization validates JWTs with Supabase `getUser`, never decoded claims alone.

## Money and state

Clients send a request UUID, product/variant/option IDs and quantities only.
Strict request schemas reject supplied prices/totals. A service-only SQL function
loads active catalogue records and atomically snapshots order lines and integer
GBP pence totals. 20 units/selection, 50 selections and £1,000/order are enforced.
The five products with unknown mandatory sauces cannot be ordered until the
authoritative choices exist. No modifiers or prices are invented.

Draft quotes expire after 15 minutes. A confirmed quote's price becomes immutable
on payment reservation; no discounts, taxes, delivery fees or extras are invented.
Request UUID retries return the same order only for the same basket fingerprint.
Stripe creation uses `kivo-order-<UUID>-payment-v1`; a recorded intent is reused.
Unrecorded attempts older than 23 hours are blocked before Stripe's idempotency
window can expire. Cancelled intents are not silently replaced with new attempts.

Only verified Stripe events can set payment success. PaymentSheet completion merely
starts bounded order polling. No customer mark-paid endpoint or write policy exists.
Cancellation of a pending intent is requested from Stripe; signed confirmation
updates the database. Draft cancellation is an ownership-checked SQL transaction.
Staff transitions and payment/refund eligibility are enforced by SQL triggers and
tested domain rules. No staff UI or refund execution endpoint exists yet.

## Webhooks

`POST /webhooks/stripe` uses the unchanged raw body with Stripe's official signature
verification and timestamp tolerance. Missing/invalid signatures are rejected;
live-mode events are rejected. A missing signing secret disables both this route
and PaymentIntent creation with HTTP 503; health and ordinary order APIs still work.

Supported events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
`payment_intent.canceled`. The intent ID, order/user metadata, GBP currency and
amount must match persisted records. Success also requires the full received amount.
A unique Stripe event claim, payment update and order update commit in one transaction.
Mismatches roll back the claim for safe retries. Duplicate delivery is harmless;
delayed failure events cannot regress paid/fulfilled orders. Unrelated event types
are acknowledged without business effects. Refund processing is deliberately deferred.
Rewards have no automatic business effects yet, and an eligibility trigger rejects
awards unless the matching user's order has a verified successful payment.

## Logs, tests and activation

API logs allow only method, safe status/error codes and generic error messages.
Request bodies, URLs, headers, raw Stripe objects, client secrets and sessions are
not serialized. Central redaction covers secret/card-field names; errors sent to
mobile never contain stacks or SDK details. Stage G uses generated unit-test signing
material and mocked Stripe calls, not Doppler credentials. PostgreSQL tests execute
the actual migrations and RLS policies using isolated PGlite databases.

Only test-mode keys are accepted. No live charge, production deployment, production
DNS, wallet activation, Apple signing or store submission is part of this milestone.
The real CLI signing secret is present in `kivo/stg/STRIPE_WEBHOOK_SECRET`.
On 2026-09-10, a real test PaymentIntent confirmed with `pm_card_visa` produced a
Stripe-signed CLI success event, then a persisted paid order/succeeded payment.
A separate real cancellation event passed. Duplicate handling used an SDK-signed
replay of the same retrieved event after the genuine delivery; no duplicate rows
or reward effects occurred. Temporary customer/order/payment fixtures were removed;
Stripe test objects and processed-event tombstones remain for audit and deduplication.

The local runtime wrapper filters listener stdout/stderr before terminal capture,
compares the existing signing secret without printing it, and never dumps secrets.
CLI forwarding is local staging/dev validation, not a deployed webhook endpoint.
Future deployed endpoints require their own dashboard signing secrets: never
substitute a CLI signing secret for a dashboard secret. No production activation
or manual PaymentSheet device acceptance is implied by this backend validation.

References: [Stripe PaymentSheet](https://docs.stripe.com/payments/mobile/accept-payment?platform=react-native&type=payment),
[Stripe webhook signatures](https://docs.stripe.com/webhooks?lang=node),
[Expo Stripe compatibility](https://docs.expo.dev/versions/latest/sdk/stripe/),
[Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native).
