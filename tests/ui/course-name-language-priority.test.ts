import { describe, expect, it } from "vitest";

import {
  getCourseDisplayName,
  getCourseSecondaryName,
  type WorkflowCourse,
} from "../../app/lib/trainingWorkflow";

const course = (courseNameTh: string, courseNameEn: string) =>
  ({ courseNameTh, courseNameEn }) as WorkflowCourse;

describe("English-first course names", () => {
  it("uses English as the primary name and Thai as secondary", () => {
    expect(getCourseDisplayName(course("ความปลอดภัย", "Safety"))).toBe(
      "Safety",
    );
    expect(getCourseSecondaryName(course("ความปลอดภัย", "Safety"))).toBe(
      "ความปลอดภัย",
    );
  });

  it("falls back to Thai when the English name is unavailable", () => {
    expect(getCourseDisplayName(course("ความปลอดภัย", ""))).toBe("ความปลอดภัย");
    expect(getCourseSecondaryName(course("ความปลอดภัย", ""))).toBe("");
  });
});
