import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// middleware.ts runs on the Edge Runtime — the Node.js `jsonwebtoken` package
// uses Node-only crypto APIs that aren't available there. `jose` is the
// Edge-compatible JWT library and uses the same HS256 algorithm.

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Routes that require authentication — all dashboard paths
const PROTECTED_PREFIXES = ["/dashboard"];
// Routes that should redirect authenticated users away (don't show login to logged-in users)
const AUTH_ROUTES = ["/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("shipstream_token")?.value;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  let isValidToken = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isValidToken = true;
    } catch {
      // Token expired or tampered — treat as unauthenticated
      isValidToken = false;
    }
  }

  // Redirect unauthenticated users away from protected pages
  if (isProtected && !isValidToken) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from the login page to the dashboard
  if (isAuthRoute && isValidToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except Next.js internals and static files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
