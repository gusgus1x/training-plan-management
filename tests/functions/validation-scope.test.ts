import { describe, expect, it } from "vitest";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import {
  resolveMappingCompanyId,
  requireMappingScope,
} from "../../app/lib/functions/scope";
import {
  parseCreateFunctionMapping,
  parseCreateOrganizationFunction,
} from "../../app/lib/functions/validation";

const factory = {
  role: "HRD_FACTORY",
  companyId: "1",
} as AuthenticatedPrincipal;
const center = {
  role: "HRD_CENTER",
  companyId: null,
} as AuthenticatedPrincipal;

describe("function validation and scope", () => {
  it("normalizes central and mapping payloads", () => {
    expect(
      parseCreateOrganizationFunction({
        functionCode: " fnc0018 ",
        functionNameTh: " ทดสอบ ",
        functionNameEn: "",
      }),
    ).toEqual({
      functionCode: "FNC0018",
      functionNameTh: "ทดสอบ",
      functionNameEn: null,
      status: "ACTIVE",
    });
    expect(
      parseCreateFunctionMapping({
        companyId: "2",
        plantFunctionCode: " tep-hr ",
        plantFunctionName: " HR ",
        functionId: "4",
      }),
    ).toMatchObject({
      companyId: "2",
      plantFunctionCode: "TEP-HR",
      plantFunctionName: "HR",
      functionId: "4",
    });
  });

  it("uses factory company_id from the session and never from payload", () => {
    expect(resolveMappingCompanyId(factory, "999")).toBe("1");
    expect(resolveMappingCompanyId(center, "2")).toBe("2");
  });

  it("allows factory writes only for its own mapping", () => {
    expect(() =>
      requireMappingScope(factory, { companyId: "1" }),
    ).not.toThrow();
    expect(() =>
      requireMappingScope(factory, { companyId: "2" }),
    ).toThrow("Access denied");
    expect(() =>
      requireMappingScope(center, { companyId: "2" }),
    ).not.toThrow();
  });
});
