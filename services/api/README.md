# KIVO API — staging/test only

Node 22, TypeScript, Fastify, Zod, official Supabase and Stripe SDKs. Listens on
`127.0.0.1:3001`; it is not a publicly deployed API.

```sh
cd /home/kivo/projects/kivocafe/services/api
npm ci
doppler run --project kivo --config stg -- npm run dev
```

`GET /health` is public. Order creation/list/read/cancel and PaymentIntent endpoints
require a Supabase bearer session. `POST /webhooks/stripe` requires a Stripe signature,
not a user session. Real checkout remains disabled until the real webhook secret exists.

```sh
npm run lint
npm run typecheck
npm test
```

Tests include actual SQL migrations/RLS in isolated PostgreSQL-compatible PGlite,
mocked Stripe API calls and cryptographically signed unit-test webhook requests.
No account secrets are needed in CI.

## Database setup

`supabase/config.toml` supports local Supabase tooling. For hosted KIVO staging,
the small `pg` migration runner derives the project reference from the Doppler URL;
it needs no personal Supabase management token. It applies additive migrations
transactionally and records checksums in a private `kivo_migrations` schema.
Do not edit migrations after application or mix this ledger with CLI `db push`.

Download the public database CA from Supabase Database settings (or its official
certificate download), then supply its **path**, not a password, as follows:

```sh
SUPABASE_CA_PATH=/tmp/kivo-supabase-ca.crt doppler run --project kivo --config stg -- npm run db:migrate
SUPABASE_CA_PATH=/tmp/kivo-supabase-ca.crt doppler run --project kivo --config stg -- npm run db:seed
```

TLS certificate/hostname verification is mandatory. Seed prices come directly from
the existing mobile menu: 49 products, 11 categories. Existing catalog rows are
never overwritten; mismatched prices/names fail. Local mobile menu data is retained.

Optional scoped integration smoke (creates and removes two temporary test accounts
and a draft order; never creates a Stripe PaymentIntent):

```sh
doppler run --project kivo --config stg -- node --experimental-strip-types scripts/staging-smoke.mjs
```

## Real webhook activation boundary

Local URL: `http://127.0.0.1:3001/webhooks/stripe`.
Future staging URL: `https://<approved-staging-api-host>/webhooks/stripe`.
No staging hostname/public API deployment has been configured.
Stripe CLI listening can forward signed test events to loopback without opening a
public API port. The listener's signing secret belongs in Doppler
`kivo/stg/STRIPE_WEBHOOK_SECRET`; API restart is required after adding it.
Never use a dashboard endpoint's signing secret for a CLI listener or vice versa.

Stripe CLI 1.50.10 is installed on the tools server. At the human approval boundary,
an operator authenticated to Doppler can run the following **once**:

```sh
node /home/kivo/projects/kivocafe/services/api/scripts/configure-local-webhook.mjs
```

This requests a real **test-mode CLI** signing secret from Stripe and pipes it
directly into Doppler. It never prints it, stores it in a file, or puts it in
process arguments. It refuses to overwrite an existing signing secret. This helper
has unit tests but has deliberately not been executed during implementation.
Forwarding later must use the same Stripe account and `--device-name kivo-tools-stg`
with `--forward-to http://127.0.0.1:3001/webhooks/stripe`; do not log the listener's
secret-bearing startup output. No real webhook delivery has yet been validated.

See [payment security](../../docs/security-payments.md) and [RLS policies](../../supabase/README.md).
