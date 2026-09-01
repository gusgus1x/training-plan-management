/**
 * Prerequisite graph maths, kept free of every import so both sides can use it: the repository
 * validates a save against the database, and the Course Master screen runs the same rules against
 * the course list it already has in memory. Living in repository.ts, these would drag Prisma into
 * the client bundle.
 *
 * `PrerequisiteGraph` maps a course id to the ids it requires completed first - the same direction
 * the course_prerequisite table stores (course_id -> prerequisite_course_id).
 */
export type PrerequisiteGraph = Map<string, string[]>;

/**
 * A → B → A leaves both courses impossible to register for, forever. Walks forward from the
 * prerequisites about to be attached to `courseId` and asks whether that walk ever leads back to
 * `courseId` itself.
 */
export const wouldCreateCycle = (
  graph: PrerequisiteGraph,
  courseId: string,
  newPrerequisiteIds: string[],
): boolean => {
  const visited = new Set<string>();
  const queue = [...newPrerequisiteIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === courseId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...(graph.get(current) ?? []));
  }
  return false;
};

/**
 * Every course reachable upward from `courseIds`, excluding the starting ids themselves.
 *
 * The enrolment gate only ever checks a course's own direct list - it does not walk the chain. So
 * naming B as a prerequisite of C does NOT quietly require A as well, even when B requires A: an
 * employee HRD waved past A on their way into B would sail straight into C. This is what the
 * screen uses to fill those courses in for the person editing, rather than leaving the gap to be
 * discovered by whoever slips through it.
 */
export const collectTransitivePrerequisites = (
  graph: PrerequisiteGraph,
  courseIds: string[],
): string[] => {
  const start = new Set(courseIds);
  const found = new Set<string>();
  const queue = courseIds.flatMap((id) => graph.get(id) ?? []);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (found.has(current)) continue;
    found.add(current);
    queue.push(...(graph.get(current) ?? []));
  }
  // A cycle would put a starting id back in its own ancestry; the save-time guard rejects those, so
  // never hand one back as something to add.
  return [...found].filter((id) => !start.has(id));
};

/** Which of `candidateIds` cannot become a prerequisite of `courseId` without creating a cycle. */
export const courseIdsThatWouldCycle = (
  graph: PrerequisiteGraph,
  courseId: string,
  candidateIds: string[],
): Set<string> =>
  new Set(candidateIds.filter((id) => id === courseId || wouldCreateCycle(graph, courseId, [id])));
