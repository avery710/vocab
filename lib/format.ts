/** Display helpers shared by pages. Pure. */

export const POS_SHORT: Record<string, string> = {
  noun: "n.",
  verb: "v.",
  adjective: "adj.",
  adverb: "adv.",
  phrase: "phr.",
  idiom: "idiom",
  other: "",
};

/**
 * Split a definition into senses. New entries put one sense per line; entries
 * imported from Notion joined them with "；" (Chinese) or "; " (English).
 */
export function senses(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.includes("\n")) return t.split(/\n+/).map((s) => s.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  if (t.includes("；")) return t.split("；").map((s) => s.trim()).filter(Boolean);
  if (/;\s/.test(t)) {
    return t
      .split(/;\s+/)
      .map((s) => s.replace(/^or\s+/i, "").trim())
      .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
      .filter(Boolean);
  }
  return [t];
}

/**
 * Notes, one point per line. New notes are written one point per line; notes
 * imported from Notion are one paragraph, so those split after each Chinese
 * sentence end (。！？), never inside brackets or quotes.
 */
export function notePoints(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((s) => s.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
  return lines.length === 1 ? sentences(lines[0]) : lines;
}

const OPEN = "（(「『“";
const CLOSE = "）)」』”";

function sentences(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && "。！？".includes(ch)) {
      out.push(text.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

/**
 * Examples, one per line in sense order, paired with their translations by
 * line. Imported Notion entries have a single example, so one pair.
 */
export function examples(en: string, zh: string): { en: string; zh: string }[] {
  const lines = (t: string) => t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const a = lines(en);
  const b = lines(zh);
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => ({ en: a[i] ?? "", zh: b[i] ?? "" }));
}

export function wordPath(term: string) {
  return `/w/${encodeURIComponent(term)}`;
}

/** "Oct 24" this year, "Oct 24, 2025" otherwise. */
export function shortDate(iso: string, now = new Date()): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = y === now.getUTCFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  });
}

export const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

/** Route params may or may not arrive percent-encoded; never throw on "%". */
export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
