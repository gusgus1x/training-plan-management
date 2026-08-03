import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(
    process.cwd(),
    "app/components/center_factory/MasterDataManagement/modules/LevelData.tsx",
  ),
  "utf8",
);

describe("Level Data UI contract", () => {
  it("uses the API and keeps the approved mock fields", () => {
    expect(source).toContain("listLevels()");
    expect(source).toContain("levelCodeTh");
    expect(source).toContain("levelCodeEn");
    expect(source).toContain("levelKey");
    expect(source).toContain("remark");
    expect(source).not.toContain("readMasterCollection(");
    expect(source).not.toContain("writeMasterCollection(");
  });

  it("renders write controls only for HRD_CENTER", () => {
    expect(source).toContain('user?.roleCode === "HRD_CENTER"');
    expect(source).toContain("{isCenter ? (");
  });
});
