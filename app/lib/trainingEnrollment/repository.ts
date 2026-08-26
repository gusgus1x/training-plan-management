import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  AttendanceStatus,
  CreateEnrollmentInput,
  EnrollmentAction,
  EnrollmentListFilters,
  EnrollmentSource,
  EnrollmentStatus,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "training_enrollment" | "training_plan" | "employee" | "attendance" | "course_standard_course">;

const forbidden = (message: string) => new ApiError({ code: "FORBIDDEN", message, status: 403 });

const employeeInclude = {
  company: true,
  organization_function: true,
  section: true,
  division: true,
  department: true,
  position: true,
  employee_level: true,
} satisfies Prisma.employeeInclude;

const enrollmentInclude = {
  employee: { include: employeeInclude },
  attendance: true,
  training_plan: { include: { training_plan_oap: { select: { company_id: true } } } },
} satisfies Prisma.training_enrollmentInclude;

type EnrollmentWithRelations = Prisma.training_enrollmentGetPayload<{ include: typeof enrollmentInclude }>;
type EmployeeWithRelations = Prisma.employeeGetPayload<{ include: typeof employeeInclude }>;

const employeeDisplayName = (employee: EmployeeWithRelations) => {
  const prefixStr = employee.title_th || employee.title_en || "";
  const nameStr = `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
    `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim();
  return prefixStr ? `${prefixStr} ${nameStr}` : nameStr;
};

const mapStatus = (approvalStatus: string, planOwnerIsFactory: boolean): EnrollmentStatus => {
  switch (approvalStatus) {
    case "APPROVED":
      return planOwnerIsFactory ? "Factory Approved" : "Center Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Pending Approval";
  }
};

const mapEnrollment = (row: EnrollmentWithRelations) => {
  const planOwnerIsFactory = row.training_plan.training_plan_oap.company_id !== null;
  const employee = row.employee;
  return {
    id: row.enrollment_id.toString(),
    planId: row.plan_id.toString(),
    employeeId: employee.employee_id.toString(),
    // Carried through so the layers above can move to the durable key without another query.
    employeeUserId: row.employee_user_id ?? employee.user_id ?? null,
    employeeCode: employee.employee_code ?? "",
    employeeName: employeeDisplayName(employee),
    prefix: employee.title_th || employee.title_en || "",
    firstName: employee.first_name_th || employee.first_name_en || "",
    lastName: employee.last_name_th || employee.last_name_en || "",
    company: employee.company.company_code,
    section: employee.section?.section_name_th || employee.section?.section_name_en || "",
    division: employee.division?.division_name_th || employee.division?.division_name_en || "",
    department: employee.organization_function?.function_name_en || employee.organization_function?.function_name_th || employee.department?.department_name_th || "",
    position: employee.position?.position_name_en || employee.position?.position_name_th || "",
    // level_key is a Thai abbreviation (จ/บ/ป + number), not an English code despite the
    // name — level_code ("S1"/"O1"/"M1"..."M4") is the real English code and must come first.
    level: employee.employee_level?.level_code || employee.employee_level?.level_code_en || employee.employee_level?.level_name_en || employee.employee_level?.level_key || employee.employee_level?.level_code_th || "",
    source: row.enrollment_source as EnrollmentSource,
    status: mapStatus(row.approval_status, planOwnerIsFactory),
    targetMatchStatus: row.target_match_status as "MATCHED" | "NOT_MATCHED",
    levelMatchStatus: row.level_match_status as "MATCHED" | "NOT_MATCHED" | "NOT_REQUIRED",
    remark: row.reject_reason || row.queue_override_reason || "",
    enrolledAt: row.enrolled_at.toISOString(),
    approvedBy: row.approved_by?.toString() || null,
    approvedAt: row.approved_at?.toISOString() || null,
    attendance: row.attendance
      ? {
          attendanceId: row.attendance.attendance_id.toString(),
          status: row.attendance.attendance_status as AttendanceStatus,
          checkInAt: row.attendance.check_in_at?.toISOString() || null,
          checkOutAt: row.attendance.check_out_at?.toISOString() || null,
          method: row.attendance.attendance_method,
          recordedBy: row.attendance.recorded_by?.toString() || null,
          remark: row.attendance.remark || "",
        }
      : null,
  };
};

