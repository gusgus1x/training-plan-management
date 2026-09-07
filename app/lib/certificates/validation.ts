import { createHash } from "node:crypto";
import { ApiError } from "../api/errors";
import type { ConfirmCertificatesInput } from "./types";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 50;

/** The one message HRD sees when a filename does not follow the rule. Kept here so the client and
 *  the server cannot drift into describing the rule differently. */
export const FILENAME_RULE_MESSAGE =
  "ไม่ตรงตามข้อกำหนดการใช้งาน กรุณาปรับชื่อไฟล์เป็น SAP UserID ให้อยู่หน้าสุดและตามด้วย _ และชื่อพนักงาน";

const invalid = (message: string, code = "CERTIFICATE_UPLOAD_INVALID", status = 400) =>
  new ApiError({ code, message, status });

/**
 * Must run BEFORE `request.formData()`. formData() buffers the whole body into process memory, so
 * checking sizes after it has parsed is not a limit - it is an OOM with extra steps.
 */
export const assertRequestSizeAllowed = (contentLength: string | null): void => {
  const declared = Number(contentLength);
  if (!contentLength || !Number.isFinite(declared) || declared <= 0) {
    throw invalid("Upload rejected: missing or unreadable Content-Length.", "CERTIFICATE_UPLOAD_INVALID", 411);
  }
  if (declared > MAX_REQUEST_BYTES) {
    throw invalid(
      `Upload rejected: total size exceeds ${Math.floor(MAX_REQUEST_BYTES / (1024 * 1024))}MB.`,
      "CERTIFICATE_UPLOAD_TOO_LARGE",
      413,
    );
  }
};

/**
 * Sniffs the real bytes. `file.type` and the extension are both supplied by the client and mean
 * nothing; this check is also what keeps file_mime_type honest against the database's
 * CK_training_certificate_file_pdf_only.
 */
export const isPdfBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 5 &&
  bytes[0] === 0x25 && // %
  bytes[1] === 0x50 && // P
  bytes[2] === 0x44 && // D
  bytes[3] === 0x46 && // F
  bytes[4] === 0x2d; //  -

export const assertPdfBytes = (bytes: Uint8Array): void => {
  if (!bytes.length) throw invalid("ไฟล์ว่าง / The file is empty.");
  if (!isPdfBytes(bytes)) throw invalid("ไฟล์นี้ไม่ใช่ PDF / This file is not a PDF.");
};

export const assertFileSizeAllowed = (bytes: Uint8Array): void => {
  const limitMb = Math.floor(MAX_FILE_BYTES / (1024 * 1024));
  if (bytes.length > MAX_FILE_BYTES) {
    throw invalid(`ไฟล์ใหญ่เกิน ${limitMb}MB / File exceeds ${limitMb}MB.`, "CERTIFICATE_UPLOAD_TOO_LARGE", 413);
  }
};

const CONTROL_CHAR_MAX = 31;
const DELETE_CHAR = 127;

/** Display-only, and never used to build a path. Strips control characters and separators anyway so
 *  a stored name can never be mistaken for one, and clamps to the NVARCHAR(255) column.
 *  Filtering by code point rather than a regex keeps invisible bytes out of this source file. */
export const maskOriginalFileName = (name: string): string => {
  const stripped = Array.from(name)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > CONTROL_CHAR_MAX && code !== DELETE_CHAR;
    })
    .join("")
    .replace(/[\\/]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return (stripped || "unnamed.pdf").slice(0, 255);
};

export const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const readString = (source: Record<string, unknown>, field: string): string => {
  const value = source[field];
  if (typeof value !== "string" || !value.trim()) {
    throw invalid(`${field} is required.`);
  }
  return value.trim();
};

export const parseConfirmCertificates = (input: Record<string, unknown>): ConfirmCertificatesInput => {
  const raw = input.assignments;
  if (!Array.isArray(raw)) throw invalid("assignments must be an array.");

  const assignments = raw.map((entry) => {
    if (!entry || typeof entry !== "object") throw invalid("Each assignment must be an object.");
    const source = entry as Record<string, unknown>;
    const certificateFileId = readString(source, "certificateFileId");
    const employeeUserId = readString(source, "employeeUserId");
    if (!/^\d+$/.test(certificateFileId)) throw invalid("certificateFileId must be numeric.");
    return { certificateFileId, employeeUserId };
  });

  const seen = new Set<string>();
  for (const assignment of assignments) {
    if (seen.has(assignment.certificateFileId)) {
      throw invalid("The same certificate file appears twice in this request.");
    }
    seen.add(assignment.certificateFileId);
  }

  return { assignments };
};
