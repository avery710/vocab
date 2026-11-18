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

/** Notes: bullet points when written one per line, otherwise one paragraph. */
export function notePoints(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
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
