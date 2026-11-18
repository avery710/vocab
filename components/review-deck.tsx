"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { senses, wordPath } from "@/lib/format";
import type { Word } from "@/lib/words";
import { SpeakButton } from "./speak-button";

type Direction = "en" | "zh";

/** Flashcards: see the word (or the Chinese), try to recall, then reveal.
 *  Space reveals / goes next. */
export function ReviewDeck({ words }: { words: Word[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [dir, setDir] = useState<Direction>("en");
  const w = words[i];
  const done = i >= words.length;

  const advance = useCallback(() => {
    if (!shown) setShown(true);
    else {
      setShown(false);
      setI((n) => n + 1);
    }
  }, [shown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        if ((e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).tagName === "A") return;
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  if (words.length === 0) {
    return <p className="mt-10 text-[15px] text-pencil">Add a few words first, then come back to review them.</p>;
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
        <span className="tabular-nums">
          {Math.min(i + 1, words.length)} / {words.length}
        </span>
      </div>

      {done ? (
        <div className="mt-6 rounded-3xl border border-rule bg-sheet p-10 text-center">
          <p className="font-serif text-[28px] font-semibold">That’s the set.</p>
          <button
            type="button"
            onClick={() => {
              setI(0);
              setShown(false);
              router.refresh();
            }}
            className="mt-5 rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-sheet"
          >
            Shuffle a new set
          </button>
        </div>
      ) : (
        <div className="mt-4 flex min-h-[360px] flex-col rounded-3xl border border-rule bg-sheet p-7 sm:p-10">
          <div className="flex-1">
            {dir === "en" || shown ? (
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-serif text-[clamp(36px,8vw,56px)] leading-tight font-semibold">
                  <span className={shown ? "marked marked-draw" : ""}>{w.term}</span>
                </h2>
                <SpeakButton text={w.term} />
              </div>
            ) : null}
            {dir === "zh" && !shown && <p className="zh text-[24px]">{senses(w.chineseDefinition).join("；") || w.definition}</p>}

            {shown && (
              <div className="mt-5 grid gap-3">
                <p className="text-[15px] text-pencil">
                  {[w.partOfSpeech, w.pronunciation].filter(Boolean).join("   ")}
                </p>
                {w.chineseDefinition && <p className="zh text-[19px]">{senses(w.chineseDefinition).join("；")}</p>}
                {w.definition && <p className="font-serif text-[17px] text-ink/80">{senses(w.definition).join("; ")}</p>}
                {w.example && (
                  <p className="mt-2 border-l-[3px] border-marker pl-3 font-serif text-[17px] italic">{w.example}</p>
                )}
                <Link href={wordPath(w.term)} className="mt-1 text-[14px] text-pencil underline decoration-rule underline-offset-4 hover:text-ink">
                  Open entry
                </Link>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={advance}
            className="mt-8 self-start rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-sheet"
          >
            {shown ? "Next word" : "Show meaning"}
          </button>
        </div>
      )}
    </div>
  );
}
