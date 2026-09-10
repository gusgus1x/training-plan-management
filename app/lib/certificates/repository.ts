import type { PrismaClient } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { recordAudit, type AuditActor } from "../audit";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { matchCertificateFilename } from "./matching";
import {
  BATCH_STATUS,
  certificateBatchSummary,
  FILE_STATUS,
  MAPPING_METHOD,
  MAPPING_STATUS,
  withDuplicatesMarked,
  type CertificateCandidate,
  type CertificateCard,
  type CertificateDraft,
  type CertificatePlanView,
  type ConfirmCertificatesInput,
  type IssuedCertificate,
} from "./types";

type DatabaseClient = Pick<
  PrismaClient,
  "certificate_import_batch" | "training_certificate_file" | "training_plan" | "$transaction"
>;

const forbidden = (message: string) => new ApiError({ code: "FORBIDDEN", message, status: 403 });
const conflict = (code: string, message: string) => new ApiError({ code, message, status: 409 });
const notFound = (message: string) => new ApiError({ code: "NOT_FOUND", message, status: 404 });

/** One prepared file on its way to disk and the database. */
export type PreparedCertificateFile = {
  originalFileName: string;
  storedFileName: string;
  storagePath: string;
  sizeBytes: number;
  sha256: string;
};

const employeeName = (employee: { first_name_th: string; last_name_th: string }) =>
  `${employee.first_name_th} ${employee.last_name_th}`.trim();

const rosterInclude = {
  training_plan_oap: { select: { company_id: true } },
  training_enrollment: {
    where: { approval_status: "APPROVED" },
    select: {
      enrollment_id: true,
      employee_user_id: true,
      training_result: { select: { result_id: true } },
      employee: { select: { employee_code: true, first_name_th: true, last_name_th: true } },
    },
  },
} as const;

