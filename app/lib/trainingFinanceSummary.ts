import type {
  WorkflowCompletedCourse,
  WorkflowOwner,
} from "./trainingWorkflow";
import type { EnrollmentRecord } from "./trainingEnrollment/types";

export type FinanceRollingPlan = {
  rollingId: string;
  scheduleGroupId?: string;
  budget: string;
  trainingDate: string;
  batch: string;
  company: string;
  relatedCompanies?: string[];
  owner: string;
  ownerScope?: WorkflowOwner;
  ownerCompany?: string;
  course: {
    code: string;
    name: string;
  };
};

export type FinancialCourseRow = {
  id: string;
  code: string;
  title: string;
  date: string;
  sessions: number;
  budget: number;
  actual: number;
  remaining: number;
  attended: number;
  status: "Planned" | "Completed" | "Over budget";
};

export type FinanceSummary = {
  rows: FinancialCourseRow[];
  courseCount: number;
  sessionCount: number;
  totalBudget: number;
  totalActual: number;
  remainingBudget: number;
  utilizationRate: number;
  attended: number;
  absent: number;
  participantTotal: number;
  attendanceRate: number;
};

export type FactoryCenterFundingRow = {
  id: string;
  code: string;
  title: string;
  date: string;
  sessions: number;
  submitted: number;
  approved: number;
  centerBudget: number;
  allocatedBudget: number;
  actualShare: number;
  method: "Approved employees" | "Submitted employees" | "Company scope";
};

export const parseMoney = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const sumCompletedCourseExpenses = (
  course: WorkflowCompletedCourse,
) =>
  Object.values(course.expenses).reduce(
    (total, value) => total + parseMoney(value),
    0,
  );

const getPeriod = (date: string, fallbackDate = "") => {
  const dateMatch = date.match(/^(\d{4})[-/](\d{1,2})/);

  if (dateMatch) {
    return {
      year: dateMatch[1],
      month: dateMatch[2].padStart(2, "0"),
    };
  }

  const parsedDate = new Date(date || fallbackDate);
  const safeDate = Number.isNaN(parsedDate.getTime())
    ? new Date(0)
    : parsedDate;

  return {
    year: String(safeDate.getFullYear()),
    month: String(safeDate.getMonth() + 1).padStart(2, "0"),
  };
};

const isInPeriod = (
  date: string,
  fallbackDate: string,
  year: string,
  month: string,
) => {
  const period = getPeriod(date, fallbackDate);
  return period.year === year && (month === "all" || period.month === month);
};

const getPlanOwner = (plan: FinanceRollingPlan): WorkflowOwner =>
  plan.ownerScope ?? (plan.owner === "admin.hrd" ? "CENTER" : "FACTORY");

const isPrimaryScope = (
  owner: WorkflowOwner,
  ownerCompany: string | undefined,
  role: "CENTER" | "FACTORY",
  companyCode: string,
) =>
  role === "CENTER"
    ? owner === "CENTER"
    : owner === "FACTORY" && ownerCompany === companyCode;

const getPlanCompanies = (plan: FinanceRollingPlan) =>
  plan.relatedCompanies?.length
    ? plan.relatedCompanies
    : plan.company === "All Companies"
      ? ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"]
      : [plan.company];

const buildRow = (
  id: string,
  plans: FinanceRollingPlan[],
  completedCourses: WorkflowCompletedCourse[],
): FinancialCourseRow => {
  const firstPlan = plans[0];
  const firstCompleted = completedCourses[0];
  const budget = Math.max(0, ...plans.map((plan) => parseMoney(plan.budget)));
  const actual = completedCourses.reduce(
    (total, course) => total + sumCompletedCourseExpenses(course),
    0,
  );
  const attended = completedCourses.reduce(
    (total, course) =>
      total + course.attendees.filter((attendee) => attendee.attended).length,
    0,
  );
  const remaining = budget - actual;

  return {
    id,
    code: firstPlan?.course.code ?? firstCompleted?.code ?? "-",
    title: firstPlan?.course.name ?? firstCompleted?.title ?? "-",
    date: firstPlan?.trainingDate ?? firstCompleted?.date ?? "-",
    sessions: Math.max(plans.length, completedCourses.length, 1),
    budget,
    actual,
    remaining,
    attended,
    status:
      actual > budget && budget > 0
        ? "Over budget"
        : completedCourses.length > 0
          ? "Completed"
          : "Planned",
  };
};

