import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Position Data UI contract", () => {
  it("uses the Position API and keeps factory read-only", () => {
    const source = readFileSync(
      new URL(
        "../../app/components/center_factory/MasterDataManagement/modules/PositionData.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("listPositions()");
    expect(source).toContain('user?.roleCode === "HRD_CENTER"');
    expect(source).not.toContain("readMasterCollection(");
    expect(source).not.toContain("writeMasterCollection(");
    expect(source).not.toContain("Remark.");
    expect(source).toContain("const savingMode = formMode");
    expect(source).toContain("const editingPositionId = selected?.positionId");
    expect(source).toContain("void listPositions()");
    expect(source).toContain(".then((refreshed) => setRows(refreshed.items))");
    expect(source).toContain("const refresh = () =>");
    expect(source).toContain("onClick={refresh}");
  });
});
