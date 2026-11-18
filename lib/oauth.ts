/**
 * OAuth 2.1 for the MCP endpoint: authorization code + PKCE, public clients,
 * dynamic client registration. This is what Claude's custom connectors (web,
 * desktop and mobile) speak. Ported from Surflog's lib/oauth.ts, on plain
 * Postgres instead of Supabase.
 *
 * An access token is an `api_tokens` row that expires after an hour and
 * carries a 60-day refresh token. Refreshing rotates both in place.
 *
 * Server-only.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { query } from "./db";
import { hashToken, PREFIX, type TokenScope } from "./token-auth";

export const ACCESS_TOKEN_TTL_S = 60 * 60;
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const REFRESH_PREFIX = "vocr_";
const CODE_PREFIX = "vocc_";
const MAX_REDIRECT_URIS = 20;
const MAX_STATE_LENGTH = 8192;

export interface OAuthClient {
  clientId: string;
  name: string;
  redirectUris: string[];
}

/** https, plain http only to loopback, or a custom app scheme. Never
 *  javascript:, data: and the like, and no fragment. */
export function isAllowedRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  return !["javascript:", "data:", "file:", "blob:", "vbscript:", "about:", "ws:", "wss:"].includes(u.protocol);
}

export type RegisterResult =
  | { ok: true; client: OAuthClient }
  | { ok: false; error: "invalid_redirect_uri" | "invalid_client_metadata"; description: string };

export async function registerClient(input: { name?: unknown; redirectUris?: unknown }): Promise<RegisterResult> {
  const uris = input.redirectUris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
    return { ok: false, error: "invalid_redirect_uri", description: `redirect_uris must list 1-${MAX_REDIRECT_URIS} URIs` };
  }
  if (!uris.every(isAllowedRedirectUri)) {
    return { ok: false, error: "invalid_redirect_uri", description: "a redirect URI is not allowed" };
  }
  const name =
    (typeof input.name === "string" ? input.name : "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60) ||
    "MCP client";
  const redirectUris = [...new Set(uris as string[])];
  const clientId = randomUUID();
  await query(`insert into oauth_clients (client_id, client_name, redirect_uris) values ($1, $2, $3)`, [
    clientId,
    name,
    JSON.stringify(redirectUris),
  ]);
  return { ok: true, client: { clientId, name, redirectUris } };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 100) return null;
  const rows = await query<{ client_id: string; client_name: string; redirect_uris: string[] }>(
    `select client_id, client_name, redirect_uris from oauth_clients where client_id = $1`,
    [clientId]
  );
  const r = rows[0];
  return r ? { clientId: r.client_id, name: r.client_name, redirectUris: r.redirect_uris } : null;
}

/** PKCE S256: base64url(SHA-256(verifier)) must equal the challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

export async function createAuthCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: TokenScope;
}): Promise<string> {
  const code = CODE_PREFIX + randomBytes(32).toString("base64url");
  await query(
    `insert into oauth_codes (code_hash, client_id, redirect_uri, code_challenge, scope, expires_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [hashToken(code), input.clientId, input.redirectUri, input.codeChallenge, input.scope, new Date(Date.now() + CODE_TTL_MS)]
  );
  return code;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: TokenScope;
}

export type TokenResult = { ok: true; tokens: TokenResponse } | { ok: false; error: "invalid_grant" | "invalid_request" };

function newPair() {
  return {
    access: PREFIX + randomBytes(32).toString("base64url"),
    refresh: REFRESH_PREFIX + randomBytes(32).toString("base64url"),
  };
}

function response(access: string, refresh: string, scope: TokenScope): TokenResponse {
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refresh, scope };
}

/** authorization_code grant. The code is burned first (only an unused,
 *  unexpired code updates), so a replay or failed PKCE check can't retry. */
export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri?: string;
  codeVerifier: string;
}): Promise<TokenResult> {
  const rows = await query<{ client_id: string; redirect_uri: string; code_challenge: string; scope: TokenScope }>(
    `update oauth_codes set used_at = now()
      where code_hash = $1 and used_at is null and expires_at > now()
      returning client_id, redirect_uri, code_challenge, scope`,
    [hashToken(input.code)]
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "invalid_grant" };
  if (row.client_id !== input.clientId || (input.redirectUri != null && row.redirect_uri !== input.redirectUri)) {
    return { ok: false, error: "invalid_grant" };
  }
  if (!pkceMatches(input.codeVerifier, row.code_challenge)) return { ok: false, error: "invalid_grant" };

  const client = await getClient(row.client_id);
  const { access, refresh } = newPair();
  await query(
    `insert into api_tokens (client_id, name, scope, token_hash, expires_at, refresh_hash, refresh_expires_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      row.client_id,
      client?.name ?? "MCP client",
      row.scope,
      hashToken(access),
      new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000),
      hashToken(refresh),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    ]
  );
  return { ok: true, tokens: response(access, refresh, row.scope) };
}

/** refresh_token grant: rotates both tokens of the same grant. */
export async function refreshGrant(input: { refreshToken: string; clientId: string }): Promise<TokenResult> {
  if (!input.refreshToken.startsWith(REFRESH_PREFIX)) return { ok: false, error: "invalid_grant" };
  const { access, refresh } = newPair();
  const rows = await query<{ scope: TokenScope }>(
    `update api_tokens
        set token_hash = $1, expires_at = $2, refresh_hash = $3, refresh_expires_at = $4
      where refresh_hash = $5 and client_id = $6 and revoked_at is null and refresh_expires_at > now()
      returning scope`,
    [
      hashToken(access),
      new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000),
      hashToken(refresh),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      hashToken(input.refreshToken),
      input.clientId,
    ]
  );
  if (!rows[0]) return { ok: false, error: "invalid_grant" };
  return { ok: true, tokens: response(access, refresh, rows[0].scope) };
}

/** Where this deployment is reachable. Behind Vercel's proxy the forwarded
 *  headers carry the public host. */
export function originOf(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};

export interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  defaultScope: TokenScope;
}

/** Validate an /oauth/authorize query. Null for anything we shouldn't
 *  redirect back to: an unknown client or unregistered redirect URI must show
 *  an error, never a redirect. */
export async function parseAuthorizeRequest(p: Record<string, string | undefined>): Promise<AuthorizeRequest | null> {
  if (p.response_type !== "code") return null;
  if (p.code_challenge_method !== "S256") return null;
  const challenge = p.code_challenge ?? "";
  if (!/^[A-Za-z0-9\-_]{43}$/.test(challenge)) return null;
  const client = await getClient(p.client_id ?? "");
  if (!client || !p.redirect_uri || !client.redirectUris.includes(p.redirect_uri)) return null;
  const asked = (p.scope ?? "").split(/\s+/).filter(Boolean);
  const defaultScope: TokenScope = asked.length > 0 && asked.every((s) => s === "read") ? "read" : "write";
  // `state` must go back byte for byte; refuse rather than shorten it.
  const state = p.state ?? "";
  if (state.length > MAX_STATE_LENGTH) return null;
  return { client, redirectUri: p.redirect_uri, codeChallenge: challenge, state, defaultScope };
}
