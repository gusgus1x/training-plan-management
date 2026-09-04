import { ApiError } from "../api/errors";
import { hashPassword } from "../auth/password";
import type { AuthenticatedPrincipal, RoleCode } from "../auth/types";
import {
  userAccountRepository,
  type UserAccountRepository,
} from "./repository";
import type {
  CreateUserAccountInput,
  UpdateUserAccountInput,
  UserAccountListFilters,
  UserAccountRecord,
} from "./types";

const notFound = () =>
  new ApiError({ code: "USER_ACCOUNT_NOT_FOUND", message: "Account not found", status: 404 });

const conflict = (message: string) =>
  new ApiError({ code: "USER_ACCOUNT_CONFLICT", message, status: 409 });

const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted account data is invalid",
    status: 400,
    details: { field, reason },
  });

/**
 * Mirrors the checks resolveActivePrincipal applies at sign-in. Without this an administrator can
 * happily save an account that is then rejected on every login attempt, with nothing explaining
 * why — the bindings are what make a principal resolvable.
 */
const assertRoleBindings = (
  roleCode: RoleCode,
  companyId: string | null,
  employeeId: string | null,
) => {
  if (roleCode === "EMPLOYEE" && !employeeId) {
    throw invalid("employeeId", "An employee account must be linked to an employee");
  }
  if (roleCode === "HRD_FACTORY" && !companyId) {
    throw invalid("companyId", "An HRD factory account must be linked to a company");
  }
  if ((roleCode === "HRD_CENTER" || roleCode === "ADMIN") && companyId) {
    throw invalid("companyId", `A ${roleCode} account must not be scoped to a company`);
  }
  if (roleCode === "ADMIN" && employeeId) {
    throw invalid("employeeId", "An administrator account is not linked to an employee record");
  }
};

export type UserAccountService = ReturnType<typeof createUserAccountService>;

export const createUserAccountService = (
  repository: UserAccountRepository = userAccountRepository,
) => {
  const resolveRoleId = async (roleCode: RoleCode) => {
    const roleId = await repository.roleIdFor(roleCode);
    if (roleId === null) {
      throw invalid("roleCode", `Role ${roleCode} is not active in this database`);
    }
    return roleId;
  };

  const requireExisting = async (userId: string) => {
    const current = await repository.findById(userId);
    if (!current) throw notFound();
    return current;
  };

  return {
    list: (filters: UserAccountListFilters) => repository.list(filters),

    get: (userId: string) => requireExisting(userId),

    async create(input: CreateUserAccountInput): Promise<UserAccountRecord> {
      assertRoleBindings(input.roleCode, input.companyId, input.employeeId);

      if (await repository.usernameTaken(input.username)) {
        throw conflict("Username already exists");
      }

      const roleId = await resolveRoleId(input.roleCode);
      return repository.create(input, await hashPassword(input.password), roleId);
    },

    async update(
      principal: AuthenticatedPrincipal,
      userId: string,
      input: UpdateUserAccountInput,
    ): Promise<UserAccountRecord> {
      const current = await requireExisting(userId);
      const nextRole = input.roleCode ?? current.roleCode;
      const nextCompany =
        input.companyId === undefined ? current.companyId : input.companyId;
      const nextEmployee =
        input.employeeId === undefined ? current.employeeId : input.employeeId;
      const nextStatus = input.status ?? current.status;

      // Changing your own role or disabling yourself is how an administrator locks themselves out.
      if (principal.userId === userId && (input.roleCode || input.status)) {
        throw conflict("You cannot change your own role or status");
      }

      if (input.username !== undefined && input.username !== current.username) {
        if (await repository.usernameTaken(input.username, userId)) {
          throw conflict(`Username "${input.username}" is already in use`);
        }
      }

      assertRoleBindings(nextRole, nextCompany, nextEmployee);

      const losesAdmin =
        current.roleCode === "ADMIN" &&
        (nextRole !== "ADMIN" || nextStatus !== "ACTIVE");
      if (losesAdmin && (await repository.countActiveAdmins(userId)) === 0) {
        throw conflict("At least one active administrator must remain");
      }

      const roleId = input.roleCode ? await resolveRoleId(input.roleCode) : null;
      return repository.update(userId, input, roleId);
    },

    async resetPassword(userId: string, password: string): Promise<UserAccountRecord> {
      await requireExisting(userId);
      return repository.setPassword(userId, await hashPassword(password));
    },

    async delete(principal: AuthenticatedPrincipal, userId: string): Promise<boolean> {
      const current = await requireExisting(userId);
      if (principal.userId === userId) {
        throw conflict("You cannot delete your own account");
      }
      if (current.roleCode === "ADMIN" && (await repository.countActiveAdmins(userId)) === 0) {
        throw conflict("At least one active administrator must remain");
      }
      return repository.delete(userId);
    },
  };
};

export const userAccountService = createUserAccountService();
