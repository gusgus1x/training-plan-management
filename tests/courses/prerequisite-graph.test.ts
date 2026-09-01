import { describe, expect, it } from "vitest";
import {
  collectTransitivePrerequisites,
  courseIdsThatWouldCycle,
} from "../../app/lib/courses/prerequisiteGraph";

/**
 * The enrolment gate reads only a course's own direct prerequisite list. Naming B as a prerequisite
 * of C therefore does NOT require A as well, even though B itself requires A - an employee HRD
 * waved past A on their way into B walks straight into C. `collectTransitivePrerequisites` is what
 * the Course Master screen uses to fill that gap in for whoever is editing.
 *
 * `graph` maps a course id to the ids it requires completed first.
 */
describe("collectTransitivePrerequisites", () => {
  it("returns the prerequisite of a prerequisite: picking B pulls in A", () => {
    const graph = new Map([["B", ["A"]]]);
    expect(collectTransitivePrerequisites(graph, ["B"])).toEqual(["A"]);
  });

  it("walks a chain more than one step deep", () => {
    const graph = new Map([
      ["C", ["B"]],
      ["B", ["A"]],
    ]);
    expect(collectTransitivePrerequisites(graph, ["C"]).sort()).toEqual(["A", "B"]);
  });

  it("returns nothing for a course with no prerequisites", () => {
    expect(collectTransitivePrerequisites(new Map(), ["A"])).toEqual([]);
  });

  it("never lists an id that was already picked", () => {
    const graph = new Map([
      ["C", ["B"]],
      ["B", ["A"]],
    ]);
    expect(collectTransitivePrerequisites(graph, ["C", "B"])).toEqual(["A"]);
  });

  it("reports a shared ancestor once, not once per branch", () => {
    const graph = new Map([
      ["D", ["B", "C"]],
      ["B", ["A"]],
      ["C", ["A"]],
    ]);
    expect(collectTransitivePrerequisites(graph, ["D"]).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("courseIdsThatWouldCycle", () => {
  it("blocks a course that already sits downstream", () => {
    // B requires A. Offering B as a prerequisite of A would close the loop.
    const graph = new Map([["B", ["A"]]]);
    expect([...courseIdsThatWouldCycle(graph, "A", ["B", "C"])]).toEqual(["B"]);
  });

  it("blocks a course further down the chain, not just the direct child", () => {
    const graph = new Map([
      ["C", ["B"]],
      ["B", ["A"]],
    ]);
    expect([...courseIdsThatWouldCycle(graph, "A", ["C"])]).toEqual(["C"]);
  });

  it("blocks the course itself", () => {
    expect([...courseIdsThatWouldCycle(new Map(), "A", ["A"])]).toEqual(["A"]);
  });

  it("blocks nothing when no candidate leads back", () => {
    const graph = new Map([["B", ["A"]]]);
    expect([...courseIdsThatWouldCycle(graph, "C", ["A", "B"])]).toEqual([]);
  });
});
