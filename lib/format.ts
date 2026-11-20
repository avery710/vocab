/** Display helpers shared by pages. Pure. */

export const POS_SHORT: Record<string, string> = {
  noun: "n.",
  verb: "v.",
  adjective: "adj.",
  adverb: "adv.",
  phrase: "phr.",
  idiom: "idiom",
  conjunction: "conj.",
  interjection: "interj.",
  preposition: "prep.",
  pronoun: "pron.",
  other: "",
};

// Part-of-speech markers inside a sense's brackets: "（名詞，非正式）", "（形）",
// "(noun)", "(adj.)". Checked in order. Phrase markers ("" = skip) are caught
// first so 片語動詞 isn't read as a verb, and an idiom sense such as grip's
// "（片語，get a grip）" doesn't make a single word a phrase.
const ZH_POS: [RegExp, string][] = [
  [/^(片語動詞|動詞片語|名詞片語|片語)$/, ""],
  [/代名詞$/, "pronoun"],
  [/(^名|名詞|名詞複數)$/, "noun"],
  [/(^動|動詞)$/, "verb"],
  [/(^形|形容詞)$/, "adjective"],
  [/(^副|副詞)$/, "adverb"],
  [/連接詞$/, "conjunction"],
  [/感嘆詞$/, "interjection"],
  [/介系詞$/, "preposition"],
];
const EN_POS: [RegExp, string][] = [
  [/^(phrasal verb|idiom|phrase)$/, ""],
  [/^(noun|n\.)$/, "noun"],
  [/^(verb|v\.)$/, "verb"],
  [/^(adjective|adj\.)$/, "adjective"],
  [/^(adverb|adv\.)$/, "adverb"],
  [/^conjunction$/, "conjunction"],
  [/^interjection$/, "interjection"],
  [/^preposition$/, "preposition"],
  [/^pronoun$/, "pronoun"],
];

function markedPos(text: string, table: [RegExp, string][]): string[] {
  const found: string[] = [];
  for (const [, inside] of text.matchAll(/[（(]([^）)]*)[）)]/g)) {
    for (const token of inside.split(/[，,、/;；]/)) {
      const t = token.trim().toLowerCase();
      const hit = table.find(([re]) => re.test(t));
      if (hit?.[1]) found.push(hit[1]);
    }
  }
  return found;
}

/**
 * Every part of speech a word is used as: the saved one first, then any that
 * its senses mark, in sense order ("（形容詞）異性戀的 / （名詞）異性戀者" →
 * adjective, noun). Chinese markers win; English ones are the fallback.
 * Phrases and idioms stay as they are: their senses' markers (片語動詞 etc.)
 * describe the phrase, not extra parts of speech.
 */
export function partsOfSpeech(w: { partOfSpeech: string | null; chineseDefinition: string; definition: string }): string[] {
  const saved = w.partOfSpeech && w.partOfSpeech !== "other" ? [w.partOfSpeech] : [];
  if (w.partOfSpeech === "phrase" || w.partOfSpeech === "idiom") return saved;
  const zh = markedPos(w.chineseDefinition, ZH_POS);
  const marked = zh.length ? zh : markedPos(w.definition, EN_POS);
  const all = [...new Set([...saved, ...marked])];
  return all.length ? all : w.partOfSpeech ? [w.partOfSpeech] : [];
}

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

// Placeholders in a saved phrase ("get on sb's nerves") stand for any word.
const PLACEHOLDER = /^(sb|sth|someone|something|somebody|one|one's|sb's|sth's|someone's|oneself|your|yourself)$/i;

