import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import {
  isSectionHeadOrAbove,
  getSectionHeadOrAboveRank,
  SECTION_HEAD_OR_ABOVE_CODES,
  SECTION_HEAD_OR_ABOVE_TITLES_EN,
  SECTION_HEAD_OR_ABOVE_TITLES_TH,
} from "../employeeMasterData";
import type {
  CreateRecordRequestInput,
  RecordRequestApproverCandidate,
  RecordRequestDecisionInput,
  TrainingRecordRequestRecord,
} from "./types";

const recordRequestInclude = {
  company: {
    select: {
      company_id: true,
      company_code: true,
      company_name_th: true,
      company_name_en: true,
    },
  },
  employee: {
    select: {
      user_id: true,
      employee_code: true,
      first_name_th: true,
      last_name_th: true,
      first_name_en: true,
      last_name_en: true,
      department: { select: { department_name_th: true, department_name_en: true } },
      position: { select: { position_name_th: true, position_name_en: true } },
    },
  },
  user_account_training_record_request_reviewed_byTouser_account: {
    select: {
      user_id: true,
      employee: {
        select: {
          user_id: true,
          employee_code: true,
          first_name_th: true,
          last_name_th: true,
          first_name_en: true,
          last_name_en: true,
          position: { select: { position_name_th: true, position_name_en: true } },
        },
      },
    },
  },
} as const;

const formatName = (emp?: {
  first_name_th?: string | null;
  last_name_th?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
} | null) => {
  if (!emp) return "";
  const th = `${emp.first_name_th || ""} ${emp.last_name_th || ""}`.trim();
  const en = `${emp.first_name_en || ""} ${emp.last_name_en || ""}`.trim();
  return th || en;
};

const mapRecord = (row: any): TrainingRecordRequestRecord => {
  const emp = row.employee;
  const reviewer = row.user_account_training_record_request_reviewed_byTouser_account?.employee;

  return {
    id: String(row.record_request_id),
    requestNo: row.request_no,
    companyId: String(row.company_id),
    companyCode: row.company?.company_code || "",
    employeeUserId: row.employee_user_id,
    employeeName: formatName(emp),
    employeeCode: emp?.employee_code || "",
    departmentName: emp?.department?.department_name_th || emp?.department?.department_name_en || "-",
    positionName: emp?.position?.position_name_th || emp?.position?.position_name_en || "-",
    requestReason: row.request_reason || "",
    requestType: row.request_type || "FULL_RECORD",
    dateFrom: row.date_from ? new Date(row.date_from).toISOString().slice(0, 10) : null,
    dateTo: row.date_to ? new Date(row.date_to).toISOString().slice(0, 10) : null,
    status: (row.status?.toUpperCase() as any) || "PENDING",
    requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : new Date().toISOString(),
    approverUserId: reviewer?.user_id || null,
    approverName: formatName(reviewer) || null,
    approverPosition: reviewer?.position?.position_name_th || reviewer?.position?.position_name_en || null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    rejectionReason: row.rejection_reason || null,
  };
};

