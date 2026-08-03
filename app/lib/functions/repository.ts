import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateFunctionMappingInput,
  CreateOrganizationFunctionInput,
  FunctionListFilters,
  FunctionMappingRecord,
  MappingListFilters,
  OrganizationFunctionRecord,
  PaginatedResult,
  UpdateFunctionMappingInput,
  UpdateOrganizationFunctionInput,
} from "./types";

type DatabaseClient = Pick<
  PrismaClient,
  "organization_function" | "company_function_mapping"
>;

const functionSelect = {
  function_id: true,
  function_code: true,
  function_name_th: true,
  function_name_en: true,
  status: true,
} satisfies Prisma.organization_functionSelect;

const mappingSelect = {
  function_mapping_id: true,
  company_id: true,
  plant_function_code: true,
  plant_function_name: true,
  function_id: true,
  status: true,
  company: {
    select: {
      company_code: true,
      company_name_th: true,
    },
  },
  organization_function: {
    select: {
      function_code: true,
      function_name_th: true,
    },
  },
} satisfies Prisma.company_function_mappingSelect;

type FunctionRow = Prisma.organization_functionGetPayload<{
  select: typeof functionSelect;
}>;
type MappingRow = Prisma.company_function_mappingGetPayload<{
  select: typeof mappingSelect;
}>;

const mapFunction = (row: FunctionRow): OrganizationFunctionRecord => ({
  functionId: row.function_id.toString(),
  functionCode: row.function_code,
  functionNameTh: row.function_name_th,
  functionNameEn: row.function_name_en,
  status: row.status as OrganizationFunctionRecord["status"],
});

const mapMapping = (row: MappingRow): FunctionMappingRecord => ({
  functionMappingId: row.function_mapping_id.toString(),
  companyId: row.company_id.toString(),
  companyCode: row.company.company_code,
  companyNameTh: row.company.company_name_th,
  plantFunctionCode: row.plant_function_code,
  plantFunctionName: row.plant_function_name,
  functionId: row.function_id.toString(),
  functionCode: row.organization_function.function_code,
  functionNameTh: row.organization_function.function_name_th,
  status: row.status as FunctionMappingRecord["status"],
});

export type FunctionRepository = ReturnType<typeof createFunctionRepository>;

export const createFunctionRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();

  return {
    async listFunctions(
      filters: FunctionListFilters,
    ): Promise<PaginatedResult<OrganizationFunctionRecord>> {
      const where: Prisma.organization_functionWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { function_code: { contains: filters.search } },
          { function_name_th: { contains: filters.search } },
          { function_name_en: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().organization_function.findMany({
            where,
            select: functionSelect,
            orderBy: { function_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().organization_function.count({ where }),
        ]);
        return { items: rows.map(mapFunction), totalItems };
      });
    },

    async findFunctionById(functionId: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().organization_function.findUnique({
          where: { function_id: BigInt(functionId) },
          select: functionSelect,
        });
        return row ? mapFunction(row) : null;
      });
    },

    async findFunctionByCode(functionCode: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().organization_function.findFirst({
          where: {
            function_code: functionCode,
            ...(excludeId
              ? { NOT: { function_id: BigInt(excludeId) } }
              : {}),
          },
          select: functionSelect,
        });
        return row ? mapFunction(row) : null;
      });
    },

    async createFunction(input: CreateOrganizationFunctionInput) {
      return withDatabaseErrorMapping(async () =>
        mapFunction(
          await database().organization_function.create({
            data: {
              function_code: input.functionCode,
              function_name_th: input.functionNameTh,
              function_name_en: input.functionNameEn,
              status: input.status,
            },
            select: functionSelect,
          }),
        ),
      );
    },

    async updateFunction(
      functionId: string,
      input: UpdateOrganizationFunctionInput,
    ) {
      return withDatabaseErrorMapping(async () =>
        mapFunction(
          await database().organization_function.update({
            where: { function_id: BigInt(functionId) },
            data: {
              ...(input.functionCode !== undefined
                ? { function_code: input.functionCode }
                : {}),
              ...(input.functionNameTh !== undefined
                ? { function_name_th: input.functionNameTh }
                : {}),
              ...(input.functionNameEn !== undefined
                ? { function_name_en: input.functionNameEn }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
            },
            select: functionSelect,
          }),
        ),
      );
    },

    async deleteFunction(functionId: string) {
      return withDatabaseErrorMapping(async () =>
        mapFunction(
          await database().organization_function.delete({
            where: { function_id: BigInt(functionId) },
            select: functionSelect,
          }),
        ),
      );
    },

    async listMappings(
      filters: MappingListFilters,
    ): Promise<PaginatedResult<FunctionMappingRecord>> {
      const where: Prisma.company_function_mappingWhereInput = {};
      if (filters.companyId) where.company_id = BigInt(filters.companyId);
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { plant_function_code: { contains: filters.search } },
          { plant_function_name: { contains: filters.search } },
          { company: { company_code: { contains: filters.search } } },
          {
            organization_function: {
              function_code: { contains: filters.search },
            },
          },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().company_function_mapping.findMany({
            where,
            select: mappingSelect,
            orderBy: [
              { company_id: "asc" },
              { function_mapping_id: "asc" },
            ],
            skip: filters.skip,
            take: filters.take,
          }),
          database().company_function_mapping.count({ where }),
        ]);
        return { items: rows.map(mapMapping), totalItems };
      });
    },

    async findMappingById(mappingId: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_function_mapping.findUnique({
          where: { function_mapping_id: BigInt(mappingId) },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async findMappingByCode(
      companyId: string,
      plantFunctionCode: string,
      excludeId?: string,
    ) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_function_mapping.findFirst({
          where: {
            company_id: BigInt(companyId),
            plant_function_code: plantFunctionCode,
            ...(excludeId
              ? { NOT: { function_mapping_id: BigInt(excludeId) } }
              : {}),
          },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async createMapping(input: CreateFunctionMappingInput & { companyId: string }) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_function_mapping.create({
            data: {
              company_id: BigInt(input.companyId),
              plant_function_code: input.plantFunctionCode,
              plant_function_name: input.plantFunctionName,
              function_id: BigInt(input.functionId),
              status: input.status,
            },
            select: mappingSelect,
          }),
        ),
      );
    },

    async updateMapping(mappingId: string, input: UpdateFunctionMappingInput) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_function_mapping.update({
            where: { function_mapping_id: BigInt(mappingId) },
            data: {
              ...(input.plantFunctionCode !== undefined
                ? { plant_function_code: input.plantFunctionCode }
                : {}),
              ...(input.plantFunctionName !== undefined
                ? { plant_function_name: input.plantFunctionName }
                : {}),
              ...(input.functionId !== undefined
                ? { function_id: BigInt(input.functionId) }
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
          await database().company_function_mapping.delete({
            where: { function_mapping_id: BigInt(mappingId) },
            select: mappingSelect,
          }),
        ),
      );
    },
  };
};

export const functionRepository = createFunctionRepository();
