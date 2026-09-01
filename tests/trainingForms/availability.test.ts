import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_OPENS_AFTER_DAYS,
  stageAvailability,
  stageOpensAt,
} from "../../app/lib/trainingForms/availability";

const START = "2026-09-10T02:00:00.000Z";
const END = "2026-09-11T10:00:00.000Z";

describe("stageOpensAt", () => {
  it("opens PRE_TEST, POST_TEST and EVALUATION at the plan's start", () => {
    expect(stageOpensAt("PRE_TEST", START, END)).toBe(START);
    expect(stageOpensAt("POST_TEST", START, END)).toBe(START);
    // The stage most likely to be miswired to endAt instead of startAt.
    expect(stageOpensAt("EVALUATION", START, END)).toBe(START);
  });

  it("opens EVALUATION_30DAY 25 days after the plan's end, not its start", () => {
    const opensAt = stageOpensAt("EVALUATION_30DAY", START, END);
    const expected = new Date(END);
    expected.setUTCDate(expected.getUTCDate() + FOLLOW_UP_OPENS_AFTER_DAYS);
    expect(opensAt).toBe(expected.toISOString());
    expect(opensAt).not.toBe(stageOpensAt("EVALUATION_30DAY", START, START));
  });
});

describe("stageAvailability - date boundaries", () => {
  it("is NOT_YET one second before the opening instant", () => {
    const oneSecondBefore = new Date(new Date(START).getTime() - 1000);
    expect(stageAvailability("PRE_TEST", START, END, null, oneSecondBefore).state).toBe("NOT_YET");
  });

  it("is OPEN at the exact opening instant", () => {
    expect(stageAvailability("PRE_TEST", START, END, null, new Date(START)).state).toBe("OPEN");
  });

  it("EVALUATION_30DAY is NOT_YET at end+24 days and OPEN at end+25 days", () => {
    const at24Days = new Date(END);
    at24Days.setUTCDate(at24Days.getUTCDate() + 24);
    expect(stageAvailability("EVALUATION_30DAY", START, END, null, at24Days).state).toBe("NOT_YET");

    const at25Days = new Date(END);
    at25Days.setUTCDate(at25Days.getUTCDate() + FOLLOW_UP_OPENS_AFTER_DAYS);
    expect(stageAvailability("EVALUATION_30DAY", START, END, null, at25Days).state).toBe("OPEN");
  });
});

describe("stageAvailability - HRD close switch (PRE_TEST/POST_TEST only)", () => {
  it("CLOSED_BY_HRD wins over an open date that has already passed", () => {
    const wellAfterOpen = new Date(new Date(START).getTime() + 1000 * 60 * 60 * 24);
    const result = stageAvailability("POST_TEST", START, END, "2026-09-10T03:00:00.000Z", wellAfterOpen);
    expect(result.state).toBe("CLOSED_BY_HRD");
  });

  it("a closedAt set before the opening date does not lie about why it's unavailable", () => {
    // HRD closed it pre-emptively, but the stage was never open yet anyway - the reason shown to
    // the employee should be "not open yet", not "HRD closed this", which would be false.
    const beforeOpen = new Date(new Date(START).getTime() - 1000);
    const result = stageAvailability("PRE_TEST", START, END, "2026-09-01T00:00:00.000Z", beforeOpen);
    expect(result.state).toBe("NOT_YET");
  });

  it("closedAt has no effect on EVALUATION or EVALUATION_30DAY - there is no close switch for them", () => {
    const wellAfterOpen = new Date(new Date(START).getTime() + 1000 * 60 * 60 * 24);
    const withClosedAt = stageAvailability("EVALUATION", START, END, "2026-09-10T03:00:00.000Z", wellAfterOpen);
    const withoutClosedAt = stageAvailability("EVALUATION", START, END, null, wellAfterOpen);
    expect(withClosedAt.state).toBe("OPEN");
    expect(withClosedAt).toEqual(withoutClosedAt);
  });
});
