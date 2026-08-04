import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateInstructorInput,
  InstructorListFilters,
  InstructorRecord,
  UpdateInstructorInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "instructor" | "training_plan_oap">;
const select = {
  instructor_id: true,
  instructor_code: true,
  first_name: true,
  last_name: true,
  telephone: true,
  email: true,
  education: true,
  organization_name: true,
  status: true,
} satisfies Prisma.instructorSelect;
type Row = Prisma.instructorGetPayload<{ select: typeof select }>;
const map = (row: Row): InstructorRecord => ({
  instructorId: row.instructor_id.toString(),
  instructorCode: row.instructor_code,
  firstName: row.first_name,
  lastName: row.last_name,
  telephone: row.telephone,
  email: row.email,
  education: row.education,
  organizationName: row.organization_name,
  status: row.status as InstructorRecord["status"],
});

export type InstructorRepository = ReturnType<typeof createInstructorRepository>;

export const createInstructorRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async list(filters: InstructorListFilters) {
      const where: Prisma.instructorWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { instructor_code: { contains: filters.search } },
          { first_name: { contains: filters.search } },
          { last_name: { contains: filters.search } },
          { telephone: { contains: filters.search } },
          { email: { contains: filters.search } },
          { education: { contains: filters.search } },
          { organization_name: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().instructor.findMany({
            where,
            select,
            orderBy: { instructor_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().instructor.count({ where }),
        ]);
        return { items: rows.map(map), totalItems };
      });
    },
    async findById(id: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().instructor.findUnique({
          where: { instructor_id: BigInt(id) },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async findByCode(instructorCode: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().instructor.findFirst({
          where: {
            instructor_code: instructorCode,
            ...(excludeId
              ? { NOT: { instructor_id: BigInt(excludeId) } }
              : {}),
          },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async create(input: CreateInstructorInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().instructor.create({
            data: {
              instructor_code: input.instructorCode,
              first_name: input.firstName,
              last_name: input.lastName,
              telephone: input.telephone,
              email: input.email,
              education: input.education,
              organization_name: input.organizationName,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async update(id: string, input: UpdateInstructorInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().instructor.update({
            where: { instructor_id: BigInt(id) },
            data: {
              ...(input.instructorCode !== undefined
                ? { instructor_code: input.instructorCode }
                : {}),
              ...(input.firstName !== undefined
                ? { first_name: input.firstName }
                : {}),
              ...(input.lastName !== undefined
                ? { last_name: input.lastName }
                : {}),
              ...(input.telephone !== undefined
                ? { telephone: input.telephone }
                : {}),
              ...(input.email !== undefined ? { email: input.email } : {}),
              ...(input.education !== undefined
                ? { education: input.education }
                : {}),
              ...(input.organizationName !== undefined
                ? { organization_name: input.organizationName }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
            },
            select,
          }),
        ),
      );
    },
    async isReferenced(id: string) {
      return withDatabaseErrorMapping(
        async () =>
          (await database().training_plan_oap.count({
            where: { instructor_id: BigInt(id) },
          })) > 0,
      );
    },
    async delete(id: string) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().instructor.delete({
            where: { instructor_id: BigInt(id) },
            select,
          }),
        ),
      );
    },
  };
};

export const instructorRepository = createInstructorRepository();
