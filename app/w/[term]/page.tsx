import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteWordAction } from "@/app/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SpeakButton } from "@/components/speak-button";
import { TopBar } from "@/components/top-bar";
import { notePoints, safeDecode, senses, shortDate, wordPath } from "@/lib/format";
import { getWordByTerm } from "@/lib/words";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ term: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: safeDecode((await params).term) };
}

export default async function WordPage({ params }: Props) {
  const term = safeDecode((await params).term);
  const w = await getWordByTerm(term);
  if (!w) notFound();

  const zh = senses(w.chineseDefinition);
  const en = senses(w.definition);
  const notes = notePoints(w.note);

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
        <div className="mt-6 flex items-center justify-between text-[14px]">
          <Link href="/" className="text-pencil hover:text-ink">
            All words
          </Link>
          <Link href={`${wordPath(w.term)}/edit`} className="rounded-full border border-rule bg-sheet px-3.5 py-1.5 hover:border-ink">
            Edit
          </Link>
        </div>

        <article className="mt-8">
          <h1 className="text-[clamp(44px,9vw,76px)] leading-[1.02] font-bold tracking-[-0.02em] break-words">
            <span className="marked marked-draw">{w.term}</span>
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {w.partOfSpeech && <span className="text-[19px] text-pencil">{w.partOfSpeech}</span>}
            {w.pronunciation && <span className="ipa text-[18px] text-ink/80">{w.pronunciation}</span>}
            <SpeakButton text={w.term} />
          </div>

          <div className="mt-10 grid gap-9">
            {zh.length > 0 && (
              <Section title="中文">
                <Senses items={zh} className="zh text-[19px]" />
              </Section>
            )}
            {en.length > 0 && (
              <Section title="English">
                <Senses items={en} className="text-[19px] leading-relaxed" />
              </Section>
            )}
            {(w.example || w.exampleZh) && (
              <Section title="例句">
                <figure className="border-l-[3px] border-marker pl-4">
                  {w.example && <p className="text-[19px] leading-relaxed">{w.example}</p>}
                  {w.exampleZh && <p className="zh mt-1 text-[15.5px] text-pencil">{w.exampleZh}</p>}
                </figure>
              </Section>
            )}
            {notes.length > 0 && (
              <Section title="筆記">
                {notes.length === 1 ? (
                  <p className="zh max-w-[68ch] text-[15.5px]">{notes[0]}</p>
                ) : (
                  <ul className="zh grid max-w-[68ch] list-disc gap-1.5 pl-5 text-[15.5px] marker:text-faint">
                    {notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </Section>
            )}
            {w.related.length > 0 && (
              <Section title="相關字">
                <div className="flex flex-wrap gap-2">
                  {w.related.map((r) => (
                    <Link
                      key={r.id}
                      href={wordPath(r.term)}
                      className="rounded-full border border-rule bg-sheet px-3 py-1 text-[16px] hover:border-ink"
                    >
                      {r.term}
                    </Link>
                  ))}
                </div>
              </Section>
            )}
          </div>

          <footer className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-rule pt-5 text-[13.5px] text-pencil">
            <span>Added {shortDate(w.dateAdded)}</span>
            {w.tags.map((t) => (
              <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="rounded-full bg-rule/70 px-2.5 py-0.5 text-ink hover:bg-rule">
                {t}
              </Link>
            ))}
            <div className="ml-auto">
              <ConfirmDelete term={w.term} action={deleteWordAction.bind(null, w.id)} />
            </div>
          </footer>
        </article>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 sm:grid-cols-[88px_1fr] sm:gap-6">
      <h2 className="pt-1 text-[14px] font-medium text-pencil">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Senses({ items, className }: { items: string[]; className: string }) {
  if (items.length === 1) return <p className={className}>{items[0]}</p>;
  return (
    <ol className={`grid gap-1.5 ${className}`}>
      {items.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-4 shrink-0 pt-[0.15em] text-right font-sans text-[14px] text-faint tabular-nums">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