export const createCertificateRepository = (client?: DatabaseClient) => {
  const db = (): DatabaseClient => client ?? getPrismaClient();

  /** Loads the plan, enforces the factory company scope, and returns its approved roster. */
  const loadPlanRoster = async (
    database: DatabaseClient,
    planId: string,
    companyId: string | null,
  ): Promise<{
    candidates: CertificateCandidate[];
    resultIdByEnrollment: Map<string, string>;
  }> => {
    const plan = await database.training_plan.findUnique({
      where: { plan_id: BigInt(planId) },
      include: rosterInclude,
    });
    if (!plan) throw notFound("Training plan not found");

    if (companyId && plan.training_plan_oap.company_id?.toString() !== companyId) {
      throw forbidden("This training plan belongs to a different company or center scope");
    }

    const candidates = plan.training_enrollment.map((enrollment) => ({
      enrollmentId: enrollment.enrollment_id.toString(),
      employeeUserId: enrollment.employee_user_id,
      employeeCode: enrollment.employee.employee_code ?? "",
      employeeName: employeeName(enrollment.employee),
    }));

    const resultIdByEnrollment = new Map(
      plan.training_enrollment
        .filter((enrollment) => enrollment.training_result)
        .map((enrollment) => [
          enrollment.enrollment_id.toString(),
          enrollment.training_result!.result_id.toString(),
        ]),
    );

    return { candidates, resultIdByEnrollment };
  };

  const toCard = (
    file: {
      certificate_file_id: bigint;
      original_file_name_masked: string;
      employee_user_id: string | null;
      mapping_status: string;
    },
    candidates: readonly CertificateCandidate[],
    alreadyIssued: ReadonlySet<string>,
  ): CertificateCard => {
    const owner = candidates.find((candidate) => candidate.employeeUserId === file.employee_user_id);

    const state = !owner
      ? "NOT_ON_PLAN"
      : alreadyIssued.has(owner.employeeUserId)
        ? "REPLACE"
        : file.mapping_status === MAPPING_STATUS.matched
          ? "MATCHED"
          : "MANUAL";

    return {
      certificateFileId: file.certificate_file_id.toString(),
      fileName: file.original_file_name_masked,
      employeeUserId: owner?.employeeUserId ?? null,
      employeeCode: owner?.employeeCode ?? null,
      employeeName: owner?.employeeName ?? null,
      state,
    };
  };

  /**
   * The certificates already issued for this plan. Draft rows can never appear: they are not
   * CONFIRMED, which is the same condition the employee read path uses.
   *
   * One query serves both callers - the "who already has one" list HRD sees, and the REPLACE flag
   * on a card whose employee is about to get a second certificate.
   */
  const loadIssued = async (
    database: DatabaseClient,
    candidates: readonly CertificateCandidate[],
  ): Promise<IssuedCertificate[]> => {
    if (candidates.length === 0) return [];

    const rows = await database.training_certificate_file.findMany({
      where: {
        enrollment_id: { in: candidates.map((candidate) => BigInt(candidate.enrollmentId)) },
        status: FILE_STATUS.active,
        mapping_status: MAPPING_STATUS.confirmed,
      },
      orderBy: { certificate_file_id: "desc" },
    });

    return rows.flatMap((row) => {
      const owner = candidates.find((candidate) => candidate.employeeUserId === row.employee_user_id);
      if (!owner) return [];
      return [
        {
          certificateFileId: row.certificate_file_id.toString(),
          fileName: row.original_file_name_masked,
          employeeUserId: owner.employeeUserId,
          employeeCode: owner.employeeCode,
          employeeName: owner.employeeName,
          issuedAt: (row.verified_at ?? row.created_at).toISOString(),
        },
      ];
    });
  };

  const loadDraftBatch = async (database: DatabaseClient, planId: string) =>
    database.certificate_import_batch.findFirst({
      where: { plan_id: BigInt(planId), import_status: BATCH_STATUS.uploaded },
      include: {
        training_certificate_file: {
          where: { status: FILE_STATUS.active },
          orderBy: { certificate_file_id: "asc" },
        },
      },
    });

  const buildDraft = async (
    database: DatabaseClient,
    planId: string,
    candidates: readonly CertificateCandidate[],
    issued?: readonly IssuedCertificate[],
  ): Promise<CertificateDraft | null> => {
    const batch = await loadDraftBatch(database, planId);
    if (!batch) return null;

    const alreadyIssued = new Set(
      (issued ?? (await loadIssued(database, candidates))).map((entry) => entry.employeeUserId),
    );

    return {
      batchId: batch.certificate_import_batch_id.toString(),
      importBatchCode: batch.import_batch_code,
      importedAt: batch.imported_at.toISOString(),
      cards: withDuplicatesMarked(
        batch.training_certificate_file.map((file) => toCard(file, candidates, alreadyIssued)),
      ),
    };
  };

  const writeBatchCounts = async (
    database: DatabaseClient,
    batchId: bigint,
    cards: readonly CertificateCard[],
    extra: Record<string, unknown> = {},
  ) => {
    const summary = certificateBatchSummary(cards);
    await database.certificate_import_batch.update({
      where: { certificate_import_batch_id: batchId },
      data: {
        total_file_count: summary.total,
        matched_file_count: summary.matched,
        failed_file_count: summary.notOnPlan,
        pending_file_count: summary.duplicate,
        updated_at: new Date(),
        ...extra,
      },
    });
  };

  return {
    async loadPlanView(planId: string, companyId: string | null): Promise<CertificatePlanView> {
      return withDatabaseErrorMapping(async () => {
        const { candidates } = await loadPlanRoster(db(), planId, companyId);
        const issued = await loadIssued(db(), candidates);
        return {
          roster: candidates,
          draft: await buildDraft(db(), planId, candidates, issued),
          issued,
        };
      });
    },

    /**
     * Appends to the plan's open draft batch, creating one only when there is none. A second batch
     * for the same plan would leave the first invisible in the UI and impossible to discard.
     */
    async appendToDraft(
      planId: string,
      files: readonly PreparedCertificateFile[],
      userId: string,
      companyId: string | null,
    ): Promise<CertificateDraft> {
      return withDatabaseErrorMapping(async () => {
        const { candidates } = await loadPlanRoster(db(), planId, companyId);

        await db().$transaction(async (tx) => {
          const existing = await loadDraftBatch(tx as unknown as DatabaseClient, planId);
          const batchId =
            existing?.certificate_import_batch_id ??
            (
              await tx.certificate_import_batch.create({
                data: {
                  plan_id: BigInt(planId),
                  import_batch_code: `CERT-${planId}-${Date.now()}`,
                  import_status: BATCH_STATUS.uploaded,
                  imported_by: BigInt(userId),
                  imported_at: new Date(),
                  created_at: new Date(),
                },
                select: { certificate_import_batch_id: true },
              })
            ).certificate_import_batch_id;

          for (const file of files) {
            const match = matchCertificateFilename(file.originalFileName, candidates);
            const owner =
              match.outcome === "MATCHED"
                ? candidates.find((candidate) => candidate.employeeUserId === match.userId) ?? null
                : null;

            await tx.training_certificate_file.create({
              data: {
                certificate_import_batch_id: batchId,
                enrollment_id: owner ? BigInt(owner.enrollmentId) : null,
                employee_user_id: owner?.employeeUserId ?? null,
                original_file_name_masked: file.originalFileName,
                stored_file_name: file.storedFileName,
                storage_path: file.storagePath,
                file_mime_type: "application/pdf",
                file_size_bytes: BigInt(file.sizeBytes),
                file_sha256: file.sha256,
                mapping_method: MAPPING_METHOD,
                mapping_status: owner ? MAPPING_STATUS.matched : MAPPING_STATUS.unmatched,
                status: FILE_STATUS.active,
                created_at: new Date(),
              },
            });
          }

          const refreshed = await buildDraft(tx as unknown as DatabaseClient, planId, candidates);
          if (refreshed) await writeBatchCounts(tx as unknown as DatabaseClient, batchId, refreshed.cards);
        });

        const draft = await buildDraft(db(), planId, candidates);
        if (!draft) throw notFound("Draft batch was not created");
        return draft;
      });
    },

    /**
     * Turns the draft into issued certificates. Returns the storage paths of rows HRD dropped, for
     * the service to unlink once the transaction has committed.
     */
    async confirmDraft(
      planId: string,
      input: ConfirmCertificatesInput,
      userId: string,
      companyId: string | null,
      actor?: AuditActor,
    ): Promise<{ removedPaths: string[] }> {
      return withDatabaseErrorMapping(async () => {
        const { candidates, resultIdByEnrollment } = await loadPlanRoster(db(), planId, companyId);
        const candidateByUserId = new Map(candidates.map((c) => [c.employeeUserId, c]));

        const claimed = new Set<string>();
        for (const assignment of input.assignments) {
          if (!candidateByUserId.has(assignment.employeeUserId)) {
            throw conflict("EMPLOYEE_NOT_ON_PLAN", "That employee is not on this training batch.");
          }
          if (claimed.has(assignment.employeeUserId)) {
            throw conflict("CERTIFICATE_DUPLICATE_EMPLOYEE", "Two certificates were assigned to one employee.");
          }
          claimed.add(assignment.employeeUserId);
        }

        return db().$transaction(async (tx) => {
          const batch = await loadDraftBatch(tx as unknown as DatabaseClient, planId);
          if (!batch) throw notFound("There is no certificate draft to confirm for this batch.");

          const filesInBatch = new Map(
            batch.training_certificate_file.map((file) => [file.certificate_file_id.toString(), file]),
          );
          for (const assignment of input.assignments) {
            if (!filesInBatch.has(assignment.certificateFileId)) {
              throw conflict("CERTIFICATE_NOT_IN_BATCH", "That certificate file is not part of this draft.");
            }
          }

          const assignedIds = new Set(input.assignments.map((a) => a.certificateFileId));
          const removed = batch.training_certificate_file.filter(
            (file) => !assignedIds.has(file.certificate_file_id.toString()),
          );

          // Supersede first. Both filtered unique indexes (active-per-result, and the app's
          // one-active-per-enrollment rule) reject the write if the predecessor is still ACTIVE
          // when the replacement is activated. Clearing training_result_id matters too: the schema
          // models that column as unique, so leaving it on a superseded row makes
          // training_result.training_certificate_file ambiguous.
          const targetEnrollmentIds = input.assignments
            .map((a) => candidateByUserId.get(a.employeeUserId)!.enrollmentId)
            .map((id) => BigInt(id));

          if (targetEnrollmentIds.length > 0) {
            await tx.training_certificate_file.updateMany({
              where: {
                enrollment_id: { in: targetEnrollmentIds },
                status: FILE_STATUS.active,
                certificate_import_batch_id: { not: batch.certificate_import_batch_id },
              },
              data: {
                status: FILE_STATUS.superseded,
                mapping_status: MAPPING_STATUS.superseded,
                training_result_id: null,
                updated_at: new Date(),
              },
            });
          }

          for (const assignment of input.assignments) {
            const owner = candidateByUserId.get(assignment.employeeUserId)!;
            await tx.training_certificate_file.update({
              where: { certificate_file_id: BigInt(assignment.certificateFileId) },
              data: {
                enrollment_id: BigInt(owner.enrollmentId),
                employee_user_id: owner.employeeUserId,
                training_result_id: resultIdByEnrollment.has(owner.enrollmentId)
                  ? BigInt(resultIdByEnrollment.get(owner.enrollmentId)!)
                  : null,
                mapping_status: MAPPING_STATUS.confirmed,
                status: FILE_STATUS.active,
                verified_by: BigInt(userId),
                verified_at: new Date(),
                updated_at: new Date(),
              },
            });
          }

          if (removed.length > 0) {
            await tx.training_certificate_file.deleteMany({
              where: { certificate_file_id: { in: removed.map((file) => file.certificate_file_id) } },
            });
          }

          const confirmedCards = input.assignments.map((assignment) => {
            const owner = candidateByUserId.get(assignment.employeeUserId)!;
            return {
              certificateFileId: assignment.certificateFileId,
              fileName: filesInBatch.get(assignment.certificateFileId)!.original_file_name_masked,
              employeeUserId: owner.employeeUserId,
              employeeCode: owner.employeeCode,
              employeeName: owner.employeeName,
              state: "MATCHED" as const,
            };
          });

          await writeBatchCounts(tx as unknown as DatabaseClient, batch.certificate_import_batch_id, confirmedCards, {
            import_status: BATCH_STATUS.confirmed,
            confirmed_by: BigInt(userId),
            confirmed_at: new Date(),
          });

          if (actor) {
            await recordAudit(
              {
                category: "UPDATE",
                action: "CERTIFICATE_BATCH_CONFIRMED",
                actor,
                entityType: "certificate_import_batch",
                entityId: batch.certificate_import_batch_id.toString(),
                entityLabel: batch.import_batch_code,
                detail: { planId, issued: input.assignments.length, discarded: removed.length },
              },
              tx,
            );
          }

          return { removedPaths: removed.map((file) => file.storage_path) };
        });
      });
    },

    /** Throws the whole draft away. Returns the paths so the service can unlink after committing. */
    async discardDraft(planId: string, companyId: string | null): Promise<{ removedPaths: string[] }> {
      return withDatabaseErrorMapping(async () => {
        await loadPlanRoster(db(), planId, companyId);

        return db().$transaction(async (tx) => {
          const batch = await loadDraftBatch(tx as unknown as DatabaseClient, planId);
          if (!batch) return { removedPaths: [] };

          await tx.training_certificate_file.deleteMany({
            where: { certificate_import_batch_id: batch.certificate_import_batch_id },
          });
          await tx.certificate_import_batch.delete({
            where: { certificate_import_batch_id: batch.certificate_import_batch_id },
          });

          return { removedPaths: batch.training_certificate_file.map((file) => file.storage_path) };
        });
      });
    },

    /**
     * Drops one uploaded file from the draft.
     *
     * The card used to be removed on screen only, which held for as long as nobody uploaded again:
     * the next upload answered with the whole draft as the database still had it, and the removed
     * file came back. Removing the row is what makes the removal real.
     *
     * An empty batch is deleted with its last file, matching discardDraft - a batch with nothing in
     * it is not a draft anybody is working on.
     */
    async removeDraftFile(
      planId: string,
      certificateFileId: string,
      companyId: string | null,
    ): Promise<{ removedPaths: string[] }> {
      return withDatabaseErrorMapping(async () => {
        await loadPlanRoster(db(), planId, companyId);

        return db().$transaction(async (tx) => {
          const batch = await loadDraftBatch(tx as unknown as DatabaseClient, planId);
          if (!batch) return { removedPaths: [] };

          // Scoped to this plan's own draft: a file id from another plan must not delete anything,
          // and the batch lookup above is what ties the id to the plan in the URL.
          const target = batch.training_certificate_file.find(
            (file) => file.certificate_file_id.toString() === certificateFileId,
          );
          if (!target) {
            throw new ApiError({
              code: "CERTIFICATE_FILE_NOT_IN_DRAFT",
              message: "That file is not part of this plan's draft.",
              status: 404,
            });
          }

          await tx.training_certificate_file.delete({
            where: { certificate_file_id: target.certificate_file_id },
          });

          if (batch.training_certificate_file.length === 1) {
            await tx.certificate_import_batch.delete({
              where: { certificate_import_batch_id: batch.certificate_import_batch_id },
            });
          }

          return { removedPaths: [target.storage_path] };
        });
      });
    },

    /**
     * The single gate on reading a certificate's bytes. Every role passes through here.
     */
    async loadFileForPrincipal(
      certificateFileId: string,
      principal: {
        role: string;
        companyId: string | null;
        employeeId: string | null;
        employeeUserId: string | null;
      },
    ) {
      return withDatabaseErrorMapping(async () => {
        const file = await db().training_certificate_file.findUnique({
          where: { certificate_file_id: BigInt(certificateFileId) },
          include: {
            training_enrollment: {
              include: {
                employee: { select: { employee_id: true } },
                training_plan: { include: { training_plan_oap: { select: { company_id: true } } } },
              },
            },
          },
        });
        if (!file) throw notFound("Certificate not found");

        if (principal.role === "EMPLOYEE") {
          // A draft is HRD's working copy: it may still be pointed at the wrong person.
          if (file.status !== FILE_STATUS.active || file.mapping_status !== MAPPING_STATUS.confirmed) {
            throw forbidden("This certificate has not been issued yet");
          }

          const enrollment = file.training_enrollment;
          if (!enrollment) throw forbidden("This certificate is not linked to your training record");

          // Dual key, and each side must be proven - never inferred from the other being null.
          const ownsByUserId =
            principal.employeeUserId !== null && enrollment.employee_user_id === principal.employeeUserId;
          const ownsByEmployeeId =
            principal.employeeId !== null &&
            enrollment.employee.employee_id.toString() === principal.employeeId;

          if (!ownsByUserId && !ownsByEmployeeId) {
            throw forbidden("You can only open your own certificate");
          }
        } else if (principal.role === "HRD_FACTORY") {
          const planCompanyId = file.training_enrollment?.training_plan.training_plan_oap.company_id;
          if (!principal.companyId || planCompanyId?.toString() !== principal.companyId) {
            throw forbidden("This certificate belongs to a different company scope");
          }
        }

        return {
          storagePath: file.storage_path,
          fileName: file.original_file_name_masked,
          fileSizeBytes: Number(file.file_size_bytes),
        };
      });
    },
  };
};

export const certificateRepository = createCertificateRepository();
export type CertificateRepository = ReturnType<typeof createCertificateRepository>;
