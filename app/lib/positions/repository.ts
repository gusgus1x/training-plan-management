import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreatePositionInput,
  PositionListFilters,
  PositionRecord,
  UpdatePositionInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "position">;
const select = {
  position_id: true,
  position_code: true,
  position_name_th: true,
  position_name_en: true,
  status: true,
} satisfies Prisma.positionSelect;
type Row = Prisma.positionGetPayload<{ select: typeof select }>;
const map = (row: Row): PositionRecord => ({
  positionId: row.position_id.toString(),
  positionCode: row.position_code,
  positionNameTh: row.position_name_th,
  positionNameEn: row.position_name_en,
  status: row.status as PositionRecord["status"],
});

export type PositionRepository = ReturnType<typeof createPositionRepository>;

export const createPositionRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async list(filters: PositionListFilters) {
      const where: Prisma.positionWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { position_code: { contains: filters.search } },
          { position_name_th: { contains: filters.search } },
          { position_name_en: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().position.findMany({
            where,
            select,
            orderBy: { position_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().position.count({ where }),
        ]);
        return { items: rows.map(map), totalItems };
      });
    },
    async findById(id: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().position.findUnique({
          where: { position_id: BigInt(id) },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async findByCode(positionCode: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().position.findFirst({
          where: {
            position_code: positionCode,
            ...(excludeId
              ? { NOT: { position_id: BigInt(excludeId) } }
              : {}),
          },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async create(input: CreatePositionInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().position.create({
            data: {
              position_code: input.positionCode,
              position_name_th: input.positionNameTh,
              position_name_en: input.positionNameEn,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async update(id: string, input: UpdatePositionInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().position.update({
            where: { position_id: BigInt(id) },
            data: {
              ...(input.positionCode !== undefined
                ? { position_code: input.positionCode }
                : {}),
              ...(input.positionNameTh !== undefined
                ? { position_name_th: input.positionNameTh }
                : {}),
              ...(input.positionNameEn !== undefined
                ? { position_name_en: input.positionNameEn }
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
          await database().position.delete({
            where: { position_id: BigInt(id) },
            select,
          }),
        ),
      );
    },
  };
};

export const positionRepository = createPositionRepository();
