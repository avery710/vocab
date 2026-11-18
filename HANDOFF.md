# Handoff: where Vocab stands (2026-11-18)

Built in a Claude chat session, then deployed by Claude Code on 2026-11-18.
Read `CLAUDE.md` for the project rules; this file is the status and what's left.
Delete this file once the step below is done.

## Done and verified (2026-11-18)

- **Code**: `npm test` (17 tests against a real Postgres, including OAuth → MCP),
  `npm run typecheck` and `npm run build` pass. Checked in a browser against
  `next start`: add / edit / duplicate and sentence refusal / Chinese search /
  letter filter / consent page → code → token → MCP `add_word`.
- **GitHub**: `github.com/avery710/vocab`, default branch `main`.
- **Neon**: free project in AWS Singapore; `npm run db:migrate` applied the schema.
  The live site reads from it (checked in the Vercel logs after sign-in).
- **Vercel**: project `vocab` at https://capy-vocab.vercel.app, region `sin1`,
  with `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
  `OWNER_EMAIL` and `APP_URL` set for Production. The site is public (no Vercel
  login wall); unauthenticated `/api/mcp` returns 401 with the OAuth metadata
  pointer.
- **Google sign-in**: real sign-in works on the live site with the owner account.
- **Notion import**: 289 entries, 0 skipped, 66 related-word pairs linked.
  Spot-checked apt, lever, on hire and implacable (with its four links) against
  the export.
- **Claude connector**: added in claude.ai at `https://capy-vocab.vercel.app/api/mcp`
  with write access. Tested overview, `get_word`, Chinese search and
  `review_words`; `add_word` saved "reinstate" (dictionary now 290 entries).
- **Focus outline**: single green line on the search box, single navy line on
  form fields (commit `bd45a94`), live.

## Left to do

1. **Switch the `english-dictionary` skill**: upload the rewritten skill
   (`claude-skill/english-dictionary/`, zipped) in claude.ai → Settings →
   Capabilities → Skills, replacing the Notion version. Then send a bare word in a
   new chat and check it lands on the site. Not verified yet: the skill's behaviour
   inside claude.ai.

## Optional

- Change `sslmode=require` to `sslmode=verify-full` in `DATABASE_URL` (Vercel and
  `.env.local`) to silence `pg`'s SSL warning.
