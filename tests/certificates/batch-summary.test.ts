import { describe, expect, it } from "vitest";
import {
  certificateBatchSummary,
  withDuplicatesMarked,
  type CertificateCard,
  type CertificateCardState,
} from "../../app/lib/certificates/types";

const card = (
  certificateFileId: string,
  state: CertificateCardState,
  employeeUserId: string | null = `u-${certificateFileId}`,
): CertificateCard => ({
  certificateFileId,
  fileName: `${certificateFileId}_x.pdf`,
  employeeUserId,
  employeeCode: employeeUserId ? `C-${employeeUserId}` : null,
  employeeName: employeeUserId ? `Employee ${employeeUserId}` : null,
  state,
});

describe("certificateBatchSummary", () => {
  it("counts a clean batch and allows confirming it", () => {
    const summary = certificateBatchSummary([card("1", "MATCHED"), card("2", "MANUAL")]);
    expect(summary).toMatchObject({ total: 2, matched: 2, notOnPlan: 0, duplicate: 0, canConfirm: true });
  });

  it("counts a REPLACE card as matched and still allows confirming", () => {
    // Replacing an existing certificate is a normal correction, not an error to block on.
    const summary = certificateBatchSummary([card("1", "REPLACE")]);
    expect(summary).toMatchObject({ matched: 1, replace: 1, canConfirm: true });
  });

  it("blocks confirming while any file belongs to nobody on the plan", () => {
    expect(certificateBatchSummary([card("1", "MATCHED"), card("2", "NOT_ON_PLAN")]).canConfirm).toBe(false);
  });

  it("blocks confirming while two files claim the same person", () => {
    expect(certificateBatchSummary([card("1", "DUPLICATE"), card("2", "DUPLICATE")]).canConfirm).toBe(false);
  });

  it("cannot confirm an empty batch", () => {
    expect(certificateBatchSummary([]).canConfirm).toBe(false);
  });
});

describe("withDuplicatesMarked", () => {
  it("flags both cards when two resolve to one employee", () => {
    const marked = withDuplicatesMarked([
      card("1", "MATCHED", "u-1"),
      card("2", "MANUAL", "u-1"),
      card("3", "MATCHED", "u-3"),
    ]);
    expect(marked.map((entry) => entry.state)).toEqual(["DUPLICATE", "DUPLICATE", "MATCHED"]);
  });

  it("leaves unresolved cards alone rather than pairing them by their shared null", () => {
    const marked = withDuplicatesMarked([card("1", "NOT_ON_PLAN", null), card("2", "NOT_ON_PLAN", null)]);
    expect(marked.map((entry) => entry.state)).toEqual(["NOT_ON_PLAN", "NOT_ON_PLAN"]);
  });
});
