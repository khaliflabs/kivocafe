import pg from "pg";
import { readFile } from "node:fs/promises";
export async function connectDatabase() {
  if (
    process.env.DOPPLER_PROJECT !== "kivo" ||
    process.env.DOPPLER_CONFIG !== "stg"
  )
    throw new Error("Run only under Doppler kivo/stg");
  const url = new URL(process.env.SUPABASE_URL);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))
    throw new Error("Unexpected Supabase project URL");
  const ref = url.hostname.split(".")[0];
  if (!process.env.SUPABASE_DB_PASSWORD || !process.env.SUPABASE_CA_PATH)
    throw new Error("Database password and verified CA path required");
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    database: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: {
      rejectUnauthorized: true,
      ca: await readFile(process.env.SUPABASE_CA_PATH, "utf8"),
    },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}
