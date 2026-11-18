# Vocab

My English vocabulary notebook: English words and phrases with Traditional
Chinese definitions, examples and notes. Before this, it lived in a Notion
database.

- **Website**: browse with A–Z tabs, search in English or 中文, filter by type and tag,
  add and edit words, listen to the pronunciation, review with flashcards.
- **MCP connector**: add `https://<your-domain>/api/mcp` to Claude as a custom
  connector, then send Claude a word from any chat (phone or computer). It looks the
  word up and saves it here.
- **Just for me**: Google sign-in, limited to `OWNER_EMAIL`.

Stack: Next.js 16 (App Router) + Tailwind 4, Postgres on Neon (`pg`), Auth.js
(Google), `mcp-handler` for the MCP endpoint, OAuth 2.1 + PKCE for AI apps (ported
from Surflog). Hosted on Vercel.

## Set up (once)

1. **Database (Neon)**: create a free project at neon.tech, picking the AWS
   Singapore region (close to Taiwan, and the same region as the Vercel functions in
   `vercel.json`). Copy the **pooled** connection string (its host contains `-pooler`).
2. **Google sign-in**: in Google Cloud Console → APIs & Services → Credentials,
   create an OAuth client ID (Web application). Authorized redirect URI:
   `https://<your-domain>/api/auth/callback/google` (add
   `http://localhost:3000/api/auth/callback/google` for local dev). You can reuse
   Surflog's Google Cloud project, but create a new client.
3. **Vercel**: import this repo, then set these environment variables:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection string |
   | `AUTH_SECRET` | `npx auth secret` or `openssl rand -base64 32` |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from step 2 |
   | `OWNER_EMAIL` | your Google account email (only this account can sign in) |
   | `APP_URL` | optional: `https://<your-domain>`, used in links the MCP tools return |

4. **Create the tables**: locally, put `DATABASE_URL` in `.env.local` and run
   `npm run db:migrate`. It is safe to run again after schema changes.
5. **Import the Notion words**: in Notion, open the English Dictionary → ⋯ → Export →
   Markdown & CSV. Unzip, then:

   ```sh
   npm run import:notion -- "English Dictionary_all.csv" --dry-run   # check first
   npm run import:notion -- "English Dictionary_all.csv"
   ```

   Words already in the database are skipped (pass `--update` to overwrite them).
   Related words are linked by title.
6. **Connect Claude**: open the site's *Connect AI* page, copy the URL, and in Claude
   go to Settings → Connectors → Add custom connector. Press Connect, sign in, and
   choose *Look up, add and edit words*.

## MCP tools

| Tool | What it does |
| --- | --- |
| `search_words` | Search (English or Chinese) or browse; filter by letter, type, tag, date |
| `get_word` | One full entry by term or id |
| `review_words` | Random words for a quiz |
| `dictionary_overview` | Count, latest date, tags and types in use |
| `add_word` | Save a new word or phrase (never a whole sentence: max 8 words) |
| `update_word` | Change fields, rename, add or remove related words |
| `delete_word` | Delete an entry |

A connection approved as *read only* gets only the first four.

## Develop

```sh
npm install
cp .env.example .env.local   # fill in
npm run db:migrate
npm run dev
```

Tests run against a real Postgres (`TEST_DATABASE_URL`, default
`postgres://vocab:vocab@localhost:5432/vocab_test`): `npm test`. They cover the
dictionary queries, the Notion CSV parser, and the full OAuth → MCP flow through the
route handlers.
