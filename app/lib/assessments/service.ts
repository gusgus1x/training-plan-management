import { ApiError } from "../api/errors";
import type { AuthenticatedPrincipal } from "../auth/types";
import {
  assessmentRepository,
  normalizeAssessmentName,
  type AssessmentRepository,
} from "./repository";
import type { AssessmentListFilters, AssessmentRecord, AssessmentStatus, AssessmentWriteInput } from "./types";

const fail = (code: string, message: string, status: number) =>
  new ApiError({ code, message, status });

const requireFactoryCompany = (principal: AuthenticatedPrincipal) => {
  if (principal.role === "HRD_FACTORY" && !principal.companyId) {
    throw fail("COMPANY_SCOPE_REQUIRED", "The signed-in HRD Factory account has no company scope", 403);
  }
};

type StoredAssessmentRecord = Omit<AssessmentRecord, "canModify" | "canCreateVersion">;

const owns = (record: StoredAssessmentRecord, principal: AuthenticatedPrincipal) =>
  principal.role === "HRD_CENTER" ||
  (record.companyId !== null && record.companyId === principal.companyId);

const writable = (record: StoredAssessmentRecord, principal: AuthenticatedPrincipal) =>
  owns(record, principal) && !record.isUsed;

const targetCompany = (input: AssessmentWriteInput, principal: AuthenticatedPrincipal) => {
  requireFactoryCompany(principal);
  if (principal.role === "HRD_FACTORY") return principal.companyId!;
  return input.scope === "CENTRAL" ? null : input.companyId;
};

