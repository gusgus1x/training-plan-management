import { publish } from "../realtime/bus";
import { enrollmentRepository, type EnrollmentRepository } from "./repository";
import type { CreateEnrollmentInput, EnrollmentAction, EnrollmentListFilters } from "./types";

// Every HRD account refetches on an enrollment change; its own API scopes what it then sees, so a
// factory hearing another company's change only costs one wasted request.
const HRD = ["HRD_CENTER", "HRD_FACTORY"] as const;

export type EnrollmentService = ReturnType<typeof createEnrollmentService>;
export const createEnrollmentService = (repository: EnrollmentRepository = enrollmentRepository) => ({
  listEnrollments: (filters: EnrollmentListFilters, companyId: string | null) => repository.list(filters, companyId),
  async createEnrollment(input: CreateEnrollmentInput, userId: string, role: string, companyId: string | null) {
    const enrollment = await repository.create(input, userId, role, companyId);
    publish(
      { type: "enrollment.changed", planId: enrollment.planId },
      { roles: HRD, employees: [enrollment.employeeUserId], accounts: [input.approverUserId, userId] },
    );
    return enrollment;
  },
  async updateEnrollmentStatus(
    id: string,
    action: EnrollmentAction,
    reason: string | undefined,
    userId: string,
    role: string,
    companyId: string | null,
    requesterEmployeeId: string | null,
    requesterEmployeeUserId: string | null,
  ) {
    const result = await repository.updateStatus(id, action, reason, userId, role, companyId, requesterEmployeeId, requesterEmployeeUserId);
    const record = "planId" in result ? result : null;
    publish(
      { type: "enrollment.changed", planId: record?.planId },
      { roles: HRD, employees: [record?.employeeUserId, requesterEmployeeUserId], accounts: [userId] },
    );
    return result;
  },
  async setAttendance(id: string, attended: boolean, userId: string, role: string, companyId: string | null) {
    const enrollment = await repository.setAttendance(id, attended, userId, role, companyId);
    const audience = { roles: HRD, employees: [enrollment.employeeUserId] };
    publish({ type: "attendance.changed", planId: enrollment.planId }, audience);
    publish({ type: "enrollment.changed", planId: enrollment.planId }, audience);
    return enrollment;
  },
  async getCourseHistory(planId: string) {
    return repository.getCourseHistory(planId);
  },
});

export const enrollmentService = createEnrollmentService();