export const computeTargetMatch = async (
  db: DatabaseClient,
  courseId: bigint,
  employee: EmployeeWithRelations,
) => {
  const standards = await db.course_standard_course.findMany({
    where: { course_id: courseId },
    include: {
      course_standard_target_position: true,
      course_standard_target_level: true,
      course_standard_target_company: true,
    },
  });

  if (standards.length === 0) {
    return { targetMatchStatus: "NOT_MATCHED" as const, levelMatchStatus: "NOT_REQUIRED" as const, standardCourseId: null as bigint | null };
  }

  let matchedStandardId: bigint | null = null;
  let overallTargetMatched = false;
  let overallHasLevels = false;
  let overallLevelMatched = false;

  for (const standard of standards) {
    const hasLevels = standard.course_standard_target_level.length > 0;
    const hasPositions = standard.course_standard_target_position.length > 0;

    if (hasLevels) overallHasLevels = true;

    const isLevelMatched =
      hasLevels &&
      employee.level_id !== null &&
      standard.course_standard_target_level.some((row) => row.level_id === employee.level_id);

    if (isLevelMatched) overallLevelMatched = true;

    const isPositionMatched =
      hasPositions &&
      employee.position_id !== null &&
      standard.course_standard_target_position.some((row) => row.position_id === employee.position_id);

    let posLevelMatch = true;
    if (hasLevels && hasPositions) {
      posLevelMatch = isLevelMatched && isPositionMatched;
    } else if (hasLevels) {
      posLevelMatch = isLevelMatched;
    } else if (hasPositions) {
      posLevelMatch = isPositionMatched;
    }

    const orgMatch =
      (standard.function_id === null || standard.function_id === employee.function_id) &&
      (standard.division_id === null || standard.division_id === employee.division_id) &&
      (standard.department_id === null || standard.department_id === employee.department_id) &&
      (standard.section_id === null || standard.section_id === employee.section_id);

    const companyMatch =
      standard.course_standard_target_company.length === 0 ||
      standard.course_standard_target_company.some((row) => row.company_id === employee.company_id);

    if (orgMatch && companyMatch && posLevelMatch) {
      overallTargetMatched = true;
      matchedStandardId = standard.standard_course_id;
      break;
    }
  }

  const targetMatchStatus = overallTargetMatched ? ("MATCHED" as const) : ("NOT_MATCHED" as const);
  const levelMatchStatus = !overallHasLevels
    ? ("NOT_REQUIRED" as const)
    : overallLevelMatched
      ? ("MATCHED" as const)
      : ("NOT_MATCHED" as const);

  return {
    targetMatchStatus,
    levelMatchStatus,
    standardCourseId: matchedStandardId ?? standards[0].standard_course_id,
  };
};

const loadPlanScope = async (db: DatabaseClient, planId: bigint) => {
  const plan = await db.training_plan.findUniqueOrThrow({
    where: { plan_id: planId },
    include: { training_plan_oap: { select: { course_id: true, company_id: true } } },
  });
  return { courseId: plan.training_plan_oap.course_id, companyId: plan.training_plan_oap.company_id };
};

const assertFactoryScopeForEnrollment = (
  planCompanyId: bigint | null,
  employeeCompanyId: bigint | null,
  requesterCompanyId: string | null,
) => {
  if (requesterCompanyId === null) {
    throw forbidden("This training plan or employee is outside your permitted scope");
  }
  const isOwnPlan = planCompanyId !== null && planCompanyId.toString() === requesterCompanyId;
  const isOwnEmployee = employeeCompanyId !== null && employeeCompanyId.toString() === requesterCompanyId;

  if (!isOwnPlan && !isOwnEmployee) {
    throw forbidden("This training plan or employee is outside your permitted scope");
  }
};

