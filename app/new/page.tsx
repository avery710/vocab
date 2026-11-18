import { createWordAction } from "@/app/actions";
import { TopBar } from "@/components/top-bar";
import { WordForm } from "@/components/word-form";
import { todayInTaipei } from "@/lib/word-input";

export const metadata = { title: "Add a word" };

export default async function NewWordPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const { term } = await searchParams;
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8 [&>*]:max-w-2xl">
        <h1 className="mt-8 font-serif text-[34px] font-semibold">Add a word</h1>
        <WordForm
          action={createWordAction}
          submitLabel="Save word"
          cancelHref="/"
          initial={{
            term: term ?? "",
            pronunciation: "",
            partOfSpeech: "",
            definition: "",
            chineseDefinition: "",
            example: "",
            exampleZh: "",
            note: "",
            tags: "",
            related: "",
            dateAdded: todayInTaipei(),
          }}
        />
      </main>
    </>
  );
}
