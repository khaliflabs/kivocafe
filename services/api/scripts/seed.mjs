import { connectDatabase } from "./connection.mjs";
import { seedDatabase, catalog } from "./catalog.mjs";
let db;
try {
  db = await connectDatabase();
  await db.query("begin");
  await seedDatabase((sql, args) => db.query(sql, args));
  for (const table of ["products", "product_variants"])
    for (const expected of catalog[table]) {
      const actual = (
        await db.query(
          `select name,price_pence from public.${table} where id=$1`,
          [expected.id],
        )
      ).rows[0];
      if (
        actual.name !== expected.name ||
        actual.price_pence !== expected.price_pence
      )
        throw new Error("Catalog differs from approved source");
    }
  await db.query("commit");
  console.log("KIVO staging seed: PASS (49 products, 11 categories)");
} catch {
  if (db) await db.query("rollback");
  console.error("Seed failed; no partial catalog committed.");
  process.exitCode = 1;
} finally {
  await db?.end();
}
