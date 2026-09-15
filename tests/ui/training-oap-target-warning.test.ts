import { describe, expect, it } from "vitest";

type MissingCourseCategory = "target" | "detail" | "evaluation";

interface MissingField {
  key: string;
  category: MissingCourseCategory;
  labelTh: string;
  labelEn: string;
}

interface TestCourse {
  id?: string;
  courseCode: string;
  remark?: string | null;
  objective?: string | null;
  learningContent?: string | null;
  targetGroup?: string | null;
  methodology?: string | null;
  courseGroup?: string | null;
  courseType?: string | null;
  preTestId?: string | null;
  preTestLink?: string | null;
  preTest?: string | null;
  postTestId?: string | null;
  postTestLink?: string | null;
  postTest?: string | null;
  evaluationId?: string | null;
  evaluationLink?: string | null;
  evaluation?: string | null;
}

interface TestStandard {
  positions?: string[] | null;
  levels?: string[] | null;
  functionName?: string | null;
  functionCode?: string | null;
}

const checkMissingCourseFields = (
  course: TestCourse | null,
  standard: TestStandard | null,
): MissingField[] => {
  if (!course) return [];
  const missing: MissingField[] = [];

  // 1. ที่มา (Background / Reason)
  if (!course.remark?.trim()) {
    missing.push({ key: "remark", category: "detail", labelTh: "ที่มา (Background / Reason)", labelEn: "Background / Reason" });
  }

  // 2. วัตถุประสงค์การเรียนรู้ (Objective)
  if (!course.objective?.trim()) {
    missing.push({ key: "objective", category: "detail", labelTh: "วัตถุประสงค์การเรียนรู้ (Objective)", labelEn: "Learning Objective" });
  }

  // 3. หัวข้อการเรียนรู้ (Learning Content)
  if (!course.learningContent?.trim()) {
    missing.push({ key: "learningContent", category: "detail", labelTh: "หัวข้อการเรียนรู้ (Learning Content)", labelEn: "Learning Content" });
  }

  // 4. กลุ่มผู้เข้าอบรม (Target Group)
  if (!course.targetGroup?.trim()) {
    missing.push({ key: "targetGroup", category: "target", labelTh: "กลุ่มผู้เข้าอบรม (Target Group)", labelEn: "Target Group" });
  }

  // 5. วิธีการอบรม (Methodology)
  if (!course.methodology?.trim()) {
    missing.push({ key: "methodology", category: "detail", labelTh: "วิธีการอบรม (Methodology)", labelEn: "Methodology" });
  }

  // 6. ตำแหน่งกลุ่มเป้าหมาย (Target Positions)
  const hasPositions = standard?.positions && standard.positions.length > 0;
  if (!hasPositions) {
    missing.push({ key: "positions", category: "target", labelTh: "ตำแหน่งกลุ่มเป้าหมาย (Target Positions)", labelEn: "Target Positions" });
  }

  // 7. ระดับกลุ่มเป้าหมาย (Target Levels)
  const hasLevels = standard?.levels && standard.levels.length > 0;
  if (!hasLevels) {
    missing.push({ key: "levels", category: "target", labelTh: "ระดับกลุ่มเป้าหมาย (Target Levels)", labelEn: "Target Levels" });
  }

  // 8. สายงานกลุ่มเป้าหมาย (Target Function)
  const hasFunction = Boolean(standard?.functionName?.trim() || standard?.functionCode?.trim());
  if (!hasFunction) {
    missing.push({ key: "function", category: "target", labelTh: "สายงานกลุ่มเป้าหมาย (Target Function)", labelEn: "Target Function" });
  }

  // 9. กลุ่มและประเภทหลักสูตร
  if (!course.courseGroup?.trim()) {
    missing.push({ key: "courseGroup", category: "detail", labelTh: "กลุ่มหลักสูตร (Course Group)", labelEn: "Course Group" });
  }
  if (!course.courseType?.trim()) {
    missing.push({ key: "courseType", category: "detail", labelTh: "ประเภทหลักสูตร (Course Type)", labelEn: "Course Type" });
  }

  // 10. แบบทดสอบและแบบประเมิน
  if (!course.preTestId && !course.preTestLink && !course.preTest?.trim()) {
    missing.push({ key: "preTest", category: "evaluation", labelTh: "แบบทดสอบก่อนเรียน (Pre-Test)", labelEn: "Pre-Test Form" });
  }
  if (!course.postTestId && !course.postTestLink && !course.postTest?.trim()) {
    missing.push({ key: "postTest", category: "evaluation", labelTh: "แบบทดสอบหลังเรียน (Post-Test)", labelEn: "Post-Test Form" });
  }
  if (!course.evaluationId && !course.evaluationLink && !course.evaluation?.trim()) {
    missing.push({ key: "evaluation", category: "evaluation", labelTh: "แบบประเมินผลการอบรม (Evaluation Form)", labelEn: "Evaluation Form" });
  }

  return missing;
};

