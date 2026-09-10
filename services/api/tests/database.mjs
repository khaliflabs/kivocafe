import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { seedDatabase } from "../scripts/catalog.mjs";
import { databaseError } from "../src/repository.ts";
export const alice = "00000000-0000-4000-8000-000000000011";
export const bob = "00000000-0000-4000-8000-000000000012";
export async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  await db.exec(
    await readFile(
      new URL(
        "../../../supabase/migrations/202609100001_foundation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../../../supabase/migrations/202609100002_order_invariants.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await seedDatabase((sql, args) => db.query(sql, args));
  await db.query("insert into auth.users(id) values($1),($2)", [alice, bob]);
  const rpc = async (name, args) => {
    try {
      return (
        await db.query(
          `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) result`,
          args,
        )
      ).rows[0].result;
    } catch (error) {
      databaseError(error);
    }
  };
  const repo = {
    authenticate: async (token) => ({ alice, bob })[token] ?? null,
    create: (user, basket) =>
      rpc("create_order", [
        user,
        basket.requestId,
        JSON.stringify(basket.items),
      ]),
    list: async (user) =>
      (await db.query("select * from orders where user_id=$1", [user])).rows,
    get: async (user, id) =>
      (
        await db.query("select * from orders where user_id=$1 and id=$2", [
          user,
          id,
        ])
      ).rows[0] ?? null,
    prepare: async (user, id) => {
      await rpc("prepare_payment", [user, id]);
      return repo.get(user, id);
    },
    payment: async (id) =>
      (
        await db.query(
          "select stripe_payment_intent_id from payments where order_id=$1",
          [id],
        )
      ).rows[0]?.stripe_payment_intent_id ?? null,
    record: (user, id, intent, amount) =>
      rpc("record_payment", [user, id, intent, amount]),
    cancel: (user, id) => rpc("cancel_draft", [user, id]),
    event: (e) =>
      rpc("apply_stripe_event", [
        e.id,
        e.type,
        e.intent,
        e.order,
        e.user,
        e.amount,
        e.currency,
      ]),
  };
  return { db, repo };
}
export const basket = (
  items = [{ productId: "king-ferrero", quantity: 2, optionIds: [] }],
) => ({ requestId: randomUUID(), items });
