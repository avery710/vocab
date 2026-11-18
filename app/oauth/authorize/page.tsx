import { redirect } from "next/navigation";
import { auth, isOwnerEmail } from "@/auth";
import { createAuthCode, parseAuthorizeRequest } from "@/lib/oauth";
import { parseTokenScope } from "@/lib/token-auth";

/**
 * /oauth/authorize — where Claude sends you when you add the connector.
 * proxy.ts makes you sign in first and brings you back with the query intact.
 * Nothing is granted until you press Allow.
 */
type Params = Record<string, string | undefined>;

async function decide(formData: FormData) {
  "use server";
  const session = await auth();
  if (!isOwnerEmail(session?.user?.email)) redirect("/signin");

  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  // Hidden fields are only as trustworthy as the query: check them again.
  const req = await parseAuthorizeRequest({
    response_type: "code",
    code_challenge_method: "S256",
    client_id: get("client_id"),
    redirect_uri: get("redirect_uri"),
    code_challenge: get("code_challenge"),
    state: get("state"),
  });
  if (!req) redirect("/");

  const back = new URL(req.redirectUri);
  if (req.state) back.searchParams.set("state", req.state);
  const scope = parseTokenScope(get("scope"));
  if (get("decision") !== "approve" || !scope) {
    back.searchParams.set("error", "access_denied");
    redirect(back.toString());
  }
  const code = await createAuthCode({
    clientId: req.client.clientId,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    scope,
  });
  back.searchParams.set("code", code);
  redirect(back.toString());
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const p: Params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const req = await parseAuthorizeRequest(p);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-rule bg-sheet p-8">
        <p className="font-serif text-[30px] leading-none font-semibold">
          <span className="marked">vocab</span>
        </p>
        {!req ? (
          <p className="mt-6 rounded-xl bg-danger/10 px-4 py-3 text-[14px] text-danger">
            This connection link is broken or out of date. Start again from the app you were connecting.
          </p>
        ) : (
          <form action={decide} className="mt-6">
            <input type="hidden" name="client_id" value={req.client.clientId} />
            <input type="hidden" name="redirect_uri" value={req.redirectUri} />
            <input type="hidden" name="code_challenge" value={req.codeChallenge} />
            <input type="hidden" name="state" value={req.state} />

            <h1 className="text-[20px] font-semibold">Let {req.client.name} use your notebook?</h1>
            <fieldset className="mt-5 grid gap-2">
              <legend className="sr-only">Access</legend>
              {(["write", "read"] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-start gap-3 rounded-xl border border-rule p-3 has-[:checked]:border-ink">
                  <input type="radio" name="scope" value={s} defaultChecked={req.defaultScope === s} className="mt-1 accent-[var(--color-ink)]" />
                  <span>
                    <span className="block text-[15px] font-medium">{s === "write" ? "Look up, add and edit words" : "Only look up words"}</span>
                    <span className="block text-[13.5px] text-pencil">
                      {s === "write" ? "It can save new words you send it and fix entries." : "It can search your notebook but not change it."}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="mt-4 text-[13px] text-pencil">
              After you choose, you’ll go back to {new URL(req.redirectUri).host || req.redirectUri}. You can disconnect it any time
              on the Connect AI page.
            </p>
            <div className="mt-5 flex gap-2">
              <button type="submit" name="decision" value="approve" className="flex-1 rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-sheet">
                Allow
              </button>
              <button type="submit" name="decision" value="deny" className="flex-1 rounded-full border border-rule px-5 py-2.5 text-[15px]">
                Don’t allow
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
