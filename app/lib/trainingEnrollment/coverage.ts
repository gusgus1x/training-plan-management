import { getPrismaClient } from "../database/prisma";
import { withDatabaseErrorMapping } from "../database/errors";
import { employeeInclude, loadPlanScope, loadTargetStandards, matchTargetAgainst } from "./repository";
import { batchLabel, courseEnrollmentsSelect, isTrainedEnrollment } from "./trained";
import type { CourseCoverageEmployee } from "./types";

/** Enrollments that already hold a seat in a batch. */
const HOLDS_A_SEAT = ["PENDING", "APPROVED"];

const nameOf = (employee: { first_name_th: string | null; last_name_th: string | null; first_name_en: string | null; last_name_en: string | null; user_id: string }) =>
  `${employee.first_name_th || ""} ${employee.last_name_th || ""}`.trim() ||
  `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim() ||
  employee.user_id;

/**
 * One row per active employee in scope, for the course behind `planId`: whether they are in its
 * target group, when they last actually trained on it, and whether they already hold a seat in this
 * batch. `companyId` narrows to one company (an HRD factory's own); a factory's own course only
 * ever covers that factory.
 */
export const getCourseCoverage = (planId: string, companyId: string | null): Promise<CourseCoverageEmployee[]> =>
  withDatabaseErrorMapping(async () => {
    const db = getPrismaClient();
    const currentPlanId = BigInt(planId);
    const plan = await loadPlanScope(db, currentPlanId);
    if (companyId !== null && plan.companyId !== null && plan.companyId !== BigInt(companyId)) return [];
    const scopeCompany = plan.companyId ?? (companyId !== null ? BigInt(companyId) : null);

    const [employees, standards, enrollments] = await Promise.all([
      db.employee.findMany({
        where: { employment_status: "ACTIVE", ...(scopeCompany !== null ? { company_id: scopeCompany } : {}) },
        include: employeeInclude,
      }),
      loadTargetStandards(db, plan.courseId),
      db.training_enrollment.findMany({
        where: { training_plan: { training_plan_oap: { course_id: plan.courseId } } },
        select: courseEnrollmentsSelect,
      }),
    ]);

    const now = new Date();
    const seated = new Set<string>();
    const trained = new Map<string, { last: (typeof enrollments)[number]["training_plan"]; times: number }>();
    for (const row of enrollments) {
      if (row.plan_id === currentPlanId) {
        if (HOLDS_A_SEAT.includes(row.approval_status)) seated.add(row.employee_user_id);
        continue;
      }
      const isTrained = isTrainedEnrollment(
        {
          attendanceStatus: row.attendance?.attendance_status,
          completionStatus: row.training_result?.completion_status,
          planEnd: row.training_plan.end_datetime,
        },
        now,
      );
      if (!isTrained) continue;
      const entry = trained.get(row.employee_user_id);
      if (!entry) trained.set(row.employee_user_id, { last: row.training_plan, times: 1 });
      else {
        entry.times += 1;
        if (row.training_plan.start_datetime > entry.last.start_datetime) entry.last = row.training_plan;
      }
    }

    return employees.map((employee): CourseCoverageEmployee => {
      const history = trained.get(employee.user_id);
      return {
        employeeId: employee.employee_id.toString(),
        employeeUserId: employee.user_id,
        employeeCode: employee.employee_code ?? "",
        name: nameOf(employee),
        companyCode: employee.company?.company_code ?? "",
        department: employee.department?.department_name_th || employee.department?.department_name_en || "",
        section: employee.section?.section_name_th || employee.section?.section_name_en || "",
        inTarget: matchTargetAgainst(standards, employee).targetMatchStatus === "MATCHED",
        lastTrainedAt: history ? history.last.start_datetime.toISOString() : null,
        lastBatchName: history ? batchLabel(history.last) : null,
        timesTrained: history?.times ?? 0,
        seatedNow: seated.has(employee.user_id),
      };
    });
  });
