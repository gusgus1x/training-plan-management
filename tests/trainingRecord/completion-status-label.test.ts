import { describe, expect, it } from "vitest";
import {
  COMPLETION_STATUSES,
  completionStatusLabel,
} from "../../app/lib/trainingRecord/types";

// The stored values are database enum names. HRD filling in a roster is answering "did this
// person pass?", and COMPLETED / NOT_COMPLETED / PENDING does not ask that question in any
// language.
describe("completion status reads as pass or fail", () => {
  it("says passed and not passed rather than the database words", () => {
    expect(completionStatusLabel("COMPLETED", "th")).toBe("ผ่าน");
    expect(completionStatusLabel("COMPLETED", "en")).toBe("Passed");
    expect(completionStatusLabel("NOT_COMPLETED", "th")).toBe("ไม่ผ่าน");
    expect(completionStatusLabel("NOT_COMPLETED", "en")).toBe("Not passed");
  });

  it("keeps 'not decided' separate from 'failed'", () => {
    // PENDING is the column default. Showing it as a failure would mark everyone who has not been
    // graded yet as having failed.
    expect(completionStatusLabel("PENDING", "th")).toBe("ยังไม่ระบุ");
    expect(completionStatusLabel("PENDING", "en")).toBe("Not decided");
  });

  it("has a label for every status the database allows", () => {
    for (const status of COMPLETION_STATUSES) {
      expect(completionStatusLabel(status, "th")).not.toBe(status);
      expect(completionStatusLabel(status, "en")).not.toBe(status);
    }
  });
});
