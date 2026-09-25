import { describe, expect, it } from "vitest";
import { employeePath, isRecordTab, isUserModule } from "../../app/components/employee/employeePaths";

describe("employeePath", () => {
  it("gives the dashboard home, a module, and a My Record tab their own address", () => {
    expect(employeePath(null)).toBe("/");
    expect(employeePath("register")).toBe("/employee/register");
    expect(employeePath("record", "completed", { focus: "e1", at: 5 })).toBe("/employee/record/completed?focus=e1&at=5");
  });

  it("leaves out empty query values", () => {
    expect(employeePath("request", null, { courseId: "", at: undefined })).toBe("/employee/request");
  });

  it("knows the modules and tabs it may route to", () => {
    expect(isUserModule("roadmap")).toBe(true);
    expect(isUserModule("admin")).toBe(false);
    expect(isRecordTab("download")).toBe(true);
    expect(isRecordTab("other")).toBe(false);
  });
});
