import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateInstituteProviderInput,
  InstituteProviderListFilters,
  InstituteProviderRecord,
  UpdateInstituteProviderInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "institute_provider" | "training_plan_oap">;
const select = {
  institute_provider_id: true,
  institute_provider_code: true,
  institute_provider_name: true,
  status: true,
} satisfies Prisma.institute_providerSelect;
type Row = Prisma.institute_providerGetPayload<{ select: typeof select }>;
const map = (row: Row): InstituteProviderRecord => ({
  instituteProviderId: row.institute_provider_id.toString(),
  instituteProviderCode: row.institute_provider_code,
  instituteProviderName: row.institute_provider_name,
  status: row.status as InstituteProviderRecord["status"],
});

export type InstituteProviderRepository = ReturnType<typeof createInstituteProviderRepository>;

export const createInstituteProviderRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async list(filters: InstituteProviderListFilters) {
      const where: Prisma.institute_providerWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { institute_provider_code: { contains: filters.search } },
          { institute_provider_name: { contains: filters.search } },
        ];
      }
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().institute_provider.findMany({
            where,
            select,
            orderBy: { institute_provider_id: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          database().institute_provider.count({ where }),
        ]);
        return { items: rows.map(map), totalItems };
      });
    },
    async findById(id: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().institute_provider.findUnique({
          where: { institute_provider_id: BigInt(id) },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async findByCode(instituteProviderCode: string, excludeId?: string) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().institute_provider.findFirst({
          where: {
            institute_provider_code: instituteProviderCode,
            ...(excludeId
              ? { NOT: { institute_provider_id: BigInt(excludeId) } }
              : {}),
          },
          select,
        });
        return row ? map(row) : null;
      });
    },
    async create(input: CreateInstituteProviderInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().institute_provider.create({
            data: {
              institute_provider_code: input.instituteProviderCode,
              institute_provider_name: input.instituteProviderName,
              status: input.status,
            },
            select,
          }),
        ),
      );
    },
    async update(id: string, input: UpdateInstituteProviderInput) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().institute_provider.update({
            where: { institute_provider_id: BigInt(id) },
            data: {
              ...(input.instituteProviderCode !== undefined
                ? { institute_provider_code: input.instituteProviderCode }
                : {}),
              ...(input.instituteProviderName !== undefined
                ? { institute_provider_name: input.instituteProviderName }
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
            where: { provider_id: BigInt(id) },
          })) > 0,
      );
    },
    async delete(id: string) {
      return withDatabaseErrorMapping(async () =>
        map(
          await database().institute_provider.delete({
            where: { institute_provider_id: BigInt(id) },
            select,
          }),
        ),
      );
    },
  };
};

export const instituteProviderRepository = createInstituteProviderRepository();
