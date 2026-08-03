import type { PrismaClient } from "../../app/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createCompanyRepository } from "../../app/lib/companies/repository";

const databaseRow = {
  company_id: BigInt(1),
  company_code: "ATA",
  company_name_th: "บริษัท ไอซิน ทาคาโอกะ เอเชีย จำกัด",
  company_name_en: "Aisin Takaoka Asia Co., Ltd.",
  remark: null,
  status: "ACTIVE",
};

const createClient = () => {
  const company = {
    findMany: vi.fn().mockResolvedValue([databaseRow]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn().mockResolvedValue(databaseRow),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(databaseRow),
    update: vi.fn().mockResolvedValue(databaseRow),
    delete: vi.fn().mockResolvedValue(databaseRow),
  };

  return {
    company,
    client: { company } as unknown as Pick<PrismaClient, "company">,
  };
};

describe("company repository", () => {
  it("uses explicit selected columns, filters, and bounded pagination", async () => {
    const { client, company } = createClient();
    const repository = createCompanyRepository(client);

    await expect(
      repository.list({
        search: "ATA",
        status: "ACTIVE",
        skip: 20,
        take: 10,
      }),
    ).resolves.toEqual({
      items: [
        {
          companyId: "1",
          companyCode: "ATA",
          companyNameTh: databaseRow.company_name_th,
          companyNameEn: databaseRow.company_name_en,
          remark: null,
          status: "ACTIVE",
        },
      ],
      totalItems: 1,
    });

    expect(company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          company_id: true,
          company_code: true,
          company_name_th: true,
          company_name_en: true,
          remark: true,
          status: true,
        },
        skip: 20,
        take: 10,
        where: expect.objectContaining({
          status: "ACTIVE",
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it("maps API fields to physical database columns for create", async () => {
    const { client, company } = createClient();
    const repository = createCompanyRepository(client);

    await repository.create({
      companyCode: "NEW",
      companyNameTh: "บริษัทใหม่",
      companyNameEn: "New Company",
      remark: null,
      status: "ACTIVE",
    });

    expect(company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          company_code: "NEW",
          company_name_th: "บริษัทใหม่",
          company_name_en: "New Company",
          remark: null,
          status: "ACTIVE",
        },
      }),
    );
  });

  it("deletes only the validated company id passed by the scoped API", async () => {
    const { client, company } = createClient();
    const repository = createCompanyRepository(client);

    await expect(repository.delete("1")).resolves.toMatchObject({
      companyId: "1",
      companyCode: "ATA",
    });
    expect(company.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { company_id: BigInt(1) },
      }),
    );
  });
});
