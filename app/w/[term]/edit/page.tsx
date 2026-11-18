import { notFound } from "next/navigation";
import { updateWordAction } from "@/app/actions";
import { TopBar } from "@/components/top-bar";
import { WordForm } from "@/components/word-form";
import { safeDecode, wordPath } from "@/lib/format";
import { getWordByTerm } from "@/lib/words";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit" };

export default async function EditWordPage({ params }: { params: Promise<{ term: string }> }) {
  const w = await getWordByTerm(safeDecode((await params).term));
  if (!w) notFound();
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8 [&>*]:max-w-2xl">
        <h1 className="mt-8 font-serif text-[34px] font-semibold">Edit “{w.term}”</h1>
        <WordForm
          action={updateWordAction.bind(null, w.id)}
          submitLabel="Save changes"
          cancelHref={wordPath(w.term)}
          initial={{
            term: w.term,
            pronunciation: w.pronunciation,
            partOfSpeech: w.partOfSpeech ?? "",
            definition: w.definition,
            chineseDefinition: w.chineseDefinition,
            example: w.example,
            exampleZh: w.exampleZh,
            note: w.note,
            tags: w.tags.join(", "),
            related: w.related.map((r) => r.term).join(", "),
            dateAdded: w.dateAdded,
          }}
        />
      </main>
    </>
  );
}
