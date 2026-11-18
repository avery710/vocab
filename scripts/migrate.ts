/**
 * Apply db/schema.sql to DATABASE_URL. Safe to run any number of times.
 *
 *   DATABASE_URL=postgres://… npm run db:migrate
 *
 * Reads .env.local when present.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { getPool } from "../lib/db";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const sql = readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  const pool = getPool();
  await pool.query(sql);
  const { rows } = await pool.query<{ n: string }>("select count(*)::text as n from words");
  console.log(`Schema is up to date. ${rows[0].n} words in the dictionary.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
