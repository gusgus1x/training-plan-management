import { describe, expect, it } from "vitest";
import { parseCreateCourse, parseUpdateCourse } from "../../app/lib/courses/validation";

const course = (over: Record<string, unknown>) => ({
  courseNameTh: "หลักสูตร",
  courseTypeId: "1",
  courseGroupId: "1",
  standardCode: "STD-001",
  standardName: "Standard",
  targetCompanies: ["1"],
  ...over,
});

describe("prerequisiteCourseIds parsing", () => {
  it("parseCreateCourse defaults to an empty list when not sent", () => {
    expect(parseCreateCourse(course({})).prerequisiteCourseIds).toEqual([]);
  });

  it("parseCreateCourse reads the ids that were sent", () => {
    const result = parseCreateCourse(course({ prerequisiteCourseIds: ["5", "9"] }));
    expect(result.prerequisiteCourseIds).toEqual(["5", "9"]);
  });

  it("parseCreateCourse ignores non-string entries rather than throwing", () => {
    const result = parseCreateCourse(course({ prerequisiteCourseIds: ["5", 9, null, "7"] }));
    expect(result.prerequisiteCourseIds).toEqual(["5", "7"]);
  });

  it("parseUpdateCourse leaves the field out entirely when not sent", () => {
    const result = parseUpdateCourse({ courseNameTh: "x" });
    expect("prerequisiteCourseIds" in result).toBe(false);
  });

  it("parseUpdateCourse can clear the list back to empty", () => {
    const result = parseUpdateCourse({ prerequisiteCourseIds: [] });
    expect(result.prerequisiteCourseIds).toEqual([]);
  });

  it("parseUpdateCourse reads the ids that were sent", () => {
    const result = parseUpdateCourse({ prerequisiteCourseIds: ["3"] });
    expect(result.prerequisiteCourseIds).toEqual(["3"]);
  });
});
