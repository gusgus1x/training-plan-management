import { config as loadEnvironment } from "dotenv";
import { describe, expect, it } from "vitest";

loadEnvironment({ path: ".env", quiet: true });
loadEnvironment({ path: ".env.local", quiet: true });

describe("Database Cascade Deletion Live Integration Tests", () => {
  it("verifies rollingPlanRepository.delete() removes training plan and cascading records from database", async () => {
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const { rollingPlanRepository } = await import(
      "../../app/lib/trainingRolling/repository"
    );

    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-6) + "_r";
    const testCourseCode = `TEST_CR_${suffix}`;
    const testCourseName = `Test Course Rolling ${suffix}`;
    const testOapCode = `TEST_OAPR_${suffix}`;
    const testPlanCode = `TEST_PLANR_${suffix}`;

    try {
      const user = await prisma.user_account.findFirstOrThrow({ orderBy: { user_id: "asc" } });
      const courseType = await prisma.course_type.findFirstOrThrow({ orderBy: { course_type_id: "asc" } });
      const courseGroup = await prisma.course_group.findFirstOrThrow({ orderBy: { course_group_id: "asc" } });
      const employee = await prisma.employee.findFirstOrThrow({ orderBy: { employee_id: "asc" } });

      const course = await prisma.course.create({
        data: {
          course_code: testCourseCode,
          course_name: testCourseName,
          course_name_normalized: testCourseName.toLowerCase(),
          course_type_id: courseType.course_type_id,
          course_group_id: courseGroup.course_group_id,
          duration_hours: 3,
          status: "ACTIVE",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const oap = await prisma.training_plan_oap.create({
        data: {
          oap_code: testOapCode,
          plan_year: 2099,
          course_id: course.course_id,
          course_name_snapshot: testCourseName,
          planned_duration_hours: 3,
          default_participant_count: 5,
          total_planned_budget: 3000,
          enrollment_mode: "BOTH",
          allow_non_target: true,
          status: "OPEN",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const plan = await prisma.training_plan.create({
        data: {
          oap_plan_id: oap.oap_plan_id,
          batch_no: 1,
          batch_name: "Batch 1",
          plan_code: testPlanCode,
          plan_name: `${testCourseName} - Batch 1`,
          start_datetime: new Date(),
          end_datetime: new Date(Date.now() + 3 * 3600000),
          capacity: 15,
          capacity_control_mode: "HARD_LIMIT",
          allow_walk_in: false,
          status: "OPEN",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const enrollment = await prisma.training_enrollment.create({
        data: {
          plan_id: plan.plan_id,
          employee_id: employee.employee_id,
          enrollment_source: "HRD_CENTER",
          approval_status: "APPROVED",
          target_match_status: "MATCHED",
          level_match_status: "MATCHED",
          target_checked_at: new Date(),
          enrolled_at: new Date(),
        },
      });

      const attendance = await prisma.attendance.create({
        data: {
          enrollment_id: enrollment.enrollment_id,
          attendance_status: "PRESENT",
          attendance_method: "QR",
        },
      });

      // Verify before
      expect(await prisma.training_plan.count({ where: { plan_id: plan.plan_id } })).toBe(1);
      expect(await prisma.training_enrollment.count({ where: { enrollment_id: enrollment.enrollment_id } })).toBe(1);
      expect(await prisma.attendance.count({ where: { attendance_id: attendance.attendance_id } })).toBe(1);

      // DELETE via rollingPlanRepository.delete
      const res = await rollingPlanRepository.delete(plan.plan_id.toString());
      expect(res.outcome).toBe("DELETED");

      // Verify after
      expect(await prisma.training_plan.count({ where: { plan_id: plan.plan_id } })).toBe(0);
      expect(await prisma.training_enrollment.count({ where: { enrollment_id: enrollment.enrollment_id } })).toBe(0);
      expect(await prisma.attendance.count({ where: { attendance_id: attendance.attendance_id } })).toBe(0);

      // Clean up test oap & course
      await prisma.training_plan_oap.delete({ where: { oap_plan_id: oap.oap_plan_id } });
      await prisma.course.delete({ where: { course_id: course.course_id } });
    } finally {
      await resetPrismaClient();
    }
  });

  it("verifies oapPlanRepository.delete() cascades all child sessions and removes OAP from database", async () => {
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const { oapPlanRepository } = await import(
      "../../app/lib/trainingOap/repository"
    );

    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-6) + "_o";
    const testCourseCode = `TEST_CO_${suffix}`;
    const testCourseName = `Test Course OAP ${suffix}`;
    const testOapCode = `TEST_OAPO_${suffix}`;
    const testPlanCode1 = `TEST_PLAN1_${suffix}`;
    const testPlanCode2 = `TEST_PLAN2_${suffix}`;

    try {
      const user = await prisma.user_account.findFirstOrThrow({ orderBy: { user_id: "asc" } });
      const courseType = await prisma.course_type.findFirstOrThrow({ orderBy: { course_type_id: "asc" } });
      const courseGroup = await prisma.course_group.findFirstOrThrow({ orderBy: { course_group_id: "asc" } });
      const employee = await prisma.employee.findFirstOrThrow({ orderBy: { employee_id: "asc" } });

      const course = await prisma.course.create({
        data: {
          course_code: testCourseCode,
          course_name: testCourseName,
          course_name_normalized: testCourseName.toLowerCase(),
          course_type_id: courseType.course_type_id,
          course_group_id: courseGroup.course_group_id,
          duration_hours: 6,
          status: "ACTIVE",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const oap = await prisma.training_plan_oap.create({
        data: {
          oap_code: testOapCode,
          plan_year: 2099,
          course_id: course.course_id,
          course_name_snapshot: testCourseName,
          planned_duration_hours: 6,
          default_participant_count: 20,
          total_planned_budget: 10000,
          enrollment_mode: "BOTH",
          allow_non_target: true,
          status: "OPEN",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      // Session 1
      const plan1 = await prisma.training_plan.create({
        data: {
          oap_plan_id: oap.oap_plan_id,
          batch_no: 1,
          batch_name: "Batch 1",
          plan_code: testPlanCode1,
          plan_name: `${testCourseName} - Batch 1`,
          start_datetime: new Date(),
          end_datetime: new Date(Date.now() + 6 * 3600000),
          capacity: 10,
          capacity_control_mode: "HARD_LIMIT",
          allow_walk_in: false,
          status: "OPEN",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      // Session 2
      const plan2 = await prisma.training_plan.create({
        data: {
          oap_plan_id: oap.oap_plan_id,
          batch_no: 2,
          batch_name: "Batch 2",
          plan_code: testPlanCode2,
          plan_name: `${testCourseName} - Batch 2`,
          start_datetime: new Date(),
          end_datetime: new Date(Date.now() + 6 * 3600000),
          capacity: 10,
          capacity_control_mode: "HARD_LIMIT",
          allow_walk_in: false,
          status: "OPEN",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const enrollment1 = await prisma.training_enrollment.create({
        data: {
          plan_id: plan1.plan_id,
          employee_id: employee.employee_id,
          enrollment_source: "HRD_CENTER",
          approval_status: "APPROVED",
          target_match_status: "MATCHED",
          level_match_status: "MATCHED",
          target_checked_at: new Date(),
          enrolled_at: new Date(),
        },
      });

      const attendance1 = await prisma.attendance.create({
        data: {
          enrollment_id: enrollment1.enrollment_id,
          attendance_status: "PRESENT",
          attendance_method: "QR",
        },
      });

      // Verify before
      expect(await prisma.training_plan_oap.count({ where: { oap_plan_id: oap.oap_plan_id } })).toBe(1);
      expect(await prisma.training_plan.count({ where: { plan_id: plan1.plan_id } })).toBe(1);
      expect(await prisma.training_plan.count({ where: { plan_id: plan2.plan_id } })).toBe(1);
      expect(await prisma.training_enrollment.count({ where: { enrollment_id: enrollment1.enrollment_id } })).toBe(1);
      expect(await prisma.attendance.count({ where: { attendance_id: attendance1.attendance_id } })).toBe(1);

      // DELETE via oapPlanRepository.delete
      const res = await oapPlanRepository.delete(oap.oap_plan_id.toString());
      expect(res.outcome).toBe("DELETED");

      // Verify after
      expect(await prisma.training_plan_oap.count({ where: { oap_plan_id: oap.oap_plan_id } })).toBe(0);
      expect(await prisma.training_plan.count({ where: { plan_id: plan1.plan_id } })).toBe(0);
      expect(await prisma.training_plan.count({ where: { plan_id: plan2.plan_id } })).toBe(0);
      expect(await prisma.training_enrollment.count({ where: { enrollment_id: enrollment1.enrollment_id } })).toBe(0);
      expect(await prisma.attendance.count({ where: { attendance_id: attendance1.attendance_id } })).toBe(0);

      // Clean up test course
      await prisma.course.delete({ where: { course_id: course.course_id } });
    } finally {
      await resetPrismaClient();
    }
  });

  it("verifies courseRepository.delete() cascades all OAPs, sessions, target scopes and removes course from database", async () => {
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const { courseRepository } = await import(
      "../../app/lib/courses/repository"
    );

    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-6) + "_c";
    const testCourseCode = `TEST_C_${suffix}`;
    const testCourseName = `Test Course Cascade ${suffix}`;
    const testOapCode = `TEST_OAP_${suffix}`;
    const testPlanCode = `TEST_PLAN_${suffix}`;
    let standardId: bigint | null = null;

    try {
      const user = await prisma.user_account.findFirstOrThrow({ orderBy: { user_id: "asc" } });
      const company = await prisma.company.findFirstOrThrow({ orderBy: { company_id: "asc" } });
      const courseType = await prisma.course_type.findFirstOrThrow({ orderBy: { course_type_id: "asc" } });
      const courseGroup = await prisma.course_group.findFirstOrThrow({ orderBy: { course_group_id: "asc" } });
      const employee = await prisma.employee.findFirstOrThrow({ orderBy: { employee_id: "asc" } });

      const course = await prisma.course.create({
        data: {
          course_code: testCourseCode,
          course_name: testCourseName,
          course_name_normalized: testCourseName.toLowerCase(),
          course_type_id: courseType.course_type_id,
          course_group_id: courseGroup.course_group_id,
          duration_hours: 4,
          status: "ACTIVE",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const standardYear = 2099;
      let standard = await prisma.course_standard.findFirst({ where: { standard_year: standardYear } });
      if (!standard) {
        standard = await prisma.course_standard.create({
          data: {
            standard_year: standardYear,
            standard_code: `STD_${suffix}`,
            standard_name: `Standard ${suffix}`,
            status: "ACTIVE",
            created_by: user.user_id,
            created_at: new Date(),
          },
        });
      }
      standardId = standard.standard_id;

      const stdCourse = await prisma.course_standard_course.create({
        data: {
          standard_id: standard.standard_id,
          course_id: course.course_id,
          created_at: new Date(),
        },
      });

      const targetCompany = await prisma.course_standard_target_company.create({
        data: {
          standard_course_id: stdCourse.standard_course_id,
          company_id: company.company_id,
        },
      });

      const oap = await prisma.training_plan_oap.create({
        data: {
          oap_code: testOapCode,
          plan_year: 2099,
          course_id: course.course_id,
          course_name_snapshot: testCourseName,
          planned_duration_hours: 4,
          default_participant_count: 10,
          total_planned_budget: 5000,
          enrollment_mode: "BOTH",
          allow_non_target: true,
          status: "OPEN",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const plan = await prisma.training_plan.create({
        data: {
          oap_plan_id: oap.oap_plan_id,
          batch_no: 1,
          batch_name: "Batch 1",
          plan_code: testPlanCode,
          plan_name: `${testCourseName} - Batch 1`,
          start_datetime: new Date(),
          end_datetime: new Date(Date.now() + 4 * 3600000),
          capacity: 20,
          capacity_control_mode: "HARD_LIMIT",
          allow_walk_in: false,
          status: "OPEN",
          created_by: user.user_id,
          created_at: new Date(),
        },
      });

      const enrollment = await prisma.training_enrollment.create({
        data: {
          plan_id: plan.plan_id,
          employee_id: employee.employee_id,
          enrollment_source: "HRD_CENTER",
          approval_status: "APPROVED",
          target_match_status: "MATCHED",
          level_match_status: "MATCHED",
          target_checked_at: new Date(),
          enrolled_at: new Date(),
          standard_course_id: stdCourse.standard_course_id,
        },
      });

      const attendance = await prisma.attendance.create({
        data: {
          enrollment_id: enrollment.enrollment_id,
          attendance_status: "PRESENT",
          attendance_method: "QR",
        },
      });

      // Verify before
      expect(await prisma.course.count({ where: { course_id: course.course_id } })).toBe(1);
      expect(await prisma.training_plan_oap.count({ where: { oap_plan_id: oap.oap_plan_id } })).toBe(1);
      expect(await prisma.training_plan.count({ where: { plan_id: plan.plan_id } })).toBe(1);
      expect(await prisma.training_enrollment.count({ where: { enrollment_id: enrollment.enrollment_id } })).toBe(1);
      expect(await prisma.attendance.count({ where: { attendance_id: attendance.attendance_id } })).toBe(1);
      expect(await prisma.course_standard_target_company.count({ where: { target_company_id: targetCompany.target_company_id } })).toBe(1);

      // Perform cascade delete via courseRepository
      const deleteResult = await courseRepository.delete(course.course_id.toString());
      expect(deleteResult.outcome).toBe("DELETED");

      // Verify after
      expect(await prisma.course.count({ where: { course_id: course.course_id } })).toBe(0);
      expect(await prisma.training_plan_oap.count({ where: { oap_plan_id: oap.oap_plan_id } })).toBe(0);
      expect(await prisma.training_plan.count({ where: { plan_id: plan.plan_id } })).toBe(0);
      expect(await prisma.training_enrollment.count({ where: { enrollment_id: enrollment.enrollment_id } })).toBe(0);
      expect(await prisma.attendance.count({ where: { attendance_id: attendance.attendance_id } })).toBe(0);
      expect(await prisma.course_standard_target_company.count({ where: { target_company_id: targetCompany.target_company_id } })).toBe(0);
    } finally {
      if (standardId) {
        await prisma.course_standard.delete({ where: { standard_id: standardId } }).catch(() => undefined);
      }
      await resetPrismaClient();
    }
  });
});
