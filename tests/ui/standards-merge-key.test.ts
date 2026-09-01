import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Both employee screens fold the course-standard list the API returns into a lookup keyed by
 * course. `WorkflowStandard.id` is NOT a course key - courses/repository.ts sets it to
 * course_standard.standard_id, and course_standard is unique per (company_id, standard_year), so
 * every course created in the same year for the same company carries the same one.
 *
 * Matching on it folded an entire year's courses into a single entry holding the last course's
 * code. On the register screen every other course then missed its standard and displayed
 * "All Positions" / "All Levels"; on the roadmap it was worse, because isTargetMatch refuses to
 * count "All" as a specific match, so those courses were filtered out of the employee's roadmap
 * altogether.
 *
 * Asserting on the absence of that one condition rather than on the merge output, because the
 * merge is inline in a component and this is the specific mistake worth pinning down.
 */

const read = (path: string) =>
  readFileSync(new URL(`../../app/components/employee/${path}`, import.meta.url), "utf8");

describe.each([
  ["RegisterTrainingModule", read("RegisterTrainingModule.tsx")],
  ["RoadmapModule", read("RoadmapModule.tsx")],
])("%s standards merge", (_label, source) => {
  it("does not fold two standards together on the shared standard id", () => {
    expect(source).not.toMatch(/String\(s\.id\)\s*===\s*String\(apiStd\.id\)/);
  });

  it("still folds on the course identifiers", () => {
    expect(source).toContain("String(s.courseId) === String(apiStd.courseId)");
    expect(source).toContain("s.courseCode.trim().toLowerCase() === apiStd.courseCode.trim().toLowerCase()");
  });
});
