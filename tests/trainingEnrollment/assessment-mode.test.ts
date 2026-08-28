import { describe, expect, it } from "vitest";
import { assessmentStage } from "../../app/lib/trainingEnrollment/types";

// A course configures each stage as an in-system form, somebody else's link, or nothing at all.
// The three are not interchangeable: NONE means there is no score to record, and putting one on a
// record the employee hands to an employer would be a mark for an exam that never happened.
describe("how a course assesses one stage", () => {
  it("is FORM when the course points at an assessment in this system", () => {
    expect(assessmentStage(BigInt(7), null)).toEqual({ mode: "FORM", link: null });
  });

  it("is LINK when the course only carries an external address", () => {
    expect(assessmentStage(null, "https://forms.example.com/abc")).toEqual({
      mode: "LINK",
      link: "https://forms.example.com/abc",
    });
  });

  it("is NONE when the course carries neither", () => {
    expect(assessmentStage(null, null)).toEqual({ mode: "NONE", link: null });
  });

  it("treats a blank link as no link rather than an empty destination", () => {
    // A stored "   " would otherwise render an Open button that navigates nowhere.
    expect(assessmentStage(null, "   ")).toEqual({ mode: "NONE", link: null });
  });

  it("prefers the in-system form when a course somehow carries both", () => {
    // The form is the copy this system can read a score from; the link cannot be graded here.
    expect(assessmentStage(BigInt(7), "https://forms.example.com/abc")).toEqual({
      mode: "FORM",
      link: null,
    });
  });

  it("trims a link so a stray space cannot break the destination", () => {
    expect(assessmentStage(null, "  https://forms.example.com/abc  ").link).toBe(
      "https://forms.example.com/abc",
    );
  });
});
