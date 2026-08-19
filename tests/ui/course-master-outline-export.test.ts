import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getCourseOutlineFileName } from "../../app/lib/courseOutlineExport";
import { buildCourseOutlineWorkbook } from "../../app/lib/courseOutlineWorkbook";
import { readXlsxEntry } from "../../app/lib/xlsxTemplate";
import type {
  WorkflowCourse,
  WorkflowOapPlan,
  WorkflowStandard,
} from "../../app/lib/trainingWorkflow";

const course: WorkflowCourse = {
  id: "course-safety-001",
  courseCode: "SAF-001",
  courseNameTh: "ความปลอดภัยในการทำงาน",
  courseNameEn: "Workplace Safety",
  objective: "เพื่อให้ผู้เข้าอบรมสามารถทำงานได้อย่างปลอดภัย",
  learningContent: "กฎความปลอดภัย\nการประเมินความเสี่ยง\nการตอบโต้เหตุฉุกเฉิน",
  targetGroup: "พนักงานฝ่ายผลิต",
  methodology: "Workshop",
  preTest: "Safety pre-test",
  postTest: "Safety post-test",
  evaluation: "Course evaluation",
  evaluationAfter30Day: "Supervisor follow-up",
  lifeCycleMonth: "12",
  remark: "หลักสูตรตามข้อกำหนดด้านความปลอดภัย",
  status: "Active",
  courseType: "IN-HOUSE",
  courseGroup: "Safety",
  updatedAt: "2026-08-03T00:00:00.000Z",
  owner: "CENTER",
  ownerCompany: "HRD Center",
  createdBy: "admin.hrd",
};

const standard: WorkflowStandard = {
  id: "standard-safety-001",
  courseId: course.id,
  courseCode: course.courseCode,
  courseName: course.courseNameTh,
  functionCode: "FNC0010",
  functionName: "Production",
  positions: ["Foreman", "Leader"],
  levels: ["S2", "O4"],
  owner: "CENTER",
  ownerCompany: "HRD Center",
};

const oapPlan: WorkflowOapPlan = {
  id: "oap-safety-001",
  sequence: 1,
  course,
  participants: "20",
  hours: "6",
  budget: "45000",
  trainer: "External trainer",
  provider: "Safety Institute",
  createdBy: "admin.hrd",
  status: "Planning",
  owner: "CENTER",
  ownerCompany: "HRD Center",
};

let template: Buffer;

beforeAll(async () => {
  template = await readFile(
    path.join(process.cwd(), "app", "Excel", "ATA-F-HD-005-Couse Outline.xlsx"),
  );
});

describe("Course outline export", () => {
  it("fills the Thai and English sheets while preserving the approval sheet", () => {
    const workbook = buildCourseOutlineWorkbook(template, course, standard);
    const thaiSheet = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet1.xml",
    ).toString("utf8");
    const englishSheet = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet2.xml",
    ).toString("utf8");

    expect(workbook.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(thaiSheet).toContain("หลักสูตร ความปลอดภัยในการทำงาน (SAF-001)");
    expect(thaiSheet).toContain("เพื่อให้ผู้เข้าอบรมสามารถทำงานได้อย่างปลอดภัย");
    expect(thaiSheet).toContain("Workshop");
    expect(thaiSheet).not.toContain("วิธีการอบรม:");
    expect(englishSheet).not.toContain("Methodology:");
    expect(englishSheet).not.toContain("Evaluation:");
    expect(englishSheet).toContain("Course Workplace Safety (SAF-001)");
    expect(englishSheet).toContain("Org: Production");
    expect(englishSheet).toContain("Positions: Foreman, Leader");
    expect(englishSheet).toContain("Levels: S2, O4");
    expect(englishSheet).toContain("Pre-test: Safety pre-test");
    expect(() => readXlsxEntry(workbook, "xl/worksheets/sheet3.xml")).not.toThrow();
    expect(() => readXlsxEntry(workbook, "xl/drawings/drawing2.xml")).not.toThrow();
  });

  it("names the file by course, code, and schedule", () => {
    expect(
      getCourseOutlineFileName(
        { courseCode: "SAF/001", courseNameTh: "ความปลอดภัย", courseNameEn: "Safety" },
        { date: "2026-03-15", time: "09:00 - 16:00" },
      ),
    ).toBe("ความปลอดภัย_SAF-001_2026-03-15_09-00 - 16-00.xlsx");
    expect(
      getCourseOutlineFileName({ courseCode: "SAF/001", courseNameTh: "", courseNameEn: "" }),
    ).toBe("SAF-001.xlsx");
  });

  it("includes the selected Training OAP plan data", () => {
    const workbook = buildCourseOutlineWorkbook(
      template,
      course,
      standard,
      oapPlan,
    );
    const englishSheet = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet2.xml",
    ).toString("utf8");

    expect(englishSheet).toContain("External trainer / Safety Institute");
    expect(englishSheet).toContain("Time: 6 hrs");
    expect(englishSheet).toContain("45,000 THB");
  });

  it("details org scope, positions, and levels in the target group", () => {
    const longStandard: WorkflowStandard = {
      ...standard,
      functionName: "All Function",
      positions: ["Section Head", "Leader", "Operator", "Supervisor"],
      levels: ["M3", "M2", "S4", "S3", "S1", "O5"],
    };
    const workbook = buildCourseOutlineWorkbook(
      template,
      { ...course, targetGroup: "Department heads" },
      longStandard,
      { ...oapPlan, participants: "50" },
    );
    const englishSheet = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet2.xml",
    ).toString("utf8");

    expect(englishSheet).toContain("Department heads");
    expect(englishSheet).toContain('r="K17" s="48" t="inlineStr"');
    expect(englishSheet).toMatch(/<row[^>]*r="17"[^>]*customHeight="1"/);
  });

  it("keeps every line when the content outgrows the template rows", () => {
    const topics = Array.from({ length: 18 }, (_, index) => `หัวข้อที่ ${index + 1}`);
    const workbook = buildCourseOutlineWorkbook(
      template,
      { ...course, learningContent: topics.join("\n") },
      standard,
      oapPlan,
    );
    const thaiSheet = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet1.xml",
    ).toString("utf8");

    for (const topic of topics) {
      expect(thaiSheet).toContain(topic);
    }
    // last learning-content row grows so the stacked leftovers stay visible
    expect(thaiSheet).toMatch(/<row[^>]*r="38"[^>]*customHeight="1"/);
  });

  it("places the export action in Training Rolling instead of Training OAP or Course Master", async () => {
    const [rollingSource, oapSource, courseMasterSource] = await Promise.all([
      readFile(
        path.join(
          process.cwd(),
          "app/components/center_factory/TrainingPlanManagement/modules/TrainingRolling.tsx",
        ),
        "utf8",
      ),
      readFile(
        path.join(
          process.cwd(),
          "app/components/center_factory/TrainingPlanManagement/modules/TrainingOAP.tsx",
        ),
        "utf8",
      ),
      readFile(
        path.join(
          process.cwd(),
          "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
        ),
        "utf8",
      ),
    ]);

    expect(rollingSource).toContain("Export Outline");
    expect(oapSource).not.toContain("Export Outline");
    expect(courseMasterSource).not.toContain("Export Outline");
  });
});
