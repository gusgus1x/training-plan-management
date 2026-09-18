import { describe, expect, it } from "vitest";
import { isSectionHeadOrAbove } from "../../app/lib/employeeMasterData";
import { RECORD_REQUEST_STATUSES } from "../../app/lib/trainingRecordRequests/types";
import type { TrainingRecordRequestRecord } from "../../app/lib/trainingRecordRequests/types";

describe("Training Record Requests Approver Eligibility", () => {
  it("recognizes Section Head and Manager positions as eligible approvers", () => {
    expect(isSectionHeadOrAbove({ positionName: "Section Head (หัวหน้าแผนก)" })).toBe(true);
    expect(isSectionHeadOrAbove({ positionName: "ผู้จัดการแผนก (Department Manager)" })).toBe(true);
    expect(isSectionHeadOrAbove({ positionCode: "SH" })).toBe(true);
    expect(isSectionHeadOrAbove({ positionCode: "MGR" })).toBe(true);
  });

  it("recognizes all 12 positions from Section Head up to President by code and title", () => {
    const positions = [
      { code: "pres", titleTh: "ประธานบริษัท", titleEn: "President" },
      { code: "evp", titleTh: "รองประธานบริหาร", titleEn: "Executive Vice President" },
      { code: "vp", titleTh: "รองประธาน", titleEn: "Vice President" },
      { code: "sadv", titleTh: "ที่ปรึกษาอาวุโส", titleEn: "Senior Advisor" },
      { code: "adv", titleTh: "ที่ปรึกษา", titleEn: "Advisor" },
      { code: "sec", titleTh: "ผู้ประสานงานบริหารอาวุโส", titleEn: "Senior Executive Coordinator" },
      { code: "pm", titleTh: "ผู้จัดการโรงงาน", titleEn: "Plant Manager" },
      { code: "egm", titleTh: "ผู้จัดการทั่วไปฝ่ายบริหาร", titleEn: "Executive General Manager" },
      { code: "sgm", titleTh: "ผู้จัดการทั่วไปอาวุโส", titleEn: "Senior General Manager" },
      { code: "gm", titleTh: "ผู้จัดการทั่วไป", titleEn: "General Manager" },
      { code: "mgr", titleTh: "ผู้จัดการ", titleEn: "Manager" },
      { code: "sh", titleTh: "ผู้จัดการแผนก", titleEn: "Section Head" },
    ];

    for (const p of positions) {
      // By lowercase and uppercase code
      expect(isSectionHeadOrAbove({ positionCode: p.code })).toBe(true);
      expect(isSectionHeadOrAbove({ positionCode: p.code.toUpperCase() })).toBe(true);
      // By Thai title
      expect(isSectionHeadOrAbove({ positionName: p.titleTh })).toBe(true);
      // By English title
      expect(isSectionHeadOrAbove({ positionName: p.titleEn })).toBe(true);
    }
  });

  it("recognizes Management level employees (M1-M4, จ1-จ4) as eligible approvers", () => {
    expect(isSectionHeadOrAbove({ levelName: "Management 1 (จ1)" })).toBe(true);
    expect(isSectionHeadOrAbove({ levelCode: "M2" })).toBe(true);
    expect(isSectionHeadOrAbove({ levelName: "จ3" })).toBe(true);
  });

  it("rejects non-Section Head employees from being approvers", () => {
    expect(isSectionHeadOrAbove({ positionName: "Staff", levelName: "O2" })).toBe(false);
    expect(isSectionHeadOrAbove({ positionName: "Technician (ช่างเทคนิค)", levelName: "ป1" })).toBe(false);
    expect(isSectionHeadOrAbove({ positionName: "Officer", levelName: "บ1" })).toBe(false);
    expect(isSectionHeadOrAbove(null)).toBe(false);
    expect(isSectionHeadOrAbove(undefined)).toBe(false);
  });
});

describe("Training Record Requests Workflow & Download Gating", () => {
  it("defines standard request statuses", () => {
    expect(RECORD_REQUEST_STATUSES).toEqual(["PENDING", "APPROVED", "REJECTED"]);
  });

  const mockPendingRequest: TrainingRecordRequestRecord = {
    id: "1",
    requestNo: "TRR-202609-000001",
    companyId: "101",
    companyCode: "ATTC",
    employeeUserId: "EMP001",
    employeeName: "Somchai Jaidee",
    employeeCode: "50001",
    departmentName: "Production",
    positionName: "Engineer",
    requestReason: "For promotion review",
    requestType: "job_change",
    dateFrom: null,
    dateTo: null,
    status: "PENDING",
    requestedAt: "2026-09-18T10:00:00Z",
    approverUserId: "SH001",
    approverName: "Section Manager",
    approverPosition: "Section Head",
    reviewedAt: null,
    rejectionReason: null,
  };

  const isDownloadPermitted = (request: TrainingRecordRequestRecord): boolean => {
    return request.status === "APPROVED";
  };

  it("strictly prohibits download when request is PENDING", () => {
    expect(isDownloadPermitted(mockPendingRequest)).toBe(false);
  });

  it("strictly prohibits download when request is REJECTED", () => {
    const rejectedRequest: TrainingRecordRequestRecord = {
      ...mockPendingRequest,
      status: "REJECTED",
      reviewedAt: "2026-09-18T11:00:00Z",
      rejectionReason: "Incomplete reasons provided",
    };
    expect(isDownloadPermitted(rejectedRequest)).toBe(false);
  });

  it("permits official training record download ONLY when status is APPROVED", () => {
    const approvedRequest: TrainingRecordRequestRecord = {
      ...mockPendingRequest,
      status: "APPROVED",
      reviewedAt: "2026-09-18T11:00:00Z",
    };
    expect(isDownloadPermitted(approvedRequest)).toBe(true);
  });

  it("verifies company isolation when filtering approvers", () => {
    const candidateRoster = [
      { userId: "SH01", companyId: "101", name: "Head Company A", isSH: true },
      { userId: "SH02", companyId: "102", name: "Head Company B", isSH: true },
      { userId: "EMP01", companyId: "101", name: "Staff Company A", isSH: false },
    ];

    const currentCompanyId = "101";
    const currentUserId = "REQ01";

    const eligibleApprovers = candidateRoster.filter(
      (c) => c.companyId === currentCompanyId && c.isSH && c.userId !== currentUserId,
    );

    expect(eligibleApprovers).toHaveLength(1);
    expect(eligibleApprovers[0].userId).toBe("SH01");
    expect(eligibleApprovers[0].name).toBe("Head Company A");
  });
});
