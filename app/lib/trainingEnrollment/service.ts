import { enrollmentRepository, type EnrollmentRepository } from "./repository";
import type { CreateEnrollmentInput, EnrollmentAction, EnrollmentListFilters } from "./types";

export type EnrollmentService = ReturnType<typeof createEnrollmentService>;
export const createEnrollmentService = (repository: EnrollmentRepository = enrollmentRepository) => ({
  listEnrollments: (filters: EnrollmentListFilters, companyId: string | null) => repository.list(filters, companyId),
  async createEnrollment(input: CreateEnrollmentInput, userId: string, role: string, companyId: string | null) {
    return repository.create(input, userId, role, companyId);
  },
  async updateEnrollmentStatus(
    id: string,
    action: EnrollmentAction,
    reason: string | undefined,
    userId: string,
    role: string,
    companyId: string | null,
    requesterEmployeeId: string | null,
  ) {
    return repository.updateStatus(id, action, reason, userId, role, companyId, requesterEmployeeId);
  },
  async setAttendance(id: string, attended: boolean, userId: string, role: string, companyId: string | null) {
    return repository.setAttendance(id, attended, userId, role, companyId);
  },
});

export const enrollmentService = createEnrollmentService();
