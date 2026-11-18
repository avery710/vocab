/**
 * What a word entry may contain — one zod schema shared by the web forms, the
 * MCP tools and the Notion import, so all three accept exactly the same data.
 */
import { z } from "zod";

export const PARTS_OF_SPEECH = ["noun", "verb", "adjective", "adverb", "phrase", "idiom", "other"] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export const MAX_TAGS = 10;
export const MAX_RELATED = 20;
/** Entries are words or phrases, never whole sentences (Capy's rule from the
 *  Notion days). Longest idioms are ~8 words; past that it's a sentence. */
export const MAX_TERM_WORDS = 8;

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

export const termSchema = z
  .string()
  .trim()
  .min(1, "a word or phrase is required")
  .max(200)
  .refine((t) => t.split(/\s+/).length <= MAX_TERM_WORDS, {
    message: `save a word or phrase (at most ${MAX_TERM_WORDS} words), not a whole sentence`,
  })
  .refine((t) => !/[.!?。！？]$/.test(t) || t.split(/\s+/).length <= 2, {
    message: "save the word or phrase, not the sentence it came from",
  });

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(30)
  .regex(/^[^,\n]+$/, "no commas in a tag");

/** Every field except the term itself; all optional, for updates. */
export const wordFieldsSchema = z.object({
  pronunciation: z.string().trim().max(200).optional(),
  partOfSpeech: z.enum(PARTS_OF_SPEECH).nullable().optional(),
  definition: z.string().trim().max(4000).optional(),
  chineseDefinition: z.string().trim().max(4000).optional(),
  example: z.string().trim().max(2000).optional(),
  exampleZh: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(10000).optional(),
  tags: z.array(tagSchema).max(MAX_TAGS).optional(),
  dateAdded: DATE.optional(),
});

export const newWordSchema = wordFieldsSchema.extend({
  term: termSchema,
  /** Terms of other entries to link as related words. Unknown ones are skipped. */
  related: z.array(z.string().trim().min(1).max(200)).max(MAX_RELATED).optional(),
});

export type WordFields = z.infer<typeof wordFieldsSchema>;
export type NewWord = z.infer<typeof newWordSchema>;

export function normalizeTags(tags: string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/** Today in Taiwan, YYYY-MM-DD. */
export function todayInTaipei(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(now);
}
