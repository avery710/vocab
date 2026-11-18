"use client";

import { useState } from "react";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-rule bg-sheet p-1.5 pl-3.5">
      <code className="min-w-0 flex-1 truncate font-sans text-[15px] tabular-nums">{value}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-[14px] font-medium ${copied ? "bg-marker text-ink" : "bg-ink text-sheet"}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
