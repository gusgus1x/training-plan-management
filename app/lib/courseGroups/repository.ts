import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type { CourseGroupListFilters, CourseGroupRecord, CreateCourseGroupInput, UpdateCourseGroupInput } from "./types";
type DatabaseClient = Pick<PrismaClient, "course_group" | "course">;
const select = { course_group_id: true, course_group_code: true, course_group_name: true, status: true, last_course_number: true } satisfies Prisma.course_groupSelect;
type Row = Prisma.course_groupGetPayload<{ select: typeof select }>;
const map = (row: Row): CourseGroupRecord => ({ courseGroupId: row.course_group_id.toString(), code: row.course_group_code.trim(), name: row.course_group_name, status: row.status as CourseGroupRecord["status"], lastCourseNumber: row.last_course_number });
export const normalizeCourseGroupName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export type CourseGroupRepository = ReturnType<typeof createCourseGroupRepository>;
export const createCourseGroupRepository = (client?: DatabaseClient) => { const db = () => client ?? getPrismaClient(); return {
  async list(filters: CourseGroupListFilters) { const where: Prisma.course_groupWhereInput = {}; if (filters.status) where.status = filters.status; if (filters.search) where.OR = [{ course_group_code: { contains: filters.search } }, { course_group_name: { contains: filters.search } }]; return withDatabaseErrorMapping(async () => { const [rows, totalItems] = await Promise.all([db().course_group.findMany({ where, select, orderBy: { course_group_code: "asc" }, skip: filters.skip, take: filters.take }), db().course_group.count({ where })]); return { items: rows.map(map), totalItems }; }); },
  async findById(id: string) { return withDatabaseErrorMapping(async () => { const row = await db().course_group.findUnique({ where: { course_group_id: BigInt(id) }, select }); return row ? map(row) : null; }); },
  async findConflict(code: string, normalizedName: string, excludeId?: string) { return withDatabaseErrorMapping(async () => { const row = await db().course_group.findFirst({ where: { OR: [{ course_group_code: code }, { course_group_name_normalized: normalizedName }], ...(excludeId ? { NOT: { course_group_id: BigInt(excludeId) } } : {}) }, select }); return row ? map(row) : null; }); },
  async create(input: CreateCourseGroupInput, userId: string) { return withDatabaseErrorMapping(async () => map(await db().course_group.create({ data: { course_group_code: input.code, course_group_name: input.name, course_group_name_normalized: normalizeCourseGroupName(input.name), last_course_number: 0, status: input.status, created_by: BigInt(userId), created_at: new Date() }, select }))); },
  async update(id: string, input: UpdateCourseGroupInput, userId: string) { return withDatabaseErrorMapping(async () => map(await db().course_group.update({ where: { course_group_id: BigInt(id) }, data: { ...(input.code !== undefined ? { course_group_code: input.code } : {}), ...(input.name !== undefined ? { course_group_name: input.name, course_group_name_normalized: normalizeCourseGroupName(input.name) } : {}), ...(input.status !== undefined ? { status: input.status } : {}), updated_by: BigInt(userId), updated_at: new Date() }, select }))); },
  async activeCourseCount(id: string) { return withDatabaseErrorMapping(() => db().course.count({ where: { course_group_id: BigInt(id), status: "ACTIVE" } })); },
  async courseCount(id: string) { return withDatabaseErrorMapping(() => db().course.count({ where: { course_group_id: BigInt(id) } })); },
  async delete(id: string) { return withDatabaseErrorMapping(async () => map(await db().course_group.delete({ where: { course_group_id: BigInt(id) }, select }))); },
}; };
export const courseGroupRepository = createCourseGroupRepository();
