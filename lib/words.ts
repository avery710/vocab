/**
 * The dictionary: every read and write of `words` and `word_links`.
 * Single-user app, so there is no owner column; who may call these is decided
 * by the caller (proxy.ts + requireOwner for the web, bearer tokens for MCP).
 *
 * Server-only.
 */
import { query, transaction } from "./db";
import {
  normalizeTags,
  type NewWord,
  type PartOfSpeech,
  type WordFields,
} from "./word-input";

export interface RelatedRef {
  id: string;
  term: string;
}

export interface Word {
  id: string;
  term: string;
  pronunciation: string;
  partOfSpeech: PartOfSpeech | null;
  definition: string;
  chineseDefinition: string;
  example: string;
  exampleZh: string;
  note: string;
  tags: string[];
  dateAdded: string;
  createdAt: string;
  updatedAt: string;
  related: RelatedRef[];
  /** Review level (0 = new or last marked "Again"). */
  reviewLevel: number;
  /** Next review date (YYYY-MM-DD, Taiwan); null = never reviewed. */
  reviewDue: string | null;
}

interface WordRow {
  id: string;
  term: string;
  pronunciation: string;
  part_of_speech: PartOfSpeech | null;
  definition: string;
  chinese_definition: string;
  example: string;
  example_zh: string;
  note: string;
  tags: string[];
  date_added: string;
  created_at: Date;
  updated_at: Date;
  related: RelatedRef[] | null;
  review_level: number;
  review_due: string | null;
}

// date_added comes back as text (cast in SQL) so no timezone shifting happens.
const SELECT = `
  select w.id, w.term, w.pronunciation, w.part_of_speech, w.definition, w.chinese_definition,
         w.example, w.example_zh, w.note, w.tags, w.date_added::text as date_added,
         w.created_at, w.updated_at, w.review_level, w.review_due::text as review_due,
         (select coalesce(json_agg(json_build_object('id', r.id, 'term', r.term) order by r.term_key), '[]')
            from word_links l join words r on r.id = l.related_id
           where l.word_id = w.id) as related
    from words w`;

