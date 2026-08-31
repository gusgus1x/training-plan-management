import { describe, expect, it } from "vitest";
import { getLocalDateString } from "../../app/lib/calendarDate";

/**
 * Two screens built "today" with `new Date().toISOString().slice(0, 10)` and used it as the
 * fallback training date. That answers in UTC, so in Thailand (UTC+7) every local time before 07:00
 * yields the previous day: a rolling session saved at 08:30 on 5 March with the date field left
 * blank was created for 4 March — a day already past.
 *
 * These assertions build dates with the local-time constructor, so they hold in any timezone and
 * pin the behaviour to the local calendar rather than to the runner's offset. On a machine set to
 * UTC the old implementation would also have passed the first case, which is exactly why the bug
 * survived: it is invisible until the clock is east of Greenwich.
 */
describe("getLocalDateString", () => {
  it.each([
    ["early morning, the case that broke", new Date(2026, 2, 5, 0, 30), "2026-03-05"],
    ["mid-morning", new Date(2026, 2, 5, 8, 30), "2026-03-05"],
    ["late evening", new Date(2026, 2, 5, 23, 45), "2026-03-05"],
  ])("reads the local calendar day: %s", (_label, date, expected) => {
    expect(getLocalDateString(date)).toBe(expected);
  });

  it("zero-pads single-digit months and days", () => {
    expect(getLocalDateString(new Date(2026, 0, 9, 12, 0))).toBe("2026-01-09");
  });

  it("agrees with the local getters rather than the UTC ones", () => {
    // Whatever the runner's timezone, the answer must be what the browser would call today.
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

    expect(getLocalDateString(now)).toBe(local);
  });
});