const assertReadable = (record: StoredAssessmentRecord, principal: AuthenticatedPrincipal) => {
  requireFactoryCompany(principal);
  if (
    principal.role === "HRD_FACTORY" &&
    record.companyId !== null &&
    record.companyId !== principal.companyId
  ) {
    throw fail("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
  }
};

const transitions: Record<AssessmentRecord["status"], readonly AssessmentRecord["status"][]> = {
  DRAFT: ["DRAFT", "ACTIVE"],
  ACTIVE: ["ACTIVE", "INACTIVE"],
  INACTIVE: ["INACTIVE", "ACTIVE"],
};

export type AssessmentService = ReturnType<typeof createAssessmentService>;

export const createAssessmentService = (
  repository: AssessmentRepository = assessmentRepository,
) => ({
  async listAssessments(filters: AssessmentListFilters, principal: AuthenticatedPrincipal) {
    requireFactoryCompany(principal);
    const result = await repository.list(filters, principal);
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        canModify: writable(item, principal),
        canCreateVersion: owns(item, principal) && item.status !== "DRAFT",
      })),
    };
  },

  async getAssessment(assessmentId: string, principal: AuthenticatedPrincipal) {
    const record = await repository.findById(assessmentId);
    if (!record) throw fail("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    assertReadable(record, principal);
    return {
      ...record,
      canModify: writable(record, principal),
      canCreateVersion: owns(record, principal) && record.status !== "DRAFT",
    };
  },

  async createAssessment(input: AssessmentWriteInput, principal: AuthenticatedPrincipal) {
    const companyId = targetCompany(input, principal);
    if (await repository.findConflict("", normalizeAssessmentName(input.seriesName))) {
      throw fail("ASSESSMENT_CONFLICT", "Assessment series name already exists", 409);
    }
    const record = await repository.create(input, companyId, principal.userId);
    return { ...record, canModify: true, canCreateVersion: false };
  },

  async updateAssessment(assessmentId: string, input: AssessmentWriteInput, principal: AuthenticatedPrincipal) {
    const current = await repository.findById(assessmentId);
    if (!current) throw fail("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    if (!owns(current, principal)) throw fail("ASSESSMENT_SCOPE_FORBIDDEN", "You cannot modify an assessment outside your company", 403);
    if (current.isUsed) throw fail("ASSESSMENT_LOCKED", "An assessment version already in use cannot be modified; create a new version", 409);
    if (!(await repository.isLatest(current.assessmentSeriesId, current.assessmentId))) {
      throw fail("ASSESSMENT_VERSION_LOCKED", "Only the latest unused assessment version can be modified", 409);
    }
    if (input.seriesCode !== current.seriesCode) {
      throw fail("ASSESSMENT_CODE_LOCKED", "An auto-generated assessment code cannot be changed", 409);
    }
    // The purpose is baked into the code (PRE-/POST-/ASM-), and the code above can never change.
    // Letting the purpose move on its own produced a GENERAL assessment still called PRE-000002 -
    // createAssessmentVersion has always refused the same change for the same reason.
    if (input.purpose !== current.purpose) {
      throw fail("ASSESSMENT_PURPOSE_LOCKED", "The purpose is part of the assessment code and cannot be changed; create a new assessment instead", 409);
    }
    if (!transitions[current.status].includes(input.status)) {
      throw fail("ASSESSMENT_STATUS_TRANSITION_INVALID", `Status cannot change from ${current.status} to ${input.status}`, 409);
    }
    if (await repository.findConflict(input.seriesCode, normalizeAssessmentName(input.seriesName), current.assessmentSeriesId)) {
      throw fail("ASSESSMENT_CONFLICT", "Assessment series code or name already exists", 409);
    }
    const companyId = targetCompany(input, principal);
    const record = await repository.update(current, input, companyId, principal.userId);
    return { ...record, canModify: true, canCreateVersion: record.status !== "DRAFT" };
  },

  /** Retiring or re-activating an assessment. Deliberately does NOT check isUsed: a form attached
   *  to a course or already answered by employees still has to be retirable, otherwise publishing
   *  one by mistake is permanent. It changes no content, so nothing already answered is disturbed. */
  async setAssessmentStatus(assessmentId: string, status: AssessmentStatus, principal: AuthenticatedPrincipal) {
    const current = await repository.findById(assessmentId);
    if (!current) throw fail("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    if (!owns(current, principal)) throw fail("ASSESSMENT_SCOPE_FORBIDDEN", "You cannot modify an assessment outside your company", 403);
    if (!(await repository.isLatest(current.assessmentSeriesId, current.assessmentId))) {
      throw fail("ASSESSMENT_VERSION_LOCKED", "Only the latest assessment version can change status", 409);
    }
    if (!transitions[current.status].includes(status)) {
      throw fail("ASSESSMENT_STATUS_TRANSITION_INVALID", `Status cannot change from ${current.status} to ${status}`, 409);
    }
    const record = await repository.setStatus(assessmentId, status, principal.userId);
    if (!record) throw fail("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    return { ...record, canModify: writable(record, principal), canCreateVersion: owns(record, principal) && record.status !== "DRAFT" };
  },

  async createAssessmentVersion(assessmentId: string, input: AssessmentWriteInput, principal: AuthenticatedPrincipal) {
    const current = await repository.findById(assessmentId);
    if (!current) throw fail("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    if (!owns(current, principal)) throw fail("ASSESSMENT_SCOPE_FORBIDDEN", "You cannot version an assessment outside your company", 403);
    if (current.status === "DRAFT") throw fail("ASSESSMENT_DRAFT_EXISTS", "Finish or delete the current draft before creating a new version", 409);
    if (!(await repository.isLatest(current.assessmentSeriesId, current.assessmentId))) {
      throw fail("ASSESSMENT_VERSION_LOCKED", "A new version can only be created from the latest version", 409);
    }
    if (
      input.seriesCode !== current.seriesCode ||
      normalizeAssessmentName(input.seriesName) !== normalizeAssessmentName(current.seriesName) ||
      input.purpose !== current.purpose
    ) {
      throw fail("ASSESSMENT_SERIES_MISMATCH", "Series code, name, and purpose cannot be changed while creating a version", 400);
    }
    const record = await repository.createVersion(current, { ...input, status: "DRAFT" }, principal.userId);
    return { ...record, canModify: true, canCreateVersion: false };
  },

  async deleteAssessment(assessmentId: string, principal: AuthenticatedPrincipal) {
    const current = await repository.findById(assessmentId);
    if (!current) throw fail("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    if (!owns(current, principal)) throw fail("ASSESSMENT_SCOPE_FORBIDDEN", "You cannot delete an assessment outside your company", 403);
    if (current.isUsed) throw fail("ASSESSMENT_IN_USE", "An assessment version already in use cannot be deleted", 409);
    if (!(await repository.isLatest(current.assessmentSeriesId, current.assessmentId))) {
      throw fail("ASSESSMENT_VERSION_LOCKED", "Only the latest unused assessment version can be deleted", 409);
    }
    return { assessment: await repository.delete(current), outcome: "DELETED" as const };
  },
});

export const assessmentService = createAssessmentService();
