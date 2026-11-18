"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import { PARTS_OF_SPEECH } from "@/lib/word-input";

export interface WordFormValues {
  term: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  chineseDefinition: string;
  example: string;
  exampleZh: string;
  note: string;
  tags: string;
  related: string;
  dateAdded: string;
}

export function WordForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  initial: WordFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = (k: keyof WordFormValues) => state.values?.[k] ?? initial[k];
  const err = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <Field label="Word or phrase" error={err("term")}>
        <input
          name="term"
          defaultValue={v("term")}
          required
          autoFocus={!initial.term}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className="field font-serif !text-[24px] font-semibold"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Type" error={err("partOfSpeech")}>
          <select name="partOfSpeech" defaultValue={v("partOfSpeech")} className="field">
            <option value="">—</option>
            {PARTS_OF_SPEECH.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pronunciation" hint="IPA, e.g. /æpt/" error={err("pronunciation")}>
          <input name="pronunciation" defaultValue={v("pronunciation")} className="field ipa" />
        </Field>
      </div>

      <Field label="中文定義" hint="One meaning per line" error={err("chineseDefinition")}>
        <textarea name="chineseDefinition" defaultValue={v("chineseDefinition")} rows={2} className="field zh" />
      </Field>
      <Field label="English definition" hint="One meaning per line" error={err("definition")}>
        <textarea name="definition" defaultValue={v("definition")} rows={2} className="field" />
      </Field>
      <Field label="Example sentence" error={err("example")}>
        <textarea name="example" defaultValue={v("example")} rows={2} className="field" />
      </Field>
      <Field label="例句翻譯" error={err("exampleZh")}>
        <textarea name="exampleZh" defaultValue={v("exampleZh")} rows={2} className="field zh" />
      </Field>
      <Field label="筆記" hint="One point per line" error={err("note")}>
        <textarea name="note" defaultValue={v("note")} rows={5} className="field zh" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tags" hint="Comma-separated" error={err("tags")}>
          <input name="tags" defaultValue={v("tags")} className="field" placeholder="casual, business" />
        </Field>
        <Field label="Related words" hint="Words already in your notebook" error={err("related")}>
          <input name="related" defaultValue={v("related")} className="field" />
        </Field>
      </div>

      <Field label="Date added" error={err("dateAdded")}>
        <input type="date" name="dateAdded" defaultValue={v("dateAdded")} className="field max-w-48" />
      </Field>

      {state.error && <p className="text-[14px] text-danger">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-sheet disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className="px-3 py-2 text-[15px] text-pencil hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-baseline gap-2 text-[14px] font-medium">
        {label}
        {hint && <span className="font-normal text-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-[13.5px] text-danger">{error}</span>}
    </label>
  );
}
