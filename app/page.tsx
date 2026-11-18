import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { TopBar } from "@/components/top-bar";
import { LETTERS, POS_SHORT, senses, shortDate, wordPath } from "@/lib/format";
import { PARTS_OF_SPEECH, type PartOfSpeech } from "@/lib/word-input";
import { overview, searchWords, type SortOrder } from "@/lib/words";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;
type Params = Record<string, string | undefined>;

function href(current: Params, change: Params) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...change })) if (v) next.set(k, v);
  next.delete("page");
  if (change.page) next.set("page", change.page);
  const s = next.toString();
  return s ? `/?${s}` : "/";
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const p: Params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const pos = PARTS_OF_SPEECH.includes(p.pos as PartOfSpeech) ? (p.pos as PartOfSpeech) : undefined;
  const sort: SortOrder = p.sort === "alpha" || p.sort === "oldest" ? p.sort : "newest";
  const page = Math.max(1, Number(p.page) || 1);
  const letter = p.letter && /^[a-z#]$/.test(p.letter) ? p.letter : undefined;

  const [result, stats] = await Promise.all([
    searchWords({ q: p.q, letter, partOfSpeech: pos, tag: p.tag, sort: letter && !p.sort ? "alpha" : sort, limit: PAGE_SIZE * page }),
    overview(),
  ]);
  const filtered = !!(p.q || letter || pos || p.tag);

  return (
    <>
      <TopBar current="/" />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
        <div className="mt-6 flex items-end justify-between gap-4">
          <p className="text-[15px] text-pencil">
            {stats.total === 0 ? (
              "Your notebook is empty."
            ) : (
              <>
                <span className="font-serif text-[22px] font-semibold text-ink tabular-nums">{stats.total}</span> words and phrases
              </>
            )}
          </p>
          <Link
            href="/new"
            className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-sheet transition-transform hover:-translate-y-px active:translate-y-0"
          >
            Add a word
          </Link>
        </div>

        <div className="mt-4">
          <Suspense>
            <SearchBox initial={p.q ?? ""} />
          </Suspense>
        </div>

        {/* Thumb index, like the tabs cut into a paper dictionary. */}
        <nav aria-label="Browse by letter" className="mt-4 -mx-1 flex gap-px overflow-x-auto pb-1 sm:gap-0 [scrollbar-width:none] sm:justify-between">
          {[...LETTERS, "#"].map((l) => {
            const active = letter === l;
            return (
              <Link
                key={l}
                href={active ? href(p, { letter: undefined }) : href({ ...p, q: undefined }, { letter: l })}
                aria-current={active ? "true" : undefined}
                className={`flex h-8 min-w-7 shrink-0 items-center justify-center rounded-md px-1 font-serif text-[16px] transition-colors sm:min-w-6 ${
                  active ? "bg-marker font-semibold text-ink" : "text-pencil hover:bg-rule/70 hover:text-ink"
                }`}
              >
                {l === "#" ? "#" : l.toUpperCase()}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
          <FilterGroup label="Type">
            {PARTS_OF_SPEECH.map((o) => (
              <Chip key={o} href={href(p, { pos: pos === o ? undefined : o })} active={pos === o}>
                {o}
              </Chip>
            ))}
          </FilterGroup>
          {stats.tags.length > 0 && (
            <FilterGroup label="Tag">
              {stats.tags.map((t) => (
                <Chip key={t.tag} href={href(p, { tag: p.tag === t.tag ? undefined : t.tag })} active={p.tag === t.tag}>
                  {t.tag}
                </Chip>
              ))}
            </FilterGroup>
          )}
          <FilterGroup label="Order">
            <Chip href={href(p, { sort: undefined })} active={sort === "newest" && !(letter && !p.sort)}>
              newest
            </Chip>
            <Chip href={href(p, { sort: "alpha" })} active={sort === "alpha" || (!!letter && !p.sort)}>
              A–Z
            </Chip>
            <Chip href={href(p, { sort: "oldest" })} active={sort === "oldest"}>
              oldest
            </Chip>
          </FilterGroup>
        </div>

        {filtered && (
          <p className="mt-6 text-[14px] text-pencil">
            {result.total === 0 ? "No matches." : `${result.total} ${result.total === 1 ? "match" : "matches"}`}
            {" "}
            <Link href="/" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
              Clear filters
            </Link>
          </p>
        )}

        {stats.total === 0 ? (
          <EmptyState />
        ) : result.total === 0 && p.q ? (
          <div className="mt-10 rounded-2xl border border-dashed border-rule p-6 text-[15px] text-pencil">
            “{p.q}” isn’t in your notebook yet.{" "}
            <Link href={`/new?term=${encodeURIComponent(p.q)}`} className="font-medium text-ink underline decoration-marker decoration-2 underline-offset-4">
              Add it
            </Link>
          </div>
        ) : (
          <ol className="mt-6">
            {result.words.map((w) => {
              const zh = senses(w.chineseDefinition).join("；");
              return (
                <li key={w.id} className="border-t border-rule first:border-t-0">
                  <Link href={wordPath(w.term)} className="group -mx-3 flex gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-sheet">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5">
                        <span className="font-serif text-[21px] leading-tight font-semibold">
                          <span className="hover-mark">{w.term}</span>
                        </span>
                        {w.partOfSpeech && POS_SHORT[w.partOfSpeech] && (
                          <span className="font-serif text-[15px] text-pencil italic">{POS_SHORT[w.partOfSpeech]}</span>
                        )}
                        {w.pronunciation && <span className="ipa text-[14px] text-faint">{w.pronunciation}</span>}
                      </div>
                      {zh && <p className="zh mt-0.5 line-clamp-2 text-[15px] text-ink/85">{zh}</p>}
                    </div>
                    <time dateTime={w.dateAdded} className="shrink-0 pt-1.5 text-[12.5px] text-faint tabular-nums">
                      {shortDate(w.dateAdded)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {result.words.length < result.total && (
          <div className="mt-6 text-center">
            <Link
              href={href(p, { page: String(page + 1) })}
              scroll={false}
              className="inline-block rounded-full border border-rule bg-sheet px-5 py-2 text-[14px] hover:border-ink"
            >
              Show more ({result.total - result.words.length} left)
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={label}>
      <span className="mr-1 text-faint">{label}</span>
      {children}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-0.5 transition-colors ${
        active ? "bg-ink text-sheet" : "text-pencil hover:bg-rule/70 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-rule p-8">
      <p className="font-serif text-[22px] font-semibold">Start with one word.</p>
      <p className="mt-2 max-w-prose text-[15px] text-pencil">
        Add it here, or connect Claude and just send it a word — it will look it up and save it for you.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/new" className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-sheet">
          Add a word
        </Link>
        <Link href="/connect" className="rounded-full border border-rule bg-sheet px-4 py-2 text-[14px] hover:border-ink">
          Connect Claude
        </Link>
      </div>
    </div>
  );
}
