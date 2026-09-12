import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORAGE_DIRECTORY,
  generateStoredFileName,
  relativeStoragePath,
  resolveAbsolutePath,
  resolveStorageRoot,
  STORED_FILE_NAME_PATTERN,
} from "../../app/lib/certificates/storage";

const ROOT = path.resolve("/srv/certificates");
const NUL = String.fromCharCode(0);

describe("generateStoredFileName", () => {
  it("produces a name matching the pattern and carrying no part of the upload", () => {
    const name = generateStoredFileName("42");
    expect(name).toMatch(STORED_FILE_NAME_PATTERN);
    expect(name.startsWith("cert_42_")).toBe(true);
  });

  it("never repeats, so the globally unique stored_file_name column is satisfied by construction", () => {
    const names = new Set(Array.from({ length: 1000 }, () => generateStoredFileName("42")));
    expect(names.size).toBe(1000);
  });
});

describe("resolveAbsolutePath", () => {
  it("resolves a normal per-plan path under the root", () => {
    const relative = relativeStoragePath("42", generateStoredFileName("42"));
    expect(resolveAbsolutePath(relative, ROOT).startsWith(ROOT + path.sep)).toBe(true);
  });

  it("refuses to climb out of the root", () => {
    expect(() => resolveAbsolutePath("../secrets.pdf", ROOT)).toThrow();
    expect(() => resolveAbsolutePath("42/../../secrets.pdf", ROOT)).toThrow();
  });

  it("refuses an absolute path", () => {
    expect(() => resolveAbsolutePath("/etc/passwd", ROOT)).toThrow();
  });

  it("refuses an empty path and a NUL byte", () => {
    expect(() => resolveAbsolutePath("", ROOT)).toThrow();
    expect(() => resolveAbsolutePath(`42/cert${NUL}.pdf`, ROOT)).toThrow();
  });
});

describe("resolveStorageRoot", () => {
  it("works with nothing configured, so a deployment needs no .env edit to store a certificate", () => {
    const root = resolveStorageRoot({});

    expect(path.isAbsolute(root)).toBe(true);
    expect(path.basename(root)).toBe(DEFAULT_STORAGE_DIRECTORY);
    // Whitespace is not configuration.
    expect(resolveStorageRoot({ CERTIFICATE_STORAGE_ROOT: "   " })).toBe(root);
  });

  it("lets the variable override the default, for a host that keeps data on another volume", () => {
    const root = resolveStorageRoot({ CERTIFICATE_STORAGE_ROOT: path.join("data", "certificates") });

    expect(path.isAbsolute(root)).toBe(true);
    expect(path.basename(root)).toBe("certificates");
  });

  it("refuses a root inside public/, configured or not", () => {
    // Next serves that directory with no authentication at all, and these are personal documents.
    expect(() => resolveStorageRoot({ CERTIFICATE_STORAGE_ROOT: "public" })).toThrow();
    expect(() => resolveStorageRoot({ CERTIFICATE_STORAGE_ROOT: "public/certificates" })).toThrow();
    expect(() =>
      resolveStorageRoot({ CERTIFICATE_STORAGE_ROOT: path.resolve("public", "uploads") }),
    ).toThrow();
  });
});
