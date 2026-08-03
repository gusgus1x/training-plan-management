import { describe, expect, it } from "vitest";
import { parseUpdateEmployee } from "../../app/lib/employees/validation";

describe("employee validation", () => {
  it.each(["นาย", "นาง", "นางสาว"])(
    "accepts the supported Thai employee title %s",
    (titleTh) => {
      expect(parseUpdateEmployee({ titleTh })).toEqual({ titleTh });
    },
  );

  it("rejects Thai employee titles outside the supported set", () => {
    expect(() => parseUpdateEmployee({ titleTh: "คุณ" })).toThrow(
      "The submitted employee data is invalid",
    );
  });
});
