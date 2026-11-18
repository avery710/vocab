"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** The search field: updates ?q= as you type (debounced), keeps other filters.
 *  "/" focuses it from anywhere on the page. */
export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (value === (params.get("q") ?? "")) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("letter");
      next.delete("page");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 220);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);

  return (
    <div className="relative">
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search English or 中文"
        aria-label="Search your words"
        className="h-13 w-full rounded-2xl border border-rule bg-sheet pr-12 pl-12 text-[17px] placeholder:text-faint focus:border-marker focus:shadow-[0_0_0_1px_var(--color-marker)] focus:outline-none"
      />
      <kbd className="absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md border border-rule px-1.5 text-[12px] text-faint sm:block">
        {pending ? "…" : "/"}
      </kbd>
    </div>
  );
}
