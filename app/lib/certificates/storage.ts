import { createReadStream } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "../api/errors";

/**
 * Certificate PDFs live on the filesystem, not in the database: `training_certificate_file` was
 * designed that way in V6.2 (storage_path / stored_file_name / file_sha256, no blob column).
 *
 * The root must be OUTSIDE public/. Anything under public/ is served by Next with no authentication
 * at all, and these are employees' personal documents - the only thing standing between one
 * employee and another's certificate is the ownership check in the file route.
 */

export const STORED_FILE_NAME_PATTERN =
  /^cert_\d+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/**
 * No silent default. A mistyped or missing env var quietly writing PDFs into the repo - or into
 * public/ - is exactly the failure this module exists to prevent, so it fails loudly instead.
 */
export const resolveStorageRoot = (env: Record<string, string | undefined> = process.env): string => {
  const configured = (env.CERTIFICATE_STORAGE_ROOT ?? "").trim();
  if (!configured) {
    throw new ApiError({
      code: "CERTIFICATE_STORAGE_UNCONFIGURED",
      message: "CERTIFICATE_STORAGE_ROOT is not set. Certificates cannot be stored or served.",
      status: 500,
    });
  }
  return path.resolve(configured);
};

/**
 * Contains no part of the uploaded name. Traversal is therefore impossible by construction rather
 * than by filtering, and the global UQ_training_certificate_file_stored_file_name is satisfied
 * without a round-trip to check.
 */
export const generateStoredFileName = (planId: string): string => `cert_${planId}_${randomUUID()}.pdf`;

/** What goes in `storage_path`: relative to the root, so moving the volume is an .env change. */
export const relativeStoragePath = (planId: string, storedFileName: string): string =>
  `${planId}/${storedFileName}`;

/**
 * The single place a stored path becomes a real filesystem path, and so the single place traversal
 * has to be stopped. Takes the root as an argument so it is testable without touching the env.
 */
export const resolveAbsolutePath = (relativePath: string, root: string = resolveStorageRoot()): string => {
  const rejected =
    !relativePath ||
    relativePath.includes("\0") ||
    relativePath.split(/[\\/]/).some((segment) => segment === ".." || segment === ".") ||
    path.isAbsolute(relativePath);

  if (rejected) {
    throw new ApiError({
      code: "CERTIFICATE_PATH_INVALID",
      message: "Invalid certificate storage path.",
      status: 400,
    });
  }

  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new ApiError({
      code: "CERTIFICATE_PATH_INVALID",
      message: "Invalid certificate storage path.",
      status: 400,
    });
  }
  return resolved;
};

export const writeCertificateFile = async (relativePath: string, bytes: Uint8Array): Promise<void> => {
  const absolute = resolveAbsolutePath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
};

export const openCertificateFile = (relativePath: string) => createReadStream(resolveAbsolutePath(relativePath));

/** Deleting a file that is already gone is the desired end state, not an error. */
export const deleteCertificateFile = async (relativePath: string): Promise<void> => {
  try {
    await unlink(resolveAbsolutePath(relativePath));
  } catch {
    // Already absent, or unreadable - either way there is nothing left to clean up here.
  }
};

/** Every file for a plan lives in one directory, so cascade cleanup is a single removal. */
export const removePlanCertificateDirectory = async (planId: string): Promise<void> => {
  try {
    await rm(resolveAbsolutePath(String(planId)), { recursive: true, force: true });
  } catch {
    // A filesystem failure must never undo a database deletion that already committed.
  }
};
