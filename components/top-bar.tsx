import Link from "next/link";

const NAV = [
  { href: "/", label: "Words" },
  { href: "/review", label: "Review" },
  { href: "/connect", label: "Connect AI" },
] as const;

export function TopBar({ current }: { current?: (typeof NAV)[number]["href"] }) {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center gap-5 px-5 pt-6 pb-2 sm:px-8">
      <Link href="/" className="text-[26px] leading-none font-bold tracking-[-0.02em]">
        <span className="marked">vocab</span>
      </Link>
      <nav className="ml-auto flex items-center gap-1 text-[14px]">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={current === n.href ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              current === n.href ? "bg-ink text-sheet" : "text-pencil hover:bg-rule/60 hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
