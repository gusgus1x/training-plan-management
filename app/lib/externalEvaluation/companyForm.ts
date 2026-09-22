import type { SectionAverageGroup } from "../trainingForms/sectionAverages";
import type { ReportSection, SectionAssignment } from "./sections";

/**
 * "แบบฟอร์มสำหรับบริษัท": the company's own evaluation form, whose shape is fixed by the paste-in
 * table of `app/Excel/1. Evaluation Form.xlsx` (sheet 01-Database, rows 8-9). After the five
 * respondent columns B-F come 19 question columns in five bands:
 *
 *   G-L Part 2 (6) · M-O Part 2 (3) · P-R Part 2 (3) · S-W Part 3 (5) · X-Y Part 4 (2)
 *
 * A form of exactly that shape is grouped for HRD instead of by hand. Anything else goes through the
 * normal mode, where the sections are HRD's to make.
 */
export const COMPANY_FORM_GROUPS = [
  { size: 6, name: "Part 2 : " },
  { size: 3, name: "Part 2 : " },
  { size: 3, name: "Part 2 : " },
  { size: 5, name: "Part 3 : " },
  { size: 2, name: "Part 4 : " },
] as const;

export const COMPANY_FORM_QUESTION_COUNT = COMPANY_FORM_GROUPS.reduce((total, group) => total + group.size, 0);

/** Part 4, the two written questions: the only comments the report page shows in this layout. */
export const COMPANY_FORM_COMMENT_GROUP = COMPANY_FORM_GROUPS.length - 1;

export const fitsCompanyForm = (groupSizes: number[]) =>
  groupSizes.length === COMPANY_FORM_GROUPS.length &&
  groupSizes.every((size, index) => size === COMPANY_FORM_GROUPS[index].size);

/**
 * Converter: the question columns, in file order, dealt into the five bands. Null when the count is
 * not the form's - the caller warns and points HRD at the normal mode.
 */
export const companyFormGrouping = (
  questionColumnIndexes: number[],
): { sections: ReportSection[]; assignment: SectionAssignment } | null => {
  if (questionColumnIndexes.length !== COMPANY_FORM_QUESTION_COUNT) return null;
  const sections: ReportSection[] = COMPANY_FORM_GROUPS.map((group, index) => ({
    id: `company-${index}`,
    name: group.name,
    showComments: index === COMPANY_FORM_COMMENT_GROUP,
  }));
  const assignment: SectionAssignment = {};
  let next = 0;
  COMPANY_FORM_GROUPS.forEach((group, groupIndex) => {
    for (let i = 0; i < group.size; i += 1) assignment[questionColumnIndexes[next++]] = sections[groupIndex].id;
  });
  return { sections, assignment };
};

/**
 * In-system form: how many columns one section fills in the paste-in table. A rating or a written
 * question is one; a grid is one per row, the way Forms exports it.
 */
export const inSystemGroupSize = (group: SectionAverageGroup) =>
  group.averages.length +
  group.choices.length +
  group.checkboxGrids.reduce((total, question) => total + question.gridRows.length, 0) +
  group.texts.length;

export const inSystemFitsCompanyForm = (groups: SectionAverageGroup[]) => fitsCompanyForm(groups.map(inSystemGroupSize));
