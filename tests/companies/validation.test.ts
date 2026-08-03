import { describe, expect, it } from "vitest";
import {
  parseCompanyListFilters,
  parseCreateCompanyInput,
  parseUpdateCompanyInput,
} from "../../app/lib/companies/validation";

describe("company input validation", () => {
  it("normalizes an approved create payload and ignores unknown scope fields", () => {
    expect(
      parseCreateCompanyInput({
        companyCode: "  ata-new ",
        companyNameTh: " บริษัททดสอบ ",
        companyNameEn: "",
        remark: " ",
        status: "active",
        companyId: "999",
        roleId: 1,
      }),
    ).toEqual({
      companyCode: "ATA-NEW",
      companyNameTh: "บริษัททดสอบ",
      companyNameEn: null,
      remark: null,
      status: "ACTIVE",
    });
  });

  it("rejects invalid codes, statuses, and empty updates", () => {
    expect(() =>
      parseCreateCompanyInput({
        companyCode: "ATA DROP TABLE",
        companyNameTh: "บริษัททดสอบ",
      }),
    ).toThrow("submitted company data is invalid");
    expect(() => parseUpdateCompanyInput({ status: "DELETED" })).toThrow(
      "submitted company data is invalid",
    );
    expect(() => parseUpdateCompanyInput({ companyId: "1" })).toThrow(
      "submitted company data is invalid",
    );
  });

  it("validates list filters independently from pagination", () => {
    expect(
      parseCompanyListFilters(
        new URLSearchParams("search=ATA&status=inactive"),
        { skip: 20, take: 10 },
      ),
    ).toEqual({
      search: "ATA",
      status: "INACTIVE",
      skip: 20,
      take: 10,
    });
  });
});
