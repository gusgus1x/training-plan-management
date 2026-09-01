import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Screens must not fill a missing field with an invented stand-in. The roadmap an employee reads
 * to decide whether to sign up used to show an instructor named "กัส เอฟ", room "212224" and
 * "ทดสอบระบบการทำงานจริง" as the course content whenever HRD had not filled those in - presented
 * exactly like real data, with nothing marking it as a placeholder. Same family of problem as the
 * 450 generated employees that reached the printed attendance sheet.
 *
 * "ยังไม่ระบุ" / "Not specified" is the honest answer, and it is also the signal to HRD that
 * something still needs filling in.
 */

const read = (path: string) => readFileSync(new URL(`../../app/${path}`, import.meta.url), "utf8");

const SCREENS = [
  ["RoadmapModule", read("components/employee/RoadmapModule.tsx")],
  ["RegisterTrainingModule", read("components/employee/RegisterTrainingModule.tsx")],
  ["TrainingRecord", read("components/center_factory/TrainingRecordManagement/modules/TrainingRecord.tsx")],
  ["TrainingActual", read("components/center_factory/TrainingRecordManagement/modules/TrainingActual.tsx")],
] as const;

// Strip line and block comments: the fixes carry comments naming what used to be there.
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe.each(SCREENS)("%s", (_label, source) => {
  const code = withoutComments(source);

  it.each([
    ["a made-up instructor name", "กัส เอฟ"],
    ["a made-up room number", "212224"],
    ["dev placeholder text", "ทดสอบระบบ"],
    ["a made-up course type", "ATA-TC"],
  ])("does not fall back to %s", (_what, needle) => {
    expect(code).not.toContain(needle);
  });
});

describe("company lists are not hardcoded into screens", () => {
  it.each(SCREENS)("%s asks for All Companies instead of naming all six", (_label, source) => {
    // Adding a seventh company should not require editing a component.
    expect(withoutComments(source)).not.toMatch(/"ATA",\s*"TEP",\s*"ATFB"/);
  });
});

describe("report screens ship with no seeded records", () => {
  // These four had no backend, so they were filled with invented rows: budgets with approval
  // states, pre/post scores, and internal mail stamped "Sent" that nobody ever sent. A screen with
  // no data should look empty, not busy.
  it.each([
    ["InternalReport", "components/center_factory/ReportManagement/modules/InternalReport.tsx"],
    ["employee ReportModule", "components/employee/ReportModule.tsx"],
  ])("%s starts with an empty report list", (_label, path) => {
    expect(read(path)).toMatch(/const initialReports[^=]*=\s*\[\]/);
  });

  it.each([
    ["TrainingExpense", "components/center_factory/ReportManagement/modules/TrainingExpense.tsx"],
    ["TrainingResultReport", "components/center_factory/ReportManagement/modules/TrainingResultReport.tsx"],
  ])("%s has no seeded table rows", (_label, path) => {
    expect(read(path)).not.toContain("initialRows");
  });

  it("no screen carries the invented attg.local addresses", () => {
    for (const [, path] of [
      ["", "components/center_factory/ReportManagement/modules/InternalReport.tsx"],
      ["", "components/employee/ReportModule.tsx"],
    ] as const) {
      expect(read(path)).not.toContain("attg.local");
    }
  });
});

describe("printed attendance sheet", () => {
  it("leaves an unknown Thai title blank rather than assuming นาย", () => {
    const source = withoutComments(read("lib/attendanceSheetExport.ts"));
    // The mapped branches still return นาย for a real "Mr."; only the unknown fallbacks changed.
    expect(source).not.toMatch(/return title \|\| "นาย"/);
  });
});
