import { describe, expect, it, vi } from "vitest";
import { computeTargetMatch } from "../../app/lib/trainingEnrollment/repository";

const employee = (overrides: Partial<Record<string, bigint | null>> = {}) =>
  ({
    position_id: BigInt(10),
    level_id: BigInt(20),
    function_id: BigInt(30),
    division_id: BigInt(40),
    department_id: BigInt(50),
    section_id: BigInt(60),
    company_id: BigInt(70),
    ...overrides,
  }) as any;

const dbWithStandard = (standard: any) =>
  ({
    course_standard_course: {
      findFirst: vi.fn().mockResolvedValue(standard),
    },
  }) as any;

const baseStandard = {
  standard_course_id: BigInt(1),
  function_id: null,
  division_id: null,
  department_id: null,
  section_id: null,
  course_standard_target_position: [],
  course_standard_target_level: [],
  course_standard_target_company: [],
};

describe("computeTargetMatch", () => {
  it("returns NOT_MATCHED with NOT_REQUIRED level when the course has no standard", async () => {
    const result = await computeTargetMatch(dbWithStandard(null), BigInt(1), employee());
    expect(result).toEqual({
      targetMatchStatus: "NOT_MATCHED",
      levelMatchStatus: "NOT_REQUIRED",
      standardCourseId: null,
    });
  });

  it("matches everyone when no org dimension or position is restricted", async () => {
    const result = await computeTargetMatch(dbWithStandard(baseStandard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("MATCHED");
  });

  it("rejects an employee in a different division when division is restricted", async () => {
    const standard = { ...baseStandard, division_id: BigInt(999) };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
  });

  it("matches an employee whose division matches the restricted division", async () => {
    const standard = { ...baseStandard, division_id: BigInt(40) };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("MATCHED");
  });

  it("requires every specified org dimension to match (AND), not just one", async () => {
    const standard = { ...baseStandard, division_id: BigInt(40), department_id: BigInt(999) };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
  });

  it("enforces function_id, closing the prior gap where Function was selectable but never checked", async () => {
    const standard = { ...baseStandard, function_id: BigInt(999) };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
  });

  it("still enforces the pre-existing position checklist alongside the new org checks", async () => {
    const standard = {
      ...baseStandard,
      division_id: BigInt(40),
      course_standard_target_position: [{ position_id: BigInt(999) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
  });

  it("keeps level matching independent, with NOT_REQUIRED when no levels are targeted", async () => {
    const standard = { ...baseStandard, division_id: BigInt(40) };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.levelMatchStatus).toBe("NOT_REQUIRED");
  });

  it("matches an employee whose company is on the target-company checklist", async () => {
    const standard = {
      ...baseStandard,
      course_standard_target_company: [{ company_id: BigInt(70) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("MATCHED");
  });

  it("rejects an employee whose company is not on the target-company checklist", async () => {
    const standard = {
      ...baseStandard,
      course_standard_target_company: [{ company_id: BigInt(999) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
  });

  it("requires company to match alongside org/position dimensions (AND)", async () => {
    const standard = {
      ...baseStandard,
      division_id: BigInt(40),
      course_standard_target_company: [{ company_id: BigInt(999) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
  });

  it("matches an employee when only level is targeted and level matches (Level is primary / position ignored)", async () => {
    const standard = {
      ...baseStandard,
      course_standard_target_level: [{ level_id: BigInt(20) }],
      course_standard_target_position: [],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("MATCHED");
    expect(result.levelMatchStatus).toBe("MATCHED");
  });

  it("matches an employee whose both level and position match targeted criteria", async () => {
    const standard = {
      ...baseStandard,
      course_standard_target_level: [{ level_id: BigInt(20) }],
      course_standard_target_position: [{ position_id: BigInt(10) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("MATCHED");
    expect(result.levelMatchStatus).toBe("MATCHED");
  });

  it("rejects an employee whose level does not match targeted levels even if position matches", async () => {
    const standard = {
      ...baseStandard,
      course_standard_target_level: [{ level_id: BigInt(999) }],
      course_standard_target_position: [{ position_id: BigInt(10) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
    expect(result.levelMatchStatus).toBe("NOT_MATCHED");
  });

  it("rejects an employee whose position does not match targeted positions when both are specified", async () => {
    const standard = {
      ...baseStandard,
      course_standard_target_level: [{ level_id: BigInt(20) }],
      course_standard_target_position: [{ position_id: BigInt(999) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
    expect(result.levelMatchStatus).toBe("MATCHED");
  });

  it("rejects an employee when neither targeted level nor targeted position matches", async () => {
    const standard = {
      ...baseStandard,
      course_standard_target_level: [{ level_id: BigInt(999) }],
      course_standard_target_position: [{ position_id: BigInt(999) }],
    };
    const result = await computeTargetMatch(dbWithStandard(standard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("NOT_MATCHED");
  });

  it("matches everyone when the target-company checklist is empty (defensive default)", async () => {
    const result = await computeTargetMatch(dbWithStandard(baseStandard), BigInt(1), employee());
    expect(result.targetMatchStatus).toBe("MATCHED");
  });
});