// Irregular past forms, for the verbs that start Capy's phrases. Compounds
// share them: uphold → upheld, withstand → withstood.
const IRREGULAR: Record<string, string[]> = {
  be: ["is", "am", "are", "was", "were", "been", "being"],
  beat: ["beaten"], become: ["became"], begin: ["began", "begun"], bite: ["bit", "bitten"],
  blow: ["blew", "blown"], break: ["broke", "broken"], bring: ["brought"], build: ["built"],
  buy: ["bought"], catch: ["caught"], choose: ["chose", "chosen"], come: ["came"],
  deal: ["dealt"], dig: ["dug"], do: ["did", "done", "does"], draw: ["drew", "drawn"],
  drive: ["drove", "driven"], eat: ["ate", "eaten"], fall: ["fell", "fallen"], feed: ["fed"],
  feel: ["felt"], fight: ["fought"], find: ["found"], fly: ["flew", "flown"],
  forget: ["forgot", "forgotten"], get: ["got", "gotten"], give: ["gave", "given"],
  go: ["went", "gone", "goes"], grow: ["grew", "grown"], hang: ["hung"], have: ["had", "has"],
  hear: ["heard"], hide: ["hid", "hidden"], hold: ["held"], keep: ["kept"], know: ["knew", "known"],
  lay: ["laid"], lead: ["led"], leave: ["left"], lend: ["lent"], lie: ["lay", "lain"],
  light: ["lit"], lose: ["lost"], make: ["made"], mean: ["meant"], meet: ["met"], pay: ["paid"],
  ride: ["rode", "ridden"], ring: ["rang", "rung"], rise: ["rose", "risen"], run: ["ran"],
  say: ["said"], see: ["saw", "seen"], seek: ["sought"], sell: ["sold"], send: ["sent"],
  shake: ["shook", "shaken"], shine: ["shone"], shoot: ["shot"], show: ["shown"],
  sink: ["sank", "sunk"], sit: ["sat"], sleep: ["slept"], speak: ["spoke", "spoken"],
  speed: ["sped"], spend: ["spent"], spin: ["spun"], stand: ["stood"], steal: ["stole", "stolen"],
  stick: ["stuck"], sting: ["stung"], strike: ["struck"], swear: ["swore", "sworn"],
  sweep: ["swept"], swing: ["swung"], take: ["took", "taken"], teach: ["taught"],
  tear: ["tore", "torn"], tell: ["told"], think: ["thought"], throw: ["threw", "thrown"],
  wake: ["woke", "woken"], wear: ["wore", "worn"], win: ["won"], write: ["wrote", "written"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A regex source matching one word of a term with its common inflections:
 *  advocate → advocates/advocated/advocating, carry → carried, plot → plotted,
 *  hold → held. */
function inflected(word: string): string {
  if (PLACEHOLDER.test(word)) return "[\\w’']+(?:\\s+[\\w’']+)?";
  const w = word.toLowerCase();
  if (/^(a|an|the)$/.test(w)) return "(?:a|an|the)";
  if (!/^[a-z]+$/.test(w)) return escape(w);
  const base = w.length < 3 ? w
    : w.endsWith("e") ? `${w.slice(0, -1)}(?:e|es|ed|ing|ely)`
    : /[^f]f$/.test(w) ? `${w.slice(0, -1)}(?:f|fs|ves)`
    : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}(?:y|ies|ied|ying|ier|iest|ily)`
    : `${w}(?:${w.at(-1)})?(?:s|es|ed|ing|ly)?`;
  const verb = Object.keys(IRREGULAR).find((v) => w === v || (w.endsWith(v) && w.length - v.length >= 2));
  if (!verb) return base;
  const prefix = w.slice(0, w.length - verb.length);
  return `(?:${base}|${IRREGULAR[verb].map((f) => prefix + f).join("|")})`;
}

/**
 * Split an example sentence into plain and highlighted parts, so the saved
 * word or phrase can be marked where it appears, inflected or not. The words
 * of a phrase may have up to two words between them ("hold him back"); a
 * leading "be" may be missing ("subjected to"); "a / b" terms match either.
 */
export function markTerm(sentence: string, term: string): { text: string; hit: boolean }[] {
  const alternatives = term
    .split(/\s+\/\s+/)
    .map((t) => t.trim().split(/\s+/).filter(Boolean))
    .filter((ws) => ws.length > 0)
    .map((ws) => {
      const join = "[\\s,-]+(?:[\\w’']+\\s+){0,2}?";
      const rest = ws.slice(ws[0].toLowerCase() === "be" && ws.length > 1 ? 1 : 0);
      const core = rest.map(inflected).join(join);
      return rest.length < ws.length ? `(?:${inflected("be")}\\s+)?${core}` : core;
    });
  if (!sentence || alternatives.length === 0) return [{ text: sentence, hit: false }];
  const re = new RegExp(`(?<![\\w’'])(?:${alternatives.join("|")})(?![\\w’'])`, "gi");
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of sentence.matchAll(re)) {
    if (m.index > last) parts.push({ text: sentence.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last), hit: false });
  return parts;
}
