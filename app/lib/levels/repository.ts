import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  LevelListFilters,
  LevelRecord,
  PersistLevelInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "employee_level">;
const select = {
  level_id: true,
  level_code: true,
  level_code_th: true,
  level_code_en: true,
  level_name_th: true,
  level_name_en: true,
  pl: true,
  level_key: true,
  remark: true,
  status: true,
} satisfies Prisma.employee_levelSelect;
type Row = Prisma.employee_levelGetPayload<{ select: typeof select }>;
const map = (row: Row): LevelRecord => ({
  levelId: row.level_id.toString(),
  levelCode: row.level_code,
  levelCodeTh: row.level_code_th,
  levelCodeEn: row.level_code_en,
  levelNameTh: row.level_name_th,
  levelNameEn: row.level_name_en,
  pl: row.pl,
  levelKey: row.level_key,
  remark: row.remark,
  status: row.status as LevelRecord["status"],
});

export type LevelRepository = ReturnType<typeof createLevelRepository>;
export const createLevelRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async list(filters: LevelListFilters) {
      const where: Prisma.employee_levelWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { level_code: { contains: filters.search } },
          { level_code_th: { contains: filters.search } },
          { level_code_en: { contains: filters.search } },
          { level_name_th: { contains: filters.search } },
          { level_name_en: { contains: filters.search } },
          { level_key: { contains: filters.search } },
          { pl: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().employee_level.findMany({
            where,
            select,
            orderBy: { level_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().employee_level.count({ where }),
        ]);
        return { items: rows.map(map), totalItems };
      });
    },
    async findById(id: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().employee_level.findUnique({
          where: { level_id: BigInt(id) },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async findConflict(levelCode: string, levelKey: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().employee_level.findFirst({
          where: {
            OR: [{ level_code: levelCode }, { level_key: levelKey }],
            ...(excludeId
              ? { NOT: { level_id: BigInt(excludeId) } }
              : {}),
          },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async create(input: PersistLevelInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().employee_level.create({
            data: {
              level_code: input.levelCode,
              level_code_th: input.levelCodeTh,
              level_code_en: input.levelCodeEn,
              level_name_th: input.levelNameTh,
              level_name_en: input.levelNameEn,
              pl: input.pl,
              level_key: input.levelKey,
              remark: input.remark,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async update(id: string, input: PersistLevelInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().employee_level.update({
            where: { level_id: BigInt(id) },
            data: {
              level_code: input.levelCode,
              level_code_th: input.levelCodeTh,
              level_code_en: input.levelCodeEn,
              level_name_th: input.levelNameTh,
              level_name_en: input.levelNameEn,
              pl: input.pl,
              level_key: input.levelKey,
              remark: input.remark,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async delete(id: string) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().employee_level.delete({
            where: { level_id: BigInt(id) },
            select,
          }),
        ),
      );
    },
  };
};

export const levelRepository = createLevelRepository();
