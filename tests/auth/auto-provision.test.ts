import { describe, expect, it, vi } from "vitest";
import {
  formatBirthDateToDDMMYYYY,
  autoProvisionEmployeeAccount,
} from "../../app/lib/auth/autoProvision";

describe("formatBirthDateToDDMMYYYY", () => {
  it("converts Date to DDMMYYYY string", () => {
    const date = new Date("1972-05-11T00:00:00.000Z");
    expect(formatBirthDateToDDMMYYYY(date)).toBe("11051972");
  });

  it("converts string YYYY-MM-DD to DDMMYYYY", () => {
    expect(formatBirthDateToDDMMYYYY("1995-12-01")).toBe("01121995");
  });

  it("handles null or empty date gracefully", () => {
    expect(formatBirthDateToDDMMYYYY(null)).toBe("");
    expect(formatBirthDateToDDMMYYYY("")).toBe("");
  });
});

describe("autoProvisionEmployeeAccount", () => {
  it("rejects password that is not 8 digits immediately", async () => {
    const mockRepo = {
      findByUsername: vi.fn(),
      findByUserId: vi.fn(),
    };
    const result = await autoProvisionEmployeeAccount("1290-000017", "1234", mockRepo);
    expect(result).toBeNull();
    expect(mockRepo.findByUsername).not.toHaveBeenCalled();
  });
});
