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

/** Where the non-employee roles are allowed to be sent after logging in. */
const VALID_BASE_PATHS = [
  "/",
  "/admin",
  "/master-data",
  "/training-course",
  "/training-plan",
  "/training-record",
  "/report",
];

const isSafeInternalUrl = (targetUrl: string | null): targetUrl is string =>
  typeof targetUrl === "string" && targetUrl.startsWith("/") && targetUrl !== "/login";

/**
 * Where to send someone straight after they log in, given the URL they were originally trying to
 * reach. Lives here rather than inside AuthGate so it can be tested, and so it sits next to
 * `isEmployeeAllowedPath` - the allow-list it defers to for employees.
 *
 * An employee used to be pinned to "/" unconditionally, which threw away the captured return URL.
 * That made every deep link into a form unusable for anyone not already logged in - scanning a QR
 * code for a pre-test landed you on the dashboard with no hint of where you meant to go. Employees
 * now keep their destination when it is one they are allowed to be at, judged by exactly the same
 * function that polices their navigation afterwards, so the two can never disagree.
 */
export const getSanitizedDestination = (targetUrl: string | null, roleCode?: string): string => {
  if (roleCode === "EMPLOYEE") {
    if (!isSafeInternalUrl(targetUrl)) return "/";
    return isEmployeeAllowedPath(targetUrl.split("?")[0]) ? targetUrl : "/";
  }
  // Admins land on the Admin Dashboard, and may only deep-link within it.
  if (roleCode === "ADMIN") {
    if (targetUrl && (targetUrl === "/admin" || targetUrl.startsWith("/admin/"))) return targetUrl;
    return "/admin";
  }
  if (!isSafeInternalUrl(targetUrl)) return "/";
  const path = targetUrl.split("?")[0];
  const isValid = VALID_BASE_PATHS.some((base) => path === base || path.startsWith(`${base}/`));
  return isValid ? targetUrl : "/";
};