export const trainingRecordRequestRepository = {
  /**
   * List Section Heads and above belonging strictly to the specified company.
   * Covers all 12 positions: PRES, EVP, VP, SADV, ADV, SEC, PM, EGM, SGM, GM, MGR, SH
   * as well as Management level (M1-M4 / จ1-จ4).
   */
  async listApprovers(companyId: string, currentEmployeeUserId?: string): Promise<RecordRequestApproverCandidate[]> {
    return withDatabaseErrorMapping(async () => {
      const db = getPrismaClient();

      const upperCodes = SECTION_HEAD_OR_ABOVE_CODES as readonly string[];
      const lowerCodes = upperCodes.map((c) => c.toLowerCase());
      const allCodes = [...upperCodes, ...lowerCodes];

      const employees = await db.employee.findMany({
        where: {
          employment_status: "ACTIVE",
          company_id: BigInt(companyId),
          ...(currentEmployeeUserId ? { user_id: { not: currentEmployeeUserId } } : {}),
          OR: [
            {
              position: {
                OR: [
                  { position_code: { in: allCodes } },
                  ...SECTION_HEAD_OR_ABOVE_TITLES_EN.map((name) => ({
                    position_name_en: { contains: name },
                  })),
                  ...SECTION_HEAD_OR_ABOVE_TITLES_TH.map((name) => ({
                    position_name_th: { contains: name },
                  })),
                ],
              },
            },
            {
              employee_level: {
                OR: [
                  { level_code: { in: ["M1", "M2", "M3", "M4", "จ1", "จ2", "จ3", "จ4", "m1", "m2", "m3", "m4"] } },
                  { level_key: { in: ["M1", "M2", "M3", "M4", "จ1", "จ2", "จ3", "จ4", "m1", "m2", "m3", "m4"] } },
                  { level_name_th: { contains: "จัดการ" } },
                  { level_name_en: { contains: "Management" } },
                ],
              },
            },
          ],
        },
        include: {
          position: true,
          company: true,
          division: true,
          department: true,
          section: true,
          employee_level: true,
        },
        orderBy: [{ first_name_th: "asc" }, { last_name_th: "asc" }],
      });

      const eligible = employees.filter((emp) =>
        isSectionHeadOrAbove({
          positionCode: emp.position?.position_code ?? null,
          positionName: emp.position?.position_name_en ?? emp.position?.position_name_th ?? null,
          levelCode: emp.employee_level?.level_code ?? null,
          levelKey: emp.employee_level?.level_key ?? null,
          levelName: emp.employee_level?.level_name_en ?? emp.employee_level?.level_name_th ?? null,
        }),
      );

      // Sort by executive rank (PRES down to SH), then alphabetically by Thai name
      eligible.sort((a, b) => {
        const rankA = getSectionHeadOrAboveRank({
          positionCode: a.position?.position_code,
          positionName: a.position?.position_name_en || a.position?.position_name_th,
        });
        const rankB = getSectionHeadOrAboveRank({
          positionCode: b.position?.position_code,
          positionName: b.position?.position_name_en || b.position?.position_name_th,
        });
        if (rankA !== rankB) return rankA - rankB;
        const nameA = `${a.first_name_th || ""} ${a.last_name_th || ""}`.trim();
        const nameB = `${b.first_name_th || ""} ${b.last_name_th || ""}`.trim();
        return nameA.localeCompare(nameB, "th");
      });

      return eligible.map((emp) => ({
        reviewerUserId: emp.user_id,
        employeeCode: emp.employee_code ?? "",
        name:
          `${emp.first_name_th} ${emp.last_name_th}`.trim() ||
          `${emp.first_name_en || ""} ${emp.last_name_en || ""}`.trim(),
        position: emp.position?.position_name_th || emp.position?.position_name_en || emp.position?.position_code || "",
        company: emp.company.company_code,
        division: emp.division?.division_name_th || emp.division?.division_name_en || "",
        department: emp.department?.department_name_th || emp.department?.department_name_en || "",
        section: emp.section?.section_name_th || emp.section?.section_name_en || "",
      }));
    });
  },

  /**
   * Submit a new training record request.
   */
  async create(
    employeeUserId: string,
    companyId: string,
    input: CreateRecordRequestInput,
  ): Promise<TrainingRecordRequestRecord> {
    return withDatabaseErrorMapping(async () => {
      const db = getPrismaClient();

      const employee = await db.employee.findUnique({
        where: { user_id: employeeUserId },
        select: { company_id: true, function_id: true, employment_status: true },
      });
      if (!employee || employee.employment_status !== "ACTIVE") {
        throw new ApiError({ code: "EMPLOYEE_NOT_FOUND", message: "Requester employee not found or inactive", status: 404 });
      }

      if (input.approverUserId === employeeUserId) {
        throw new ApiError({ code: "INVALID_APPROVER", message: "You cannot name yourself as the approver", status: 400 });
      }

      // Verify the approver belongs to the same company and is Section Head or above
      const approverEmp = await db.employee.findUnique({
        where: { user_id: input.approverUserId },
        include: { position: true, employee_level: true, company: true },
      });
      if (!approverEmp || approverEmp.employment_status !== "ACTIVE") {
        throw new ApiError({ code: "INVALID_APPROVER", message: "Approver not found or inactive", status: 400 });
      }
      if (String(approverEmp.company_id) !== String(companyId)) {
        throw new ApiError({
          code: "INVALID_APPROVER_COMPANY",
          message: "Approver must be from the same company",
          status: 400,
        });
      }

      const isHead = isSectionHeadOrAbove({
        positionCode: approverEmp.position?.position_code ?? null,
        positionName: approverEmp.position?.position_name_en ?? approverEmp.position?.position_name_th ?? null,
        levelCode: approverEmp.employee_level?.level_code ?? null,
        levelKey: approverEmp.employee_level?.level_key ?? null,
        levelName: approverEmp.employee_level?.level_name_en ?? approverEmp.employee_level?.level_name_th ?? null,
      });
      if (!isHead) {
        throw new ApiError({
          code: "INVALID_APPROVER_ROLE",
          message: "Approver must be a Section Head or above",
          status: 400,
        });
      }

      // Find user_account ID for reviewed_by foreign key
      let approverUserAccount = await db.user_account.findFirst({
        where: { employee_user_id: input.approverUserId },
        select: { user_id: true },
      });
      if (!approverUserAccount) {
        try {
          approverUserAccount = await db.user_account.findUnique({
            where: { user_id: BigInt(input.approverUserId) },
            select: { user_id: true },
          });
        } catch {}
      }

      const created = await db.$transaction(async (tx) => {
        const placeholder = `TMP-${crypto.randomUUID()}`;
        const row = await tx.training_record_request.create({
          data: {
            request_no: placeholder,
            company_id: employee.company_id,
            function_id: employee.function_id,
            employee_user_id: employeeUserId,
            reviewed_by: approverUserAccount?.user_id ?? null,
            status: "PENDING",
            request_type: input.requestType || "FULL_RECORD",
            request_reason: input.requestReason.trim(),
            date_from: input.dateFrom ? new Date(input.dateFrom) : null,
            date_to: input.dateTo ? new Date(input.dateTo) : null,
          },
        });

        const yearMonth = `${row.requested_at.getFullYear()}${String(row.requested_at.getMonth() + 1).padStart(2, "0")}`;
        const requestNo = `TRR-${yearMonth}-${row.record_request_id.toString().padStart(6, "0")}`;

        return tx.training_record_request.update({
          where: { record_request_id: row.record_request_id },
          data: { request_no: requestNo },
          include: recordRequestInclude,
        });
      });

      return mapRecord(created);
    });
  },

  /**
   * List requests:
   * - myRequests: requests submitted by current employee
   * - pendingApprovals: requests assigned to current user as Section Head (if applicable)
   */
  async list(employeeUserId: string, userAccountId?: string | null): Promise<{
    myRequests: TrainingRecordRequestRecord[];
    pendingApprovals: TrainingRecordRequestRecord[];
  }> {
    return withDatabaseErrorMapping(async () => {
      const db = getPrismaClient();

      const [myRows, approvalRows] = await Promise.all([
        db.training_record_request.findMany({
          where: { employee_user_id: employeeUserId },
          include: recordRequestInclude,
          orderBy: { requested_at: "desc" },
        }),
        userAccountId
          ? db.training_record_request.findMany({
              where: {
                reviewed_by: BigInt(userAccountId),
              },
              include: recordRequestInclude,
              orderBy: { requested_at: "desc" },
            })
          : Promise.resolve([]),
      ]);

      return {
        myRequests: myRows.map(mapRecord),
        pendingApprovals: approvalRows.map(mapRecord),
      };
    });
  },

  /**
   * Section Head decides (approves or rejects) a request.
   */
  async decide(
    requestId: string,
    userAccountId: string,
    input: RecordRequestDecisionInput,
  ): Promise<TrainingRecordRequestRecord> {
    return withDatabaseErrorMapping(async () => {
      const db = getPrismaClient();
      const current = await db.training_record_request.findUnique({
        where: { record_request_id: BigInt(requestId) },
      });
      if (!current) {
        throw new ApiError({ code: "REQUEST_NOT_FOUND", message: "Training record request not found", status: 404 });
      }

      if (current.reviewed_by && String(current.reviewed_by) !== String(userAccountId)) {
        throw new ApiError({ code: "FORBIDDEN", message: "Only the assigned Section Head can decide this request", status: 403 });
      }

      if (input.action === "reject" && !input.note?.trim()) {
        throw new ApiError({ code: "NOTE_REQUIRED", message: "Rejection reason is required", status: 400 });
      }

      const updated = await db.training_record_request.update({
        where: { record_request_id: BigInt(requestId) },
        data: {
          status: input.action === "approve" ? "APPROVED" : "REJECTED",
          reviewed_by: BigInt(userAccountId),
          reviewed_at: new Date(),
          rejection_reason: input.action === "reject" ? input.note?.trim() || null : null,
          completed_at: input.action === "approve" ? new Date() : null,
        },
        include: recordRequestInclude,
      });

      return mapRecord(updated);
    });
  },

  /**
   * Find request by ID
   */
  async findById(requestId: string): Promise<TrainingRecordRequestRecord | null> {
    return withDatabaseErrorMapping(async () => {
      const db = getPrismaClient();
      const row = await db.training_record_request.findUnique({
        where: { record_request_id: BigInt(requestId) },
        include: recordRequestInclude,
      });
      return row ? mapRecord(row) : null;
    });
  },
};
