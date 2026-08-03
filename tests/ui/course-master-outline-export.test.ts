import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getCourseOutlineFileName } from "../../app/lib/courseOutlineExport";
import { buildCourseOutlineWorkbook } from "../../app/lib/courseOutlineWorkbook";
import { readXlsxEntry } from "../../app/lib/xlsxTemplate";
import type { WorkflowCourse, WorkflowStandard } from "../../app/lib/trainingWorkflow";

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

let template: Buffer;

beforeAll(async () => {
  template = await readFile(
    path.join(process.cwd(), "app", "Excel", "ATA-F-HD-005-Couse Outline.xlsx"),
  );
});

describe("Course Master outline export", () => {
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
    expect(thaiSheet).toContain("ตำแหน่ง: Foreman, Leader");
    expect(thaiSheet).toContain("วิธีการอบรม: Workshop");
    expect(englishSheet).toContain("Course Workplace Safety (SAF-001)");
    expect(englishSheet).toContain("Positions: Foreman, Leader");
    expect(englishSheet).toContain("Pre-test: Safety pre-test");
    expect(() => readXlsxEntry(workbook, "xl/worksheets/sheet3.xml")).not.toThrow();
    expect(() => readXlsxEntry(workbook, "xl/drawings/drawing2.xml")).not.toThrow();
  });

  it("creates a safe .xlsx filename from the course code", () => {
    expect(getCourseOutlineFileName({ courseCode: "SAF/001" })).toBe(
      "course-outline_SAF-001.xlsx",
    );
  });
});
