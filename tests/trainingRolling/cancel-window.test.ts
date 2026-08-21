import { describe, expect, it } from "vitest";
import { canCancelSession } from "../../app/components/center_factory/TrainingPlanManagement/modules/TrainingRolling";

const now = new Date("2026-08-21T10:00:00");

describe("canCancelSession", () => {
  it("allows cancelling a published session before its training day", () => {
    expect(canCancelSession({ status: "Planned", trainingDate: "2026-09-09" }, now)).toBe(true);
  });

  it("allows cancelling on the training day itself", () => {
    expect(canCancelSession({ status: "Planned", trainingDate: "2026-08-21" }, now)).toBe(true);
  });

  it("refuses once the training day has passed", () => {
    expect(canCancelSession({ status: "Planned", trainingDate: "2026-08-20" }, now)).toBe(false);
  });

  it("refuses for drafts and already-cancelled sessions (those delete instead)", () => {
    expect(canCancelSession({ status: "Planning", trainingDate: "2026-09-09" }, now)).toBe(false);
    expect(canCancelSession({ status: "Cancel", trainingDate: "2026-09-09" }, now)).toBe(false);
  });
});
