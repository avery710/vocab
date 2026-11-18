-- Vocab schema. Idempotent: `npm run db:migrate` runs this whole file every
-- time, so every statement must be safe to repeat.

-- ── Dictionary ─────────────────────────────────────────────────────────────

create table if not exists words (
  id uuid primary key default gen_random_uuid(),
  term text not null check (length(trim(term)) between 1 and 200),
  -- Lookup key: one entry per word/phrase, ignoring case and outer spaces.
  term_key text generated always as (lower(trim(term))) stored,
  pronunciation text not null default '',
  part_of_speech text check (part_of_speech in ('noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other')),
  definition text not null default '',
  chinese_definition text not null default '',
  example text not null default '',
  example_zh text not null default '',
  note text not null default '',
  tags text[] not null default '{}',
  date_added date not null default (now() at time zone 'Asia/Taipei')::date,
  notion_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists words_term_key on words (term_key);
create index if not exists words_date_added on words (date_added desc, created_at desc);
create index if not exists words_tags on words using gin (tags);

-- Review (light spaced repetition). review_due null = never reviewed.
-- "Knew it" moves a word up a level and further out (1, 3, 7, 14, 30, 60 days);
-- "Again" drops it to level 0, due tomorrow. Dates are Taiwan dates.
alter table words add column if not exists review_level int not null default 0;
alter table words add column if not exists review_due date;
alter table words add column if not exists last_reviewed_at timestamptz;

-- "Related words" — stored in both directions so a lookup is one WHERE.
create table if not exists word_links (
  word_id uuid not null references words (id) on delete cascade,
  related_id uuid not null references words (id) on delete cascade,
  primary key (word_id, related_id),
  check (word_id <> related_id)
);

-- ── OAuth for the MCP endpoint (ported from Surflog) ───────────────────────

create table if not exists oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists oauth_codes (
  code_hash text primary key,
  client_id text not null references oauth_clients (client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null check (scope in ('read', 'write')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id text references oauth_clients (client_id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('read', 'write')),
  token_hash text not null unique,
  refresh_hash text unique,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
