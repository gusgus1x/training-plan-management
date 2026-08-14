import { NextResponse, type NextRequest } from "next/server";
import { shouldRedirectToLogin } from "./app/lib/auth/route-guard";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./app/lib/auth/session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasValidSession = token ? verifySessionToken(token) !== null : false;

  if (
    shouldRedirectToLogin(
      request.nextUrl.pathname,
      hasValidSession,
      process.env.NODE_ENV,
    )
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|icon.png|attg-logo.png).*)"],
};
