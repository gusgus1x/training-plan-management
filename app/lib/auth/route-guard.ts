// Coarse, production-only backstop for proxy.ts (Next.js's middleware
// convention, renamed in v16). Never redirects in
// development: dev-preview auth has no session cookie by design, and
// middleware also runs on client-side <Link> navigation, so a dev redirect
// would break preview mode. The real gate is AuthGate (client-rendered
// LoginPage when no server session is present, and the effect that keeps
// the URL bar in sync with auth state).
export const shouldRedirectToLogin = (
  pathname: string,
  hasValidSession: boolean,
  nodeEnv: string,
) => nodeEnv === "production" && pathname !== "/login" && !hasValidSession;
