import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CompanyListFilters,
  CompanyRecord,
  CreateCompanyInput,
  UpdateCompanyInput,
} from "./types";

const companySelect = {
  company_id: true,
  company_code: true,
  company_name_th: true,
  company_name_en: true,
  remark: true,
  status: true,
} satisfies Prisma.companySelect;

type CompanyRow = Prisma.companyGetPayload<{ select: typeof companySelect }>;
type CompanyDatabaseClient = Pick<PrismaClient, "company">;

const mapCompanyRow = (row: CompanyRow): CompanyRecord => ({
  companyId: row.company_id.toString(),
  companyCode: row.company_code,
  companyNameTh: row.company_name_th,
  companyNameEn: row.company_name_en,
  remark: row.remark,
  status: row.status as CompanyRecord["status"],
});

export type CompanyRepository = {
  create(input: CreateCompanyInput): Promise<CompanyRecord>;
  findByCode(
    companyCode: string,
    excludeCompanyId?: string,
  ): Promise<CompanyRecord | null>;
  findById(companyId: string): Promise<CompanyRecord | null>;
  list(
    filters: CompanyListFilters,
  ): Promise<{ items: CompanyRecord[]; totalItems: number }>;
  delete(companyId: string): Promise<CompanyRecord>;
  update(
    companyId: string,
    input: UpdateCompanyInput,
  ): Promise<CompanyRecord>;
};

export const createCompanyRepository = (
  client?: CompanyDatabaseClient,
): CompanyRepository => {
  const database = () => client ?? getPrismaClient();

  return {
    async list(filters) {
      const where: Prisma.companyWhereInput = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.search) {
        where.OR = [
          { company_code: { contains: filters.search } },
          { company_name_th: { contains: filters.search } },
          { company_name_en: { contains: filters.search } },
          { remark: { contains: filters.search } },
        ];
      }

      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          database().company.findMany({
            where,
            select: companySelect,
            orderBy: [{ company_id: "asc" }],
            skip: filters.skip,
            take: filters.take,
          }),
          database().company.count({ where }),
        ]);

        return {
          items: rows.map(mapCompanyRow),
          totalItems,
        };
      });
    },

  async findById(companyId) {
    return withDatabaseErrorMapping(async () => {
      const row = await database().company.findUnique({
        where: { company_id: BigInt(companyId) },
        select: companySelect,
      });

      return row ? mapCompanyRow(row) : null;
    });
  },

  async findByCode(companyCode, excludeCompanyId) {
    return withDatabaseErrorMapping(async () => {
      const row = await database().company.findFirst({
        where: {
          company_code: companyCode,
          ...(excludeCompanyId
            ? { NOT: { company_id: BigInt(excludeCompanyId) } }
            : {}),
        },
        select: companySelect,
      });

      return row ? mapCompanyRow(row) : null;
    });
  },

  async create(input) {
    return withDatabaseErrorMapping(async () => {
      const row = await database().company.create({
        data: {
          company_code: input.companyCode,
          company_name_th: input.companyNameTh,
          company_name_en: input.companyNameEn,
          remark: input.remark,
          status: input.status,
        },
        select: companySelect,
      });

      return mapCompanyRow(row);
    });
  },

  async update(companyId, input) {
    return withDatabaseErrorMapping(async () => {
      const row = await database().company.update({
        where: { company_id: BigInt(companyId) },
        data: {
          ...(input.companyCode !== undefined
            ? { company_code: input.companyCode }
            : {}),
          ...(input.companyNameTh !== undefined
            ? { company_name_th: input.companyNameTh }
            : {}),
          ...(input.companyNameEn !== undefined
            ? { company_name_en: input.companyNameEn }
            : {}),
          ...(input.remark !== undefined ? { remark: input.remark } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        select: companySelect,
      });

      return mapCompanyRow(row);
    });
  },

    async delete(companyId) {
      return withDatabaseErrorMapping(async () => {
        const row = await database().company.delete({
          where: { company_id: BigInt(companyId) },
          select: companySelect,
        });

        return mapCompanyRow(row);
      });
    },
  };
};

export const companyRepository = createCompanyRepository();
