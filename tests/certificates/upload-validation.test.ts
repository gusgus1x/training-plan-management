import { describe, expect, it } from "vitest";
import {
  assertFileSizeAllowed,
  assertPdfBytes,
  assertRequestSizeAllowed,
  isPdfBytes,
  MAX_FILE_BYTES,
  MAX_REQUEST_BYTES,
  maskOriginalFileName,
  parseConfirmCertificates,
  sha256Hex,
} from "../../app/lib/certificates/validation";

const pdfBytes = (trailing = "rest of file") => new TextEncoder().encode(`%PDF-1.7\n${trailing}`);

describe("PDF sniffing", () => {
  it("accepts real PDF bytes even when the name and MIME type say otherwise", () => {
    // The extension and file.type are both client-supplied; only the bytes are evidence.
    expect(isPdfBytes(pdfBytes())).toBe(true);
    expect(() => assertPdfBytes(pdfBytes())).not.toThrow();
  });

  it("rejects text bytes that claim to be a PDF", () => {
    expect(() => assertPdfBytes(new TextEncoder().encode("not a pdf at all"))).toThrow();
  });

  it("rejects a file too short to hold the signature without throwing a raw TypeError", () => {
    expect(() => assertPdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toThrowError(/not a PDF/);
  });

  it("rejects an empty file with its own message", () => {
    expect(() => assertPdfBytes(new Uint8Array())).toThrowError(/empty/);
  });
});

describe("size limits", () => {
  it("rejects a request larger than the cap", () => {
    expect(() => assertRequestSizeAllowed(String(MAX_REQUEST_BYTES + 1))).toThrowError(/exceeds/);
  });

  it("accepts a request inside the cap", () => {
    expect(() => assertRequestSizeAllowed(String(MAX_REQUEST_BYTES))).not.toThrow();
  });

  it("rejects a request with no usable Content-Length, since the cap cannot be enforced without it", () => {
    expect(() => assertRequestSizeAllowed(null)).toThrow();
    expect(() => assertRequestSizeAllowed("not-a-number")).toThrow();
    expect(() => assertRequestSizeAllowed("0")).toThrow();
  });

  it("rejects a single file over the per-file cap", () => {
    expect(() => assertFileSizeAllowed(new Uint8Array(MAX_FILE_BYTES + 1))).toThrowError(/exceeds/);
  });
});

describe("maskOriginalFileName", () => {
  it("keeps Thai characters intact", () => {
    expect(maskOriginalFileName("12345_สมชาย ใจดี.pdf")).toBe("12345_สมชาย ใจดี.pdf");
  });

  it("leaves no path separator in the stored display name", () => {
    const masked = maskOriginalFileName("../../etc/passwd");
    expect(masked).not.toContain("/");
    expect(masked).not.toContain("\\");
  });

  it("clamps to the NVARCHAR(255) column", () => {
    expect(maskOriginalFileName(`${"a".repeat(400)}.pdf`)).toHaveLength(255);
  });

  it("falls back rather than returning an empty name", () => {
    expect(maskOriginalFileName("   ")).toBe("unnamed.pdf");
  });
});

describe("sha256Hex", () => {
  it("returns the 64 hex characters the CHAR(64) column expects", () => {
    expect(sha256Hex(pdfBytes())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives identical bytes the same digest, so duplicates in one batch are detectable", () => {
    expect(sha256Hex(pdfBytes())).toBe(sha256Hex(pdfBytes()));
    expect(sha256Hex(pdfBytes("a"))).not.toBe(sha256Hex(pdfBytes("b")));
  });
});

describe("parseConfirmCertificates", () => {
  it("accepts a well-formed assignment list", () => {
    expect(
      parseConfirmCertificates({ assignments: [{ certificateFileId: "10", employeeUserId: "12345" }] }),
    ).toEqual({ assignments: [{ certificateFileId: "10", employeeUserId: "12345" }] });
  });

  it("refuses a non-numeric certificate id", () => {
    expect(() =>
      parseConfirmCertificates({ assignments: [{ certificateFileId: "10; DROP", employeeUserId: "1" }] }),
    ).toThrow();
  });

  it("refuses the same certificate file twice in one request", () => {
    expect(() =>
      parseConfirmCertificates({
        assignments: [
          { certificateFileId: "10", employeeUserId: "1" },
          { certificateFileId: "10", employeeUserId: "2" },
        ],
      }),
    ).toThrow();
  });

  it("refuses a missing employee", () => {
    expect(() => parseConfirmCertificates({ assignments: [{ certificateFileId: "10" }] })).toThrow();
  });

  it("refuses anything that is not an array", () => {
    expect(() => parseConfirmCertificates({})).toThrow();
  });
});
