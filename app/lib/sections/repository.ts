import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateSectionInput,
  SectionListFilters,
  SectionRecord,
  UpdateSectionInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "section">;
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
  };
};

export const sectionRepository = createSectionRepository();
