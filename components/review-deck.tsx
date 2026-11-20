"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { recordReviewAction } from "@/app/actions";
import { examples, partsOfSpeech, senses, shortDate, wordPath } from "@/lib/format";
import type { ReviewCounts, Word } from "@/lib/words";
import { MarkedSentence } from "./marked-sentence";
import { SpeakButton } from "./speak-button";

type Direction = "en" | "zh";

/** Flashcards: see the word (or the Chinese), try to recall, reveal, then
 *  mark it "Knew it" (comes back later and later) or "Again" (tomorrow).
 *  Space reveals; then 1 = Again, 2 = Knew it. */
export function ReviewDeck({ words, counts }: { words: Word[]; counts: ReviewCounts }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [dir, setDir] = useState<Direction>("en");
  const [left, setLeft] = useState({ due: counts.due, new: counts.new });
  const [failed, setFailed] = useState(false);
  const w = words[i];
  const done = i >= words.length;
  const pos = w ? partsOfSpeech(w).join(" · ") : "";

  const grade = useCallback(
    (knew: boolean) => {
      if (!w || !shown) return;
      recordReviewAction(w.id, knew).catch(() => setFailed(true));
      setLeft((l) => (w.reviewDue === null ? { ...l, new: l.new - 1 } : { ...l, due: l.due - 1 }));
      setShown(false);
      setI((n) => n + 1);
    },
    [w, shown]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "INPUT") return;
      if ((e.key === " " || e.key === "Enter") && !shown && !done) {
        e.preventDefault();
        setShown(true);
      } else if (shown && e.key === "1") grade(false);
      else if (shown && e.key === "2") grade(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, done, grade]);

  if (words.length === 0) {
    return counts.nextDue ? (
      <CaughtUp nextDue={counts.nextDue} />
    ) : (
      <p className="mt-10 text-[15px] text-pencil">Add a few words first, then come back to review them.</p>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-[14px] text-pencil">
        <div role="group" aria-label="Card front" className="flex gap-1">
          {(["en", "zh"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dir === d}
              onClick={() => {
                setDir(d);
                setShown(false);
              }}
              className={`rounded-full px-3 py-1 ${dir === d ? "bg-ink text-sheet" : "hover:bg-rule/70 hover:text-ink"}`}
            >
              {d === "en" ? "English first" : "中文先"}
            </button>
          ))}
        </div>
        <span className="font-mono tabular-nums">
          {Math.min(i + 1, words.length)} / {words.length}
        </span>
      </div>

      {done ? (
        left.due + left.new > 0 ? (
          <div className="mt-6 rounded-3xl border border-rule bg-sheet p-10 text-center">
            <p className="text-[28px] font-bold tracking-[-0.02em]">That’s the set.</p>
            <p className="mt-2 text-[15px] text-pencil">
              <span className="font-mono tabular-nums">{left.due}</span> due ·{" "}
              <span className="font-mono tabular-nums">{left.new}</span> new left
            </p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-5 rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-sheet"
            >
              Next set
            </button>
          </div>
        ) : (
          <CaughtUp nextDue={null} />
        )
      ) : (
        <div className="mt-4 flex min-h-[360px] flex-col rounded-3xl border border-rule bg-sheet p-7 sm:p-10">
          <div className="flex-1">
            {dir === "en" || shown ? (
              // Inline, so align-middle centers the button on the word's x-height
              // (and it follows the last line when a phrase wraps).
              <div className="text-[clamp(36px,8vw,56px)] leading-tight">
                <h2 className="inline font-bold tracking-[-0.02em]">
                  <span className={shown ? "marked marked-draw" : ""}>{w.term}</span>
                </h2>
                <SpeakButton text={w.term} className="ml-3 align-middle" />
              </div>
            ) : null}
            {dir === "zh" && !shown && <p className="zh text-[24px]">{senses(w.chineseDefinition).join("；") || w.definition}</p>}

            {shown && (
              <div className="mt-5 grid gap-3">
                <p className="flex flex-wrap gap-x-3 text-[15px] text-pencil">
                  {pos && <span>{pos}</span>}
                  {w.pronunciation && <span className="ipa">{w.pronunciation}</span>}
                </p>
                {w.chineseDefinition && <p className="zh text-[19px]">{senses(w.chineseDefinition).join("；")}</p>}
                {w.definition && <p className="text-[17px] text-ink/80">{w.definition}</p>}
                {examples(w.example, "").map((e, i) => (
                  <p key={i} className="mt-2 border-l-[3px] border-marker pl-3 text-[17px]">
                    <MarkedSentence text={e.en} term={w.term} />
                  </p>
                ))}
                <Link href={wordPath(w.term)} className="mt-1 text-[14px] text-pencil underline decoration-rule underline-offset-4 hover:text-ink">
                  Open entry
                </Link>
              </div>
            )}
          </div>
          {shown ? (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => grade(false)}
                className="rounded-full border border-rule bg-sheet px-5 py-2.5 text-[15px] font-medium hover:border-ink"
              >
                Again
              </button>
              <button type="button" onClick={() => grade(true)} className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-sheet">
                Knew it
              </button>
              <span className="ml-2 hidden text-[12.5px] text-faint sm:inline">1 · 2</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShown(true)}
              className="mt-8 self-start rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-sheet"
            >
              Show meaning
            </button>
          )}
        </div>
      )}
      {failed && <p className="mt-3 text-[13.5px] text-danger">Some reviews didn’t save. They’ll come up again.</p>}
    </div>
  );
}

function CaughtUp({ nextDue }: { nextDue: string | null }) {
  return (
    <div className="mt-6 rounded-3xl border border-rule bg-sheet p-10 text-center">
      <p className="text-[28px] font-bold tracking-[-0.02em]">All caught up.</p>
      <p className="mt-2 text-[15px] text-pencil">
        {nextDue ? `Next words are due ${shortDate(nextDue)}.` : "Nothing else is due today."}
      </p>
    </div>
  );
}
