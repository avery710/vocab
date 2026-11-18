import { googleSignIn } from "@/app/actions";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <p className="font-serif text-[64px] leading-none font-semibold tracking-tight">
          <span className="marked">vocab</span>
        </p>
        <p className="mt-4 text-[15.5px] text-pencil">My English notebook. Sign in to open it.</p>
        {error && (
          <p className="mt-5 rounded-xl bg-danger/10 px-4 py-3 text-[14px] text-danger">
            {error === "AccessDenied" ? "This Google account can’t open this notebook." : "Sign-in didn’t finish. Try again."}
          </p>
        )}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await googleSignIn(callbackUrl);
          }}
        >
          <button type="submit" className="w-full rounded-full bg-ink px-5 py-3 text-[15px] font-medium text-sheet">
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
