import { apiSuccess } from "../../../lib/api/response";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { employeeRepository } from "../../../lib/employees/repository";

// The Employee Data form fills the company part of an employee code in for the user. The prefix
// is derived from the codes that already exist, so this reads it back rather than the form
// carrying a copy that can fall out of step with the data.
export const createEmployeeCodePrefixesHandler = () =>
  createProtectedRoute(async () => {
    const prefixes = await employeeRepository.codePrefixes();
    return apiSuccess({ prefixes });
  });

export const GET = createEmployeeCodePrefixesHandler();
