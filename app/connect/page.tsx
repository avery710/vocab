import { headers } from "next/headers";
import { revokeAppAction, signOutAction } from "@/app/actions";
import { CopyField } from "@/components/copy-field";
import { TopBar } from "@/components/top-bar";
import { listConnectedApps } from "@/lib/token-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect AI" };

function relative(iso: string | null) {
  if (!iso) return "never used";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 2) return "used just now";
  if (mins < 60) return `used ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `used ${hours} h ago`;
  return `used ${Math.round(hours / 24)} days ago`;
}

export default async function ConnectPage() {
  const h = await headers();
  const origin = process.env.APP_URL?.replace(/\/$/, "") || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const apps = await listConnectedApps();

  return (
    <>
      <TopBar current="/connect" />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8 [&>*]:max-w-2xl">
        <h1 className="mt-8 font-serif text-[34px] font-semibold">Connect AI</h1>
        <p className="mt-2 max-w-prose text-[15.5px] text-pencil">
          Add your notebook to Claude as a connector. Then send Claude a word from any chat, on your phone or computer, and it
          will look it up and save it here.
        </p>

        <section className="mt-8">
          <h2 className="text-[15px] font-medium">Connector URL</h2>
          <div className="mt-2">
            <CopyField value={`${origin}/api/mcp`} />
          </div>
          <ol className="mt-5 grid list-decimal gap-2 pl-5 text-[15px] marker:text-faint">
            <li>In Claude, open Settings, then Connectors, and choose Add custom connector.</li>
            <li>Name it “Vocab” and paste the URL above.</li>
            <li>Press Connect. You’ll come back here to sign in and allow access.</li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-[15px] font-medium">Connected apps</h2>
          {apps.length === 0 ? (
            <p className="mt-2 text-[15px] text-pencil">Nothing connected yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule rounded-2xl border border-rule bg-sheet">
              {apps.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {a.name} {a.host && <span className="font-normal text-faint">({a.host})</span>}
                    </p>
                    <p className="text-[13.5px] text-pencil">
                      {a.scope === "write" ? "Can add and edit words" : "Can only look up words"}, {relative(a.lastUsedAt)}
                    </p>
                  </div>
                  <form action={revokeAppAction.bind(null, a.id)}>
                    <button type="submit" className="rounded-full border border-rule px-3 py-1 text-[14px] hover:border-danger hover:text-danger">
                      Disconnect
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form action={signOutAction} className="mt-14">
          <button type="submit" className="text-[14px] text-pencil underline decoration-rule underline-offset-4 hover:text-ink">
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
