# KIVO database policies

Every public table has RLS enabled. Privileged writes are service-role-only; all
security-definer RPCs have PUBLIC/anon/authenticated EXECUTE revoked and a fixed
empty search path. Explicit grants accompany policies; RLS alone is not relied on.

| Tables | Customer policy |
| --- | --- |
| categories | Public SELECT only |
| products, product_variants, product_options | Public SELECT only for active catalogue entries and visible parents |
| product_option_groups | Public SELECT for visible parent products |
| stores, promotions | Public SELECT only when active |
| profiles | Authenticated SELECT own row; UPDATE only `display_name` on own row |
| orders | Authenticated SELECT own orders; no customer writes |
| order_items, order_item_options | SELECT only through an owned order |
| favorites | SELECT/INSERT/DELETE own rows; no updates granted |
| rewards_accounts, rewards_transactions | SELECT own rows; no customer writes |
| payments, stripe_events | No customer grants or policies; server only |

Profile creation is an Auth insert trigger with no client-supplied privilege fields.
Prices use integer pence and all amounts/statuses have database constraints. Seed
catalogue slugs preserve local IDs; UUIDs identify orders, customers and payment rows.
Strawberry variant IDs are `chocolate-strawberries:six` and `:ten`; mobile serialization
performs this explicit mapping. Unknown sauce groups are seeded required with zero
options, intentionally preventing incomplete orders. No dietary assumptions added.

Migrations are additive. Tests execute every migration, validate actual table columns
against raw-card field names, exercise RLS under an authenticated database role, and
check order/webhook transactions. Hosted migration commands are in `services/api/README.md`.
