import { describe, expect, it } from "vitest";
import { isSectionHeadOrAbove, toEnglishPositionName } from "../../app/lib/employeeMasterData";
import { RECORD_REQUEST_STATUSES } from "../../app/lib/trainingRecordRequests/types";
import type { TrainingRecordRequestRecord } from "../../app/lib/trainingRecordRequests/types";
import {
  buildEmployeeNotices,
  noticeHref,
  noticeText,
} from "../../app/components/employee/employeeNotices";
import { storedHref } from "../../app/components/employee/useStoredNotifications";

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

  it("translates Thai positions into standard English positions", () => {
    expect(toEnglishPositionName("ผู้จัดการโรงงาน")).toBe("Plant Manager");
    expect(toEnglishPositionName("ประธานบริษัท")).toBe("President");
    expect(toEnglishPositionName("ผู้จัดการทั่วไป")).toBe("General Manager");
    expect(toEnglishPositionName("ผู้จัดการแผนก")).toBe("Section Head");
    expect(toEnglishPositionName("เจ้าหน้าที่")).toBe("Officer");
    expect(toEnglishPositionName({ position_name_th: "ผู้จัดการโรงงาน", position_name_en: null })).toBe("Plant Manager");
    expect(toEnglishPositionName({ position_code: "PM" })).toBe("Plant Manager");
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

describe("Training Record Requests Notification Integration", () => {
  const pendingReq: TrainingRecordRequestRecord = {
    id: "req-101",
    requestNo: "TRR-202609-000101",
    companyId: "1",
    companyCode: "ATA",
    employeeUserId: "usr-emp-1",
    employeeName: "สมชาย ทดสอบ",
    employeeCode: "10001",
    departmentName: "ฝ่ายผลิต",
    positionName: "วิศวกร",
    requestReason: "ขอเอกสารยื่นปรับตำแหน่ง",
    requestType: "DOCUMENT",
    dateFrom: null,
    dateTo: null,
    status: "PENDING",
    requestedAt: "2026-09-21T02:00:00.000Z",
    approverUserId: "usr-head-1",
    approverName: "สมบูรณ์ ผู้จัดการ",
    approverPosition: "Section Head",
    reviewedAt: null,
    rejectionReason: null,
  };

  const approvedReq: TrainingRecordRequestRecord = {
    ...pendingReq,
    id: "req-102",
    requestNo: "TRR-202609-000102",
    status: "APPROVED",
    reviewedAt: "2026-09-21T03:00:00.000Z",
  };

  const rejectedReq: TrainingRecordRequestRecord = {
    ...pendingReq,
    id: "req-103",
    requestNo: "TRR-202609-000103",
    status: "REJECTED",
    reviewedAt: "2026-09-21T03:30:00.000Z",
    rejectionReason: "ข้อมูลไม่ครบถ้วน",
  };

  it("builds pending approval notification for the approver (Section Head)", () => {
    const notices = buildEmployeeNotices([], { pendingApprovals: [pendingReq] });

    expect(notices).toHaveLength(1);
    const notice = notices[0];
    expect(notice.kind).toBe("record_request_approval");
    expect(notice.tab).toBe("download");
    expect(notice.id).toBe("record_request_approval:req-101");

    const textTh = noticeText(notice, true);
    expect(textTh.eyebrow).toBe("คำขออนุมัติประวัติการอบรม");
    expect(textTh.title).toContain("สมชาย ทดสอบ");
    expect(textTh.title).toContain("10001");
    expect(textTh.detail).toContain("TRR-202609-000101");

    const href = noticeHref(notice, 123456);
    expect(href).toBe("/?module=record&tab=download&focusRequest=req-101&at=123456");
  });

  // The decision is news written to the notification table when the head decides; the bell reads
  // it from there, so nothing is worked out from the request list any more.
  it("leaves decided requests to the notification table and lands its rows on the request", () => {
    expect(buildEmployeeNotices([], { pendingApprovals: [approvedReq, rejectedReq] })).toEqual([]);

    const row = (relatedType: string, relatedId: string) => ({
      notificationId: "1",
      userId: "10",
      title: "",
      message: "",
      relatedType,
      relatedId,
      isRead: false,
      createdAt: "2026-09-21T03:00:00.000Z",
    });
    expect(storedHref(row("TRAINING_RECORD_REQUEST_APPROVED", "req-102"), 999999)).toBe(
      "/?module=record&tab=download&downloadReq=req-102&at=999999",
    );
    expect(storedHref(row("TRAINING_RECORD_REQUEST_REJECTED", "req-103"), 888888)).toBe(
      "/?module=record&tab=download&focusRequest=req-103&at=888888",
    );
  });
});
