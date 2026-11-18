"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, signIn, signOut } from "@/auth";
import { wordPath } from "@/lib/format";
import { revokeApp } from "@/lib/token-auth";
import { newWordSchema } from "@/lib/word-input";
import { createWord, deleteWord, updateWord } from "@/lib/words";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function list(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function readForm(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  const values = Object.fromEntries(
    ["term", "pronunciation", "partOfSpeech", "definition", "chineseDefinition", "example", "exampleZh", "note", "tags", "related", "dateAdded"].map(
      (k) => [k, s(k)]
    )
  );
  const parsed = newWordSchema.safeParse({
    term: s("term"),
    pronunciation: s("pronunciation"),
    partOfSpeech: s("partOfSpeech") || null,
    definition: s("definition"),
    chineseDefinition: s("chineseDefinition"),
    example: s("example"),
    exampleZh: s("exampleZh"),
    note: s("note"),
    tags: list(fd.get("tags")),
    related: list(fd.get("related")),
    dateAdded: s("dateAdded") || undefined,
  });
  return { values, parsed };
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function createWordAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireOwner();
  const { values, parsed } = readForm(fd);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error.issues) };
  const r = await createWord(parsed.data);
  if (!r.ok) {
    return r.error === "duplicate"
      ? { values, fieldErrors: { term: `“${r.existing.term}” is already in your dictionary.` } }
      : { values, error: "Couldn't save the word." };
  }
  revalidatePath("/");
  redirect(wordPath(r.word.term));
}

export async function updateWordAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireOwner();
  const { values, parsed } = readForm(fd);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error.issues) };
  const { term, related, ...fields } = parsed.data;
  const r = await updateWord(id, { term, related: related ?? [], ...fields, partOfSpeech: fields.partOfSpeech ?? null });
  if (!r.ok) {
    return r.error === "duplicate"
      ? { values, fieldErrors: { term: `“${r.existing.term}” is already in your dictionary.` } }
      : { values, error: "This word no longer exists." };
  }
  revalidatePath("/");
  redirect(wordPath(r.word.term));
}

export async function deleteWordAction(id: string) {
  await requireOwner();
  await deleteWord(id);
  revalidatePath("/");
  redirect("/");
}

export async function revokeAppAction(id: string) {
  await requireOwner();
  await revokeApp(id);
  revalidatePath("/connect");
}

export async function googleSignIn(callbackUrl?: string) {
  // Only same-site paths, never an absolute URL from the query.
  const safe = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  await signIn("google", { redirectTo: safe });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
