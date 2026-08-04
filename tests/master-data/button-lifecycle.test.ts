import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const moduleDirectory =
  "app/components/center_factory/MasterDataManagement/modules";
const read = (fileName: string) =>
  readFileSync(join(process.cwd(), moduleDirectory, fileName), "utf8");

describe("API-backed Master Data button lifecycle", () => {
  const modules = [
    ["CompanyData", "Companies", "isSaving"],
    ["FunctionData", "Functions", "isSaving"],
    ["PositionData", "Positions", "isSaving"],
    ["LevelData", "Levels", "isSaving"],
    ["EmployeeData", "Employees", "saving"],
  ] as const;

  it.each(modules)(
    "%s unlocks after the mutation and refreshes in the background",
    (component, collection, savingState) => {
      const source = read(`${component}.tsx`);

      expect(source).toContain(`void list${collection}()`);
      expect(source).toContain(".catch(() => undefined)");
      expect(source).toContain(
        `{${savingState} ? "Saving..." : "Save"}`,
      );
    },
  );

  it("InstructorData distinguishes Create from Save Changes", () => {
    const source = read("InstructorData.tsx");

    expect(source).toContain("void listInstructors()");
    expect(source).toContain(".catch(() => undefined)");
    expect(source).toContain('formMode === "new"');
    expect(source).toContain('"Creating..."');
    expect(source).toContain('"Saving..."');
    expect(source).toContain('"Save Changes"');
  });

  it("closes stale editor drafts when Refresh is pressed", () => {
    expect(read("CompanyData.tsx")).toContain("const handleRefresh = () =>");
    for (const [component, closeEditor] of [
      ["FunctionData", "setFormMode(null)"],
      ["PositionData", "setFormMode(null)"],
      ["LevelData", "setFormMode(null)"],
      ["EmployeeData", "setMode(null)"],
      ["InstructorData", "setFormMode(null)"],
    ]) {
      const source = read(`${component}.tsx`);
      expect(source).toContain("const refresh = () =>");
      expect(source).toContain(closeEditor);
      expect(source).toContain("onClick={refresh}");
    }
  });

  it("visually marks editor buttons as disabled", () => {
    for (const component of ["FunctionData", "PositionData", "LevelData"]) {
      const styles = read(`${component}.module.css`);
      expect(styles).toContain(".saveButton:disabled");
      expect(styles).toContain(".cancelButton:disabled");
    }
    expect(read("EmployeeData.module.css")).toContain(".saveButton:disabled");
    expect(read("InstructorData.module.css")).toContain(
      ".formPanel button:disabled",
    );
  });
});
