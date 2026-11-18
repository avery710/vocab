import { NextResponse } from "next/server";
import { auth, isOwnerEmail } from "@/auth";

/**
 * Everything needs the owner's Google sign-in except:
 * - the sign-in page and Auth.js routes;
 * - /api/mcp, which checks its own bearer token (app/api/mcp/route.ts);
 * - the OAuth pieces an AI app calls before anyone signs in (metadata,
 *   registration, token). /oauth/authorize is NOT here: approving a
 *   connection needs the cookie session, which is the point.
 *
 * Named `proxy` (Next.js 16's name for middleware).
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname === "/signin") return;
  if (pathname === "/api/mcp") return;
  if (
    pathname.startsWith("/.well-known/oauth-") ||
    pathname === "/api/oauth/register" ||
    pathname === "/api/oauth/token"
  ) {
    return;
  }

  if (!isOwnerEmail(req.auth?.user?.email)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const signInUrl = new URL("/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
