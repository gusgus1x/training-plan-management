import type { CertificateCandidate } from "./types";

/**
 * Maps an uploaded filename to a person.
 *
 * The rule HRD is given is: SAP UserID first, then `_`, then the employee's name.
 *   12345_สมชาย ใจดี.pdf
 *
 * Anchoring the id at the front is what makes this safe. The earlier idea - "find any user_id that
 * appears anywhere in the name" - silently mis-files whenever one id is a substring of another
 * (`123` inside `1234_สมชาย.pdf`), and the Draft stage only helps if HRD notices, which is exactly
 * what a confident, wrong name defeats. A leading delimited token has no such ambiguity.
 */

export type FilenameMatch =
  /** The leading token is the user_id of someone on this plan. */
  | { outcome: "MATCHED"; userId: string }
  /** Well-formed, but nobody in this batch has that id: wrong batch, or a typo in the id. */
  | { outcome: "NOT_ON_PLAN"; userId: string }
  /** No leading `<id>_` token at all - the filename does not follow the rule. */
  | { outcome: "INVALID_NAME"; userId: null };

const stripPdfExtension = (fileName: string): string => fileName.replace(/\.pdf$/i, "");

/** The leading token, or null when the name has no `_` to delimit one. */
export const leadingUserIdToken = (fileName: string): string | null => {
  const stem = stripPdfExtension(fileName);
  const separator = stem.indexOf("_");
  if (separator <= 0) return null;

  const token = stem.slice(0, separator).trim();
  return token || null;
};

export const matchCertificateFilename = (
  fileName: string,
  roster: readonly CertificateCandidate[],
): FilenameMatch => {
  const userId = leadingUserIdToken(fileName);
  if (userId === null) return { outcome: "INVALID_NAME", userId: null };

  // Compared as a string, never Number()-ed: user_id is NVARCHAR(50) and a leading zero is part of
  // the id, so "00123" and "123" are different people.
  const found = roster.some((candidate) => candidate.employeeUserId === userId);
  return found ? { outcome: "MATCHED", userId } : { outcome: "NOT_ON_PLAN", userId };
};
