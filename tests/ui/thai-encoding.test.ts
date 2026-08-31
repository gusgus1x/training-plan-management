import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards against a real incident: a file was round-tripped through Windows PowerShell 5.1 using
 * `Get-Content` with no -Encoding, which reads by the system ANSI codepage. On a Thai machine that
 * decodes UTF-8 Thai as CP874, and writing the result back as UTF-8 makes the damage permanent and
 * structurally valid — so `tsc`, eslint and the entire test suite stayed green while every Thai
 * string on the page rendered as garbage.
 *
 * Nothing else in the pipeline notices. The only signal was a human looking at the screen, which is
 * exactly why this check earns its keep.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const selfPath = fileURLToPath(import.meta.url);
const roots = ["app", "tests", "scripts", "prisma"];
const extensions = new Set([".ts", ".tsx", ".mjs", ".sql", ".css", ".json", ".md"]);
const skipDirectories = new Set(["node_modules", ".next", ".git", "generated"]);

/**
 * Every Thai character is three UTF-8 bytes beginning 0xE0 0xB8 or 0xE0 0xB9, which CP874 renders
 * as the two-character prefix เธ or เน. Corrupted text is that prefix repeating
 * every one or two characters, not merely containing it once.
 *
 * Matching the repetition rather than the prefix is the whole point: ordinary Thai words contain
 * the prefix once and are perfectly valid — an earlier draft of this regex flagged the Thai for
 * "engineering" in a seed file.
 *
 * Written as escapes so this pattern cannot itself be damaged by the encoding bug it detects.
 */
const MOJIBAKE = /(?:[เ][ธน][฀-๿]?){4,}/;

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    if (skipDirectories.has(entry)) return [];
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return extensions.has(path.extname(full)) ? [full] : [];
  });

describe("Thai text is stored as UTF-8", () => {
  it("has no mis-decoded Thai anywhere in the source", () => {
    const damaged = roots
      .flatMap((root) => walk(path.join(projectRoot, root)))
      .filter((file) => file !== selfPath)
      .filter((file) => MOJIBAKE.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(projectRoot, file));

    expect(
      damaged,
      `Mis-decoded Thai found. Restore the file from git and redo the edit with a tool that reads UTF-8 — do not use PowerShell Get-Content without -Encoding utf8.\n${damaged.join("\n")}`,
    ).toEqual([]);
  });

  it("still recognises the damage it is looking for", () => {
    // The literal bytes a corrupted file carries, built from escapes so this stays readable.
    const corrupted = "เธเธฒเธเธช";
    expect(MOJIBAKE.test(corrupted)).toBe(true);

    // ...and does not fire on real Thai. "เอ็นจิเนียริ่ง" carries the prefix once.
    expect(MOJIBAKE.test("บริษัท ไทย เอ็นจิเนียริ่ง โปรดักส์ จำกัด")).toBe(false);
    expect(MOJIBAKE.test("กลุ่มเป้าหมายและขั้นตอนอนุมัติ")).toBe(false);
  });
});