describe("Training OAP Target Group & Course Details Popup Warning", () => {
  it("triggers pop-up warning and marks target warning when positions or levels are missing", () => {
    const course: TestCourse = {
      courseCode: "TR-001",
      remark: "Background provided",
      objective: "Objective provided",
      learningContent: "Content provided",
      targetGroup: "All Staff",
      methodology: "Lecture & Workshop",
      courseGroup: "Technical",
      courseType: "Internal",
      preTest: "Pretest Link",
      postTest: "Posttest Link",
      evaluation: "Eval Link",
    };
    // Standard missing positions and levels
    const standard: TestStandard = {
      positions: [],
      levels: [],
      functionName: "Engineering",
      functionCode: "ENG",
    };

    const missing = checkMissingCourseFields(course, standard);
    const popupTriggerMissingFields = missing.filter((f) => f.category !== "evaluation");
    const hasTargetGroupMissing = missing.some((f) => f.key === "positions" || f.key === "levels");

    expect(hasTargetGroupMissing).toBe(true);
    expect(popupTriggerMissingFields.length).toBe(2);
    expect(popupTriggerMissingFields.map((f) => f.key)).toContain("positions");
    expect(popupTriggerMissingFields.map((f) => f.key)).toContain("levels");
  });

  it("triggers pop-up warning when internal course details are missing (e.g. objective, learningContent)", () => {
    const course: TestCourse = {
      courseCode: "TR-002",
      remark: "",
      objective: "",
      learningContent: "",
      targetGroup: "Managers",
      methodology: "",
      courseGroup: "",
      courseType: "",
    };
    const standard: TestStandard = {
      positions: ["Manager"],
      levels: ["M1", "M2"],
      functionName: "All",
      functionCode: "ALL",
    };

    const missing = checkMissingCourseFields(course, standard);
    const popupTriggerMissingFields = missing.filter((f) => f.category !== "evaluation");
    const detailMissing = missing.filter((f) => f.category === "detail");
    const hasTargetGroupMissing = missing.some((f) => f.key === "positions" || f.key === "levels");

    // Positions and levels exist, so target group warning callout is false
    expect(hasTargetGroupMissing).toBe(false);
    // But internal details are missing, so popup MUST trigger
    expect(popupTriggerMissingFields.length).toBeGreaterThan(0);
    expect(detailMissing.map((f) => f.key)).toContain("objective");
    expect(detailMissing.map((f) => f.key)).toContain("learningContent");
    expect(detailMissing.map((f) => f.key)).toContain("remark");
  });

  it("does NOT trigger pop-up warning if only pre-test, post-test, or evaluation is missing", () => {
    const courseWithOnlyEvalMissing: TestCourse = {
      courseCode: "TR-003",
      remark: "Reason",
      objective: "Objective",
      learningContent: "Content",
      targetGroup: "Staff",
      methodology: "Lecture",
      courseGroup: "Safety",
      courseType: "Mandatory",
      preTest: null,
      postTest: null,
      evaluation: null,
    };
    const completeStandard: TestStandard = {
      positions: ["Staff", "Engineer"],
      levels: ["L1", "L2"],
      functionName: "Production",
      functionCode: "PRD",
    };

    const missing = checkMissingCourseFields(courseWithOnlyEvalMissing, completeStandard);
    const popupTriggerMissingFields = missing.filter((f) => f.category !== "evaluation");
    const hasTargetGroupMissing = missing.some((f) => f.key === "positions" || f.key === "levels");

    // Pre-test, post-test, eval are missing
    expect(missing.length).toBe(3);
    expect(missing.every((f) => f.category === "evaluation")).toBe(true);

    // MUST NOT trigger popup!
    expect(popupTriggerMissingFields.length).toBe(0);
    expect(hasTargetGroupMissing).toBe(false);
  });

  it("reports zero missing fields when course and standard are completely filled", () => {
    const completeCourse: TestCourse = {
      courseCode: "TR-004",
      remark: "Reason",
      objective: "Objective",
      learningContent: "Content",
      targetGroup: "Staff",
      methodology: "Lecture",
      courseGroup: "Safety",
      courseType: "Mandatory",
      preTest: "https://test.link/pre",
      postTest: "https://test.link/post",
      evaluation: "https://eval.link",
    };
    const completeStandard: TestStandard = {
      positions: ["Staff"],
      levels: ["L1"],
      functionName: "Production",
      functionCode: "PRD",
    };

    const missing = checkMissingCourseFields(completeCourse, completeStandard);
    const popupTriggerMissingFields = missing.filter((f) => f.category !== "evaluation");

    expect(missing.length).toBe(0);
    expect(popupTriggerMissingFields.length).toBe(0);
  });
});