export const buildFinanceSummary = ({
  rollingPlans,
  completedCourses,
  role,
  companyCode,
  year,
  month,
}: {
  rollingPlans: FinanceRollingPlan[];
  completedCourses: WorkflowCompletedCourse[];
  role: "CENTER" | "FACTORY";
  companyCode: string;
  year: string;
  month: string;
}): FinanceSummary => {
  const scopedPlans = rollingPlans.filter(
    (plan) =>
      isPrimaryScope(
        getPlanOwner(plan),
        plan.ownerCompany ?? plan.company,
        role,
        companyCode,
      ) && isInPeriod(plan.trainingDate, "", year, month),
  );
  const scopedCompleted = completedCourses.filter(
    (course) =>
      isPrimaryScope(
        course.owner,
        course.ownerCompany ?? course.company,
        role,
        companyCode,
      ) && isInPeriod(course.date, course.savedAt, year, month),
  );
  const planGroups = new Map<string, FinanceRollingPlan[]>();

  scopedPlans.forEach((plan) => {
    const groupId = plan.scheduleGroupId ?? plan.rollingId;
    planGroups.set(groupId, [...(planGroups.get(groupId) ?? []), plan]);
  });

  const matchedCompletedIds = new Set<string>();
  const rows = [...planGroups.entries()].map(([groupId, plans]) => {
    const rollingIds = new Set(plans.map((plan) => plan.rollingId));
    const matches = scopedCompleted.filter((course) => {
      const matched =
        rollingIds.has(course.rollingId) ||
        (course.scheduleGroupId && course.scheduleGroupId === groupId);
      if (matched) {
        matchedCompletedIds.add(course.id);
      }
      return matched;
    });

    return buildRow(groupId, plans, matches);
  });

  const orphanGroups = new Map<string, WorkflowCompletedCourse[]>();
  scopedCompleted
    .filter((course) => !matchedCompletedIds.has(course.id))
    .forEach((course) => {
      const groupId = course.scheduleGroupId ?? course.rollingId;
      orphanGroups.set(groupId, [
        ...(orphanGroups.get(groupId) ?? []),
        course,
      ]);
    });
  orphanGroups.forEach((courses, groupId) => {
    rows.push(buildRow(groupId, [], courses));
  });

  rows.sort((a, b) => b.date.localeCompare(a.date));
  const attendees = scopedCompleted.flatMap((course) => course.attendees);
  const attended = attendees.filter((attendee) => attendee.attended).length;
  const absent = attendees.filter((attendee) => !attendee.attended).length;
  const participantTotal = attended + absent;
  const totalBudget = rows.reduce((total, row) => total + row.budget, 0);
  const totalActual = rows.reduce((total, row) => total + row.actual, 0);

  return {
    rows,
    courseCount: rows.length,
    sessionCount: new Set([
      ...scopedPlans.map((plan) => plan.rollingId),
      ...scopedCompleted.map((course) => course.rollingId),
    ]).size,
    totalBudget,
    totalActual,
    remainingBudget: totalBudget - totalActual,
    utilizationRate:
      totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0,
    attended,
    absent,
    participantTotal,
    attendanceRate:
      participantTotal > 0
        ? Math.round((attended / participantTotal) * 100)
        : 0,
  };
};

export const buildFactoryCenterFunding = ({
  rollingPlans,
  completedCourses,
  enrollments,
  companyCode,
  year,
  month,
}: {
  rollingPlans: FinanceRollingPlan[];
  completedCourses: WorkflowCompletedCourse[];
  enrollments: EnrollmentRecord[];
  companyCode: string;
  year: string;
  month: string;
}): FactoryCenterFundingRow[] => {
  const submittedStatuses = new Set(["Pending Approval", "Center Approved"]);
  const centerPlans = rollingPlans.filter(
    (plan) =>
      getPlanOwner(plan) === "CENTER" &&
      isInPeriod(plan.trainingDate, "", year, month) &&
      (getPlanCompanies(plan).includes(companyCode) ||
        enrollments.some(
          (enrollment) =>
            enrollment.planId === plan.rollingId &&
            enrollment.company === companyCode &&
            submittedStatuses.has(enrollment.status),
        )),
  );
  const groups = new Map<string, FinanceRollingPlan[]>();

  centerPlans.forEach((plan) => {
    const groupId = plan.scheduleGroupId ?? plan.rollingId;
    groups.set(groupId, [...(groups.get(groupId) ?? []), plan]);
  });

  return [...groups.entries()]
    .map(([groupId, plans]) => {
      const firstPlan = plans[0];
      const rollingIds = new Set(plans.map((plan) => plan.rollingId));
      const groupAcceptances = enrollments.filter(
        (enrollment) =>
          rollingIds.has(enrollment.planId) &&
          submittedStatuses.has(enrollment.status),
      );
      const approvedAcceptances = groupAcceptances.filter(
        (acceptance) => acceptance.status === "Center Approved",
      );
      const companySubmitted = groupAcceptances.filter(
        (acceptance) => acceptance.company === companyCode,
      ).length;
      const companyApproved = approvedAcceptances.filter(
        (acceptance) => acceptance.company === companyCode,
      ).length;
      const companies = Array.from(
        new Set(plans.flatMap((plan) => getPlanCompanies(plan))),
      );
      let allocationRate = 0;
      let method: FactoryCenterFundingRow["method"] = "Company scope";

      if (approvedAcceptances.length > 0) {
        allocationRate = companyApproved / approvedAcceptances.length;
        method = "Approved employees";
      } else if (groupAcceptances.length > 0) {
        allocationRate = companySubmitted / groupAcceptances.length;
        method = "Submitted employees";
      } else if (companies.includes(companyCode) && companies.length > 0) {
        allocationRate = 1 / companies.length;
      }

      const centerBudget = Math.max(
        0,
        ...plans.map((plan) => parseMoney(plan.budget)),
      );
      const completed = completedCourses.filter(
        (course) =>
          (rollingIds.has(course.rollingId) ||
            (course.scheduleGroupId && course.scheduleGroupId === groupId)) &&
          isInPeriod(course.date, course.savedAt, year, month),
      );
      const actualTotal = completed.reduce(
        (total, course) => total + sumCompletedCourseExpenses(course),
        0,
      );
      const actualAttendees = completed.flatMap((course) =>
        course.attendees.filter((attendee) => attendee.attended),
      );
      const companyActualAttendees = actualAttendees.filter(
        (attendee) => attendee.company === companyCode,
      ).length;
      const actualRate =
        actualAttendees.length > 0
          ? companyActualAttendees / actualAttendees.length
          : allocationRate;

      return {
        id: groupId,
        code: firstPlan.course.code,
        title: firstPlan.course.name,
        date: firstPlan.trainingDate,
        sessions: plans.length,
        submitted: companySubmitted,
        approved: companyApproved,
        centerBudget,
        allocatedBudget: Math.round(centerBudget * allocationRate),
        actualShare: Math.round(actualTotal * actualRate),
        method,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
};
