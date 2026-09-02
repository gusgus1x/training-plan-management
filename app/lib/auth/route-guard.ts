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

/**
 * Where an EMPLOYEE is allowed to be. Everything else — the Center/Factory sub-routes — bounces
 * them back to their own dashboard at "/".
 *
 * "/training-form" is here because taking a pre/post-test or an evaluation is a real page with its
 * own URL, not a dialog: without this entry AuthGate would redirect the employee off the form the
 * instant it opened.
 */
const EMPLOYEE_ALLOWED_BASE_PATHS = ["/", "/training-form"];

export const isEmployeeAllowedPath = (pathname: string) =>
  EMPLOYEE_ALLOWED_BASE_PATHS.some(
    (base) =>
      pathname === base ||
      // Compare against "<base>/" so a look-alike prefix such as "/training-formx" is refused.
      // "/" is skipped here: every path starts with it, and the equality check above covers it.
      (base !== "/" && pathname.startsWith(`${base}/`)),
  );
