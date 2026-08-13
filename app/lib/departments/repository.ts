import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateDepartmentInput,
  DepartmentListFilters,
  DepartmentRecord,
  UpdateDepartmentInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "department">;
const select = {
  department_id: true,
  department_code: true,
  department_name_th: true,
  department_name_en: true,
  status: true,
} satisfies Prisma.departmentSelect;
type Row = Prisma.departmentGetPayload<{ select: typeof select }>;
const map = (row: Row): DepartmentRecord => ({
  departmentId: row.department_id.toString(),
  departmentCode: row.department_code,
  departmentNameTh: row.department_name_th,
  departmentNameEn: row.department_name_en,
  status: row.status as DepartmentRecord["status"],
});

export type DepartmentRepository = ReturnType<typeof createDepartmentRepository>;

export const createDepartmentRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async list(filters: DepartmentListFilters) {
      const where: Prisma.departmentWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { department_code: { contains: filters.search } },
          { department_name_th: { contains: filters.search } },
          { department_name_en: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().department.findMany({
            where,
            select,
            orderBy: { department_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().department.count({ where }),
        ]);
        return { items: rows.map(map), totalItems };
      });
    },
    async findById(id: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().department.findUnique({
          where: { department_id: BigInt(id) },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async findByCode(departmentCode: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().department.findFirst({
          where: {
            department_code: departmentCode,
            ...(excludeId
              ? { NOT: { department_id: BigInt(excludeId) } }
              : {}),
          },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async create(input: CreateDepartmentInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().department.create({
            data: {
              department_code: input.departmentCode,
              department_name_th: input.departmentNameTh,
              department_name_en: input.departmentNameEn,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async update(id: string, input: UpdateDepartmentInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().department.update({
            where: { department_id: BigInt(id) },
            data: {
              ...(input.departmentCode !== undefined
                ? { department_code: input.departmentCode }
                : {}),
              ...(input.departmentNameTh !== undefined
                ? { department_name_th: input.departmentNameTh }
                : {}),
              ...(input.departmentNameEn !== undefined
                ? { department_name_en: input.departmentNameEn }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
            },
            select,
          }),
        ),
      );
    },
    async delete(id: string) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().department.delete({
            where: { department_id: BigInt(id) },
            select,
          }),
        ),
      );
    },
  };
};

export const departmentRepository = createDepartmentRepository();
