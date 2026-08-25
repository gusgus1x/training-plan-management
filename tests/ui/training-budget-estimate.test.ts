import { describe, expect, it } from "vitest";
import { calculateBudgetEstimate, formatBaht } from "../../app/lib/trainingBudgetEstimate";

describe("calculateBudgetEstimate", () => {
  it("splits the budget by head count and the head count by company", () => {
    const result = calculateBudgetEstimate({
      totalBudget: "36000",
      participants: "36",
      companyCount: 6,
    });

    expect(result.costPerPerson).toBe(1000);
    expect(result.seatsPerCompany).toBe(6);
    expect(result.costPerCompany).toBe(6000);
  });

  it("floors the seats — a company cannot send a fraction of a person", () => {
    const result = calculateBudgetEstimate({
      totalBudget: "10000",
      participants: "20",
      companyCount: 6,
    });

    expect(result.seatsPerCompany).toBe(3);
    expect(result.costPerCompany).toBe(1500);
  });

  it("returns null instead of dividing by zero when nobody is planned", () => {
    const result = calculateBudgetEstimate({
      totalBudget: "10000",
      participants: "0",
      companyCount: 6,
    });

    expect(result.costPerPerson).toBeNull();
    expect(result.seatsPerCompany).toBeNull();
    expect(result.costPerCompany).toBeNull();
  });

  it("returns null per-company figures when no target company is set", () => {
    const result = calculateBudgetEstimate({
      totalBudget: "10000",
      participants: "20",
      companyCount: 0,
    });

    expect(result.costPerPerson).toBe(500);
    expect(result.seatsPerCompany).toBeNull();
    expect(result.costPerCompany).toBeNull();
  });

  it("reads budgets that arrive already formatted", () => {
    const result = calculateBudgetEstimate({
      totalBudget: "฿36,000",
      participants: "36",
      companyCount: 6,
    });

    expect(result.totalBudget).toBe(36000);
    expect(result.costPerPerson).toBe(1000);
  });

  it("shows a dash rather than a misleading zero", () => {
    expect(formatBaht(null)).toBe("-");
    expect(formatBaht(1500)).toBe("฿1,500");
  });
});
