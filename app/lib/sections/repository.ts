import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateSectionInput,
  CreateSectionMappingInput,
  MappingListFilters,
  PaginatedResult,
  SectionListFilters,
  SectionMappingRecord,
  SectionRecord,
  UpdateSectionInput,
  UpdateSectionMappingInput,
} from "./types";

type DatabaseClient = Pick<
  PrismaClient,
  "section" | "company_section_mapping"
>;
const select = {
  section_id: true,
  section_code: true,
  section_name_th: true,
  section_name_en: true,
  status: true,
} satisfies Prisma.sectionSelect;
type Row = Prisma.sectionGetPayload<{ select: typeof select }>;
const map = (row: Row): SectionRecord => ({
  sectionId: row.section_id.toString(),
  sectionCode: row.section_code,
  sectionNameTh: row.section_name_th,
  sectionNameEn: row.section_name_en,
  status: row.status as SectionRecord["status"],
});

const mappingSelect = {
  section_mapping_id: true,
  company_id: true,
  plant_section_code: true,
  plant_section_name: true,
  section_id: true,
  status: true,
  company: {
    select: {
      company_code: true,
      company_name_th: true,
    },
  },
  section: {
    select: {
      section_code: true,
      section_name_th: true,
    },
  },
} satisfies Prisma.company_section_mappingSelect;
type MappingRow = Prisma.company_section_mappingGetPayload<{
  select: typeof mappingSelect;
}>;
const mapMapping = (row: MappingRow): SectionMappingRecord => ({
  sectionMappingId: row.section_mapping_id.toString(),
  companyId: row.company_id.toString(),
  companyCode: row.company.company_code,
  companyNameTh: row.company.company_name_th,
  plantSectionCode: row.plant_section_code,
  plantSectionName: row.plant_section_name,
  sectionId: row.section_id.toString(),
  sectionCode: row.section.section_code,
  sectionNameTh: row.section.section_name_th,
  status: row.status as SectionMappingRecord["status"],
});

export type SectionRepository = ReturnType<typeof createSectionRepository>;

export const createSectionRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async list(filters: SectionListFilters) {
      const where: Prisma.sectionWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { section_code: { contains: filters.search } },
          { section_name_th: { contains: filters.search } },
          { section_name_en: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().section.findMany({
            where,
            select,
            orderBy: { section_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().section.count({ where }),
        ]);
        return { items: rows.map(map), totalItems };
      });
    },
    async findById(id: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().section.findUnique({
          where: { section_id: BigInt(id) },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async findByCode(sectionCode: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().section.findFirst({
          where: {
            section_code: sectionCode,
            ...(excludeId
              ? { NOT: { section_id: BigInt(excludeId) } }
              : {}),
          },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async create(input: CreateSectionInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().section.create({
            data: {
              section_code: input.sectionCode,
              section_name_th: input.sectionNameTh,
              section_name_en: input.sectionNameEn,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async update(id: string, input: UpdateSectionInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().section.update({
            where: { section_id: BigInt(id) },
            data: {
              ...(input.sectionCode !== undefined
                ? { section_code: input.sectionCode }
                : {}),
              ...(input.sectionNameTh !== undefined
                ? { section_name_th: input.sectionNameTh }
                : {}),
              ...(input.sectionNameEn !== undefined
                ? { section_name_en: input.sectionNameEn }
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
          await database().section.delete({
            where: { section_id: BigInt(id) },
            select,
          }),
        ),
      );
    },

    async listMappings(
      filters: MappingListFilters,
    ): Promise<PaginatedResult<SectionMappingRecord>> {
      const where: Prisma.company_section_mappingWhereInput = {};
      if (filters.companyId) where.company_id = BigInt(filters.companyId);
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { plant_section_code: { contains: filters.search } },
          { plant_section_name: { contains: filters.search } },
          { company: { company_code: { contains: filters.search } } },
          { section: { section_code: { contains: filters.search } } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().company_section_mapping.findMany({
            where,
            select: mappingSelect,
            orderBy: [{ company_id: "asc" }, { section_mapping_id: "asc" }],
            skip: filters.skip,
            take: filters.take,
          }),
          database().company_section_mapping.count({ where }),
        ]);
        return { items: rows.map(mapMapping), totalItems };
      });
    },

    async findMappingById(mappingId: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_section_mapping.findUnique({
          where: { section_mapping_id: BigInt(mappingId) },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async findMappingByCode(
      companyId: string,
      plantSectionCode: string,
      excludeId?: string,
    ) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company_section_mapping.findFirst({
          where: {
            company_id: BigInt(companyId),
            plant_section_code: plantSectionCode,
            ...(excludeId
              ? { NOT: { section_mapping_id: BigInt(excludeId) } }
              : {}),
          },
          select: mappingSelect,
        });
        return row ? mapMapping(row) : null;
      });
    },

    async createMapping(input: CreateSectionMappingInput & { companyId: string }) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_section_mapping.create({
            data: {
              company_id: BigInt(input.companyId),
              plant_section_code: input.plantSectionCode,
              plant_section_name: input.plantSectionName,
              section_id: BigInt(input.sectionId),
              status: input.status,
            },
            select: mappingSelect,
          }),
        ),
      );
    },

    async updateMapping(mappingId: string, input: UpdateSectionMappingInput) {
      return withDatabaseErrorMapping(async () =>
        mapMapping(
          await database().company_section_mapping.update({
            where: { section_mapping_id: BigInt(mappingId) },
            data: {
              ...(input.plantSectionCode !== undefined
                ? { plant_section_code: input.plantSectionCode }
                : {}),
              ...(input.plantSectionName !== undefined
                ? { plant_section_name: input.plantSectionName }
                : {}),
              ...(input.sectionId !== undefined
                ? { section_id: BigInt(input.sectionId) }
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
          await database().company_section_mapping.delete({
            where: { section_mapping_id: BigInt(mappingId) },
            select: mappingSelect,
          }),
        ),
      );
    },
  };
};

export const sectionRepository = createSectionRepository();
