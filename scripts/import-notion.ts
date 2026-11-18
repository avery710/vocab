/**
 * Import the Notion "English Dictionary" CSV export into the database.
 *
 *   npm run import:notion -- path/to/English\ Dictionary_all.csv [--dry-run] [--update]
 *
 * In Notion: open the database → ⋯ → Export → "Markdown & CSV", unzip, and
 * use the CSV (the "_all" one if there are two).
 *
 * Words already in the database are left alone unless you pass --update,
 * which overwrites them with the Notion version. Related words are linked in
 * a second pass, so the order of rows doesn't matter. Safe to run again.
 * Reads DATABASE_URL from .env.local when present.
 */
import { existsSync, readFileSync } from "node:fs";
import { getPool } from "../lib/db";
import { parseNotionCsv } from "../lib/notion-import";
import { createWord, getWordByTerm, updateWord } from "../lib/words";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const overwrite = args.includes("--update");
  if (!file) {
    console.error("Usage: npm run import:notion -- <export.csv> [--dry-run] [--update]");
    process.exit(1);
  }

  const { rows, skipped } = parseNotionCsv(readFileSync(file, "utf8"));
  console.log(`Read ${rows.length} entries from ${file}${skipped.length ? `, skipped ${skipped.length}` : ""}.`);
  for (const s of skipped) console.log(`  line ${s.line}: ${s.reason}`);

  if (dryRun) {
    for (const r of rows.slice(0, 5)) console.log("  ", JSON.stringify(r.word).slice(0, 160));
    console.log("Dry run: nothing written.");
    return;
  }

  let added = 0;
  let updated = 0;
  let kept = 0;
  for (const { word } of rows) {
    const existing = await getWordByTerm(word.term);
    if (!existing) {
      const r = await createWord(word);
      if (r.ok) added++;
    } else if (overwrite) {
      const { term, related, ...fields } = word;
      void related;
      await updateWord(existing.id, { term, ...fields });
      updated++;
    } else {
      kept++;
    }
  }

  let links = 0;
  const unmatched = new Set<string>();
  for (const { word, related } of rows) {
    if (related.length === 0) continue;
    const w = await getWordByTerm(word.term);
    if (!w) continue;
    const r = await updateWord(w.id, { addRelated: related });
    if (r.ok) {
      links += related.length - r.unknownRelated.length;
      r.unknownRelated.forEach((u) => unmatched.add(u));
    }
  }

  console.log(`Added ${added}, updated ${updated}, left ${kept} existing as they were. Linked ${links} related-word pairs.`);
  if (unmatched.size) console.log(`Related words not found as entries: ${[...unmatched].join(", ")}`);
  await getPool().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
