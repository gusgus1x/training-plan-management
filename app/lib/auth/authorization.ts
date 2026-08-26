import { ApiError } from "../api/errors";
import type { AuthenticatedPrincipal, RoleCode } from "./types";

const forbidden = () =>
  new ApiError({
    code: "FORBIDDEN",
    message: "Access denied",
    status: 403,
  });

export const requireRole = (
  principal: AuthenticatedPrincipal,
  allowedRoles: readonly RoleCode[],
) => {
  if (!allowedRoles.includes(principal.role)) {
    throw forbidden();
  }
};

/**
 * Both employee keys are live during Phase 20, so ownership may be proven by either — but only by
 * a key the principal actually carries. An account with no employee link proves nothing and is
 * refused, which is the case for every account today: `user_account.employee_id` is deliberately
 * left NULL until real people are linked to logins.
 */
export const requireEmployeeOwnership = (
  principal: AuthenticatedPrincipal,
  employeeId: string,
  employeeUserId?: string | null,
) => {
  if (principal.role !== "EMPLOYEE") {
    throw forbidden();
  }

  const matchesDurableKey =
    principal.employeeUserId !== null &&
    employeeUserId != null &&
    principal.employeeUserId === employeeUserId;

  const matchesSurrogateKey =
    principal.employeeId !== null && principal.employeeId === employeeId;

  if (!matchesDurableKey && !matchesSurrogateKey) {
    throw forbidden();
  }
};

export const requireCompanyScope = (
  principal: AuthenticatedPrincipal,
  companyId: string,
  options: { allowHrdCenter?: boolean } = {},
) => {
  if (principal.role === "HRD_CENTER" && options.allowHrdCenter === true) {
    return;
  }

  if (
    principal.role !== "HRD_FACTORY" ||
    principal.companyId === null ||
    principal.companyId !== companyId
  ) {
    throw forbidden();
  }
};

