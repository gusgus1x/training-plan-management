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

export const requireEmployeeOwnership = (
  principal: AuthenticatedPrincipal,
  employeeId: string,
) => {
  if (
    principal.role !== "EMPLOYEE" ||
    principal.employeeId === null ||
    principal.employeeId !== employeeId
  ) {
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

