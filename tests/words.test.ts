import { describe, expect, it } from "vitest";
import { newWordSchema } from "@/lib/word-input";
import { createWord, deleteWord, getWordByTerm, overview, recordReview, reviewCounts, reviewWords, searchWords, updateWord } from "@/lib/words";

async function add(term: string, extra: Record<string, unknown> = {}) {
  const r = await createWord(newWordSchema.parse({ term, ...extra }));
  if (!r.ok) throw new Error(`add ${term}: ${r.error}`);
  return r;
}

describe("term rules", () => {
  it("accepts words and phrases", () => {
    expect(newWordSchema.safeParse({ term: "apt" }).success).toBe(true);
    expect(newWordSchema.safeParse({ term: "call it a day" }).success).toBe(true);
    expect(newWordSchema.safeParse({ term: "etc." }).success).toBe(true);
  });

  it("refuses whole sentences", () => {
    expect(newWordSchema.safeParse({ term: "That was an apt description of the situation." }).success).toBe(false);
    expect(newWordSchema.safeParse({ term: "I think he is apt to forget names when tired" }).success).toBe(false);
  });

  it("lowercases and dedupes tags", () => {
    expect(newWordSchema.parse({ term: "x", tags: ["Casual", "casual "] }).tags).toEqual(["casual", "casual"]);
  });
});

describe("words", () => {
  it("creates, finds case-insensitively and refuses duplicates", async () => {
    const r = await add("Apt", { partOfSpeech: "adjective", chineseDefinition: "恰當的", tags: ["Casual", "casual"] });
    expect(r.word.tags).toEqual(["casual"]);
    expect((await getWordByTerm("  apt "))?.id).toBe(r.word.id);
    const dup = await createWord(newWordSchema.parse({ term: "APT" }));
    expect(dup).toMatchObject({ ok: false, error: "duplicate" });
  });

  it("defaults date_added to today in Taiwan and keeps a given date", async () => {
    const a = await add("alpha");
    expect(a.word.dateAdded).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const b = await add("beta", { dateAdded: "2025-01-31" });
    expect(b.word.dateAdded).toBe("2025-01-31");
  });

  it("links related words both ways and reports unknown ones", async () => {
    await add("calf");
    const thigh = await add("thigh", { related: ["calf", "shin"] });
    expect(thigh.word.related.map((r) => r.term)).toEqual(["calf"]);
    expect(thigh.unknownRelated).toEqual(["shin"]);
    expect((await getWordByTerm("calf"))!.related.map((r) => r.term)).toEqual(["thigh"]);

    const upd = await updateWord(thigh.word.id, { removeRelated: ["calf"] });
    expect(upd.ok && upd.word.related).toEqual([]);
    expect((await getWordByTerm("calf"))!.related).toEqual([]);
  });

  it("updates only given fields and blocks renaming onto another entry", async () => {
    const a = await add("slop", { definition: "old", note: "keep" });
    await add("slope");
    const r = await updateWord(a.word.id, { definition: "new", tags: ["Slang"] });
    expect(r.ok && r.word).toMatchObject({ definition: "new", note: "keep", tags: ["slang"] });
    expect(await updateWord(a.word.id, { term: "SLOPE" })).toMatchObject({ ok: false, error: "duplicate" });
    const renamed = await updateWord(a.word.id, { term: "Slop" });
    expect(renamed.ok && renamed.word.term).toBe("Slop");
  });

  it("searches headwords first, then definitions and Chinese", async () => {
    await add("aptitude", { definition: "natural ability" });
    await add("apt", { definition: "suitable", chineseDefinition: "恰當的" });
    await add("adapt", { definition: "change to fit" });
    await add("fitting", { definition: "apt; suitable" });

    const r = await searchWords({ q: "apt" });
    expect(r.words.map((w) => w.term)).toEqual(["apt", "aptitude", "adapt", "fitting"]);
    expect((await searchWords({ q: "恰當" })).words.map((w) => w.term)).toEqual(["apt"]);
    expect((await searchWords({ q: "100%" })).total).toBe(0);
  });

  it("filters by letter, tag, part of speech and date; sorts", async () => {
    await add("bravo", { tags: ["casual"], partOfSpeech: "noun", dateAdded: "2026-01-01" });
    await add("alpha", { tags: ["business"], partOfSpeech: "noun", dateAdded: "2026-02-01" });
    await add("'tis", { partOfSpeech: "other", dateAdded: "2026-03-01" });

    expect((await searchWords({ letter: "b" })).words.map((w) => w.term)).toEqual(["bravo"]);
    expect((await searchWords({ letter: "#" })).words.map((w) => w.term)).toEqual(["'tis"]);
    expect((await searchWords({ tag: "Business" })).words.map((w) => w.term)).toEqual(["alpha"]);
    expect((await searchWords({ partOfSpeech: "noun", sort: "alpha" })).words.map((w) => w.term)).toEqual(["alpha", "bravo"]);
    expect((await searchWords({ addedFrom: "2026-02-01" })).total).toBe(2);
    expect((await searchWords({ sort: "oldest" })).words[0].term).toBe("bravo");
    expect((await searchWords({})).words[0].term).toBe("'tis");
  });

  it("gives an overview and review samples; deletes", async () => {
    const a = await add("one", { tags: ["casual"] });
    await add("two", { tags: ["casual", "slang"] });
    const o = await overview();
    expect(o.total).toBe(2);
    expect(o.tags).toEqual([
      { tag: "casual", count: 2 },
      { tag: "slang", count: 1 },
    ]);
    expect((await reviewWords(5, { tag: "slang" })).map((w) => w.term)).toEqual(["two"]);
    expect(await deleteWord(a.word.id)).toBe(true);
    expect(await deleteWord(a.word.id)).toBe(false);
  });

  it("schedules reviews: due first, then new; Knew it spaces out, Again is tomorrow", async () => {
    const a = (await add("one")).word;
    const b = (await add("two")).word;
    await add("three");
    expect((await reviewCounts()).new).toBe(3);

    const knew = await recordReview(a.id, true);
    expect(knew?.reviewLevel).toBe(1);
    const again = await recordReview(b.id, false);
    expect(again?.reviewLevel).toBe(0);
    // Both are now due tomorrow or later, so only "three" is left today.
    expect((await reviewWords(10)).map((w) => w.term)).toEqual(["three"]);
    const c = await reviewCounts();
    expect(c).toMatchObject({ due: 0, new: 1 });
    expect(c.nextDue).toBe(again?.reviewDue);

    // Knew it again climbs: level 2 is 3 days out, later than level 1.
    const second = await recordReview(a.id, true);
    expect(second?.reviewLevel).toBe(2);
    expect(second!.reviewDue > knew!.reviewDue).toBe(true);
    expect(await recordReview("not-an-id", true)).toBeNull();
  });
});
