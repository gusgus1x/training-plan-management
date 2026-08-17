import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateDivisionInput,
  CreateDivisionMappingInput,
  DivisionListFilters,
  DivisionMappingRecord,
  DivisionRecord,
  MappingListFilters,
  PaginatedResult,
  UpdateDivisionInput,
  UpdateDivisionMappingInput,
} from "./types";

type DatabaseClient = Pick<
  PrismaClient,
  "division" | "company_division_mapping"
>;
const select = {
  division_id: true,
  division_code: true,
  division_name_th: true,
  division_name_en: true,
  status: true,
} satisfies Prisma.divisionSelect;
type Row = Prisma.divisionGetPayload<{ select: typeof select }>;
const map = (row: Row): DivisionRecord => ({
  divisionId: row.division_id.toString(),
  divisionCode: row.division_code,
  divisionNameTh: row.division_name_th,
  divisionNameEn: row.division_name_en,
  status: row.status as DivisionRecord["status"],
});

const mappingSelect = {
  division_mapping_id: true,
  company_id: true,
  plant_division_code: true,
  plant_division_name: true,
  division_id: true,
  status: true,
  company: {
    select: {
      company_code: true,
      company_name_th: true,
    },
  },
  division: {
    select: {
      division_code: true,
      division_name_th: true,
    },
  },
} satisfies Prisma.company_division_mappingSelect;
type MappingRow = Prisma.company_division_mappingGetPayload<{
  select: typeof mappingSelect;
}>;
const mapMapping = (row: MappingRow): DivisionMappingRecord => ({
  divisionMappingId: row.division_mapping_id.toString(),
  companyId: row.company_id.toString(),
  companyCode: row.company.company_code,
  companyNameTh: row.company.company_name_th,
  plantDivisionCode: row.plant_division_code,
  plantDivisionName: row.plant_division_name,
  divisionId: row.division_id.toString(),
  divisionCode: row.division.division_code,
  divisionNameTh: row.division.division_name_th,
  status: row.status as DivisionMappingRecord["status"],
});

export type DivisionRepository = ReturnType<typeof createDivisionRepository>;

export const createDivisionRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async list(filters: DivisionListFilters) {
      const where: Prisma.divisionWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { division_code: { contains: filters.search } },
          { division_name_th: { contains: filters.search } },
          { division_name_en: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().division.findMany({
            where,
            select,
            orderBy: { division_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().division.count({ where }),
        ]);
        return { items: rows.map(map), totalItems };
      });
    },
    async findById(id: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().division.findUnique({
          where: { division_id: BigInt(id) },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async findByCode(divisionCode: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().division.findFirst({
          where: {
            division_code: divisionCode,
            ...(excludeId
              ? { NOT: { division_id: BigInt(excludeId) } }
              : {}),
          },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async create(input: CreateDivisionInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().division.create({
            data: {
              division_code: input.divisionCode,
              division_name_th: input.divisionNameTh,
              division_name_en: input.divisionNameEn,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async update(id: string, input: UpdateDivisionInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().division.update({
            where: { division_id: BigInt(id) },
            data: {
              ...(input.divisionCode !== undefined
                ? { division_code: input.divisionCode }
                : {}),
              ...(input.divisionNameTh !== undefined
                ? { division_name_th: input.divisionNameTh }
                : {}),
              ...(input.divisionNameEn !== undefined
                ? { division_name_en: input.divisionNameEn }
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
          await database().division.delete({
            where: { division_id: BigInt(id) },
            select,
          }),
        ),
      );
    },

    async listMappings(
      filters: MappingListFilters,
    ): Promise<PaginatedResult<DivisionMappingRecord>> {
      const where: Prisma.company_division_mappingWhereInput = {};
      if (filters.companyId) where.company_id = BigInt(filters.companyId);
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { plant_division_code: { contains: filters.search } },
          { plant_division_name: { contains: filters.search } },
          { company: { company_code: { contains: filters.search } } },
          { division: { division_code: { contains: filters.search } } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().company_division_mapping.findMany({
            where,
            select: mappingSelect,
            orderBy: [{ company_id: "asc" }, { division_mapping_id: "asc" }],
            skip: filters.skip,
            take: filters.take,
          }),
          database().company_division_mapping.count({ where }),
        ]);
        return { items: rows.map(mapMapping), totalItems };
      });
    },

    async findMappingById(mappingId: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_division_mapping.findUnique({
          where: { division_mapping_id: BigInt(mappingId) },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async findMappingByCode(
      companyId: string,
      plantDivisionCode: string,
      excludeId?: string,
    ) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_division_mapping.findFirst({
          where: {
            company_id: BigInt(companyId),
            plant_division_code: plantDivisionCode,
            ...(excludeId
              ? { NOT: { division_mapping_id: BigInt(excludeId) } }
              : {}),
          },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async createMapping(input: CreateDivisionMappingInput & { companyId: string }) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_division_mapping.create({
            data: {
              company_id: BigInt(input.companyId),
              plant_division_code: input.plantDivisionCode,
              plant_division_name: input.plantDivisionName,
              division_id: BigInt(input.divisionId),
              status: input.status,
            },
            select: mappingSelect,
          }),
        ),
      );
    },

    async updateMapping(mappingId: string, input: UpdateDivisionMappingInput) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_division_mapping.update({
            where: { division_mapping_id: BigInt(mappingId) },
            data: {
              ...(input.plantDivisionCode !== undefined
                ? { plant_division_code: input.plantDivisionCode }
                : {}),
              ...(input.plantDivisionName !== undefined
                ? { plant_division_name: input.plantDivisionName }
                : {}),
              ...(input.divisionId !== undefined
                ? { division_id: BigInt(input.divisionId) }
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
          await database().company_division_mapping.delete({
            where: { division_mapping_id: BigInt(mappingId) },
            select: mappingSelect,
          }),
        ),
      );
    },
  };
};

export const divisionRepository = createDivisionRepository();
