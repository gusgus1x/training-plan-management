import { describe, expect, it } from "vitest";
import { clockRemaining, pausedClock, runningClock } from "../../app/components/employee/TrainingFormRunner";

/**
 * A timed test's clock runs only while the form is on screen, so the time somebody spends off it -
 * a dropped connection, a closed laptop, another tab - costs them nothing. What that rests on is
 * this arithmetic: banking what has run when it stops, and never counting the gap.
 */

const MINUTE = 60_000;

describe("the form clock", () => {
  it("counts down only while it is running", () => {
    const started = { remainingMs: 10 * MINUTE, runningSince: 1_000_000 };

    expect(clockRemaining(started, 1_000_000 + 2 * MINUTE)).toBe(8 * MINUTE);

    const paused = pausedClock(started, 1_000_000 + 2 * MINUTE);
    // An hour away from the form, and it still has the eight minutes it was left with.
    expect(clockRemaining(paused, 1_000_000 + 62 * MINUTE)).toBe(8 * MINUTE);
  });

  it("starts again from where it stopped", () => {
    const paused = { remainingMs: 8 * MINUTE, runningSince: null };
    const resumed = runningClock(paused, 5_000_000);

    expect(clockRemaining(resumed, 5_000_000)).toBe(8 * MINUTE);
    expect(clockRemaining(resumed, 5_000_000 + 3 * MINUTE)).toBe(5 * MINUTE);
  });

  it("ignores a second pause or a second start", () => {
    const running = { remainingMs: 10 * MINUTE, runningSince: 1_000_000 };
    const paused = pausedClock(running, 1_000_000 + MINUTE);

    // Losing focus and then hiding the tab must not bank the same minute twice.
    expect(pausedClock(paused, 1_000_000 + 5 * MINUTE)).toEqual(paused);
    // And coming back twice must not restart the clock from the later moment.
    expect(runningClock(running, 9_000_000)).toEqual(running);
  });

  it("never reports less than nothing left", () => {
    const running = { remainingMs: MINUTE, runningSince: 1_000_000 };

    expect(clockRemaining(running, 1_000_000 + 10 * MINUTE)).toBe(0);
    expect(pausedClock(running, 1_000_000 + 10 * MINUTE).remainingMs).toBe(0);
  });
});
