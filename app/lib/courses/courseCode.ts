const pad = (seq: number) => String(seq).padStart(6, "0");

/**
 * Builds a course_code. Shared by the repository (the real code) and Course Master (the preview).
 *
 * - Center course:                     `<group>-<seq>`                        e.g. OT-000001
 * - Company course:                    `<company>-<group>-<seq>`              e.g. ATA-OT-000002
 * - Company course copied from Center: `<company>-<group>-<center seq>-<seq>` e.g. ATA-OT-000001-000002
 *
 * `seq` is always the company's own running number (or the Center's, for a Center course), so
 * copied and self-written company courses share one sequence: findNextAvailableCourseCodeSeq reads
 * the last segment of every code.
 */
export const buildCourseCode = ({
  groupCode,
  seq,
  companyCode,
  centerCourseCode,
}: {
  groupCode: string;
  seq: number;
  companyCode?: string | null;
  centerCourseCode?: string | null;
}) => {
  const group = groupCode.trim();
  if (!companyCode) return `${group}-${pad(seq)}`;
  const centerSeq = centerCourseCode?.trim().split("-").pop();
  return centerSeq
    ? `${companyCode.trim()}-${group}-${centerSeq}-${pad(seq)}`
    : `${companyCode.trim()}-${group}-${pad(seq)}`;
};
