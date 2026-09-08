// Page-break and branching arithmetic for a form the learner is filling in.
//
// Kept free of React and Prisma so the only genuinely non-trivial logic in the section feature can
// be tested directly. TrainingFormRunner renders whatever these functions decide; it does not
// decide anything itself.
//
// A section is a run of items. Section 1 is everything before the first SECTION_BREAK; each break
// opens the next section and is that section's first item, so its title and description render as
// the page heading.
//
// Branch targets are 1-based section ordinals, never ids: both repositories delete and recreate
// every question row on save, so an id-based target would dangle immediately.

import { isFormBlockType, SUBMIT_SECTION } from "../formBlocks";

export type FlowOption = {
  id: string;
  /** 1-based section to jump to when this option is chosen, or null for no branch. */
  nextSection: number | null;
};

export type FlowItem = {
  questionId: string;
  /** Raw question_type, blocks included. */
  type: string;
  isRequired: boolean;
  /** Meaningful on SECTION_BREAK only: the section's default "after this section" target. */
  nextSection: number | null;
  options: FlowOption[];
};

export type FlowSection = {
  /** 1-based. */
  index: number;
  items: FlowItem[];
};

/** questionId -> the option ids chosen for it. */
export type SelectedByQuestion = Record<string, string[]>;

const SECTION_BREAK = "SECTION_BREAK";

export const splitSections = (items: readonly FlowItem[]): FlowSection[] => {
  const sections: FlowSection[] = [{ index: 1, items: [] }];
  for (const item of items) {
    if (item.type === SECTION_BREAK) sections.push({ index: sections.length + 1, items: [item] });
    else sections[sections.length - 1].items.push(item);
  }
  return sections;
};

/**
 * Where the learner goes after finishing `currentIndex`. Returns null when the form is finished.
 *
 * The LAST answered single-choice question in the section whose chosen option carries a target
 * wins. Google Forms resolves the same way, and "last" is what a respondent expects when one
 * section holds two branching questions: the one they answered nearest the Next button.
 */
export const resolveNextSection = (
  sections: readonly FlowSection[],
  currentIndex: number,
  selected: SelectedByQuestion,
): number | null => {
  const section = sections.find((candidate) => candidate.index === currentIndex);
  if (!section) return null;

  let target: number | null = null;
  for (const item of section.items) {
    const chosen = selected[item.questionId] ?? [];
    // A multi-select has no single answer to branch on, and validation rejects targets on one, so
    // only a lone selection can steer.
    if (chosen.length !== 1) continue;
    const option = item.options.find((candidate) => candidate.id === chosen[0]);
    if (option?.nextSection != null) target = option.nextSection;
  }

  const breakItem = section.items.find((item) => item.type === SECTION_BREAK);
  // `??` and not `||`: SUBMIT_SECTION is 0, which is falsy but is a real instruction ("end here")
  // and must not fall through to the section's own default or to the next section in order.
  const next = target ?? breakItem?.nextSection ?? currentIndex + 1;
  if (next === SUBMIT_SECTION) return null;
  return next > sections.length ? null : next;
};

/**
 * The sections the learner actually walks, given their answers so far. Sections a branch jumps over
 * never appear, which is what makes their required questions genuinely optional rather than an
 * unreachable block on the submit button.
 */
export const visitedPath = (
  sections: readonly FlowSection[],
  selected: SelectedByQuestion,
): number[] => {
  if (!sections.length) return [];
  const path: number[] = [];
  const seen = new Set<number>();
  let current: number | null = 1;
  // Validation forbids backwards targets, so this cannot cycle. The guard is here so a row written
  // before that rule existed cannot hang the browser.
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    path.push(current);
    current = resolveNextSection(sections, current, selected);
  }
  return path;
};

/** Every answerable item on the visited path, in order. Blocks are never answerable. */
export const visitedItems = (
  sections: readonly FlowSection[],
  selected: SelectedByQuestion,
): FlowItem[] => {
  const bySection = new Map(sections.map((section) => [section.index, section]));
  return visitedPath(sections, selected).flatMap((index) =>
    (bySection.get(index)?.items ?? []).filter((item) => !isFormBlockType(item.type)));
};
