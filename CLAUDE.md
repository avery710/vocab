# Vocab

Capy's personal English vocabulary notebook (EN ↔ 繁體中文). Replaced the Notion
"English Dictionary" database in Nov 2026. Single user: Google sign-in limited to
`OWNER_EMAIL`; no owner column anywhere.

## Layout

- `db/schema.sql`: the whole schema, idempotent (`npm run db:migrate`).
- `lib/words.ts`: every dictionary query. `lib/word-input.ts`: the one zod schema
  the forms, MCP tools and import all share.
- `lib/mcp-tools.ts` + `app/api/mcp/route.ts`: the MCP server. Write tools are not
  registered for read-only tokens.
- `lib/oauth.ts`, `lib/token-auth.ts`, `app/api/oauth/*`, `app/.well-known/*`,
  `app/oauth/authorize`: OAuth 2.1 + PKCE + dynamic registration, ported from Surflog
  (github.com/avery710/surflog) onto plain Postgres.
- `proxy.ts`: the sign-in gate. Only the auth routes, `/api/mcp` (own bearer check)
  and the pre-sign-in OAuth endpoints get through without a session.
- `lib/notion-import.ts` + `scripts/import-notion.ts`: one-off Notion CSV import.

## Rules

- Entries are words or phrases, never whole sentences (max 8 words, enforced in
  `termSchema`). The Notion import is exempt so old entries come over as they were.
- Definitions: one sense per line. Imported Notion entries join senses with "；" or
  "; "; `lib/format.ts#senses` splits both.
- Look: navy ink on cool paper, Newsreader for headwords, Schibsted Grotesk + Noto
  Sans TC for text. The one bold element is the marker-yellow highlighter on
  headwords and the active A–Z tab. Keep everything else quiet.
- Tests hit a real Postgres (`npm test`); keep the OAuth → MCP end-to-end test green.
