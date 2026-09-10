import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { connectDatabase } from "./connection.mjs";
let db;
try {
  db = await connectDatabase();
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext('kivo-migrations'))");
  await db.query("create schema if not exists kivo_migrations");
  await db.query(
    "revoke all on schema kivo_migrations from public,anon,authenticated",
  );
  await db.query(
    "create table if not exists kivo_migrations.applied(version text primary key,checksum text not null,applied_at timestamptz not null default now())",
  );
  const dir = new URL("../../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(name, dir), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const prior = (
      await db.query(
        "select checksum from kivo_migrations.applied where version=$1",
        [name],
      )
    ).rows[0];
    if (prior) {
      if (prior.checksum !== checksum)
        throw new Error("Applied migration was changed");
      continue;
    }
    await db.query(sql);
    await db.query(
      "insert into kivo_migrations.applied(version,checksum) values($1,$2)",
      [name, checksum],
    );
    console.log(`Applied ${name}`);
  }
  await db.query("commit");
  console.log("KIVO staging migrations: PASS");
} catch {
  if (db) await db.query("rollback");
  console.error(
    "Migration failed; transaction rolled back. Check connection, CA, and migration history.",
  );
  process.exitCode = 1;
} finally {
  await db?.end();
}
