import { describe, expect, it } from "vitest";
import {
  parseBatchNumber,
  sortCoursesByCourseAndBatch,
} from "../../app/components/center_factory/TrainingRecordManagement/modules/TrainingRecord";

describe("Training Record course and batch sorting", () => {
  it("extracts batch number from numeric and textual formats", () => {
    expect(parseBatchNumber("1")).toBe(1);
    expect(parseBatchNumber("2")).toBe(2);
    expect(parseBatchNumber("10")).toBe(10);
    expect(parseBatchNumber("Batch 3")).toBe(3);
    expect(parseBatchNumber("รุ่นที่ 5")).toBe(5);
    expect(parseBatchNumber("รุ่น 12")).toBe(12);
    expect(parseBatchNumber(undefined)).toBe(0);
    expect(parseBatchNumber(null)).toBe(0);
    expect(parseBatchNumber("No digits")).toBe(0);
  });

  it("sorts courses by code and natural numeric batch order", () => {
    const courses = [
      { code: "CRS-002", title: "Course B", batch: "รุ่นที่ 10", date: "2026-03-01" },
      { code: "CRS-001", title: "Course A", batch: "รุ่นที่ 2", date: "2026-02-01" },
      { code: "CRS-002", title: "Course B", batch: "รุ่นที่ 2", date: "2026-01-15" },
      { code: "CRS-001", title: "Course A", batch: "รุ่นที่ 1", date: "2026-01-10" },
      { code: "CRS-001", title: "Course A", batch: "รุ่นที่ 10", date: "2026-02-20" },
    ];

    const sorted = sortCoursesByCourseAndBatch(courses);

    expect(sorted.map((c) => `${c.code} - ${c.batch}`)).toEqual([
      "CRS-001 - รุ่นที่ 1",
      "CRS-001 - รุ่นที่ 2",
      "CRS-001 - รุ่นที่ 10",
      "CRS-002 - รุ่นที่ 2",
      "CRS-002 - รุ่นที่ 10",
    ]);
  });

  it("groups by title when code is missing", () => {
    const courses = [
      { code: "", title: "Safety Induction", batch: "2", date: "2026-02-01" },
      { code: "", title: "Leadership 101", batch: "1", date: "2026-01-01" },
      { code: "", title: "Safety Induction", batch: "1", date: "2026-01-01" },
    ];

    const sorted = sortCoursesByCourseAndBatch(courses);

    expect(sorted.map((c) => `${c.title} - ${c.batch}`)).toEqual([
      "Leadership 101 - 1",
      "Safety Induction - 1",
      "Safety Induction - 2",
    ]);
  });
});
