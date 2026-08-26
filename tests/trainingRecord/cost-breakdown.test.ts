import { describe, expect, it, vi } from "vitest";
import { createTrainingRecordRepository } from "../../app/lib/trainingRecord/repository";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const centerPrincipal: AuthenticatedPrincipal = {
  userId: "1",
  username: "center",
  role: "HRD_CENTER",
  companyId: null,
  employeeId: null,
  employeeUserId: null,
  email: null,
  employeeCode: null,
  displayName: null,
  companyCode: null,
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
};

const factoryPrincipal = (companyId: string): AuthenticatedPrincipal => ({
  ...centerPrincipal,
  userId: "2",
  username: "factory",
  role: "HRD_FACTORY",
  companyId,
});

const enrollment = (companyId: string, companyCode: string, attendanceStatus: string | null) => ({
  employee: {
    company_id: BigInt(companyId),
    company: { company_code: companyCode },
  },
  attendance: attendanceStatus ? { attendance_status: attendanceStatus } : null,
});

const oapPlanned = (overrides: Partial<Record<string, number | bigint | null>> = {}) => ({
  company_id: null,
  total_planned_budget: 0,
  budget_instructor: 0,
  budget_traveling: 0,
  budget_seminar_room: 0,
  budget_accommodation: 0,
  budget_material: 0,
  budget_food_beverage: 0,
  ...overrides,
});

const buildClient = (plan: unknown) => ({
  training_plan: { findUniqueOrThrow: vi.fn().mockResolvedValue(plan) },
});

describe("trainingRecordRepository.getCostBreakdown", () => {
  it("counts only PRESENT enrollments toward presentCount and cost-per-person", async () => {
    const client = buildClient({
      training_plan_oap: oapPlanned({ company_id: BigInt(1) }),
      training_expense: [{ expense_category: "INSTRUCTOR", amount: 10000 }],
      training_enrollment: [
        enrollment("1", "ATA", "PRESENT"),
        enrollment("1", "ATA", "ABSENT"),
        enrollment("1", "ATA", null),
      ],
    });

    const repo = createTrainingRecordRepository(client as any);
    const result = await repo.getCostBreakdown("10", centerPrincipal);

    expect(result.presentCount).toBe(1);
    expect(result.actualGrandTotal).toBe(10000);
    expect(result.costPerPerson).toBe(10000);
  });

  it("matches the worked example: 10,000 THB / 10 people and 20,000 THB / 20 people both give 1,000 THB/person", async () => {
    const tenPeople = Array.from({ length: 10 }, () => enrollment("1", "ATA", "PRESENT"));
    const client1 = buildClient({
      training_plan_oap: oapPlanned({ company_id: BigInt(1) }),
      training_expense: [{ expense_category: "MATERIAL", amount: 10000 }],
      training_enrollment: tenPeople,
    });
    const repo1 = createTrainingRecordRepository(client1 as any);
    const batch1 = await repo1.getCostBreakdown("10", centerPrincipal);
    expect(batch1.presentCount).toBe(10);
    expect(batch1.costPerPerson).toBe(1000);

    const twentyPeople = Array.from({ length: 20 }, () => enrollment("1", "ATA", "PRESENT"));
    const client2 = buildClient({
      training_plan_oap: oapPlanned({ company_id: BigInt(1) }),
      training_expense: [{ expense_category: "MATERIAL", amount: 20000 }],
      training_enrollment: twentyPeople,
    });
    const repo2 = createTrainingRecordRepository(client2 as any);
    const batch2 = await repo2.getCostBreakdown("11", centerPrincipal);
    expect(batch2.presentCount).toBe(20);
    expect(batch2.costPerPerson).toBe(1000);
  });

  it("scopes HRD_FACTORY to their own company's row while keeping course-wide totals unfiltered", async () => {
    const client = buildClient({
      // Owned by center (company_id null) but has attendees from two companies.
      training_plan_oap: oapPlanned({ company_id: null }),
      training_expense: [{ expense_category: "ACCOMMODATION", amount: 3000 }],
      training_enrollment: [
        enrollment("1", "ATA", "PRESENT"),
        enrollment("1", "ATA", "PRESENT"),
        enrollment("2", "TEP", "PRESENT"),
      ],
    });

    const repo = createTrainingRecordRepository(client as any);
    const result = await repo.getCostBreakdown("12", factoryPrincipal("1"));

    expect(result.presentCount).toBe(3);
    expect(result.actualGrandTotal).toBe(3000);
    expect(result.companyBreakdown).toEqual([
      { companyCode: "ATA", presentCount: 2, allocatedCost: 2000 },
    ]);
  });

  it("shows every company for HRD_CENTER", async () => {
    const client = buildClient({
      training_plan_oap: oapPlanned({ company_id: null }),
      training_expense: [{ expense_category: "ACCOMMODATION", amount: 3000 }],
      training_enrollment: [
        enrollment("1", "ATA", "PRESENT"),
        enrollment("1", "ATA", "PRESENT"),
        enrollment("2", "TEP", "PRESENT"),
      ],
    });

    const repo = createTrainingRecordRepository(client as any);
    const result = await repo.getCostBreakdown("13", centerPrincipal);

    expect(result.companyBreakdown).toEqual(
      expect.arrayContaining([
        { companyCode: "ATA", presentCount: 2, allocatedCost: 2000 },
        { companyCode: "TEP", presentCount: 1, allocatedCost: 1000 },
      ]),
    );
  });

  it("rejects HRD_FACTORY who neither owns the plan nor has any employee enrolled", async () => {
    const client = buildClient({
      training_plan_oap: oapPlanned({ company_id: BigInt(9) }),
      training_expense: [],
      training_enrollment: [enrollment("9", "OTHER", "PRESENT")],
    });

    const repo = createTrainingRecordRepository(client as any);
    await expect(repo.getCostBreakdown("14", factoryPrincipal("1"))).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("falls back to the legacy lump-sum budget when no category breakdown was ever entered", async () => {
    const client = buildClient({
      training_plan_oap: oapPlanned({ company_id: BigInt(1), total_planned_budget: 15000 }),
      training_expense: [],
      training_enrollment: [],
    });

    const repo = createTrainingRecordRepository(client as any);
    const result = await repo.getCostBreakdown("15", centerPrincipal);

    expect(result.plannedGrandTotal).toBe(15000);
  });
});
