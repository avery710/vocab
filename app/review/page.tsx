import Link from "next/link";
import { ReviewDeck } from "@/components/review-deck";
import { TopBar } from "@/components/top-bar";
import { overview, randomWords } from "@/lib/words";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const [words, stats] = await Promise.all([randomWords(15, { tag }), overview()]);
  return (
    <>
      <TopBar current="/review" />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8 [&>*]:max-w-2xl">
        <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="font-serif text-[34px] font-semibold">Review</h1>
          {stats.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 text-[13.5px]">
              <Link href="/review" className={`rounded-full px-2.5 py-0.5 ${!tag ? "bg-ink text-sheet" : "text-pencil hover:bg-rule/70"}`}>
                all words
              </Link>
              {stats.tags.map((t) => (
                <Link
                  key={t.tag}
                  href={`/review?tag=${encodeURIComponent(t.tag)}`}
                  className={`rounded-full px-2.5 py-0.5 ${tag === t.tag ? "bg-ink text-sheet" : "text-pencil hover:bg-rule/70"}`}
                >
                  {t.tag}
                </Link>
              ))}
            </div>
          )}
        </div>
        <ReviewDeck key={words.map((w) => w.id).join()} words={words} />
      </main>
    </>
  );
}
