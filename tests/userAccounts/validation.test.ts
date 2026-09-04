import { describe, expect, it } from "vitest";
import { parseUpdateUserAccount } from "../../app/lib/userAccounts/validation";

describe("parseUpdateUserAccount", () => {
  it("parses username update", () => {
    const res = parseUpdateUserAccount({ username: "new_name" });
    expect(res).toEqual({ username: "new_name" });
  });

  it("handles employeeId with alphanumeric / hyphenated employee code format", () => {
    const res = parseUpdateUserAccount({ username: "test", employeeId: "1510-000432" });
    expect(res.employeeId).toBe("1510-000432");
  });

  it("handles employeeId with empty string or null", () => {
    const res = parseUpdateUserAccount({ username: "test", employeeId: "" });
    expect(res.employeeId).toBeNull();
  });
});
