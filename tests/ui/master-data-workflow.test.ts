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

  it("persists Function, Position, Level, and Employee through APIs and keeps Instructor local", () => {
    const workflowSource = readSource("app/lib/trainingWorkflow.ts");

    expect(workflowSource).toContain('functions: "tpm_master_functions"');
    expect(workflowSource).toContain('positions: "tpm_master_positions"');
    expect(workflowSource).toContain('levels: "tpm_master_levels"');
    expect(workflowSource).toContain('instructors: "tpm_master_instructors"');
    expect(workflowSource).toContain("TRAINING_MASTER_EVENT");

    const functionSource = readSource(
      "app/components/center_factory/MasterDataManagement/modules/FunctionData.tsx",
    );
    expect(functionSource).toContain("listFunctions()");
    expect(functionSource).not.toContain("listFunctionMappings()");
    expect(functionSource).not.toContain("readMasterCollection(");
    expect(functionSource).not.toContain("writeMasterCollection(");

    const positionSource = readSource(
      "app/components/center_factory/MasterDataManagement/modules/PositionData.tsx",
    );
    expect(positionSource).toContain("listPositions()");
    expect(positionSource).not.toContain("readMasterCollection(");
    expect(positionSource).not.toContain("writeMasterCollection(");

    const levelSource = readSource(
      "app/components/center_factory/MasterDataManagement/modules/LevelData.tsx",
    );
    expect(levelSource).toContain("listLevels()");
    expect(levelSource).not.toContain("readMasterCollection(");
    expect(levelSource).not.toContain("writeMasterCollection(");

    ["InstructorData.tsx"].forEach(
      (fileName) => {
      const source = readSource(
        `app/components/center_factory/MasterDataManagement/modules/${fileName}`,
      );
      expect(source).toContain("readMasterCollection");
      expect(source).toContain("writeMasterCollection");
      },
    );
  });

  it("uses the reference masters in Employee Data and Course Standard", () => {
    const employeeSource = readSource(
      "app/components/center_factory/MasterDataManagement/modules/EmployeeData.tsx",
    );
    const standardSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
    );

    expect(employeeSource).toContain("listEmployees()");
    expect(employeeSource).toContain("listFunctions()");
    expect(employeeSource).toContain("listPositions()");
    expect(employeeSource).toContain("listLevels()");
    expect(employeeSource).not.toContain("readEmployeeMasterData");
    expect(employeeSource).toContain("<th>Title(TH)</th>");
    expect(employeeSource).not.toContain("<th>Telephone</th>");
    expect(employeeSource).not.toContain("<th>Email</th>");
    expect(employeeSource).toContain("<th>Function Name</th>");
    expect(employeeSource).toContain("visibleCompanyGroups.map");
    expect(employeeSource).toContain("toggleCompany(companyGroup.companyId)");
    expect(employeeSource).toContain("aria-expanded={isOpen}");
    expect(employeeSource).toContain("companyGroup.totalRecords");
    expect(employeeSource).toContain("companyGroup.rows.length");
    expect(employeeSource).toContain("revealedNationalIds[employee.employeeId]");
    expect(employeeSource).not.toContain("Full National ID");
    expect(employeeSource).toContain('"Reveal All IDs"');
    expect(employeeSource).toContain('"Hide All IDs"');
    expect(employeeSource).toContain("rows.map(async (employee)");
    expect(employeeSource).toContain("Promise.all(");
    expect(employeeSource).toContain("employee.nationalIdMasked");
    expect(employeeSource).not.toContain("alert(`National ID:");
    expect(employeeSource).toContain('change("titleTh"');
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
