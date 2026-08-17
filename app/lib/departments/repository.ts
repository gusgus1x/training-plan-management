import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateDepartmentInput,
  CreateDepartmentMappingInput,
  DepartmentListFilters,
  DepartmentMappingRecord,
  DepartmentRecord,
  MappingListFilters,
  PaginatedResult,
  UpdateDepartmentInput,
  UpdateDepartmentMappingInput,
} from "./types";

type DatabaseClient = Pick<
  PrismaClient,
  "department" | "company_department_mapping"
>;
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

const mappingSelect = {
  department_mapping_id: true,
  company_id: true,
  plant_department_code: true,
  plant_department_name: true,
  department_id: true,
  status: true,
  company: {
    select: {
      company_code: true,
      company_name_th: true,
    },
  },
  department: {
    select: {
      department_code: true,
      department_name_th: true,
    },
  },
} satisfies Prisma.company_department_mappingSelect;
type MappingRow = Prisma.company_department_mappingGetPayload<{
  select: typeof mappingSelect;
}>;
const mapMapping = (row: MappingRow): DepartmentMappingRecord => ({
  departmentMappingId: row.department_mapping_id.toString(),
  companyId: row.company_id.toString(),
  companyCode: row.company.company_code,
  companyNameTh: row.company.company_name_th,
  plantDepartmentCode: row.plant_department_code,
  plantDepartmentName: row.plant_department_name,
  departmentId: row.department_id.toString(),
  departmentCode: row.department.department_code,
  departmentNameTh: row.department.department_name_th,
  status: row.status as DepartmentMappingRecord["status"],
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

    async listMappings(
      filters: MappingListFilters,
    ): Promise<PaginatedResult<DepartmentMappingRecord>> {
      const where: Prisma.company_department_mappingWhereInput = {};
      if (filters.companyId) where.company_id = BigInt(filters.companyId);
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { plant_department_code: { contains: filters.search } },
          { plant_department_name: { contains: filters.search } },
          { company: { company_code: { contains: filters.search } } },
          { department: { department_code: { contains: filters.search } } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().company_department_mapping.findMany({
            where,
            select: mappingSelect,
            orderBy: [{ company_id: "asc" }, { department_mapping_id: "asc" }],
            skip: filters.skip,
            take: filters.take,
          }),
          database().company_department_mapping.count({ where }),
        ]);
        return { items: rows.map(mapMapping), totalItems };
      });
    },

    async findMappingById(mappingId: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_department_mapping.findUnique({
          where: { department_mapping_id: BigInt(mappingId) },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async findMappingByCode(
      companyId: string,
      plantDepartmentCode: string,
      excludeId?: string,
    ) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_department_mapping.findFirst({
          where: {
            company_id: BigInt(companyId),
            plant_department_code: plantDepartmentCode,
            ...(excludeId
              ? { NOT: { department_mapping_id: BigInt(excludeId) } }
              : {}),
          },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async createMapping(
      input: CreateDepartmentMappingInput & { companyId: string },
    ) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_department_mapping.create({
            data: {
              company_id: BigInt(input.companyId),
              plant_department_code: input.plantDepartmentCode,
              plant_department_name: input.plantDepartmentName,
              department_id: BigInt(input.departmentId),
              status: input.status,
            },
            select: mappingSelect,
          }),
        ),
      );
    },

    async updateMapping(
      mappingId: string,
      input: UpdateDepartmentMappingInput,
    ) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_department_mapping.update({
            where: { department_mapping_id: BigInt(mappingId) },
            data: {
              ...(input.plantDepartmentCode !== undefined
                ? { plant_department_code: input.plantDepartmentCode }
                : {}),
              ...(input.plantDepartmentName !== undefined
                ? { plant_department_name: input.plantDepartmentName }
                : {}),
              ...(input.departmentId !== undefined
                ? { department_id: BigInt(input.departmentId) }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
            },
            select: mappingSelect,
          }),
        ),
      );
    },

    async deleteMapping(mappingId: string) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_department_mapping.delete({
            where: { department_mapping_id: BigInt(mappingId) },
            select: mappingSelect,
          }),
        ),
      );
    },
  };
};

export const departmentRepository = createDepartmentRepository();
