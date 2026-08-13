import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateDivisionInput,
  DivisionListFilters,
  DivisionRecord,
  UpdateDivisionInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "division">;
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
  };
};

export const divisionRepository = createDivisionRepository();
