import { describe, expect, it } from "vitest";
import {
  companyFormGrouping,
  COMPANY_FORM_QUESTION_COUNT,
  fitsCompanyForm,
  inSystemGroupSize,
} from "../../app/lib/externalEvaluation/companyForm";
import type { SectionAverageGroup } from "../../app/lib/trainingForms/sectionAverages";

describe("company form shape", () => {
  it("is the paste-in table of 1. Evaluation Form.xlsx: 19 questions in 6/3/3/5/2", () => {
    expect(COMPANY_FORM_QUESTION_COUNT).toBe(19);
    expect(fitsCompanyForm([6, 3, 3, 5, 2])).toBe(true);
    expect(fitsCompanyForm([6, 3, 3, 5])).toBe(false);
    expect(fitsCompanyForm([3, 6, 3, 5, 2])).toBe(false);
  });

  it("deals the converter's question columns into the five bands in file order", () => {
    const columns = Array.from({ length: 19 }, (_, index) => index + 5);
    const grouping = companyFormGrouping(columns)!;
    expect(grouping.sections.map((section) => section.name)).toEqual([
      "Part 2 : ",
      "Part 2 : ",
      "Part 2 : ",
      "Part 3 : ",
      "Part 4 : ",
    ]);
    // Only Part 4 keeps its comments on the report page.
    expect(grouping.sections.map((section) => section.showComments)).toEqual([false, false, false, false, true]);
    const sizes = grouping.sections.map((section) => Object.values(grouping.assignment).filter((id) => id === section.id).length);
    expect(sizes).toEqual([6, 3, 3, 5, 2]);
    expect(grouping.assignment[5]).toBe("company-0");
    expect(grouping.assignment[23]).toBe("company-4");
  });

  it("refuses a file with any other number of questions", () => {
    expect(companyFormGrouping(Array.from({ length: 18 }, (_, index) => index))).toBeNull();
    expect(companyFormGrouping(Array.from({ length: 20 }, (_, index) => index))).toBeNull();
  });

  it("counts an in-system section the way Forms exports it: a grid is one column per row", () => {
    const group = {
      name: "Part 3",
      averages: [{}, {}],
      choices: [{}],
      checkboxGrids: [{ gridRows: [{}, {}] }],
      texts: [],
    } as unknown as SectionAverageGroup;
    expect(inSystemGroupSize(group)).toBe(5);
  });
});
