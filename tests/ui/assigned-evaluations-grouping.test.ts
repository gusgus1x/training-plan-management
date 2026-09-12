import { describe, expect, it } from "vitest";
import { groupByRound } from "../../app/components/employee/AssignedEvaluations";
import type { AssignedEvaluation } from "../../app/lib/trainingForms/types";

/**
 * A supervisor reads this list to see which of their people went on what. So the grouping is the
 * screen: one round of one course said once, with the names under it.
 */

const assignment = (overrides: Partial<AssignedEvaluation>): AssignedEvaluation => ({
  enrollmentId: "1",
  stage: "EVALUATION_30DAY",
  attendeeName: "นาย ทดสอบ ระบบ",
  attendeeEmployeeCode: "E-001",
  courseName: "Way of working",
  batchName: "4",
  startAt: "2026-08-11T02:00:00.000Z",
  endAt: "2026-08-11T09:00:00.000Z",
  mode: "FORM",
  link: null,
  opensAt: "2026-09-10T02:00:00.000Z",
  isOpen: true,
  openedAt: null,
  submitted: false,
  ...overrides,
});

describe("groupByRound", () => {
  it("gathers everybody on the same round under one heading", () => {
    const groups = groupByRound([
      assignment({ enrollmentId: "1", attendeeName: "คนที่หนึ่ง" }),
      assignment({ enrollmentId: "2", attendeeName: "คนที่สอง" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].courseName).toBe("Way of working");
    expect(groups[0].rows.map((row) => row.attendeeName)).toEqual(["คนที่หนึ่ง", "คนที่สอง"]);
  });

  it("keeps two rounds of the same course apart", () => {
    const groups = groupByRound([
      assignment({ enrollmentId: "1", batchName: "4" }),
      assignment({ enrollmentId: "2", batchName: "5", startAt: "2026-09-01T02:00:00.000Z" }),
    ]);

    expect(groups.map((group) => group.batchName)).toEqual(["5", "4"]);
  });

  it("keeps the two evaluations of one round apart", () => {
    // The same people on the same round owe two different forms, and answering one says nothing
    // about the other.
    const groups = groupByRound([
      assignment({ enrollmentId: "1", stage: "EVALUATION" }),
      assignment({ enrollmentId: "1", stage: "EVALUATION_30DAY" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((group) => group.stage))).toEqual(new Set(["EVALUATION", "EVALUATION_30DAY"]));
  });

  it("puts the most recent round first", () => {
    const groups = groupByRound([
      assignment({ enrollmentId: "1", courseName: "เก่า", startAt: "2026-01-05T02:00:00.000Z" }),
      assignment({ enrollmentId: "2", courseName: "ใหม่", startAt: "2026-08-11T02:00:00.000Z" }),
    ]);

    expect(groups.map((group) => group.courseName)).toEqual(["ใหม่", "เก่า"]);
  });
});
