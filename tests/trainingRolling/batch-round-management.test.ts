import { describe, expect, it } from "vitest";
import { parseCreateRollingPlan, parseUpdateRollingPlan } from "../../app/lib/trainingRolling/validation";

describe("Training Rolling Batch & Round Management", () => {
  it("parses batchNo as positive integer when provided in CreateRollingPlanInput", () => {
    const parsed = parseCreateRollingPlan({
      oapPlanId: "1001",
      batchNo: 2,
      batchName: "รอบที่ 1",
      venue: "Room A",
      trainingDate: "2026-10-15",
      startTime: "09:00",
      endTime: "16:00",
    });

    expect(parsed.batchNo).toBe(2);
    expect(parsed.batchName).toBe("รอบที่ 1");
    expect(parsed.venue).toBe("Room A");
  });

  it("handles string numbers for batchNo in input", () => {
    const parsed = parseCreateRollingPlan({
      oapPlanId: "1001",
      batchNo: "3",
      batchName: "รอบที่ 2",
      venue: "Online",
      trainingDate: "2026-10-15",
      startTime: "09:00",
      endTime: "16:00",
    });

    expect(parsed.batchNo).toBe(3);
    expect(parsed.batchName).toBe("รอบที่ 2");
  });

  it("parses batchNo in UpdateRollingPlanInput", () => {
    const parsed = parseUpdateRollingPlan({
      batchNo: 5,
      batchName: "รอบที่ 3",
    });

    expect(parsed.batchNo).toBe(5);
    expect(parsed.batchName).toBe("รอบที่ 3");
  });

  it("throws validation error if batchNo is invalid (zero or negative)", () => {
    expect(() =>
      parseCreateRollingPlan({
        oapPlanId: "1001",
        batchNo: 0,
        batchName: "1",
        venue: "Room A",
        trainingDate: "2026-10-15",
        startTime: "09:00",
        endTime: "16:00",
      })
    ).toThrow();
  });
});
