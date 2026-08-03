import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getCourseDisplayName,
  getCourseSecondaryName,
  type WorkflowCourse,
} from "../../app/lib/trainingWorkflow";

const course = (courseNameTh: string, courseNameEn: string) =>
  ({ courseNameTh, courseNameEn }) as WorkflowCourse;

describe("Thai-first course names", () => {
  it("uses Thai as the primary name and English as secondary", () => {
    expect(getCourseDisplayName(course("ความปลอดภัย", "Safety"))).toBe(
      "ความปลอดภัย",
    );
    expect(getCourseSecondaryName(course("ความปลอดภัย", "Safety"))).toBe(
      "Safety",
    );
  });

  it("falls back to English when the Thai name is unavailable", () => {
    expect(getCourseDisplayName(course("", "Safety"))).toBe("Safety");
    expect(getCourseSecondaryName(course("", "Safety"))).toBe("");
  });

  it("propagates the Thai-first rule into plans and employee roadmaps", () => {
    const sources = [
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingOAP.tsx",
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingRolling.tsx",
      "app/components/employee/RoadmapModule.tsx",
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

    sources.forEach((source) => expect(source).toContain("getCourseDisplayName"));
  });
});
