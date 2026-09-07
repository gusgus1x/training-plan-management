import type { AuditActor } from "../audit";
import { certificateRepository, type CertificateRepository, type PreparedCertificateFile } from "./repository";
import {
  deleteCertificateFile,
  generateStoredFileName,
  relativeStoragePath,
  writeCertificateFile,
} from "./storage";
import type { CertificateUploadRejection, CertificateUploadResult, ConfirmCertificatesInput } from "./types";
import {
  assertFileSizeAllowed,
  assertPdfBytes,
  FILENAME_RULE_MESSAGE,
  maskOriginalFileName,
  sha256Hex,
} from "./validation";
import { leadingUserIdToken } from "./matching";

export type UploadedCertificate = { fileName: string; bytes: Uint8Array };

export const createCertificateService = (repository: CertificateRepository = certificateRepository) => ({
  loadPlanView: (planId: string, companyId: string | null) => repository.loadPlanView(planId, companyId),

  /**
   * Writes the accepted PDFs to disk, then records them. Bytes first, row second: a row pointing at
   * a missing file breaks the preview with no way to recover, while a file with no row is invisible
   * and removable. If the database write fails, the bytes written in this request are removed again
   * so a failed upload leaves nothing behind.
   */
  async uploadCertificates(
    planId: string,
    uploads: readonly UploadedCertificate[],
    userId: string,
    companyId: string | null,
  ): Promise<CertificateUploadResult> {
    const rejected: CertificateUploadRejection[] = [];
    // Bytes travel WITH their prepared row: rejecting a file makes the two lists diverge, and
    // pairing them by index afterwards would write one employee's PDF under another's name.
    const accepted: Array<{ file: PreparedCertificateFile; bytes: Uint8Array }> = [];

    for (const upload of uploads) {
      const fileName = maskOriginalFileName(upload.fileName);

      // Checked before the bytes so a misnamed file is never written at all - and so HRD gets the
      // filename rule back, which is the one error they can actually fix.
      if (leadingUserIdToken(upload.fileName) === null) {
        rejected.push({ fileName, reason: FILENAME_RULE_MESSAGE });
        continue;
      }

      try {
        assertPdfBytes(upload.bytes);
        assertFileSizeAllowed(upload.bytes);
      } catch (error) {
        rejected.push({ fileName, reason: error instanceof Error ? error.message : "Rejected" });
        continue;
      }

      const storedFileName = generateStoredFileName(planId);
      accepted.push({
        file: {
          originalFileName: fileName,
          storedFileName,
          storagePath: relativeStoragePath(planId, storedFileName),
          sizeBytes: upload.bytes.length,
          sha256: sha256Hex(upload.bytes),
        },
        bytes: upload.bytes,
      });
    }

    const written: string[] = [];
    try {
      for (const entry of accepted) {
        await writeCertificateFile(entry.file.storagePath, entry.bytes);
        written.push(entry.file.storagePath);
      }
      const draft = await repository.appendToDraft(
        planId,
        accepted.map((entry) => entry.file),
        userId,
        companyId,
      );
      return { draft, rejected };
    } catch (error) {
      await Promise.allSettled(written.map(deleteCertificateFile));
      throw error;
    }
  },

  async confirmCertificates(
    planId: string,
    input: ConfirmCertificatesInput,
    userId: string,
    companyId: string | null,
    actor?: AuditActor,
  ) {
    const { removedPaths } = await repository.confirmDraft(planId, input, userId, companyId, actor);
    // After the commit: a rolled-back confirm must not have deleted anything.
    await Promise.allSettled(removedPaths.map(deleteCertificateFile));
    return repository.loadPlanView(planId, companyId);
  },

  async discardDraft(planId: string, companyId: string | null) {
    const { removedPaths } = await repository.discardDraft(planId, companyId);
    await Promise.allSettled(removedPaths.map(deleteCertificateFile));
    return repository.loadPlanView(planId, companyId);
  },

  loadFileForPrincipal: (
    certificateFileId: string,
    principal: {
      role: string;
      companyId: string | null;
      employeeId: string | null;
      employeeUserId: string | null;
    },
  ) => repository.loadFileForPrincipal(certificateFileId, principal),
});

export const certificateService = createCertificateService();
export type CertificateService = ReturnType<typeof createCertificateService>;
