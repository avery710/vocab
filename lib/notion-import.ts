/**
 * Turn Notion's CSV export of the old "English Dictionary" database into
 * entries. Pure (no database) so it can be tested; scripts/import-notion.ts
 * does the writing.
 *
 * Notion's CSV quirks handled here: a BOM before the first header, dates like
 * "October 24, 2026" (or ISO), multi-selects as "business, casual", and
 * relations as "calf (https://www.notion.so/calf-3df4…), thigh (…)".
 */
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { PARTS_OF_SPEECH, newWordSchema, type NewWord } from "./word-input";

// Old entries are imported as they are, even ones the new rule (words and
// phrases only, at most 8 words) would refuse.
const importSchema = newWordSchema.extend({ term: z.string().trim().min(1).max(200) });

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function parseNotionDate(s: string): string | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  if (iso) return iso[1];
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(t);
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1 || MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) + 1;
    if (month > 0) return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const slash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(t);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
  return undefined;
}

/** "calf (https://…), thigh (https://…)" → ["calf", "thigh"]. Plain
 *  comma-separated titles work too. */
export function parseRelations(s: string): string[] {
  const t = s.trim();
  if (!t) return [];
  const withUrls = [...t.matchAll(/(?:^|,\s*)(.+?)\s*\((?:https?:\/\/|notion:)[^)]*\)/g)].map((m) => m[1].trim());
  if (withUrls.length) return withUrls.filter(Boolean);
  if (/https?:\/\//.test(t)) return []; // bare links only: no titles to match on
  return t.split(",").map((x) => x.trim()).filter(Boolean);
}

export interface ImportRow {
  word: NewWord;
  /** Related terms, linked in a second pass once every word exists. */
  related: string[];
}

export interface ParseResult {
  rows: ImportRow[];
  skipped: { line: number; reason: string }[];
}

export function parseNotionCsv(csv: string): ParseResult {
  const records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];
  const rows: ImportRow[] = [];
  const skipped: ParseResult["skipped"] = [];
  const seen = new Set<string>();

  records.forEach((r, idx) => {
    const line = idx + 2; // header is line 1
    const col = (...names: string[]) => {
      for (const n of names) {
        const key = Object.keys(r).find((k) => k.trim().toLowerCase() === n.toLowerCase());
        if (key && r[key] != null) return String(r[key]);
      }
      return "";
    };
    const term = col("Word/Phrase", "Name", "Word").trim();
    if (!term) {
      skipped.push({ line, reason: "no word" });
      return;
    }
    const key = term.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ line, reason: `duplicate of “${term}” earlier in the file` });
      return;
    }

    const posRaw = col("Part of Speech").trim().toLowerCase();
    const pos = (PARTS_OF_SPEECH as readonly string[]).includes(posRaw) ? posRaw : posRaw ? "other" : null;
    const parsed = importSchema.safeParse({
      term,
      pronunciation: col("Pronunciation"),
      partOfSpeech: pos,
      definition: col("Definition"),
      chineseDefinition: col("Chinese Definition"),
      example: col("Example Sentence"),
      exampleZh: col("Example Sentence (Chinese)"),
      note: col("Note", "Notes"),
      tags: col("Tags").split(",").map((t) => t.trim()).filter(Boolean),
      dateAdded: parseNotionDate(col("Date Added")),
    });
    if (!parsed.success) {
      skipped.push({ line, reason: `“${term}”: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}` });
      return;
    }
    seen.add(key);
    rows.push({ word: parsed.data, related: parseRelations(col("Related words", "Related Words", "Related")) });
  });

  return { rows, skipped };
}
