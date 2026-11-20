import { markTerm } from "@/lib/format";

/** An example sentence with the saved word or phrase in the green highlighter. */
export function MarkedSentence({ text, term }: { text: string; term: string }) {
  return (
    <>
      {markTerm(text, term).map((p, i) =>
        p.hit ? (
          <mark key={i} className="marked bg-transparent text-inherit">
            {p.text}
          </mark>
        ) : (
          p.text
        )
      )}
    </>
  );
}