describe("Training OAP - Factory Scoping for Plans and Courses", () => {
  interface SamplePlan {
    id: string;
    owner: "CENTER" | "FACTORY";
    ownerCompany: string;
  }

  interface SampleCourse {
    courseCode: string;
    status: string;
    owner?: "CENTER" | "FACTORY";
    ownerCompany?: string;
  }

  const samplePlans: SamplePlan[] = [
    { id: "plan-center-1", owner: "CENTER", ownerCompany: "HRD Center" },
    { id: "plan-center-2", owner: "CENTER", ownerCompany: "CENTER" },
    { id: "plan-ata-1", owner: "FACTORY", ownerCompany: "ATA" },
    { id: "plan-tep-1", owner: "FACTORY", ownerCompany: "TEP" },
  ];

  const sampleCourses: SampleCourse[] = [
    { courseCode: "C-CENTER-1", status: "Active", owner: "CENTER", ownerCompany: "HRD Center" },
    { courseCode: "C-CENTER-2", status: "Active", owner: "CENTER", ownerCompany: "CENTER" },
    { courseCode: "C-ATA-1", status: "Active", owner: "FACTORY", ownerCompany: "ATA" },
    { courseCode: "C-TEP-1", status: "Active", owner: "FACTORY", ownerCompany: "TEP" },
    { courseCode: "C-ATA-INACTIVE", status: "Inactive", owner: "FACTORY", ownerCompany: "ATA" },
  ];

  const filterScopedPlans = (
    plans: SamplePlan[],
    isFactoryUser: boolean,
    userCompanyCode: string,
  ) => {
    return plans.filter((plan) => {
      if (isFactoryUser) {
        return (
          plan.ownerCompany === userCompanyCode &&
          plan.owner !== "CENTER" &&
          plan.ownerCompany !== "HRD Center" &&
          plan.ownerCompany !== "CENTER"
        );
      }
      return true;
    });
  };

  const filterCourseOptions = (
    courses: SampleCourse[],
    isFactoryUser: boolean,
    userCompanyCode: string,
  ) => {
    return courses.filter((course) => {
      if (course.status === "Inactive") return false;
      if (isFactoryUser) {
        return (
          course.ownerCompany === userCompanyCode &&
          course.owner !== "CENTER" &&
          course.ownerCompany !== "HRD Center" &&
          course.ownerCompany !== "CENTER"
        );
      }
      return true;
    });
  };

  it("strictly scopes OAP plans to factory's own company for factory users, excluding Center and other factories", () => {
    const factoryAtaPlans = filterScopedPlans(samplePlans, true, "ATA");
    expect(factoryAtaPlans.map((p) => p.id)).toEqual(["plan-ata-1"]);
    expect(factoryAtaPlans.some((p) => p.owner === "CENTER" || p.ownerCompany === "HRD Center")).toBe(false);
  });

  it("strictly scopes OAP course options to factory's own company for factory users, excluding Center courses", () => {
    const factoryAtaCourses = filterCourseOptions(sampleCourses, true, "ATA");
    expect(factoryAtaCourses.map((c) => c.courseCode)).toEqual(["C-ATA-1"]);
    expect(factoryAtaCourses.some((c) => c.owner === "CENTER" || c.ownerCompany === "HRD Center")).toBe(false);
  });
});
