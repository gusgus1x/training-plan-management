// Converts the old per-question `section_name` label into real SECTION_BREAK rows.
//
// Before section breaks existed, an evaluation question carried a section_name picked from a fixed
// list of five strings. It was only ever a label - the editor never grouped by it and the learner
// saw at most a grey line. Now that a section is a real page break, the dropdown is gone.
//
// The conversion happens when a form is opened for editing rather than in SQL, for two reasons: no
// migration can get it wrong on forms nobody ever opens, and the author sees the result at the
// moment they can still fix it. It matters because the repository deletes and recreates every
// question row on save, so without this an old form would silently lose its grouping the first
// time anyone edited it.

export type LegacySectionRow = { sectionName: string | null };

/**
 * Indices in the original row list where a SECTION_BREAK should be inserted, ascending.
 *
 * A break goes wherever the section name changes from the previous row - never before the first
 * row, since everything up to the first break is already section 1. Rows with no section name do
 * not start a section; they simply continue whatever came before.
 */
export const legacySectionBreakPoints = (rows: readonly LegacySectionRow[]): number[] => {
  const points: number[] = [];
  let previous: string | null = null;
  rows.forEach((row, index) => {
    const name = row.sectionName?.trim() || null;
    if (name !== null && name !== previous && index > 0) points.push(index);
    if (name !== null) previous = name;
  });
  return points;
};

/** The section title to use for the break inserted at `index`. */
export const legacySectionTitleAt = (rows: readonly LegacySectionRow[], index: number): string =>
  rows[index]?.sectionName?.trim() || "Untitled section";
