/**
 * End to end through the real route handlers: an AI app registers, the owner
 * approves (createAuthCode stands in for the consent page), the app swaps the
 * code for tokens, then calls MCP tools over Streamable HTTP.
 */
import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as mcpPost } from "@/app/api/mcp/route";
import { POST as registerPost } from "@/app/api/oauth/register/route";
import { POST as tokenPost } from "@/app/api/oauth/token/route";
import { createAuthCode, parseAuthorizeRequest } from "@/lib/oauth";
import { listConnectedApps, revokeApp } from "@/lib/token-auth";

const ORIGIN = "https://vocab.example";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

async function connect(scope: "read" | "write" = "write") {
  const reg = await registerPost(
    new Request(`${ORIGIN}/api/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Claude", redirect_uris: [REDIRECT] }),
    })
  );
  expect(reg.status).toBe(201);
  const { client_id } = await reg.json();

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const parsed = await parseAuthorizeRequest({
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: challenge,
    client_id,
    redirect_uri: REDIRECT,
    state: "xyz",
  });
  expect(parsed?.client.name).toBe("Claude");
  const code = await createAuthCode({ clientId: client_id, redirectUri: REDIRECT, codeChallenge: challenge, scope });

  const form = new URLSearchParams({ grant_type: "authorization_code", code, client_id, code_verifier: verifier, redirect_uri: REDIRECT });
  const tok = await tokenPost(new Request(`${ORIGIN}/api/oauth/token`, { method: "POST", body: form }));
  expect(tok.status).toBe(200);
  const tokens = await tok.json();

  // A code works once.
  const replay = await tokenPost(new Request(`${ORIGIN}/api/oauth/token`, { method: "POST", body: form }));
  expect(replay.status).toBe(400);
  return { ...tokens, client_id } as { access_token: string; refresh_token: string; client_id: string };
}

let rpcId = 0;
async function rpc(token: string | null, method: string, params: Record<string, unknown> = {}) {
  const res = await mcpPost(
    new Request(`${ORIGIN}/api/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    })
  );
  const text = await res.text();
  if (res.status !== 200) return { status: res.status, headers: res.headers, body: text };
  // Streamable HTTP may answer as SSE: take the data line.
  const data = text.includes("data:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text;
  return { status: res.status, headers: res.headers, body: JSON.parse(data) };
}

async function call(token: string, name: string, args: Record<string, unknown>) {
  const r = await rpc(token, "tools/call", { name, arguments: args });
  const result = r.body.result as { content: { text: string }[]; isError?: boolean };
  let parsed: unknown = result.content[0].text;
  try {
    parsed = JSON.parse(result.content[0].text);
  } catch {}
  return { isError: !!result.isError, data: parsed as Record<string, any> };
}

describe("MCP over OAuth", () => {
  it("401s without a token and points to the OAuth metadata", async () => {
    const r = await rpc(null, "tools/list");
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain(`${ORIGIN}/.well-known/oauth-protected-resource`);
  });

  it("adds, finds, updates and searches words", async () => {
    const { access_token } = await connect("write");
    const list = await rpc(access_token, "tools/list");
    const names = list.body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      "search_words", "get_word", "review_words", "dictionary_overview", "add_word", "update_word", "delete_word",
    ]);

    const added = await call(access_token, "add_word", {
      term: "apt",
      pronunciation: "/æpt/",
      partOfSpeech: "adjective",
      definition: "Suitable or appropriate",
      chineseDefinition: "恰當的、貼切的",
      tags: ["casual"],
    });
    expect(added.isError).toBe(false);
    expect(added.data.word.url).toBe(`${ORIGIN}/w/apt`);

    const dup = await call(access_token, "add_word", { term: "APT" });
    expect(dup.isError).toBe(true);
    expect(dup.data.existing.term).toBe("apt");

    const sentence = await rpc(access_token, "tools/call", {
      name: "add_word",
      arguments: { term: "That was an apt description of the situation." },
    });
    expect(JSON.stringify(sentence.body)).toMatch(/not (a whole sentence|the sentence)/);

    const upd = await call(access_token, "update_word", { id: "apt", note: "apt to + V：傾向於" });
    expect(upd.data.word.note).toBe("apt to + V：傾向於");
    expect(upd.data.word.chineseDefinition).toBe("恰當的、貼切的");

    const found = await call(access_token, "search_words", { query: "貼切" });
    expect(found.data.words.map((w: { term: string }) => w.term)).toEqual(["apt"]);

    const ov = await call(access_token, "dictionary_overview", {});
    expect(ov.data.total).toBe(1);

    const del = await call(access_token, "delete_word", { id: "apt" });
    expect(del.data).toEqual({ deleted: true, term: "apt" });
    expect((await call(access_token, "get_word", { term: "apt" })).isError).toBe(true);
  });

  it("a read-only connection gets no write tools", async () => {
    const { access_token } = await connect("read");
    const list = await rpc(access_token, "tools/list");
    expect(list.body.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "search_words", "get_word", "review_words", "dictionary_overview",
    ]);
  });

  it("refresh rotates tokens; revoking cuts the app off", async () => {
    const t = await connect("write");
    const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: t.client_id });
    const res = await tokenPost(new Request(`${ORIGIN}/api/oauth/token`, { method: "POST", body: form }));
    const fresh = await res.json();
    expect(fresh.access_token).not.toBe(t.access_token);
    expect((await rpc(t.access_token, "tools/list")).status).toBe(401);
    expect((await rpc(fresh.access_token, "tools/list")).status).toBe(200);

    const apps = await listConnectedApps();
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ name: "Claude", host: "claude.ai", scope: "write" });
    await revokeApp(apps[0].id);
    expect((await rpc(fresh.access_token, "tools/list")).status).toBe(401);
  });
});
