import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import { employeePath } from "./employeePaths";

/** My Record, opened on this enrollment's own card: attended courses live under the completed tab.
 *  `at` makes a repeat visit to the same card still count as a new navigation. */
export const recordFocusHref = (enrollment: EnrollmentRecord, now = Date.now()) =>
  employeePath("record", enrollment.attendance?.status === "PRESENT" ? "completed" : "pending", { focus: enrollment.id, at: now });
