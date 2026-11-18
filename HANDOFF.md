# Handoff: where Vocab stands (2026-11-18)

Built in a Claude chat session and handed to Claude Code to finish and ship.
Read `CLAUDE.md` for the project rules; this file is the status and the to-do list.
Delete this file once everything below is done.

## Done and verified

- Next.js 16 app: word list (A–Z tabs, search EN/中文, type/tag/order filters,
  "show more"), word page (senses, 例句, 筆記, 相關字, speak button), add/edit form
  with validation, two-step delete, flashcard review, Connect AI page, sign-in page,
  OAuth consent page.
- MCP endpoint `/api/mcp` with OAuth 2.1 + PKCE + dynamic client registration, ported
  from Surflog onto plain Postgres. Tools: `search_words`, `get_word`, `review_words`,
  `dictionary_overview`, `add_word`, `update_word`, `delete_word` (write tools only for
  write-scoped tokens).
- Notion CSV import (`npm run import:notion`), tested on a sample export.
- Look: Surflog's fonts (Funnel Sans + IBM Plex Mono, self-hosted via @fontsource),
  neon-green highlighter `#39ff14`, light grey `#f5f5f6` background, white cards.
- `npm test`: 17 tests against a real local Postgres, including the full OAuth → MCP
  flow through the route handlers. `npm run typecheck` and `npm run build` pass.
- Checked in a real browser against `next start`: add / edit / duplicate and
  sentence refusal / Chinese search / letter filter / consent page → code → token →
  MCP `add_word`.

## Not verified yet (needs Capy's accounts)

- Real Google sign-in (only tested with a hand-minted Auth.js session cookie).
- Neon itself (tested on local Postgres 16; `lib/db.ts` turns on TLS for any
  non-localhost URL).
- Adding the connector in Claude (claude.ai) for real.

## Next steps, in order

1. **Push**: `git push -u origin main` (repo `git@github.com:avery710/vocab.git` is
   empty and waiting).
2. **Neon**: Capy creates a free project in AWS Singapore (matches `vercel.json`
   region `sin1`). Use the *pooled* connection string as `DATABASE_URL`.
3. **Google OAuth client** (Web): redirect URIs
   `https://<domain>/api/auth/callback/google` and
   `http://localhost:3000/api/auth/callback/google`.
4. **Vercel**: import the repo, set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
   `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL`, optionally `APP_URL`. Decide the domain
   (open question: a subdomain of surflog.tw, a vercel.app URL, or something else).
5. **Tables**: `npm run db:migrate` with the Neon URL in `.env.local`.
6. **Import**: Capy exports the Notion "English Dictionary" (⋯ → Export → Markdown &
   CSV). Run `npm run import:notion -- "<file>_all.csv" --dry-run`, check the skipped
   lines, then run it for real. Expect about 289 words. Spot-check a few entries
   (apt, lever, on hire) and that related words linked.
7. **Connect Claude**: Settings → Connectors → Add custom connector →
   `https://<domain>/api/mcp`, approve with "Look up, add and edit words". Then send a
   word in a chat and confirm it lands on the site.
8. **Switch the `english-dictionary` skill** (claude.ai skill, currently writes to
   Notion) to use the Vocab connector's `get_word` / `add_word` instead. Keep its
   rule: save words and phrases only, never whole sentences.

## Gotchas

- `npm install` on a fresh tree hit an npm arborist bug ("Cannot read properties of
  null (reading 'edgesOut')") from vitest's peer set; `.npmrc` sets
  `legacy-peer-deps=true`. `npm ci` from the lockfile works.
- `next/font/google` was replaced with @fontsource on purpose (builds without
  reaching Google Fonts). Don't switch back without a reason.
- Next route params may or may not be percent-encoded; use `safeDecode` from
  `lib/format.ts` for `/w/[term]`.
- The search count query must not carry the ranking parameter (Postgres can't type an
  unused `$n`); see the comment in `searchWords`.
