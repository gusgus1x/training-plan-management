import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * These controls report success while writing nothing: a toast saying the LINE message reached
 * every participant, an import that only touches React state, a download that produces no file.
 * The decision was to keep the UI exactly where it is, disable it, and say why — so the test that
 * matters is that no button is wired back to one of those handlers.
 *
 * The assertions are negative on purpose. A positive match on the exact disabled markup breaks the
 * moment someone reformats the JSX; "no onClick names this handler" only fails when the fake is
 * genuinely re-armed, which is the one thing worth catching.
 */

const read = (path: string) =>
  readFileSync(new URL(`../../app/${path}`, import.meta.url), "utf8");

const acceptSurvey = read(
  "components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.tsx",
);
const courseMaster = read(
  "components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
);
const trainingRecord = read(
  "components/center_factory/TrainingRecordManagement/modules/TrainingRecord.tsx",
);
const scheduleCalendar = read(
  "components/center_factory/ReportManagement/modules/ScheduleCalendar.tsx",
);
const loginPage = read("components/LoginPage.tsx");

describe("controls whose backend does not exist stay disabled", () => {
  it.each([
    ["LINE OA notification", acceptSurvey, "handleSendLineNotification"],
    ["save imported courses", trainingRecord, "handleSaveImportedCourses"],
    ["evaluation form download", trainingRecord, "handleDownload"],
    ["prepare email", scheduleCalendar, "handlePrepareEmail"],
  ])("does not wire %s to a click", (_label, source, handler) => {
    // Catches both onClick={handler} and onClick={() => handler(...)}.
    expect(source).not.toMatch(new RegExp(`onClick=\\{[^}]*${handler}`));
  });

  it("says the same thing on every one of them", () => {
    for (const source of [acceptSurvey, trainingRecord, scheduleCalendar, loginPage]) {
      expect(source).toContain("UNDER_DEVELOPMENT");
    }
  });

  it("keeps fabricated employees out of the nomination picker and the printed sheet", () => {
    // The generated demo master had no NODE_ENV guard and was used as a live fallback: an empty or
    // failed employee fetch seeded the picker with 450 invented people, and the attendance-sheet
    // export consulted the same list when resolving names by employee code.
    expect(acceptSurvey).not.toContain("readEmployeeMasterData");
  });

  it("no longer carries a fake employee master anywhere in the module", () => {
    // Removing the one caller left the generator sitting there exported, so the next person to
    // need "the employee list" could wire it back in and print invented people again. Guard the
    // source of the data, not just the screen that used to read it.
    const employeeMasterData = read("lib/employeeMasterData.ts");
    for (const gone of [
      "defaultEmployeeRows",
      "readEmployeeMasterData",
      "writeEmployeeMasterData",
      "thaiGivenNames",
      "thaiSurnames",
      "companySlots",
    ]) {
      expect(employeeMasterData).not.toContain(`const ${gone}`);
    }
    // The invented id-card prefix every generated row shared.
    expect(employeeMasterData).not.toContain("1101700");
  });
});
