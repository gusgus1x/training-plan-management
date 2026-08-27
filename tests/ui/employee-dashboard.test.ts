import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countdownLabel,
  daysUntil,
  initialsOf,
} from "../../app/components/employee/UserDashboard";

afterEach(() => {
  vi.useRealTimers();
});

// The dashboard tells the employee how long they have before a training. Counting in milliseconds
// would make a course starting later today read as "in 0 days" or, worse, as already past.
const atLocalTime = (year: number, month: number, day: number, hour: number) =>
  new Date(year, month - 1, day, hour, 0, 0);

describe("countdown to the next training", () => {
  it("calls a training later today 'today', not overdue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(atLocalTime(2026, 8, 27, 8));

    const days = daysUntil(atLocalTime(2026, 8, 27, 17).toISOString());

    expect(days).toBe(0);
    expect(countdownLabel(days!, "en")).toBe("Today");
    expect(countdownLabel(days!, "th")).toBe("วันนี้");
  });

  it("counts calendar days, not 24-hour blocks", () => {
    vi.useFakeTimers();
    // 23:00 today to 08:00 tomorrow is nine hours, but it is still tomorrow.
    vi.setSystemTime(atLocalTime(2026, 8, 27, 23));

    expect(daysUntil(atLocalTime(2026, 8, 28, 8).toISOString())).toBe(1);
    expect(countdownLabel(1, "en")).toBe("Tomorrow");
    expect(countdownLabel(1, "th")).toBe("พรุ่งนี้");
  });

  it("reports a training already under way rather than a negative countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(atLocalTime(2026, 8, 27, 12));

    const days = daysUntil(atLocalTime(2026, 8, 26, 9).toISOString());

    expect(days).toBe(-1);
    expect(countdownLabel(days!, "en")).toBe("In progress");
    expect(countdownLabel(days!, "th")).toBe("กำลังดำเนินการ");
  });

  it("returns null for a date it cannot read instead of rendering NaN", () => {
    expect(daysUntil("not a date")).toBeNull();
  });
});

describe("avatar initials", () => {
  it("uses the first letter of the first two words", () => {
    expect(initialsOf("Somchai Jaidee")).toBe("SJ");
  });

  it("falls back to the first two letters of a single word", () => {
    expect(initialsOf("somchai")).toBe("SO");
  });

  it("survives an empty or blank name", () => {
    expect(initialsOf("")).toBe("EU");
    expect(initialsOf("   ")).toBe("EU");
  });
});
