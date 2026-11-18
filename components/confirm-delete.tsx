"use client";

import { useState } from "react";

/** Two-step delete: first press asks, second press deletes. No browser dialog. */
export function ConfirmDelete({ term, action }: { term: string; action: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-pencil hover:text-danger">
        Delete
      </button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <span>Delete “{term}”?</span>
      <button type="submit" className="rounded-full bg-danger px-3 py-1 font-medium text-white">
        Delete
      </button>
      <button type="button" onClick={() => setAsking(false)} className="px-2 py-1 text-pencil hover:text-ink">
        Keep
      </button>
    </form>
  );
}
