/**
 * Auth.js (next-auth v5): Google sign-in, and only for OWNER_EMAIL. This is a
 * one-person dictionary; every other Google account is turned away at sign-in.
 * If OWNER_EMAIL is unset, nobody can sign in (fails closed).
 *
 * Imported by proxy.ts, so keep it free of Node-only imports.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export function ownerEmail(): string | null {
  return process.env.OWNER_EMAIL?.trim().toLowerCase() || null;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = ownerEmail();
  return !!owner && !!email && email.trim().toLowerCase() === owner;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ user, profile }) {
      if (profile?.email_verified === false) return false;
      return isOwnerEmail(profile?.email ?? user.email);
    },
  },
});

/** For server actions and pages: throws unless the owner is signed in. */
export async function requireOwner() {
  const session = await auth();
  if (!isOwnerEmail(session?.user?.email)) throw new Error("Not signed in");
  return session!;
}
