import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import type { RoleCode } from "../auth/types";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateUserAccountInput,
  UpdateUserAccountInput,
  UserAccountListFilters,
  UserAccountRecord,
  UserAccountStatus,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "user_account" | "role">;

// password_hash is never selected: nothing outside authentication has any reason to read it.
const select = {
  user_id: true,
  username: true,
  email: true,
  status: true,
  last_login_at: true,
  created_at: true,
  company_id: true,
  employee_id: true,
  role: { select: { role_code: true, role_name: true } },
  company: { select: { company_code: true } },
  employee: { select: { first_name_th: true, last_name_th: true } },
} satisfies Prisma.user_accountSelect;

type Row = Prisma.user_accountGetPayload<{ select: typeof select }>;

const map = (row: Row): UserAccountRecord => ({
  userId: row.user_id.toString(),
  username: row.username,
  email: row.email,
  roleCode: row.role.role_code as RoleCode,
  roleName: row.role.role_name,
  companyId: row.company_id?.toString() ?? null,
  companyCode: row.company?.company_code ?? null,
  employeeId: row.employee_id?.toString() ?? null,
  employeeName: row.employee
    ? `${row.employee.first_name_th} ${row.employee.last_name_th}`.trim()
    : null,
  status: row.status as UserAccountStatus,
  lastLoginAt: row.last_login_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

export type UserAccountRepository = ReturnType<typeof createUserAccountRepository>;

export const createUserAccountRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as PrismaClient;

  const roleIdFor = async (roleCode: RoleCode) => {
    const role = await db().role.findFirst({
      where: { role_code: roleCode, status: "ACTIVE" },
      select: { role_id: true },
    });
    return role?.role_id ?? null;
  };

  return {
    roleIdFor,

    async list(filters: UserAccountListFilters) {
      const where: Prisma.user_accountWhereInput = {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.roleCode ? { role: { role_code: filters.roleCode } } : {}),
        ...(filters.search
          ? {
              OR: [
                { username: { contains: filters.search } },
                { email: { contains: filters.search } },
              ],
            }
          : {}),
      };

      return withDatabaseErrorMapping(async () => {
        const rows = await db().user_account.findMany({
          where,
          select,
          orderBy: { username: "asc" },
        });
        return rows.map(map);
      });
    },

    async findById(userId: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await db().user_account.findUnique({
          where: { user_id: BigInt(userId) },
          select,
        });
        return row ? map(row) : null;
      });
    },

    /** Guards the last way back in: the app must never be left without a usable administrator. */
    async countActiveAdmins(excludeUserId?: string) {
      return withDatabaseErrorMapping(() =>
        db().user_account.count({
          where: {
            status: "ACTIVE",
            role: { role_code: "ADMIN" },
            ...(excludeUserId ? { user_id: { not: BigInt(excludeUserId) } } : {}),
          },
        }),
      );
    },

    async usernameTaken(username: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await db().user_account.findFirst({
          where: { username },
          select: { user_id: true },
        });
        return row !== null;
      });
    },

    async create(input: CreateUserAccountInput, passwordHash: string, roleId: number) {
      return withDatabaseErrorMapping(async () => {
        const row = await db().user_account.create({
          data: {
            username: input.username,
            password_hash: passwordHash,
            email: input.email,
            status: input.status,
            role_id: roleId,
            company_id: input.companyId ? BigInt(input.companyId) : null,
            employee_id: input.employeeId ? BigInt(input.employeeId) : null,
            created_at: new Date(),
          },
          select,
        });
        return map(row);
      });
    },

    async update(userId: string, input: UpdateUserAccountInput, roleId: number | null) {
      return withDatabaseErrorMapping(async () => {
        const row = await db().user_account.update({
          where: { user_id: BigInt(userId) },
          data: {
            ...(roleId === null ? {} : { role_id: roleId }),
            ...(input.email === undefined ? {} : { email: input.email }),
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.companyId === undefined
              ? {}
              : { company_id: input.companyId ? BigInt(input.companyId) : null }),
            ...(input.employeeId === undefined
              ? {}
              : { employee_id: input.employeeId ? BigInt(input.employeeId) : null }),
          },
          select,
        });
        return map(row);
      });
    },

    async setPassword(userId: string, passwordHash: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await db().user_account.update({
          where: { user_id: BigInt(userId) },
          data: { password_hash: passwordHash },
          select,
        });
        return map(row);
      });
    },
  };
};

export const userAccountRepository = createUserAccountRepository();
