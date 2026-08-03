import { ApiError } from "../api/errors";
import { requireCompanyScope } from "../auth/authorization";
import type { AuthenticatedPrincipal } from "../auth/types";
import type { FunctionMappingRecord } from "./types";

export const resolveMappingCompanyId = (
  principal: AuthenticatedPrincipal,
  requestedCompanyId: string | null,
) => {
  if (principal.role === "HRD_FACTORY") {
    requireCompanyScope(principal, principal.companyId ?? "");
    return principal.companyId as string;
  }

  if (principal.role === "HRD_CENTER" && requestedCompanyId) {
    return requestedCompanyId;
  }

  throw new ApiError({
    code: "INVALID_INPUT",
    message: "Company is required",
    status: 400,
    details: { field: "companyId" },
  });
};

export const requireMappingScope = (
  principal: AuthenticatedPrincipal,
  mapping: Pick<FunctionMappingRecord, "companyId">,
) => requireCompanyScope(principal, mapping.companyId, { allowHrdCenter: true });
