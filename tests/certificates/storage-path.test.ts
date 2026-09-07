import path from "node:path";
import { describe, expect, it } from "vitest";
import {
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
  it("fails loudly when unset rather than defaulting somewhere surprising", () => {
    // A silent default is how PDFs end up inside the repo, or inside public/ where anyone can read
    // them. Refusing to start is the safer failure.
    expect(() => resolveStorageRoot({})).toThrow();
    expect(() => resolveStorageRoot({ CERTIFICATE_STORAGE_ROOT: "   " })).toThrow();
  });

  it("resolves a configured root to an absolute path", () => {
    const root = resolveStorageRoot({ CERTIFICATE_STORAGE_ROOT: "Certificate_Storage" });
    expect(path.isAbsolute(root)).toBe(true);
  });
});
