/**
 * Bearer tokens for the MCP endpoint (table `api_tokens`), issued through
 * OAuth (lib/oauth.ts) when an AI app such as Claude connects. Ported from
 * Surflog, minus owners (single-user app) and personal tokens.
 *
 * Only the SHA-256 of a token (`voc_` + 32 random bytes) is stored. A token
 * resolves to a scope: "read" can search and look up, "write" can also add,
 * edit and delete words.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";
import { query } from "./db";

export const PREFIX = "voc_";
const LAST_USED_REFRESH_MS = 60_000;

export type TokenScope = "read" | "write";

export interface TokenAuth {
  scope: TokenScope;
  tokenId: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseTokenScope(v: unknown): TokenScope | null {
  return v === "read" || v === "write" ? v : null;
}

/** Resolve `Authorization: Bearer voc_…`, or null for anything missing,
 *  malformed, unknown, expired or revoked. */
export async function authenticateBearer(authorization: string | null | undefined): Promise<TokenAuth | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? "");
  const token = match?.[1];
  if (!token || !token.startsWith(PREFIX)) return null;

  const rows = await query<{ id: string; scope: TokenScope; expires_at: Date | null; last_used_at: Date | null }>(
    `select id, scope, expires_at, last_used_at from api_tokens where token_hash = $1 and revoked_at is null`,
    [hashToken(token)]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) return null;

  if (!row.last_used_at || Date.now() - row.last_used_at.getTime() > LAST_USED_REFRESH_MS) {
    await query(`update api_tokens set last_used_at = now() where id = $1`, [row.id]).catch(() => undefined);
  }
  return { scope: row.scope, tokenId: row.id };
}

export interface ConnectedApp {
  id: string;
  name: string;
  host: string | null;
  scope: TokenScope;
  createdAt: string;
  lastUsedAt: string | null;
}

/** One short label for where an app's sign-in returns to (`claude.ai`). */
export function hostLabel(uris: unknown): string | null {
  if (!Array.isArray(uris)) return null;
  const hosts = [
    ...new Set(
      uris.flatMap((u) => {
        try {
          const url = new URL(String(u));
          return [url.host || url.protocol];
        } catch {
          return [];
        }
      })
    ),
  ];
  if (hosts.length <= 1) return hosts[0] ?? null;
  return [...new Set(hosts.map((h) => h.split(":")[0].split(".").slice(-2).join(".")))].join(", ");
}

export async function listConnectedApps(): Promise<ConnectedApp[]> {
  const rows = await query<{
    id: string;
    name: string;
    scope: TokenScope;
    created_at: Date;
    last_used_at: Date | null;
    redirect_uris: unknown;
  }>(
    `select t.id, t.name, t.scope, t.created_at, t.last_used_at, c.redirect_uris
       from api_tokens t left join oauth_clients c on c.client_id = t.client_id
      where t.revoked_at is null and (t.refresh_expires_at is null or t.refresh_expires_at > now())
      order by coalesce(t.last_used_at, t.created_at) desc`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    host: hostLabel(r.redirect_uris),
    scope: r.scope,
    createdAt: r.created_at.toISOString(),
    lastUsedAt: r.last_used_at?.toISOString() ?? null,
  }));
}

export async function revokeApp(id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await query(`update api_tokens set revoked_at = now() where id = $1 and revoked_at is null returning id`, [id]);
  return rows.length > 0;
}