export type EnrollmentRepository = ReturnType<typeof createEnrollmentRepository>;
export const createEnrollmentRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as unknown as DatabaseClient & PrismaClient;
  return {
    async list(filters: EnrollmentListFilters, companyId: string | null) {
      const where: Prisma.training_enrollmentWhereInput = {};
      if (filters.planId) where.plan_id = BigInt(filters.planId);
      // The durable key wins when the caller supplies it; employee_id remains the legacy filter.
      if (filters.employeeUserId) where.employee_user_id = filters.employeeUserId;
      else if (filters.employeeId) where.employee = { employee_id: BigInt(filters.employeeId) };
      if (companyId) {
        // A factory HRD needs visibility into both directions: enrollments under a plan
        // their own company owns (any employee), and their own employees' enrollments
        // under a plan owned by someone else (e.g. submitted to a Center-owned course).
        where.OR = [
          { training_plan: { training_plan_oap: { company_id: BigInt(companyId) } } },
          { employee: { company_id: BigInt(companyId) } },
        ];
      }

      return withDatabaseErrorMapping(async () => {
        const rows = await db().training_enrollment.findMany({
          where,
          include: enrollmentInclude,
          orderBy: { enrolled_at: "asc" },
        });
        return rows.map(mapEnrollment);
      });
    },

    async create(input: CreateEnrollmentInput, userId: string, role: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const planId = BigInt(input.planId);
        const { courseId, companyId: planCompanyId } = await loadPlanScope(db(), planId);
        // Resolve by the durable key when the caller sent one, otherwise by the surrogate id.
        const employee = input.employeeUserId
          ? await db().employee.findUniqueOrThrow({ where: { user_id: input.employeeUserId }, include: employeeInclude })
          : await db().employee.findUniqueOrThrow({ where: { employee_id: BigInt(input.employeeId) }, include: employeeInclude });

        if (role === "HRD_FACTORY") {
          assertFactoryScopeForEnrollment(planCompanyId, employee.company_id, companyId);
        }

        const { targetMatchStatus, levelMatchStatus, standardCourseId } = await computeTargetMatch(db(), courseId, employee);

        const isOwnFactoryPlan = planCompanyId !== null && companyId !== null && planCompanyId.toString() === companyId;
        const autoApprove = role === "HRD_CENTER" || (role === "HRD_FACTORY" && isOwnFactoryPlan);

        const data: Prisma.training_enrollmentUncheckedCreateInput = {
          plan_id: planId,
          // employee_id is gone from this table (Phase 20 Stage 8); the durable key is the link.
          employee_user_id: employee.user_id,
          enrollment_source: input.source,
          approval_status: autoApprove ? "APPROVED" : "PENDING",
          standard_course_id: standardCourseId,
          position_id_snapshot: employee.position_id,
          position_code_snapshot: employee.position?.position_code || null,
          position_name_snapshot: employee.position?.position_name_en || employee.position?.position_name_th || null,
          level_id_snapshot: employee.level_id,
          level_code_snapshot: employee.employee_level?.level_code || employee.employee_level?.level_code_en || employee.employee_level?.level_key || null,
          level_name_snapshot: employee.employee_level?.level_name_en || employee.employee_level?.level_name_th || null,
          target_match_status: targetMatchStatus,
          level_match_status: levelMatchStatus,
          target_checked_at: new Date(),
          enrolled_at: new Date(),
          approved_by: autoApprove ? BigInt(userId) : null,
          approved_at: autoApprove ? new Date() : null,
        };

        const existing = await db().training_enrollment.findUnique({
          where: { plan_id_employee_user_id: { plan_id: planId, employee_user_id: employee.user_id } },
        });

        const saved = existing
          ? await db().training_enrollment.update({ where: { enrollment_id: existing.enrollment_id }, data, include: enrollmentInclude })
          : await db().training_enrollment.create({ data, include: enrollmentInclude });

        return mapEnrollment(saved);
      });
    },

    async updateStatus(
      id: string,
      action: EnrollmentAction,
      reason: string | undefined,
      userId: string,
      role: string,
      companyId: string | null,
      requesterEmployeeId: string | null,
      requesterEmployeeUserId: string | null,
    ) {
      return withDatabaseErrorMapping(async () => {
        const enrollmentId = BigInt(id);
        const current = await db().training_enrollment.findUniqueOrThrow({
          where: { enrollment_id: enrollmentId },
          include: enrollmentInclude,
        });

        if (role === "HRD_FACTORY") {
          assertFactoryScopeForEnrollment(
            current.training_plan.training_plan_oap.company_id,
            current.employee.company_id,
            companyId,
          );
        } else if (role === "EMPLOYEE") {
          // Same rule as requireEmployeeOwnership: either key may prove it, neither may be assumed.
          const ownsByDurableKey =
            requesterEmployeeUserId !== null &&
            current.employee_user_id !== null &&
            current.employee_user_id === requesterEmployeeUserId;
          const ownsBySurrogateKey =
            requesterEmployeeId !== null &&
            current.employee.employee_id.toString() === requesterEmployeeId;

          if (action !== "cancel" || (!ownsByDurableKey && !ownsBySurrogateKey)) {
            throw forbidden("You can only withdraw your own registration");
          }
        }

        const data: Prisma.training_enrollmentUncheckedUpdateInput = {};
        if (action === "approve") {
          data.approval_status = "APPROVED";
          data.approved_by = BigInt(userId);
          data.approved_at = new Date();
          data.reject_reason = null;
        } else if (action === "reject") {
          data.approval_status = "REJECTED";
          data.approved_by = BigInt(userId);
          data.approved_at = new Date();
          data.reject_reason = reason || null;
        } else {
          data.approval_status = "CANCELLED";
          data.approved_by = BigInt(userId);
          data.approved_at = new Date();
        }

        const updated = await db().training_enrollment.update({ where: { enrollment_id: enrollmentId }, data, include: enrollmentInclude });
        return mapEnrollment(updated);
      });
    },

    async setAttendance(id: string, attended: boolean, userId: string, role: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const enrollmentId = BigInt(id);
        const current = await db().training_enrollment.findUniqueOrThrow({
          where: { enrollment_id: enrollmentId },
          include: enrollmentInclude,
        });

        if (role === "HRD_FACTORY") {
          assertFactoryScopeForEnrollment(
            current.training_plan.training_plan_oap.company_id,
            current.employee.company_id,
            companyId,
          );
        }

        if (!attended) {
          if (current.attendance) {
            await db().attendance.delete({ where: { enrollment_id: enrollmentId } });
          }
        } else {
          await db().attendance.upsert({
            where: { enrollment_id: enrollmentId },
            create: {
              enrollment_id: enrollmentId,
              attendance_status: "PRESENT",
              attendance_method: "MANUAL",
              check_in_at: new Date(),
              recorded_by: BigInt(userId),
            },
            update: {
              attendance_status: "PRESENT",
              check_in_at: new Date(),
              recorded_by: BigInt(userId),
            },
          });
        }

        const updated = await db().training_enrollment.findUniqueOrThrow({ where: { enrollment_id: enrollmentId }, include: enrollmentInclude });
        return mapEnrollment(updated);
      });
    },
  };
};

export const enrollmentRepository = createEnrollmentRepository();
