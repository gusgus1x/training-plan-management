import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../app/lib/api/errors";
import type { CompanyRepository } from "../../app/lib/companies/repository";
import { createCompanyService } from "../../app/lib/companies/service";
import type { CompanyRecord } from "../../app/lib/companies/types";

const company: CompanyRecord = {
  companyId: "1",
  companyCode: "ATA",
  companyNameTh: "บริษัท ไอซิน ทาคาโอกะ เอเชีย จำกัด",
  companyNameEn: "Aisin Takaoka Asia Co., Ltd.",
  remark: null,
  status: "ACTIVE",
};

const createRepository = () => {
  const repository: CompanyRepository = {
    list: vi.fn().mockResolvedValue({ items: [company], totalItems: 1 }),
    findById: vi.fn().mockResolvedValue(company),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(company),
    update: vi.fn().mockResolvedValue(company),
    delete: vi.fn().mockResolvedValue(company),
  };

  return repository;
};

describe("company service", () => {
  it("returns a stable not-found error", async () => {
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue(null);
    const service = createCompanyService(repository);

    await expect(service.getCompany("999")).rejects.toMatchObject({
      code: "COMPANY_NOT_FOUND",
      status: 404,
    });
  });

  it("prevents a duplicate company code before create", async () => {
    const repository = createRepository();
    vi.mocked(repository.findByCode).mockResolvedValue(company);
    const service = createCompanyService(repository);

    await expect(
      service.createCompany({
        companyCode: "ATA",
        companyNameTh: "ชื่อซ้ำ",
        companyNameEn: null,
        remark: null,
        status: "ACTIVE",
      }),
    ).rejects.toMatchObject({
      code: "COMPANY_CODE_CONFLICT",
      status: 409,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("checks duplicate codes outside the current record on update", async () => {
    const repository = createRepository();
    const service = createCompanyService(repository);

    await service.updateCompany("1", {
      companyCode: "ATA2",
      status: "INACTIVE",
    });

    expect(repository.findByCode).toHaveBeenCalledWith("ATA2", "1");
    expect(repository.update).toHaveBeenCalledWith("1", {
      companyCode: "ATA2",
      status: "INACTIVE",
    });
  });

  it("returns a stable conflict when a company is still referenced", async () => {
    const repository = createRepository();
    vi.mocked(repository.delete).mockRejectedValue(
      new ApiError({
        code: "INVALID_REFERENCE",
        message: "The referenced record is invalid or still in use",
        status: 409,
      }),
    );
    const service = createCompanyService(repository);

    await expect(service.deleteCompany("1")).rejects.toMatchObject({
      code: "COMPANY_IN_USE",
      status: 409,
    });
  });
});
