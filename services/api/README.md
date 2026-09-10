# KIVO API — staging/test only

Node 22, TypeScript, Fastify, Zod, official Supabase and Stripe SDKs. Listens on
`127.0.0.1:3001`; it is not a publicly deployed API.

```sh
cd /home/kivo/projects/kivocafe/services/api
npm ci
doppler run --no-fallback --project kivo --config stg -- node scripts/local-runtime.mjs api
```

`GET /health` is public. Order creation/list/read/cancel and PaymentIntent endpoints
require a Supabase bearer session. `POST /webhooks/stripe` requires a Stripe signature,
not a user session. Local Stripe test checkout and signed webhook delivery have been
validated; missing webhook configuration still disables payment initialization.

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
SUPABASE_CA_PATH=/tmp/kivo-supabase-ca.crt doppler run --no-fallback --project kivo --config stg -- npm run db:migrate
SUPABASE_CA_PATH=/tmp/kivo-supabase-ca.crt doppler run --no-fallback --project kivo --config stg -- npm run db:seed
```

TLS certificate/hostname verification is mandatory. Seed prices come directly from
the existing mobile menu: 49 products, 11 categories. Existing catalog rows are
never overwritten; mismatched prices/names fail. Local mobile menu data is retained.

Optional scoped integration smoke (creates and removes two temporary test accounts
and a draft order; never creates a Stripe PaymentIntent):

```sh
doppler run --no-fallback --project kivo --config stg -- node --experimental-strip-types scripts/staging-smoke.mjs
```

## Validated local test webhook

Local URL: `http://127.0.0.1:3001/webhooks/stripe`.
Future staging URL: `https://<approved-staging-api-host>/webhooks/stripe`.
No staging hostname/public API deployment has been configured.
Stripe CLI listening can forward signed test events to loopback without opening a
public API port. The listener's signing secret belongs in Doppler
`kivo/stg/STRIPE_WEBHOOK_SECRET`; API restart is required after adding it.
Never use a dashboard endpoint's signing secret for a CLI listener or vice versa.

Stripe CLI 1.50.10 is installed. The operator has already completed this one-time
helper; **do not rerun it to start or restart the listener**:

```sh
node /home/kivo/projects/kivocafe/services/api/scripts/configure-local-webhook.mjs
```

This requests a real **test-mode CLI** signing secret from Stripe and pipes it
directly into Doppler. It never prints it, stores it in a file, or puts it in
process arguments. It refuses to overwrite an existing signing secret. This helper
has unit tests and was executed by the operator before end-to-end validation.
Forwarding later must use the same Stripe account and `--device-name kivo-tools-stg`
with `--forward-to http://127.0.0.1:3001/webhooks/stripe`; do not log the listener's
secret-bearing startup output.

### Persistent operation on the tools server

From the Doppler-authenticated operator session (currently the root/operator tmux
server), start only missing sessions:

```sh
tmux new-session -d -s kivo-api-stg -c /home/kivo/projects/kivocafe/services/api 'doppler run --no-fallback --project kivo --config stg -- node scripts/local-runtime.mjs api'
tmux new-session -d -s kivo-stripe-listener -c /home/kivo/projects/kivocafe/services/api 'doppler run --no-fallback --project kivo --config stg -- node scripts/local-runtime.mjs listener'
curl --fail --silent http://127.0.0.1:3001/health
```

The wrapper runs children as the repository owner (`kivo`), limits their environment,
and pipes both listener output streams through an allowlist before tmux receives
anything. It compares the existing signing secret in memory and reports only
`Listener signing secret match: PASS`; a mismatch stops the listener. It never
requests a new signing secret or writes Stripe credentials to disk. `--no-fallback`
disables Doppler's default encrypted on-disk secret cache and cached-secret fallback.

For a safe restart, attach to the relevant session (`tmux attach -t kivo-api-stg`
or `tmux attach -t kivo-stripe-listener`), press Ctrl+C, and verify the old process
has exited before starting it again. For the API, the health request must stop
responding before restart. Repeat the corresponding start command above once the
session is gone; if a retained dead pane exists, use `tmux respawn-pane -t <session>
-c /home/kivo/projects/kivocafe/services/api '<same command>'` without `-k`.
Never run an unfiltered listener in a logged terminal or enable shell tracing.

### End-to-end evidence and repeatable test

On 2026-09-10, application source `826df006d27e8f737e7455954e09e41a5c3456ce`
passed actual staging Auth → API order → Stripe TEST PaymentIntent → signed CLI
webhook → Supabase paid/succeeded validation. Two Matilda Cakes cost 990 GBP pence,
calculated by the backend. Intent `pi_3UEA4DIrMMmtWJj53Mzp2JBi` succeeded through
event `evt_3UEA4DIrMMmtWJj53n47inEn`; a separate intent
`pi_3UEA4HIrMMmtWJj50KsOO536` was cancelled through a real signed CLI event.
Missing/invalid signatures were rejected and PaymentIntent retries reused one intent.

Duplicate handling replayed the same Stripe-retrieved event with a fresh SDK test
signature **after** proving real CLI delivery. This checks idempotency, not a second
Stripe-originated delivery. Order/payment/event counts and absence of reward effects
were checked. Temporary Auth users, orders and payment rows were removed; Stripe test
objects and processed `stripe_events` tombstones remain for audit/replay safety.
The seeded catalogue and permanent configuration were untouched.

An explicitly approved repeat creates new test objects (not part of Stage G):

```sh
cd /home/kivo/projects/kivocafe/services/api
doppler run --no-fallback --project kivo --config stg -- node --experimental-strip-types scripts/payment-e2e.mjs --confirm-test
```

It uses Stripe's `pm_card_visa` test PaymentMethod, never raw card details. Its
allowlisted receipt is `/tmp/kivo-stripe-payment-e2e-receipt.json` (mode 0600), outside
the repository. Failed/incomplete fixtures are retained for diagnosis using safe IDs.
PaymentSheet device interaction has not been tested by this backend runner.

The CLI listener is **local staging/development only**. A future deployed staging
or production endpoint needs its own Stripe dashboard endpoint signing secret.
CLI and dashboard `whsec` values are not interchangeable. Production remains disabled.

See [payment security](../../docs/security-payments.md) and [RLS policies](../../supabase/README.md).
