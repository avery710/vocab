# Vocab

Capy's personal English vocabulary notebook (EN ↔ 繁體中文). Replaced the Notion
"English Dictionary" database in Nov 2026. Single user: Google sign-in limited to
`OWNER_EMAIL`; no owner column anywhere.

## Status

Live since 2026-11-18 at https://capy-vocab.vercel.app (Vercel project `vocab`,
personal scope, region `sin1`). Every push to `main` deploys production. Database:
Neon free plan, AWS Singapore, pooled URL. The 289 Notion entries are imported, and
the Claude connector (`/api/mcp`) is added and tested. `HANDOFF.md` has the one
step left.

Changing the domain (it was `vocab-two-tau.vercel.app` until the 2026-11-18
rename) touches four places: the Google client's redirect URI, `APP_URL` in Vercel
(then redeploy), the Claude connector (remove and re-add with the new `/api/mcp`),
and the address in `claude-skill/english-dictionary/SKILL.md`.

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
- `claude-skill/english-dictionary/SKILL.md`: source of Capy's claude.ai
  `english-dictionary` skill, which saves words through the connector. Zip the
  folder and upload it in claude.ai; the copy under `~/.claude/skills/synced` is a
  read-only mirror of the claude.ai version.

## Rules

- Entries are words or phrases, never whole sentences (max 8 words, enforced in
  `termSchema`). The Notion import is exempt so old entries come over as they were.
- Definitions: one sense per line. Imported Notion entries join senses with "；" or
  "; "; `lib/format.ts#senses` splits both.
- Look: navy ink on light grey (#f5f5f6) with white cards and fields. Type matches Surflog: Funnel Sans for all text
  (headwords 700, −0.02em, like Surflog's spot titles), IBM Plex Mono for figures
  (the word count, the review counter). Self-hosted via @fontsource, not
  next/font/google. Chinese falls back to the system font, as in Surflog. The one bold element is the neon-green highlighter (#39ff14) on
  headwords and the active A–Z tab. Keep everything else quiet.
- Focus: one outline, never two. The search box gets a single neon-green line,
  form fields (`.field`) a single navy line. The global `:focus-visible` rule lives
  in `@layer base` so component utilities like `focus:outline-none` can beat it;
  unlayered, it wins over every Tailwind utility and draws a second outline.
- Tests hit a real Postgres (`npm test`); keep the OAuth → MCP end-to-end test green.

## Gotchas

- A fresh checkout or worktree needs `npm ci` (from the lockfile) and a
  `.env.local`. Plain `npm install` hit an npm arborist bug ("Cannot read
  properties of null (reading 'edgesOut')"); `.npmrc` sets `legacy-peer-deps=true`.
- `next/font/google` was replaced with @fontsource on purpose (builds without
  reaching Google Fonts). Don't switch back without a reason.
- Next route params may or may not be percent-encoded; use `safeDecode` from
  `lib/format.ts` for `/w/[term]`.
- The search count query must not carry the ranking parameter (Postgres can't type
  an unused `$n`); see the comment in `searchWords`.
- `pg` logs a "SECURITY WARNING … sslmode" for Neon's `sslmode=require`. Harmless:
  it already means full certificate checks. `sslmode=verify-full` in
  `DATABASE_URL` silences it.
