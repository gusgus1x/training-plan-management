"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  listNeedRequests,
  updateNeedRequest,
} from "../../../../lib/trainingNeedRequests/client";
import type {
  NeedRequestAction,
  NeedRequestRecord,
  NeedRequestStatus,
} from "../../../../lib/trainingNeedRequests/types";
import { APPROVED_TRAINING_NEED_STORAGE_KEY } from "../../../../lib/trainingRequests";
import styles from "./RequestTrainingNeed.module.css";

export const requestTrainingNeedModule = {
  title: "Request Training Need",
  subtitle: "Employee request inbox",
  description:
    "Review Course Needed and Request Reason submitted from the employee training request page.",
} as const;

const formatDate = (iso: string) => iso.slice(0, 10);

type RequestTrainingNeedProps = {
  onOpenTrainingOap?: () => void;
};

type CourseDemandGroup = {
  courseKey: string;
  courseTitle: string;
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  plannedCount: number;
  rejectedCount: number;
  companies: string[];
  requests: NeedRequestRecord[];
};

export default function RequestTrainingNeed({ onOpenTrainingOap }: RequestTrainingNeedProps) {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const toast = useToast();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";

  const [requests, setRequests] = useState<NeedRequestRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<NeedRequestStatus | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"list" | "demand">("list");
  const [pendingAction, setPendingAction] = useState(false);

  // Rejection modal dialog state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const [requestsRes, companiesRes] = await Promise.all([
        listNeedRequests(),
        !isFactoryUser
          ? listCompanies().catch(() => ({ items: [] as CompanyRecord[] }))
          : Promise.resolve({ items: [] as CompanyRecord[] }),
      ]);
      setRequests(requestsRes.needRequests || []);
      setCompanies(companiesRes.items || []);
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "Could not load requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
      planned: requests.filter((r) => r.status === "PLANNED").length,
    };
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesCompany = companyFilter === "all" || request.companyCode === companyFilter;
      const matchesSearch =
        !query ||
        [
          request.requestNo,
          request.employeeCode,
          request.employeeName,
          request.companyCode,
          request.functionName,
          request.requestedCourseName,
          request.requestReason,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesCompany && matchesSearch;
    });
  }, [requests, search, statusFilter, companyFilter]);

  // Aggregate requests by Course for Demand Tab
  const demandGroups = useMemo(() => {
    const groupMap = new Map<string, CourseDemandGroup>();

    for (const req of visibleRequests) {
      const title = req.requestedCourseName.trim();
      const key = title.toLowerCase();

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          courseKey: key,
          courseTitle: title,
          totalRequests: 0,
          pendingCount: 0,
          approvedCount: 0,
          plannedCount: 0,
          rejectedCount: 0,
          companies: [],
          requests: [],
        });
      }

      const g = groupMap.get(key)!;
      g.totalRequests += 1;
      if (req.status === "PENDING") g.pendingCount += 1;
      if (req.status === "APPROVED") g.approvedCount += 1;
      if (req.status === "PLANNED") g.plannedCount += 1;
      if (req.status === "REJECTED") g.rejectedCount += 1;
      if (req.companyCode && !g.companies.includes(req.companyCode)) {
        g.companies.push(req.companyCode);
      }
      g.requests.push(req);
    }

    return Array.from(groupMap.values()).sort((a, b) => b.totalRequests - a.totalRequests);
  }, [visibleRequests]);

  const selectedRequest =
    visibleRequests.find((request) => request.id === selectedId) ?? visibleRequests[0] ?? null;

  const applyAction = async (action: NeedRequestAction, note: string | null) => {
    if (!selectedRequest) return null;

    setPendingAction(true);
    try {
      const { needRequest } = await updateNeedRequest(selectedRequest.id, { action, note });
      setRequests((current) =>
        current.map((request) => (request.id === needRequest.id ? needRequest : request)),
      );
      return needRequest;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("อัปเดตคำขอไม่สำเร็จ", "Could not update the request"),
      );
      return null;
    } finally {
      setPendingAction(false);
    }
  };

  const handleApproveToPlan = async (customRequest?: NeedRequestRecord) => {
    const targetReq = customRequest ?? selectedRequest;
    if (!targetReq) return;

    let target = targetReq;

    if (target.status !== "APPROVED") {
      const ok = await confirm({
        message: {
          th: `ยืนยันการอนุมัติคำขอ ${target.requestNo} และนำเข้าสู่การจัดทำแผน OAP หรือไม่?`,
          en: `Confirm approving request ${target.requestNo} and proceed to OAP planning?`,
        },
      });
      if (!ok) return;

      const { needRequest } = await updateNeedRequest(target.id, { action: "approve", note: null });
      setRequests((current) =>
        current.map((request) => (request.id === needRequest.id ? needRequest : request)),
      );
      target = needRequest;
    }

    window.localStorage.setItem(APPROVED_TRAINING_NEED_STORAGE_KEY, JSON.stringify(target));
    window.dispatchEvent(new Event("approved-training-need-changed"));
    toast.success(
      t(
        `เปิดฟอร์มจัดทำแผน OAP สำหรับคำขอ ${target.requestNo} แล้ว`,
        `Opened OAP plan form for ${target.requestNo}`,
      ),
    );
    onOpenTrainingOap?.();
  };

  const handleBatchApproveGroup = async (group: CourseDemandGroup) => {
    const pendingReqs = group.requests.filter((r) => r.status === "PENDING" || r.status === "APPROVED");
    if (!pendingReqs.length) {
      toast.info(t("ไม่มีคำขอที่รออนุมัติในกลุ่มนี้", "No pending requests in this group"));
      return;
    }

    const ok = await confirm({
      message: {
        th: `ยืนยันการอนุมัติความต้องการฝึกอบรมหลักสูตร "${group.courseTitle}" ทั้งหมด ${pendingReqs.length} รายการ และเปิดหน้าจัดทำแผน OAP หรือไม่?`,
        en: `Confirm approving all ${pendingReqs.length} requests for "${group.courseTitle}" and proceed to OAP planning?`,
      },
    });
    if (!ok) return;

    setPendingAction(true);
    try {
      for (const req of pendingReqs) {
        if (req.status === "PENDING") {
          await updateNeedRequest(req.id, { action: "approve", note: null });
        }
      }
      await loadRequests();

      // Send the first request to open in OAP
      const firstReq = pendingReqs[0];
      window.localStorage.setItem(APPROVED_TRAINING_NEED_STORAGE_KEY, JSON.stringify(firstReq));
      window.dispatchEvent(new Event("approved-training-need-changed"));
      toast.success(
        t(
          `อนุมัติกลุ่มหลักสูตร ${group.courseTitle} (${pendingReqs.length} คน) เรียบร้อยแล้ว`,
          `Approved course group (${pendingReqs.length} requesters)`,
        ),
      );
      onOpenTrainingOap?.();
    } catch (error) {
      console.error("Batch approve failed", error);
      toast.error(t("อนุมัติรวมชุดไม่สำเร็จ", "Failed to batch approve"));
    } finally {
      setPendingAction(false);
    }
  };

  const handleRevertToPending = async () => {
    if (!selectedRequest) return;
    const ok = await confirm({
      message: {
        th: `ต้องการย้อนกลับสถานะคำขอ ${selectedRequest.requestNo} เป็น "รอตรวจสอบ" เพื่อให้สามารถตัดสินใจวางแผนหรือยกเลิกใหม่ได้หรือไม่?`,
        en: `Revert request ${selectedRequest.requestNo} to "Pending" to reconsider planning or rejecting?`,
      },
    });
    if (!ok) return;

    const updated = await applyAction("reset", null);
    if (updated) {
      window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
      toast.success(
        t(
          `ย้อนกลับสถานะคำขอ ${updated.requestNo} เป็นรอตรวจสอบแล้ว`,
          `Reverted ${updated.requestNo} to Pending`,
        ),
      );
    }
  };

  const handleOpenRejectModal = () => {
    setRejectionNote("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionNote.trim()) {
      toast.warning(t("กรุณาระบุเหตุผลที่ไม่อนุมัติ", "Please specify a rejection reason"));
      return;
    }

    setIsRejectModalOpen(false);
    const updated = await applyAction("reject", rejectionNote.trim());
    if (updated) {
      window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
      toast.success(t(`ปฏิเสธคำขอ ${updated.requestNo} แล้ว`, `Rejected ${updated.requestNo}`));
    }
  };

  const getStatusBadge = (status: NeedRequestStatus) => {
    switch (status) {
      case "PENDING":
        return <span className={`${styles.statusBadge} ${styles.statusBadgePending}`}>⏳ {t("รอตรวจสอบ", "Pending")}</span>;
      case "APPROVED":
        return <span className={`${styles.statusBadge} ${styles.statusBadgeApproved}`}>✓ {t("อนุมัติแล้ว", "Approved")}</span>;
      case "PLANNED":
        return <span className={`${styles.statusBadge} ${styles.statusBadgePlanned}`}>📋 {t("จัดลงแผนแล้ว", "Planned")}</span>;
      case "REJECTED":
        return <span className={`${styles.statusBadge} ${styles.statusBadgeRejected}`}>✕ {t("ไม่อนุมัติ", "Rejected")}</span>;
      default:
        return <span className={styles.statusBadge}>{status}</span>;
    }
  };

  const isFinalPlanned = selectedRequest?.status === "PLANNED";

  return (
    <section className={styles.moduleWorkspace} aria-label="Request Training Need module">
      {/* 1. Hero Header */}
      <header className={styles.heroHeader}>
        <div className={styles.heroContent}>
          <h2>
            <span>📬</span> {t("คำขอจัดฝึกอบรมจากพนักงาน", "Training Need Requests Inbox")}
          </h2>
          <p>
            {t(
              "ตรวจสอบความต้องการฝึกอบรมของพนักงาน เพื่อพิจารณาอนุมัติและบรรจุลงในแผนการฝึกอบรมประจำปี (OAP)",
              "Review employee training requests and approve to incorporate into Annual Training Plans (OAP).",
            )}
          </p>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.scopeBadge}>
            {isFactoryUser ? (
              <span>🏬 {t(`HRD โรงงาน (${user?.companyCode || "Factory"})`, `Factory HRD (${user?.companyCode || "Factory"})`)}</span>
            ) : (
              <span>🏢 {t("HRD ส่วนกลาง (Center - ทุกบริษัท)", "Center HRD (All Companies)")}</span>
            )}
          </div>
          <button className={styles.refreshBtn} type="button" onClick={() => void loadRequests()} title="Refresh">
            🔄 {t("รีเฟรช", "Refresh")}
          </button>
        </div>
      </header>

      {/* 2. Interactive KPI Stats Deck */}
      <div className={styles.statsGrid}>
        <button
          className={`${styles.statCard} ${statusFilter === "PENDING" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "PENDING" ? "all" : "PENDING")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>⏳ {t("รอตรวจสอบ", "Pending")}</span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountPending}`}>{stats.pending}</strong>
        </button>

        <button
          className={`${styles.statCard} ${statusFilter === "APPROVED" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "APPROVED" ? "all" : "APPROVED")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>✓ {t("อนุมัติแล้ว", "Approved")}</span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountApproved}`}>{stats.approved}</strong>
        </button>

        <button
          className={`${styles.statCard} ${statusFilter === "PLANNED" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "PLANNED" ? "all" : "PLANNED")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>📋 {t("จัดลงแผนแล้ว", "Planned")}</span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountPlanned}`}>{stats.planned}</strong>
        </button>

        <button
          className={`${styles.statCard} ${statusFilter === "REJECTED" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "REJECTED" ? "all" : "REJECTED")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>✕ {t("ไม่อนุมัติ", "Rejected")}</span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountRejected}`}>{stats.rejected}</strong>
        </button>

        <button
          className={`${styles.statCard} ${statusFilter === "all" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter("all")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>📊 {t("คำขอทั้งหมด", "Total")}</span>
          </div>
          <strong className={styles.statCount}>{stats.total}</strong>
        </button>
      </div>

      {/* 3. Control & Navigation Bar */}
      <div className={styles.controlBar}>
        <div className={styles.viewTabs}>
          <button
            className={`${styles.viewTab} ${activeTab === "list" ? styles.viewTabActive : ""}`}
            type="button"
            onClick={() => setActiveTab("list")}
          >
            📑 {t("รายการคำขอ (รายคน)", "Request List")} ({visibleRequests.length})
          </button>
          <button
            className={`${styles.viewTab} ${activeTab === "demand" ? styles.viewTabActive : ""}`}
            type="button"
            onClick={() => setActiveTab("demand")}
          >
            📊 {t("รวมยอดตามหลักสูตร", "Demand by Course")} ({demandGroups.length})
          </button>
        </div>

        <div className={styles.filterControls}>
          <input
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("🔍 ค้นหาเลขที่คำขอ, พนักงาน, หลักสูตร...", "Search request no, employee, course...")}
          />

          {!isFactoryUser && companies.length > 0 ? (
            <select
              className={styles.companySelect}
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="all">🏢 {t("ทุกบริษัท (All Companies)", "All Companies")}</option>
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyCode}>
                  {c.companyCode} - {language === "th" ? c.companyNameTh : (c.companyNameEn || c.companyNameTh)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <div className={styles.emptyStateContainer}>
          <p style={{ color: "#ef4444", fontWeight: 700 }}>⚠️ {loadError}</p>
        </div>
      ) : null}

      {/* 4. Tab 1: Master-Detail List View */}
      {activeTab === "list" && (
        <div className={styles.mainLayout}>
          {/* Left Pane: Requests List */}
          <div className={styles.listPane}>
            {visibleRequests.length === 0 ? (
              <div className={styles.emptyStateContainer}>
                <p>📭 {t("ไม่พบคำขอฝึกอบรมตามเงื่อนไขที่เลือก", "No training requests match your filters")}</p>
              </div>
            ) : (
              visibleRequests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                return (
                  <div
                    key={req.id}
                    className={`${styles.requestCard} ${isSelected ? styles.requestCardActive : ""}`}
                    onClick={() => setSelectedId(req.id)}
                  >
                    <div className={styles.requestCardHeader}>
                      <span className={styles.requestNo}>{req.requestNo}</span>
                      {getStatusBadge(req.status)}
                    </div>
                    <h4 className={styles.requestCardTitle}>{req.requestedCourseName}</h4>
                    <div className={styles.requestCardMeta}>
                      <span className={styles.requesterBadge}>
                        👤 {req.employeeName} ({req.companyCode})
                      </span>
                      <span>📅 {formatDate(req.requestedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Pane: Inspector & Decision Desk */}
          {selectedRequest ? (
            <div className={styles.detailPane}>
              <div className={styles.detailHeader}>
                <div className={styles.detailTitleSection}>
                  <p className={styles.detailSubtitle}>
                    {t("คำขอเลขที่", "Request No")} <span className={styles.requestNo}>{selectedRequest.requestNo}</span>
                  </p>
                  <h3>{selectedRequest.requestedCourseName}</h3>
                </div>
                {getStatusBadge(selectedRequest.status)}
              </div>

              {/* Requester Profile */}
              <div className={styles.profileBox}>
                <div className={styles.profileAvatar}>
                  {selectedRequest.employeeName ? selectedRequest.employeeName.charAt(0) : "U"}
                </div>
                <div className={styles.profileInfo}>
                  <span className={styles.profileName}>{selectedRequest.employeeName}</span>
                  <span className={styles.profileOrg}>
                    🆔 {selectedRequest.employeeCode} • 🏢 {selectedRequest.companyCode} • 📂 {selectedRequest.functionName || "-"}
                  </span>
                </div>
              </div>

              {/* Request Reason */}
              <div className={styles.infoSection}>
                <span className={styles.sectionLabel}>📝 {t("เหตุผลความจำเป็นในการขอรับการฝึกอบรม", "Reason for Request")}</span>
                <div className={styles.highlightBox}>
                  {selectedRequest.requestReason || "-"}
                </div>
              </div>

              {/* Preferred Dates */}
              <div className={styles.infoSection}>
                <span className={styles.sectionLabel}>📅 {t("ช่วงเวลาที่สะดวกในการเข้าอบรม", "Preferred Schedule")}</span>
                <div className={styles.datesGrid}>
                  <div className={styles.dateCard}>
                    <span>{t("วันที่เริ่มต้นที่สะดวก", "Preferred Start Date")}</span>
                    <strong>{selectedRequest.preferredStartDate || "-"}</strong>
                  </div>
                  <div className={styles.dateCard}>
                    <span>{t("วันที่สิ้นสุดที่สะดวก", "Preferred End Date")}</span>
                    <strong>{selectedRequest.preferredEndDate || "-"}</strong>
                  </div>
                </div>
              </div>

              {/* Rejection / Review info if present */}
              {selectedRequest.rejectionReason && (
                <div className={styles.infoSection}>
                  <span className={styles.sectionLabel} style={{ color: "#ef4444" }}>🚫 {t("เหตุผลที่ไม่อนุมัติ", "Rejection Reason")}</span>
                  <div className={styles.highlightBox} style={{ borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.06)" }}>
                    {selectedRequest.rejectionReason}
                  </div>
                </div>
              )}

              {selectedRequest.reviewedAt && (
                <div className={styles.reviewHistoryCard}>
                  <span>
                    ⏱️ {t("พิจารณาเมื่อ:", "Reviewed at:")} {formatDate(selectedRequest.reviewedAt)}
                    {selectedRequest.reviewNote ? ` • Note: ${selectedRequest.reviewNote}` : ""}
                  </span>
                </div>
              )}

              {/* Decision Action Deck */}
              <div className={styles.actionsBar}>
                {!isFinalPlanned && (
                  <>
                    <button
                      className={styles.btnPrimary}
                      type="button"
                      disabled={pendingAction}
                      onClick={() => void handleApproveToPlan()}
                    >
                      🚀 {selectedRequest.status === "APPROVED"
                        ? t("เปิดฟอร์มจัดทำแผน OAP อีกครั้ง", "Open OAP Plan Form")
                        : t("อนุมัติและจัดลงแผน OAP", "Approve & Plan in OAP")}
                    </button>

                    {selectedRequest.status === "APPROVED" && (
                      <button
                        className={styles.btnSecondary}
                        type="button"
                        disabled={pendingAction}
                        onClick={() => void handleRevertToPending()}
                      >
                        ↩️ {t("ย้อนกลับเป็นรอตรวจสอบ", "Revert to Pending")}
                      </button>
                    )}

                    {selectedRequest.status !== "REJECTED" && (
                      <button
                        className={styles.btnDanger}
                        type="button"
                        disabled={pendingAction}
                        onClick={() => handleOpenRejectModal()}
                      >
                        ✕ {selectedRequest.status === "APPROVED" ? t("เปลี่ยนเป็นไม่อนุมัติ", "Change to Reject") : t("ไม่อนุมัติ", "Reject")}
                      </button>
                    )}

                    {selectedRequest.status === "REJECTED" && (
                      <button
                        className={styles.btnSecondary}
                        type="button"
                        disabled={pendingAction}
                        onClick={() => void handleRevertToPending()}
                      >
                        ↩️ {t("เปิดพิจารณาใหม่ (รอตรวจสอบ)", "Reopen to Pending")}
                      </button>
                    )}
                  </>
                )}

                {isFinalPlanned && (
                  <p style={{ margin: 0, fontSize: "0.86rem", color: "#2563eb", fontWeight: 700 }}>
                    ✓ {t("คำขอนี้ได้รับการจัดทำแผนการอบรม (OAP / Rolling) เสร็จสมบูรณ์แล้ว", "Incorporated into training plan.")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.emptyStateContainer}>
              <p>👈 {t("เลือกคำขอจากรายการด้านซ้ายเพื่อดูรายละเอียด", "Select a request to inspect")}</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Group by Course Demand View */}
      {activeTab === "demand" && (
        <div className={styles.demandGrid}>
          {demandGroups.length === 0 ? (
            <div className={styles.emptyStateContainer} style={{ gridColumn: "1 / -1" }}>
              <p>📭 {t("ไม่มีข้อมูลความต้องการฝึกอบรม", "No course demand records")}</p>
            </div>
          ) : (
            demandGroups.map((group) => (
              <div key={group.courseKey} className={styles.demandCard}>
                <div className={styles.demandCardHeader}>
                  <h4 className={styles.demandCourseTitle}>{group.courseTitle}</h4>
                  <span className={styles.demandCountBadge}>
                    👥 {group.totalRequests} {t("คน", "requesters")}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {group.companies.map((comp) => (
                    <span key={comp} className={styles.scopeBadge} style={{ fontSize: "0.74rem", padding: "2px 8px" }}>
                      🏢 {comp}
                    </span>
                  ))}
                  {group.pendingCount > 0 && (
                    <span className={`${styles.statusBadge} ${styles.statusBadgePending}`}>
                      ⏳ {group.pendingCount} {t("รอตรวจ", "Pending")}
                    </span>
                  )}
                  {group.approvedCount > 0 && (
                    <span className={`${styles.statusBadge} ${styles.statusBadgeApproved}`}>
                      ✓ {group.approvedCount} {t("อนุมัติแล้ว", "Approved")}
                    </span>
                  )}
                  {group.plannedCount > 0 && (
                    <span className={`${styles.statusBadge} ${styles.statusBadgePlanned}`}>
                      📋 {group.plannedCount} {t("ลงแผนแล้ว", "Planned")}
                    </span>
                  )}
                </div>

                {/* List of Requesters in this course */}
                <div className={styles.demandRequestersList}>
                  {group.requests.map((r) => (
                    <div key={r.id} className={styles.demandRequesterItem}>
                      <div>
                        <strong>{r.employeeName}</strong> ({r.companyCode})
                        <div style={{ fontSize: "0.76rem", color: "var(--ui-30-muted)", marginTop: "2px" }}>
                          {r.requestReason}
                        </div>
                      </div>
                      {getStatusBadge(r.status)}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "auto", paddingTop: "10px" }}>
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={pendingAction}
                    onClick={() => void handleBatchApproveGroup(group)}
                  >
                    🚀 {t("อนุมัติกลุ่มนี้ & เปิดแผน OAP", "Approve Group & Plan in OAP")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. Rejection Modal Dialog */}
      {isRejectModalOpen && selectedRequest ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={() => setIsRejectModalOpen(false)}
        >
          <div
            style={{
              background: "var(--ui-60-surface)",
              color: "var(--ui-30-ink)",
              border: "1px solid var(--ui-30-border)",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#ef4444", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🚫</span> {t("ระบุเหตุผลที่ไม่อนุมัติคำขอ", "Reject Training Request")}
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--ui-30-muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ui-30-text)" }}>
              {t("คำขอเลขที่:", "Request No:")} <strong>{selectedRequest.requestNo}</strong> ({selectedRequest.requestedCourseName})
            </p>

            <textarea
              style={{
                width: "100%",
                minHeight: "90px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1.5px solid var(--ui-30-border)",
                background: "var(--ui-60-surface-soft)",
                color: "var(--ui-30-ink)",
                fontFamily: "inherit",
                fontSize: "0.9rem",
                boxSizing: "border-box",
                outline: "none",
              }}
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder={t("พิมพ์เหตุผลที่ไม่อนุมัติเพื่อให้พนักงานรับทราบ...", "Enter rejection reason for the employee...")}
              autoFocus
            />

            {/* Quick Reason Templates */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--ui-30-muted)", fontWeight: 700, alignSelf: "center" }}>
                {t("ตัวอย่างเหตุผล:", "Quick reasons:")}
              </span>
              {[
                t("หลักสูตรนี้มีในแผนประจำปีอยู่แล้ว", "Course scheduled in annual plan"),
                t("ข้อมูลคำขอไม่ครบถ้วน", "Incomplete request info"),
                t("งบประมาณการอบรมเต็ม", "Training budget exhausted"),
              ].map((reasonText) => (
                <button
                  key={reasonText}
                  type="button"
                  onClick={() => setRejectionNote(reasonText)}
                  style={{
                    background: "var(--ui-60-surface-soft)",
                    color: "var(--ui-30-text)",
                    border: "1px solid var(--ui-30-border)",
                    borderRadius: "20px",
                    padding: "3px 10px",
                    fontSize: "0.76rem",
                    cursor: "pointer",
                  }}
                >
                  {reasonText}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                className={styles.btnSecondary}
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
              >
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                className={styles.btnDanger}
                type="button"
                disabled={!rejectionNote.trim() || pendingAction}
                onClick={() => void handleConfirmReject()}
              >
                {pendingAction ? t("กำลังบันทึก...", "Saving...") : t("ยืนยันไม่อนุมัติ", "Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
