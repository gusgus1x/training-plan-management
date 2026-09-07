/**
 * Certificate import: HRD uploads a batch of PDFs against one training plan, the system maps each
 * file to a person by the SAP UserID at the start of the filename, HRD checks and confirms, and the
 * employee then sees their own certificate.
 *
 * The two tables were designed in V6.2 Migration 12 and never used. The status vocabularies below
 * are ours to choose: neither `mapping_status`, `import_status`, `mapping_method` nor `status` has a
 * CHECK constraint (verified against the create script).
 */

/** Written to `training_certificate_file.mapping_method`, overriding the column's
 *  NATIONAL_ID_FILENAME default - this feature matches on user_id, and leaving the default would
 *  tell the next reader of the table that certificates were matched on national ID. */
export const MAPPING_METHOD = "USER_ID_FILENAME";

export const MAPPING_STATUS = {
  matched: "MATCHED",
  unmatched: "UNMATCHED",
  confirmed: "CONFIRMED",
  superseded: "SUPERSEDED",
} as const;

export const FILE_STATUS = { active: "ACTIVE", superseded: "SUPERSEDED" } as const;
export const BATCH_STATUS = { uploaded: "UPLOADED", confirmed: "CONFIRMED" } as const;

/** One approved attendee of the plan - the only people a certificate in this batch can belong to. */
export type CertificateCandidate = {
  enrollmentId: string;
  employeeUserId: string;
  employeeCode: string;
  employeeName: string;
};

export type CertificateCardState =
  | "MATCHED"
  | "NOT_ON_PLAN"
  | "MANUAL"
  | "DUPLICATE"
  | "REPLACE";

export type CertificateCard = {
  certificateFileId: string;
  fileName: string;
  employeeUserId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  state: CertificateCardState;
};

export type CertificateDraft = {
  batchId: string;
  importBatchCode: string;
  importedAt: string;
  cards: CertificateCard[];
};

/** A certificate already issued for this batch: confirmed by HRD and visible to the employee. */
export type IssuedCertificate = {
  certificateFileId: string;
  fileName: string;
  employeeUserId: string;
  employeeCode: string;
  employeeName: string;
  issuedAt: string;
};

export type CertificatePlanView = {
  roster: CertificateCandidate[];
  draft: CertificateDraft | null;
  /** Confirmed certificates for this batch, so HRD can see who has already been given one without
   *  re-uploading to find out. Also what makes a missing person obvious. */
  issued: IssuedCertificate[];
};

/** Files the server refused. They never reach disk or the database, so they have no id. */
export type CertificateUploadRejection = { fileName: string; reason: string };

export type CertificateUploadResult = {
  draft: CertificateDraft;
  rejected: CertificateUploadRejection[];
};

export type ConfirmCertificatesInput = {
  assignments: Array<{ certificateFileId: string; employeeUserId: string }>;
};

/** What rides along on an enrollment for the employee-facing screens. */
export type EnrollmentCertificate = {
  certificateFileId: string;
  fileName: string;
  issuedAt: string;
};

export type CertificateBatchSummary = {
  total: number;
  matched: number;
  notOnPlan: number;
  duplicate: number;
  replace: number;
  canConfirm: boolean;
};

/**
 * Pure, so the Save button's enabled state is testable without rendering anything. The counts map
 * straight onto certificate_import_batch's four count columns.
 */
export const certificateBatchSummary = (cards: readonly CertificateCard[]): CertificateBatchSummary => {
  const countOf = (state: CertificateCardState) => cards.filter((card) => card.state === state).length;

  const notOnPlan = countOf("NOT_ON_PLAN");
  const duplicate = countOf("DUPLICATE");

  return {
    total: cards.length,
    matched: countOf("MATCHED") + countOf("MANUAL") + countOf("REPLACE"),
    notOnPlan,
    duplicate,
    replace: countOf("REPLACE"),
    // An unresolved card is a certificate about to be filed under the wrong person, or under
    // nobody. Neither is worth letting through to save a click.
    canConfirm: cards.length > 0 && notOnPlan === 0 && duplicate === 0,
  };
};

/**
 * Marks every card whose employee another card already claims. Runs after any manual re-pick, so it
 * catches the case where HRD resolves two files onto the same person by hand.
 */
export const withDuplicatesMarked = (cards: readonly CertificateCard[]): CertificateCard[] => {
  const timesClaimed = new Map<string, number>();
  for (const card of cards) {
    if (!card.employeeUserId) continue;
    timesClaimed.set(card.employeeUserId, (timesClaimed.get(card.employeeUserId) ?? 0) + 1);
  }

  return cards.map((card) =>
    card.employeeUserId && (timesClaimed.get(card.employeeUserId) ?? 0) > 1
      ? { ...card, state: "DUPLICATE" as const }
      : card,
  );
};
