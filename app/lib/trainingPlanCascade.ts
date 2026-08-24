import type { Prisma } from "../generated/prisma/client";
import { recordAudit, type AuditActor } from "./audit";

export type CascadeAuditContext = {
  actor: AuditActor;
  /** What the user asked to delete — a course, an OAP plan, or a single rolling session. */
  entityType: string;
  entityId: string;
  entityLabel?: string;
};

/**
 * Cascades deletion of one or more training plans and all related entities in strict
 * foreign-key dependency order so no constraint errors or orphaned records occur.
 *
 * When an audit context is supplied the row count wiped from each table is written to audit_log
 * inside the caller's transaction, so the record either commits with the deletion or rolls back
 * with it. Without those counts nobody can tell afterwards whether a delete removed one empty
 * plan or a year of attendance history. See docs/admin-and-audit-log-plan.md.
 */
export const cascadeDeleteTrainingPlans = async (
  tx: Prisma.TransactionClient,
  planIds: bigint[],
  audit?: CascadeAuditContext,
): Promise<void> => {
  if (planIds.length === 0) return;

  const deleted: Record<string, number> = {};
  // Preserves the original swallow-and-continue behaviour while tallying what actually went.
  const drop = async (
    table: string,
    run: Promise<{ count: number }>,
    swallow = true,
  ) => {
    const result = swallow ? await run.catch(() => undefined) : await run;
    if (result?.count) deleted[table] = (deleted[table] ?? 0) + result.count;
  };

  // 1. Find all enrollment IDs for these plans
  const enrollments = await tx.training_enrollment.findMany({
    where: { plan_id: { in: planIds } },
    select: { enrollment_id: true },
  });
  const enrollmentIds = enrollments.map((e) => e.enrollment_id);

  // 2. Find all certificate batch IDs for these plans
  const batches = await tx.certificate_import_batch.findMany({
    where: { plan_id: { in: planIds } },
    select: { certificate_import_batch_id: true },
  });
  const batchIds = batches.map((b) => b.certificate_import_batch_id);

  // 3. Unlink certificate files from enrollments and results
  if (enrollmentIds.length > 0 || batchIds.length > 0) {
    await tx.training_certificate_file.updateMany({
      where: {
        OR: [
          ...(enrollmentIds.length > 0 ? [{ enrollment_id: { in: enrollmentIds } }] : []),
        ],
      },
      data: { enrollment_id: null, training_result_id: null },
    }).catch(() => undefined);
  }

  if (enrollmentIds.length > 0) {
    // 4. Delete training results FIRST before assessment submissions
    // because training_result has official_pre_submission_id and official_post_submission_id
    // referencing assessment_submission.
    await drop("training_result", tx.training_result.deleteMany({
      where: { enrollment_id: { in: enrollmentIds } },
    }));

    // 5. Delete assessment answers & submissions
    const assessmentSubmissions = await tx.assessment_submission.findMany({
      where: { enrollment_id: { in: enrollmentIds } },
      select: { submission_id: true },
    });
    if (assessmentSubmissions.length > 0) {
      const submissionIds = assessmentSubmissions.map((s) => s.submission_id);
      await drop("assessment_answer", tx.assessment_answer.deleteMany({
        where: { submission_id: { in: submissionIds } },
      }));
      await drop("assessment_submission", tx.assessment_submission.deleteMany({
        where: { submission_id: { in: submissionIds } },
      }));
    }

    // 6. Delete evaluation answers & submissions
    const evaluationSubmissions = await tx.evaluation_submission.findMany({
      where: { enrollment_id: { in: enrollmentIds } },
      select: { evaluation_submission_id: true },
    });
    if (evaluationSubmissions.length > 0) {
      const evalSubIds = evaluationSubmissions.map((s) => s.evaluation_submission_id);
      await drop("evaluation_answer", tx.evaluation_answer.deleteMany({
        where: { evaluation_submission_id: { in: evalSubIds } },
      }));
      await drop("evaluation_submission", tx.evaluation_submission.deleteMany({
        where: { evaluation_submission_id: { in: evalSubIds } },
      }));
    }

    // 7. Delete attendance
    await drop("attendance", tx.attendance.deleteMany({
      where: { enrollment_id: { in: enrollmentIds } },
    }), false);

    // 8. Delete training enrollments
    await drop("training_enrollment", tx.training_enrollment.deleteMany({
      where: { plan_id: { in: planIds } },
    }), false);
  }

  // 9. Delete certificate import batches (if any)
  if (batchIds.length > 0) {
    await drop("certificate_import_batch", tx.certificate_import_batch.deleteMany({
      where: { certificate_import_batch_id: { in: batchIds } },
    }));
  }

  // 10. Delete training plan assessment settings
  await drop("training_plan_assessment_setting", tx.training_plan_assessment_setting.deleteMany({
    where: { plan_id: { in: planIds } },
  }));

  // 11. Delete training expenses
  await drop("training_expense", tx.training_expense.deleteMany({
    where: { plan_id: { in: planIds } },
  }));

  // 12. Unlink training need requests
  await tx.training_need_request.updateMany({
    where: { training_plan_id: { in: planIds } },
    data: { training_plan_id: null },
  }).catch(() => undefined);

  // 13. Delete the training plans
  await drop("training_plan", tx.training_plan.deleteMany({
    where: { plan_id: { in: planIds } },
  }), false);

  if (audit) {
    await recordAudit(
      {
        category: "DELETE",
        action: "TRAINING_PLAN_CASCADE_DELETED",
        actor: audit.actor,
        entityType: audit.entityType,
        entityId: audit.entityId,
        entityLabel: audit.entityLabel,
        detail: {
          planIds: planIds.map(String),
          deletedRows: deleted,
        },
      },
      tx,
    );
  }
};
