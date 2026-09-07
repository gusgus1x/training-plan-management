import { describe, expect, it } from "vitest";
import { leadingUserIdToken, matchCertificateFilename } from "../../app/lib/certificates/matching";
import type { CertificateCandidate } from "../../app/lib/certificates/types";

const candidate = (employeeUserId: string): CertificateCandidate => ({
  enrollmentId: `e-${employeeUserId}`,
  employeeUserId,
  employeeCode: `C-${employeeUserId}`,
  employeeName: `Employee ${employeeUserId}`,
});

describe("matchCertificateFilename", () => {
  it("matches the SAP UserID at the front of the filename", () => {
    expect(matchCertificateFilename("12345_สมชาย ใจดี.pdf", [candidate("12345")])).toEqual({
      outcome: "MATCHED",
      userId: "12345",
    });
  });

  it("refuses a name with the id anywhere but the front", () => {
    // The whole point of anchoring: this is the shape that used to mis-file silently.
    expect(matchCertificateFilename("สมชาย_12345.pdf", [candidate("12345")])).toEqual({
      outcome: "NOT_ON_PLAN",
      userId: "สมชาย",
    });
  });

  it("rejects a filename with no underscore at all", () => {
    expect(matchCertificateFilename("12345.pdf", [candidate("12345")])).toEqual({
      outcome: "INVALID_NAME",
      userId: null,
    });
  });

  it("rejects a filename that starts with the underscore", () => {
    expect(matchCertificateFilename("_สมชาย.pdf", [candidate("12345")])).toEqual({
      outcome: "INVALID_NAME",
      userId: null,
    });
  });

  it("never confuses an id with a longer one that contains it", () => {
    // "123" must not claim a file belonging to "1234". Anchoring makes this structural.
    expect(matchCertificateFilename("1234_สมชาย.pdf", [candidate("123")])).toEqual({
      outcome: "NOT_ON_PLAN",
      userId: "1234",
    });
    expect(matchCertificateFilename("1234_สมชาย.pdf", [candidate("123"), candidate("1234")])).toEqual({
      outcome: "MATCHED",
      userId: "1234",
    });
  });

  it("treats a leading zero as part of the id, not as a number", () => {
    expect(matchCertificateFilename("00123_x.pdf", [candidate("123")])).toEqual({
      outcome: "NOT_ON_PLAN",
      userId: "00123",
    });
    expect(matchCertificateFilename("00123_x.pdf", [candidate("00123")])).toEqual({
      outcome: "MATCHED",
      userId: "00123",
    });
  });

  it("reports a well-formed id that belongs to nobody on this plan", () => {
    expect(matchCertificateFilename("99999_x.pdf", [candidate("12345")])).toEqual({
      outcome: "NOT_ON_PLAN",
      userId: "99999",
    });
  });

  it("accepts an uppercase extension", () => {
    expect(matchCertificateFilename("12345_x.PDF", [candidate("12345")])).toEqual({
      outcome: "MATCHED",
      userId: "12345",
    });
  });

  it("keeps only the first token when the name has several underscores", () => {
    expect(matchCertificateFilename("12345_สมชาย_ใจดี.pdf", [candidate("12345")])).toEqual({
      outcome: "MATCHED",
      userId: "12345",
    });
  });

  it("does not throw on an empty roster", () => {
    expect(matchCertificateFilename("12345_x.pdf", [])).toEqual({ outcome: "NOT_ON_PLAN", userId: "12345" });
  });

  it("trims stray spaces around the id", () => {
    expect(leadingUserIdToken(" 12345 _x.pdf")).toBe("12345");
  });
});
