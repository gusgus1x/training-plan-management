import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type { CourseTypeListFilters, CourseTypeRecord, CreateCourseTypeInput, UpdateCourseTypeInput } from "./types";

type DatabaseClient = Pick<PrismaClient, "course_type" | "course">;
const select = { course_type_id: true, course_type_code: true, course_type_name: true, description: true, status: true, has_been_used: true } satisfies Prisma.course_typeSelect;
type Row = Prisma.course_typeGetPayload<{ select: typeof select }>;
const map = (row: Row): CourseTypeRecord => ({ courseTypeId: row.course_type_id.toString(), code: row.course_type_code, name: row.course_type_name, description: row.description, status: row.status as CourseTypeRecord["status"], hasBeenUsed: row.has_been_used });
export const normalizeCourseTypeName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export type CourseTypeRepository = ReturnType<typeof createCourseTypeRepository>;
export const createCourseTypeRepository = (client?: DatabaseClient) => {
  const db = () => client ?? getPrismaClient();
  return {
    async list(filters: CourseTypeListFilters) {
      const where: Prisma.course_typeWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) where.OR = [{ course_type_code: { contains: filters.search } }, { course_type_name: { contains: filters.search } }, { description: { contains: filters.search } }];
      return withDatabaseErrorMapping(async () => { const [rows, totalItems] = await Promise.all([db().course_type.findMany({ where, select, orderBy: { course_type_code: "asc" }, skip: filters.skip, take: filters.take }), db().course_type.count({ where })]); return { items: rows.map(map), totalItems }; });
    },
    async findById(id: string) { return withDatabaseErrorMapping(async () => { const row = await db().course_type.findUnique({ where: { course_type_id: BigInt(id) }, select }); return row ? map(row) : null; }); },
    async findConflict(code: string, normalizedName: string, excludeId?: string) { return withDatabaseErrorMapping(async () => { const row = await db().course_type.findFirst({ where: { OR: [{ course_type_code: code }, { course_type_name_normalized: normalizedName }], ...(excludeId ? { NOT: { course_type_id: BigInt(excludeId) } } : {}) }, select }); return row ? map(row) : null; }); },
    async create(input: CreateCourseTypeInput, userId: string) { return withDatabaseErrorMapping(async () => map(await db().course_type.create({ data: { course_type_code: input.code, course_type_name: input.name, course_type_name_normalized: normalizeCourseTypeName(input.name), description: input.description, status: input.status, has_been_used: false, created_by: BigInt(userId), created_at: new Date() }, select }))); },
    async update(id: string, input: UpdateCourseTypeInput, userId: string) { return withDatabaseErrorMapping(async () => map(await db().course_type.update({ where: { course_type_id: BigInt(id) }, data: { ...(input.code !== undefined ? { course_type_code: input.code } : {}), ...(input.name !== undefined ? { course_type_name: input.name, course_type_name_normalized: normalizeCourseTypeName(input.name) } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.status !== undefined ? { status: input.status } : {}), updated_by: BigInt(userId), updated_at: new Date() }, select }))); },
    async activeCourseCount(id: string) { return withDatabaseErrorMapping(() => db().course.count({ where: { course_type_id: BigInt(id), status: "ACTIVE" } })); },
    async courseCount(id: string) { return withDatabaseErrorMapping(() => db().course.count({ where: { course_type_id: BigInt(id) } })); },
    async delete(id: string) { return withDatabaseErrorMapping(async () => map(await db().course_type.delete({ where: { course_type_id: BigInt(id) }, select }))); },
  };
};
export const courseTypeRepository = createCourseTypeRepository();
