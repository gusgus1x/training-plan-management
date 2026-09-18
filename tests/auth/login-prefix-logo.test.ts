import { describe, expect, it } from "vitest";
import { COMPANY_PREFIX_MAP } from "../../app/components/LoginPage";

describe("COMPANY_PREFIX_MAP", () => {
  it("contains the exact 4-digit prefix for all 6 ATTG companies", () => {
    expect(COMPANY_PREFIX_MAP).toEqual({
      ATA: "1290",
      TEP: "0450",
      ATFB: "1510",
      NIC: "0420",
      SATI: "1120",
      SNF: "0430",
    });
  });

  it("formats full username correctly from company prefix and staff digits", () => {
    const formatFullUsername = (companyCode: keyof typeof COMPANY_PREFIX_MAP, digits: string) => {
      const prefix = COMPANY_PREFIX_MAP[companyCode];
      const padded = digits.padStart(6, "0");
      return `${prefix}-${padded}`;
    };

    expect(formatFullUsername("SATI", "700005")).toBe("1120-700005");
    expect(formatFullUsername("ATA", "17")).toBe("1290-000017");
    expect(formatFullUsername("ATFB", "16")).toBe("1510-000016");
    expect(formatFullUsername("TEP", "381")).toBe("0450-000381");
    expect(formatFullUsername("NIC", "10")).toBe("0420-000010");
    expect(formatFullUsername("SNF", "13640")).toBe("0430-013640");
  });
});
