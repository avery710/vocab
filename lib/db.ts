/**
 * Postgres access (Neon in production, any Postgres locally) through one
 * shared `pg` pool. DATABASE_URL should be Neon's *pooled* connection string
 * (host contains `-pooler`) so serverless functions don't exhaust
 * connections.
 *
 * Server-only.
 */
import { Pool, type QueryResultRow } from "pg";

declare global {
  // Survives Next.js dev hot reloads, so we don't open a new pool per edit.
  var __vocabPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__vocabPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
    globalThis.__vocabPool = new Pool({
      connectionString,
      max: 5,
      ssl: local ? undefined : { rejectUnauthorized: true },
    });
  }
  return globalThis.__vocabPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

/** Run `fn` inside one transaction on one connection. */
export async function transaction<T>(fn: (q: typeof query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const q = async <R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) =>
      (await client.query<R>(text, params)).rows;
    const result = await fn(q as typeof query);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