function toWord(r: WordRow): Word {
  return {
    id: r.id,
    term: r.term,
    pronunciation: r.pronunciation,
    partOfSpeech: r.part_of_speech,
    definition: r.definition,
    chineseDefinition: r.chinese_definition,
    example: r.example,
    exampleZh: r.example_zh,
    note: r.note,
    tags: r.tags,
    dateAdded: r.date_added,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    related: r.related ?? [],
    reviewLevel: r.review_level,
    reviewDue: r.review_due,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getWordById(id: string): Promise<Word | null> {
  if (!UUID.test(id)) return null;
  const rows = await query<WordRow>(`${SELECT} where w.id = $1`, [id]);
  return rows[0] ? toWord(rows[0]) : null;
}

export async function getWordByTerm(term: string): Promise<Word | null> {
  const rows = await query<WordRow>(`${SELECT} where w.term_key = lower(trim($1))`, [term]);
  return rows[0] ? toWord(rows[0]) : null;
}

/** By id when it looks like one, otherwise by term. */
export async function findWord(idOrTerm: string): Promise<Word | null> {
  return UUID.test(idOrTerm) ? getWordById(idOrTerm) : getWordByTerm(idOrTerm);
}

export type SortOrder = "newest" | "oldest" | "alpha";

export interface SearchOptions {
  q?: string;
  /** First letter, a–z, or "#" for anything else. */
  letter?: string;
  partOfSpeech?: PartOfSpeech;
  tag?: string;
  addedFrom?: string;
  addedTo?: string;
  sort?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  total: number;
  words: Word[];
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export async function searchWords(opts: SearchOptions = {}): Promise<SearchResult> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const q = opts.q?.trim();
  if (q) {
    const like = p(`%${escapeLike(q)}%`);
    where.push(
      `(w.term ilike ${like} or w.definition ilike ${like} or w.chinese_definition ilike ${like}
        or w.note ilike ${like} or w.example ilike ${like} or w.example_zh ilike ${like} or w.pronunciation ilike ${like})`
    );
  }
  if (opts.letter) {
    const l = opts.letter.toLowerCase();
    if (/^[a-z]$/.test(l)) where.push(`left(w.term_key, 1) = ${p(l)}`);
    else where.push(`left(w.term_key, 1) !~ '[a-z]'`);
  }
  if (opts.partOfSpeech) where.push(`w.part_of_speech = ${p(opts.partOfSpeech)}`);
  if (opts.tag) where.push(`${p(opts.tag.trim().toLowerCase())} = any(w.tags)`);
  if (opts.addedFrom) where.push(`w.date_added >= ${p(opts.addedFrom)}::date`);
  if (opts.addedTo) where.push(`w.date_added <= ${p(opts.addedTo)}::date`);

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const order =
    opts.sort === "alpha"
      ? "w.term_key asc"
      : opts.sort === "oldest"
        ? "w.date_added asc, w.created_at asc"
        : "w.date_added desc, w.created_at desc";
  // With a search, the headword itself matching beats a hit in a definition.
  // Its parameter goes last, and only into the rows query (the count query
  // must not carry an unused parameter).
  const rowParams = q ? [...params, q.toLowerCase()] : params;
  const qParam = `$${rowParams.length}::text`;
  const rank = q
    ? `case when w.term_key = ${qParam} then 0 when w.term_key like ${qParam} || '%' then 1 when w.term_key like '%' || ${qParam} || '%' then 2 else 3 end, `
    : "";

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const [rows, count] = await Promise.all([
    query<WordRow>(`${SELECT} ${whereSql} order by ${rank}${order} limit ${limit} offset ${offset}`, rowParams),
    query<{ n: number }>(`select count(*)::int as n from words w ${whereSql}`, params),
  ]);
  return { total: count[0].n, words: rows.map(toWord) };
}

/** Days until the next review after "Knew it", by the level reached. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];
const TODAY = `(now() at time zone 'Asia/Taipei')::date`;

type ReviewFilter = { tag?: string; partOfSpeech?: PartOfSpeech };

function reviewWhere(filter: ReviewFilter, params: unknown[]): string[] {
  const where: string[] = [];
  if (filter.tag) {
    params.push(filter.tag.toLowerCase());
    where.push(`$${params.length} = any(w.tags)`);
  }
  if (filter.partOfSpeech) {
    params.push(filter.partOfSpeech);
    where.push(`w.part_of_speech = $${params.length}`);
  }
  return where;
}

/**
 * Words to review now: those due (oldest due date first), then ones never
 * reviewed, shuffled. Words not yet due never come up, so a word you just
 * marked doesn't reappear until its date.
 */
export async function reviewWords(n: number, filter: ReviewFilter = {}): Promise<Word[]> {
  const params: unknown[] = [];
  const where = [...reviewWhere(filter, params), `(w.review_due is null or w.review_due <= ${TODAY})`];
  const rows = await query<WordRow>(
    `${SELECT} where ${where.join(" and ")}
      order by (w.review_due is null), w.review_due, random()
      limit ${Math.min(Math.max(n, 1), 50)}`,
    params
  );
  return rows.map(toWord);
}

export interface ReviewCounts {
  due: number;
  new: number;
  /** Soonest date anything comes due after today. */
  nextDue: string | null;
}

export async function reviewCounts(filter: ReviewFilter = {}): Promise<ReviewCounts> {
  const params: unknown[] = [];
  const where = reviewWhere(filter, params);
  const [r] = await query<{ due: number; new: number; next_due: string | null }>(
    `select count(*) filter (where w.review_due <= ${TODAY})::int as due,
            count(*) filter (where w.review_due is null)::int as new,
            (min(w.review_due) filter (where w.review_due > ${TODAY}))::text as next_due
       from words w ${where.length ? "where " + where.join(" and ") : ""}`,
    params
  );
  return { due: r.due, new: r.new, nextDue: r.next_due };
}

/** Record one review. Returns the new level and due date, or null if the word is gone. */
export async function recordReview(id: string, knew: boolean): Promise<{ reviewLevel: number; reviewDue: string } | null> {
  if (!UUID.test(id)) return null;
  const max = REVIEW_INTERVALS.length;
  const rows = await query<{ review_level: number; review_due: string }>(
    `update words set
        review_level = case when $2 then least(review_level + 1, ${max}) else 0 end,
        review_due = ${TODAY} + case when $2 then ($3::int[])[least(review_level + 1, ${max})] else 1 end,
        last_reviewed_at = now()
      where id = $1
      returning review_level, review_due::text`,
    [id, knew, REVIEW_INTERVALS]
  );
  return rows[0] ? { reviewLevel: rows[0].review_level, reviewDue: rows[0].review_due } : null;
}

export interface Overview {
  total: number;
  latestAdded: string | null;
  tags: { tag: string; count: number }[];
  partsOfSpeech: { partOfSpeech: string; count: number }[];
}

export async function overview(): Promise<Overview> {
  const [totals, tags, pos] = await Promise.all([
    query<{ total: number; latest: string | null }>(`select count(*)::int as total, max(date_added)::text as latest from words`),
    query<{ tag: string; count: number }>(
      `select t as tag, count(*)::int as count from words, unnest(tags) t group by t order by count desc, t`
    ),
    query<{ part_of_speech: string; count: number }>(
      `select coalesce(part_of_speech, 'unset') as part_of_speech, count(*)::int as count from words group by 1 order by 2 desc`
    ),
  ]);
  return {
    total: totals[0].total,
    latestAdded: totals[0].latest,
    tags,
    partsOfSpeech: pos.map((r) => ({ partOfSpeech: r.part_of_speech, count: r.count })),
  };
}

export type WriteResult =
  | { ok: true; word: Word; unknownRelated: string[] }
  | { ok: false; error: "duplicate"; existing: Word }
  | { ok: false; error: "not_found" };

/** Link `id` to each of `terms` (both directions). Returns the terms that
 *  matched no entry. */
async function linkTerms(q: typeof query, id: string, terms: string[]): Promise<string[]> {
  if (terms.length === 0) return [];
  const found = await q<{ id: string; term_key: string }>(
    `select id, term_key from words where term_key = any($1::text[]) and id <> $2`,
    [terms.map((t) => t.trim().toLowerCase()), id]
  );
  for (const r of found) {
    await q(
      `insert into word_links (word_id, related_id) values ($1, $2), ($2, $1) on conflict do nothing`,
      [id, r.id]
    );
  }
  const keys = new Set(found.map((r) => r.term_key));
  return terms.filter((t) => !keys.has(t.trim().toLowerCase()) && t.trim().toLowerCase() !== "");
}

async function unlinkTerms(q: typeof query, id: string, terms: string[]) {
  if (terms.length === 0) return;
  await q(
    `delete from word_links l using words r
      where r.term_key = any($2::text[])
        and ((l.word_id = $1 and l.related_id = r.id) or (l.related_id = $1 and l.word_id = r.id))`,
    [id, terms.map((t) => t.trim().toLowerCase())]
  );
}

export async function createWord(input: NewWord): Promise<WriteResult> {
  const existing = await getWordByTerm(input.term);
  if (existing) return { ok: false, error: "duplicate", existing };

  const result = await transaction(async (q) => {
    const rows = await q<{ id: string }>(
      `insert into words (term, pronunciation, part_of_speech, definition, chinese_definition,
                          example, example_zh, note, tags, date_added)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10::date, (now() at time zone 'Asia/Taipei')::date))
       on conflict (term_key) do nothing
       returning id`,
      [
        input.term.trim(),
        input.pronunciation ?? "",
        input.partOfSpeech ?? null,
        input.definition ?? "",
        input.chineseDefinition ?? "",
        input.example ?? "",
        input.exampleZh ?? "",
        input.note ?? "",
        normalizeTags(input.tags) ?? [],
        input.dateAdded ?? null,
      ]
    );
    if (!rows[0]) return null; // lost a race with an identical insert
    const unknownRelated = await linkTerms(q, rows[0].id, input.related ?? []);
    return { id: rows[0].id, unknownRelated };
  });

  if (!result) {
    const again = await getWordByTerm(input.term);
    return again ? { ok: false, error: "duplicate", existing: again } : { ok: false, error: "not_found" };
  }
  const word = await getWordById(result.id);
  return { ok: true, word: word!, unknownRelated: result.unknownRelated };
}

export interface WordUpdate extends WordFields {
  /** Rename the entry. */
  term?: string;
  /** Replace the whole related list with these terms. */
  related?: string[];
  addRelated?: string[];
  removeRelated?: string[];
}

const COLUMNS: Record<keyof WordFields, string> = {
  pronunciation: "pronunciation",
  partOfSpeech: "part_of_speech",
  definition: "definition",
  chineseDefinition: "chinese_definition",
  example: "example",
  exampleZh: "example_zh",
  note: "note",
  tags: "tags",
  dateAdded: "date_added",
};

export async function updateWord(id: string, patch: WordUpdate): Promise<WriteResult> {
  const current = await getWordById(id);
  if (!current) return { ok: false, error: "not_found" };

  if (patch.term && patch.term.trim().toLowerCase() !== current.term.toLowerCase()) {
    const clash = await getWordByTerm(patch.term);
    if (clash && clash.id !== id) return { ok: false, error: "duplicate", existing: clash };
  }

  const unknownRelated = await transaction(async (q) => {
    const sets: string[] = [];
    const params: unknown[] = [id];
    if (patch.term !== undefined) {
      params.push(patch.term.trim());
      sets.push(`term = $${params.length}`);
    }
    for (const key of Object.keys(COLUMNS) as (keyof WordFields)[]) {
      if (patch[key] === undefined) continue;
      const value = key === "tags" ? normalizeTags(patch.tags) : patch[key];
      params.push(value);
      sets.push(`${COLUMNS[key]} = $${params.length}${key === "dateAdded" ? "::date" : ""}`);
    }
    if (sets.length) await q(`update words set ${sets.join(", ")}, updated_at = now() where id = $1`, params);

    let unknown: string[] = [];
    if (patch.related !== undefined) {
      await q(`delete from word_links where word_id = $1 or related_id = $1`, [id]);
      unknown = await linkTerms(q, id, patch.related);
    }
    if (patch.removeRelated?.length) await unlinkTerms(q, id, patch.removeRelated);
    if (patch.addRelated?.length) unknown = unknown.concat(await linkTerms(q, id, patch.addRelated));
    if (!sets.length && (patch.related || patch.addRelated || patch.removeRelated)) {
      await q(`update words set updated_at = now() where id = $1`, [id]);
    }
    return unknown;
  });

  const word = await getWordById(id);
  return { ok: true, word: word!, unknownRelated };
}

export async function deleteWord(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const rows = await query(`delete from words where id = $1 returning id`, [id]);
  return rows.length > 0;
}
