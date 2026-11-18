import Link from "next/link";
import { TopBar } from "@/components/top-bar";

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
        <p className="mt-16 text-[30px] font-bold tracking-[-0.02em]">That word isn’t in your notebook.</p>
        <div className="mt-5 flex gap-2">
          <Link href="/new" className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-sheet">
            Add a word
          </Link>
          <Link href="/" className="rounded-full border border-rule bg-sheet px-4 py-2 text-[14px] hover:border-ink">
            All words
          </Link>
        </div>
      </main>
    </>
  );
}
