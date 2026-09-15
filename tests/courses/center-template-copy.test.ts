import { describe, expect, it } from "vitest";

type CourseTemplate = {
  id: string;
  courseCode: string;
  courseGroup: string;
  courseType: string;
  courseNameTh: string;
  courseNameEn: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  lifeCycleMonth: string;
  remark: string;
  preTestId?: string;
  postTestId?: string;
  evaluationId?: string;
  evaluationAfter30DayId?: string;
  prerequisites?: Array<{ id: string; courseCode: string; courseName: string }>;
};

type StandardTemplate = {
  courseId: string;
  courseCode: string;
  companies?: string[];
  functionCode?: string;
  divisionCode?: string;
  departmentCode?: string;
  sectionCode?: string;
  targetOrgScopes?: Array<{ functionCode?: string; divisionCode?: string }>;
  positions: string[];
  levels: string[];
};

const applyCenterTemplateToFactory = ({
  templateCourse,
  templateStandard,
  factoryUserCompany,
  availablePositions,
  availableLevels,
}: {
  templateCourse: CourseTemplate;
  templateStandard?: StandardTemplate | null;
  factoryUserCompany: string;
  availablePositions: string[];
  availableLevels: string[];
}) => {
  // 1. Form details copied (tests and evaluations excluded)
  const form = {
    courseGroup: templateCourse.courseGroup,
    courseType: templateCourse.courseType,
    courseNameTh: templateCourse.courseNameTh,
    courseNameEn: templateCourse.courseNameEn || templateCourse.courseNameTh,
    objective: templateCourse.objective || "",
    learningContent: templateCourse.learningContent || "",
    targetGroup: templateCourse.targetGroup || "",
    methodology: templateCourse.methodology || "",
    lifeCycleMonth: templateCourse.lifeCycleMonth || "0",
    remark: templateCourse.remark || "",
    status: "Active",

    // Excluded
    preTestId: "",
    preTest: "",
    postTestId: "",
    postTest: "",
    evaluationId: "",
    evaluation: "",
    evaluationAfter30DayId: "",
    evaluationAfter30Day: "",
  };

  // 2. Standard details
  // Excluded: Target Org Scopes (Function, Division, Department, Section)
  const targetOrgScopes = [{ id: "1", functionCode: "", divisionCode: "", departmentCode: "", sectionCode: "" }];
  const standardFunctionCode = "";
  const standardDivisionCode = "";

  // Excluded: Center's company list (Factory user gets own company)
  const selectedCompanies = factoryUserCompany ? [factoryUserCompany] : [];

  // Included: Target positions from Center standard
  const selectedPositions = availablePositions.filter((pos) =>
    (templateStandard?.positions ?? []).includes(pos),
  );

  // Included: Target levels from Center standard
  const selectedLevels = availableLevels.filter((lvl) =>
    (templateStandard?.levels ?? []).includes(lvl),
  );

  // Included: Prerequisites from Center course
  const selectedPrerequisites = (templateCourse.prerequisites ?? []).map((p) => p.id);

  return {
    form,
    targetOrgScopes,
    standardFunctionCode,
    standardDivisionCode,
    selectedCompanies,
    selectedPositions,
    selectedLevels,
    selectedPrerequisites,
  };
};

describe("Factory Center Template Copy Behavior", () => {
  it("copies all course details, target positions, levels, and prerequisites, while excluding tests, evals, org scopes, and center companies", () => {
    const centerCourse: CourseTemplate = {
      id: "c-center-1",
      courseCode: "SY-000001",
      courseGroup: "Safety",
      courseType: "IN-HOUSE",
      courseNameTh: "ความปลอดภัยในการทำงาน",
      courseNameEn: "Occupational Safety",
      objective: "เพื่อให้พนักงานเข้าใจหลักความปลอดภัย",
      learningContent: "1. กฎหมายความปลอดภัย 2. การใช้อุปกรณ์ PPE",
      targetGroup: "พนักงานระดับปฏิบัติการและหัวหน้างาน",
      methodology: "บรรยายและฝึกปฏิบัติ",
      lifeCycleMonth: "12",
      remark: "หลักสูตรบังคับตามกฎหมาย",
      preTestId: "test-pre-99",
      postTestId: "test-post-99",
      evaluationId: "eval-99",
      evaluationAfter30DayId: "eval30-99",
      prerequisites: [{ id: "pre-c1", courseCode: "SY-000000", courseName: "Basic Safety" }],
    };

    const centerStandard: StandardTemplate = {
      courseId: "c-center-1",
      courseCode: "SY-000001",
      companies: ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"], // Center includes all companies
      functionCode: "ALL",
      divisionCode: "ALL",
      departmentCode: "ALL",
      sectionCode: "ALL",
      targetOrgScopes: [{ functionCode: "ALL", divisionCode: "ALL" }],
      positions: ["Staff", "Officer", "Supervisor"],
      levels: ["L1", "L2", "L3"],
    };

    const result = applyCenterTemplateToFactory({
      templateCourse: centerCourse,
      templateStandard: centerStandard,
      factoryUserCompany: "ATA",
      availablePositions: ["Staff", "Officer", "Supervisor", "Manager"],
      availableLevels: ["L1", "L2", "L3", "L4"],
    });

    // 1. Course Details are fully copied
    expect(result.form.courseNameTh).toBe("ความปลอดภัยในการทำงาน");
    expect(result.form.objective).toBe("เพื่อให้พนักงานเข้าใจหลักความปลอดภัย");
    expect(result.form.learningContent).toBe("1. กฎหมายความปลอดภัย 2. การใช้อุปกรณ์ PPE");
    expect(result.form.targetGroup).toBe("พนักงานระดับปฏิบัติการและหัวหน้างาน");
    expect(result.form.methodology).toBe("บรรยายและฝึกปฏิบัติ");
    expect(result.form.remark).toBe("หลักสูตรบังคับตามกฎหมาย");
    expect(result.form.lifeCycleMonth).toBe("12");

    // 2. Tests and Evaluations are excluded (empty)
    expect(result.form.preTestId).toBe("");
    expect(result.form.postTestId).toBe("");
    expect(result.form.evaluationId).toBe("");
    expect(result.form.evaluationAfter30DayId).toBe("");

    // 3. Target Positions & Levels are copied from Center standard
    expect(result.selectedPositions).toEqual(["Staff", "Officer", "Supervisor"]);
    expect(result.selectedLevels).toEqual(["L1", "L2", "L3"]);

    // 4. Prerequisites are copied
    expect(result.selectedPrerequisites).toEqual(["pre-c1"]);

    // 5. Company checklist is NOT copied from Center; factory user gets their own company
    expect(result.selectedCompanies).toEqual(["ATA"]);

    // 6. Target Org Scopes (Function, Division, Department, Section) are excluded (reset to empty for factory to specify)
    expect(result.targetOrgScopes).toEqual([
      { id: "1", functionCode: "", divisionCode: "", departmentCode: "", sectionCode: "" },
    ]);
    expect(result.standardFunctionCode).toBe("");
    expect(result.standardDivisionCode).toBe("");
  });
});
