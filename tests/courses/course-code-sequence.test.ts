import { describe, it, expect } from "vitest";
import { findNextAvailableCourseCodeSeq } from "../../app/lib/courses/repository";
import { findNextAvailableCourseSeq, type CourseRecord } from "../../app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace";

describe("findNextAvailableCourseCodeSeq (Backend)", () => {
  it("returns 1 for an empty course list", () => {
    expect(findNextAvailableCourseCodeSeq([])).toBe(1);
  });

  it("returns next sequential integer when no gaps exist", () => {
    const courses = [
      { course_code: "MT-000001" },
      { course_code: "MT-000002" },
      { course_code: "MT-000003" },
    ];
    expect(findNextAvailableCourseCodeSeq(courses)).toBe(4);
  });

  it("fills the first missing number (gap) in the middle", () => {
    // Exactly like the database state: 1..17 exist, then jump to 26
    const courses = [
      ...Array.from({ length: 17 }, (_, i) => ({ course_code: `MT-${String(i + 1).padStart(6, "0")}` })),
      { course_code: "MT-000026" },
      { course_code: "MT-000027" },
      { course_code: "MT-000039" },
    ];
    expect(findNextAvailableCourseCodeSeq(courses)).toBe(18);
  });

  it("fills gap when sequence starts after 1", () => {
    // Like DQ group where 4 exists but 1..3 are missing
    const courses = [{ course_code: "DQ-000004" }];
    expect(findNextAvailableCourseCodeSeq(courses)).toBe(1);
  });

  it("handles factory company-prefixed course codes", () => {
    const courses = [
      { course_code: "ATA-AL-000001" },
      { course_code: "ATA-AL-000002" },
      { course_code: "ATA-AL-000004" },
    ];
    expect(findNextAvailableCourseCodeSeq(courses)).toBe(3);
  });

  it("safely ignores malformed or non-numeric course codes", () => {
    const courses = [
      { course_code: "INVALID_CODE" },
      { course_code: "MT-ABCDEF" },
      { course_code: "MT-000001" },
    ];
    expect(findNextAvailableCourseCodeSeq(courses)).toBe(2);
  });
});

describe("findNextAvailableCourseSeq (Frontend Preview)", () => {
  const makeCourse = (code: string, group: string, ownerCompany?: string, owner = "CENTER"): CourseRecord => ({
    id: "1",
    courseCode: code,
    courseGroup: group,
    courseType: "IN-HOUSE",
    courseNameTh: "Test Course",
    courseNameEn: "Test Course",
    objective: "",
    learningContent: "",
    targetGroup: "",
    methodology: "",
    preTest: "",
    postTest: "",
    evaluation: "",
    evaluationAfter30Day: "",
    lifeCycleMonth: "",
    remark: "",
    status: "Active",
    owner: owner as "CENTER" | "FACTORY",
    ownerCompany: ownerCompany || "HRD Center",
    updatedAt: new Date().toISOString(),
  });

  it("returns 1 when group has no courses", () => {
    expect(findNextAvailableCourseSeq([], "Maintenance", null, false)).toBe(1);
  });

  it("finds gap for HRD Center courses", () => {
    const courses: CourseRecord[] = [
      makeCourse("MT-000001", "Maintenance"),
      makeCourse("MT-000002", "Maintenance"),
      makeCourse("MT-000004", "Maintenance"), // 3 is missing
    ];
    expect(findNextAvailableCourseSeq(courses, "Maintenance", null, false)).toBe(3);
  });

  it("scopes numbering to the specific company for factory users", () => {
    const courses: CourseRecord[] = [
      makeCourse("ATA-MT-000001", "Maintenance", "ATA", "FACTORY"),
      makeCourse("ATA-MT-000002", "Maintenance", "ATA", "FACTORY"),
      // ATFB has a different sequence
      makeCourse("ATFB-MT-000001", "Maintenance", "ATFB", "FACTORY"),
      makeCourse("ATFB-MT-000005", "Maintenance", "ATFB", "FACTORY"),
    ];

    // ATA user should see next is 3
    expect(findNextAvailableCourseSeq(courses, "Maintenance", "ATA", true)).toBe(3);

    // ATFB user should see next is 2 (gap between 1 and 5)
    expect(findNextAvailableCourseSeq(courses, "Maintenance", "ATFB", true)).toBe(2);
  });
});
