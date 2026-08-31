import { apiSuccess } from "../../../lib/api/response";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { employeeRepository } from "../../../lib/employees/repository";

// The Employee Data form fills the company part of an employee code in for the user. The prefix
// is derived from the codes that already exist, so this reads it back rather than the form
// carrying a copy that can fall out of step with the data.
// Only the HRD roles reach the Employee Data form, and this was the one route in the tree with no
// allowedRoles at all — which let any signed-in EMPLOYEE read the per-company prefix table.
export const createEmployeeCodePrefixesHandler = () =>
  createProtectedRoute(
    async () => {
      const prefixes = await employeeRepository.codePrefixes();
      return apiSuccess({ prefixes });
    },
    { allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] },
  );

export const GET = createEmployeeCodePrefixesHandler();
