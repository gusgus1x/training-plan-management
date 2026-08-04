import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Function Data UI contract", () => {
  it("uses the central Function API without exposing mapping UI", () => {
    const source = readFileSync(
      new URL(
        "../../app/components/center_factory/MasterDataManagement/modules/FunctionData.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain("listFunctions()");
    expect(source).not.toContain("listFunctionMappings()");
    expect(source).not.toContain("Company Function Mapping");
    expect(source).not.toContain("readMasterCollection(");
    expect(source).not.toContain("writeMasterCollection(");
    expect(source).toContain("const savingMode = formMode");
    expect(source).toContain("const editingFunctionId = selected?.functionId");
    expect(source).toContain("void listFunctions()");
    expect(source).toContain(".then((refreshed) => applyRows(refreshed.items))");
    expect(source).toContain("const refresh = () =>");
    expect(source).toContain("onClick={refresh}");
  });
});
