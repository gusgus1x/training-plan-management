import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Master Data workflow integration", () => {
  it("places Course Type and Course Group under Master Data", () => {
    const masterDataModules = readSource(
      "app/components/center_factory/MasterDataManagement/modules/index.ts",
    );
    const trainingCourseModules = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/index.ts",
    );

    expect(masterDataModules).toContain("courseTypeModule");
    expect(masterDataModules).toContain("courseGroupModule");
    expect(masterDataModules).toContain('from "./CourseType"');
    expect(masterDataModules).toContain('from "./CourseGroup"');
    expect(trainingCourseModules).not.toContain("courseTypeModule");
    expect(trainingCourseModules).not.toContain("courseGroupModule");
  });

  it("persists Function, Position, Level, and Instructor masters", () => {
    const workflowSource = readSource("app/lib/trainingWorkflow.ts");

    expect(workflowSource).toContain('functions: "tpm_master_functions"');
    expect(workflowSource).toContain('positions: "tpm_master_positions"');
    expect(workflowSource).toContain('levels: "tpm_master_levels"');
    expect(workflowSource).toContain('instructors: "tpm_master_instructors"');
    expect(workflowSource).toContain("TRAINING_MASTER_EVENT");

    [
      "FunctionData.tsx",
      "PositionData.tsx",
      "LevelData.tsx",
      "InstructorData.tsx",
    ].forEach((fileName) => {
      const source = readSource(
        `app/components/center_factory/MasterDataManagement/modules/${fileName}`,
      );
      expect(source).toContain("readMasterCollection");
      expect(source).toContain("writeMasterCollection");
    });
  });

  it("uses the reference masters in Employee Data and Course Standard", () => {
    const employeeSource = readSource(
      "app/components/center_factory/MasterDataManagement/modules/EmployeeData.tsx",
    );
    const standardSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
    );

    expect(employeeSource).toContain("TRAINING_MASTER_KEYS.functions");
    expect(employeeSource).toContain("TRAINING_MASTER_KEYS.positions");
    expect(employeeSource).toContain("TRAINING_MASTER_KEYS.levels");
    expect(employeeSource).toContain("updateFunction");
    expect(standardSource).toContain("functionRows");
    expect(standardSource).toContain("positionRows");
    expect(standardSource).toContain("levelRows");
    expect(standardSource).toContain("functionCode:");
  });

  it("matches survey targets by Function, Position, and Level", () => {
    const surveySource = readSource(
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.tsx",
    );

    expect(surveySource).toContain("targetFunctionCode");
    expect(surveySource).toContain("targetFunctionName");
    expect(surveySource).toContain(
      "employee.departmentCode === selectedCourse.targetFunctionCode",
    );
    expect(surveySource).toContain("normalizeTargetPosition(employee.position)");
    expect(surveySource).toContain("normalizeEmployeeLevel(level)");
  });

  it("lets OAP select a master instructor or enter an external name", () => {
    const oapSource = readSource(
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingOAP.tsx",
    );

    expect(oapSource).toContain("TRAINING_MASTER_KEYS.instructors");
    expect(oapSource).toContain('list="instructor-master-options"');
    expect(oapSource).toContain('<datalist id="instructor-master-options">');
    expect(oapSource).toContain("type an external instructor name");
  });
});
