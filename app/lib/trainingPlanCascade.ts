import type { Prisma } from "../generated/prisma/client";

/**
 * Cascades deletion of one or more training plans and all related entities in strict
 * foreign-key dependency order so no constraint errors or orphaned records occur.
 */
export const cascadeDeleteTrainingPlans = async (
  tx: Prisma.TransactionClient,
  planIds: bigint[],
): Promise<void> => {
  if (planIds.length === 0) return;

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
    await tx.training_result.deleteMany({
      where: { enrollment_id: { in: enrollmentIds } },
    }).catch(() => undefined);

    // 5. Delete assessment answers & submissions
    const assessmentSubmissions = await tx.assessment_submission.findMany({
      where: { enrollment_id: { in: enrollmentIds } },
      select: { submission_id: true },
    });
    if (assessmentSubmissions.length > 0) {
      const submissionIds = assessmentSubmissions.map((s) => s.submission_id);
      await tx.assessment_answer.deleteMany({
        where: { submission_id: { in: submissionIds } },
      }).catch(() => undefined);
      await tx.assessment_submission.deleteMany({
        where: { submission_id: { in: submissionIds } },
      }).catch(() => undefined);
    }

    // 6. Delete evaluation answers & submissions
    const evaluationSubmissions = await tx.evaluation_submission.findMany({
      where: { enrollment_id: { in: enrollmentIds } },
      select: { evaluation_submission_id: true },
    });
    if (evaluationSubmissions.length > 0) {
      const evalSubIds = evaluationSubmissions.map((s) => s.evaluation_submission_id);
      await tx.evaluation_answer.deleteMany({
        where: { evaluation_submission_id: { in: evalSubIds } },
      }).catch(() => undefined);
      await tx.evaluation_submission.deleteMany({
        where: { evaluation_submission_id: { in: evalSubIds } },
      }).catch(() => undefined);
    }

    // 7. Delete attendance
    await tx.attendance.deleteMany({
      where: { enrollment_id: { in: enrollmentIds } },
    });

    // 8. Delete training enrollments
    await tx.training_enrollment.deleteMany({
      where: { plan_id: { in: planIds } },
    });
  }

  // 9. Delete certificate import batches (if any)
  if (batchIds.length > 0) {
    await tx.certificate_import_batch.deleteMany({
      where: { certificate_import_batch_id: { in: batchIds } },
    }).catch(() => undefined);
  }

  // 10. Delete training plan assessment settings
  await tx.training_plan_assessment_setting.deleteMany({
    where: { plan_id: { in: planIds } },
  }).catch(() => undefined);

  // 11. Delete training expenses
  await tx.training_expense.deleteMany({
    where: { plan_id: { in: planIds } },
  }).catch(() => undefined);

  // 12. Unlink training need requests
  await tx.training_need_request.updateMany({
    where: { training_plan_id: { in: planIds } },
    data: { training_plan_id: null },
  }).catch(() => undefined);

  // 13. Delete the training plans
  await tx.training_plan.deleteMany({
    where: { plan_id: { in: planIds } },
  });
};
