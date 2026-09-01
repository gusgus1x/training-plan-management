import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "../../app/lib/courses/prerequisiteGraph";

/**
 * A -> B -> A leaves both courses impossible to register for, forever - `wouldCreateCycle` is the
 * guard the repository runs before writing a new edge. `graph` maps a course id to the ids it
 * already requires; `courseId` is the course about to gain `newPrerequisiteIds`.
 */
describe("wouldCreateCycle", () => {
  it("rejects a direct cycle: A requires B, B would require A", () => {
    const graph = new Map([["B", ["A"]]]);
    expect(wouldCreateCycle(graph, "A", ["B"])).toBe(true);
  });

  it("rejects a transitive cycle: A -> B -> C, C would require A", () => {
    const graph = new Map([
      ["A", ["B"]],
      ["B", ["C"]],
    ]);
    expect(wouldCreateCycle(graph, "C", ["A"])).toBe(true);
  });

  it("allows a normal chain: A -> B, C would require B", () => {
    const graph = new Map([["A", ["B"]]]);
    expect(wouldCreateCycle(graph, "C", ["B"])).toBe(false);
  });

  it("rejects a course requiring itself directly", () => {
    const graph = new Map<string, string[]>();
    expect(wouldCreateCycle(graph, "A", ["A"])).toBe(true);
  });

  it("allows unrelated prerequisites with no shared edges", () => {
    const graph = new Map([
      ["X", ["Y"]],
      ["Y", ["Z"]],
    ]);
    expect(wouldCreateCycle(graph, "A", ["X"])).toBe(false);
  });
});
