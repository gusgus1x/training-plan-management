"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  bulkDecideNeedRequests,
  listNeedRequests,
  updateNeedRequest,
} from "../../../../lib/trainingNeedRequests/client";
import { HRD_REJECT_REASONS } from "../../../../lib/trainingNeedRequests/labels";
import type {
  NeedRequestAction,
  NeedRequestRecord,
  NeedRequestStatus,
} from "../../../../lib/trainingNeedRequests/types";
import {
  Inbox,
  Factory,
  Building2,
  RefreshCw,
  FileText,
  BarChart3,
  AlertTriangle,
  User,
  CalendarDays,
  Tag,
  Folder,
  FileEdit,
  Ban,
  Clock,
  Rocket,
  RotateCcw,
  X,
  Check,
  Users,
  ClipboardList,
} from "../../../icons/LucideIcons";
import styles from "./RequestTrainingNeed.module.css";

export const requestTrainingNeedModule = {
  title: "Request Training Need",
  subtitle: "Employee request inbox",
  description:
    "Review Course Needed and Request Reason submitted from the employee training request page.",
} as const;

const formatDate = (iso: string) => iso.slice(0, 10);


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

export default function RequestTrainingNeed() {
  const router = useRouter();
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
  // The requests the open rejection dialog will reject: one from the detail pane, or a selection.
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);
  // Ticked requests for approving, rejecting or planning in one go.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  /** Only a request waiting on HRD, or already approved, can be decided or planned from here. */
  const isActionable = (request: NeedRequestRecord) => request.stage === "WAITING_HRD" || request.stage === "APPROVED";

  const mergeUpdated = (updated: NeedRequestRecord[]) => {
    const byId = new Map(updated.map((request) => [request.id, request]));
    setRequests((current) => current.map((request) => byId.get(request.id) ?? request));
  };

  const toggleSelected = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedRequests = requests.filter((request) => selectedIds.has(request.id) && isActionable(request));
  const actionableVisible = visibleRequests.filter(isActionable);
  const allVisibleSelected = actionableVisible.length > 0 && actionableVisible.every((request) => selectedIds.has(request.id));

  /** Approves whichever of these still wait on HRD, all or none, and returns false when HRD backs out. */
  const approvePending = async (targets: NeedRequestRecord[]) => {
    const pending = targets.filter((request) => request.stage === "WAITING_HRD");
    if (pending.length === 0) return true;
    const ok = await confirm({
      message: {
        th: `ยืนยันอนุมัติคำขอ ${pending.length} รายการ หรือไม่?`,
        en: `Approve ${pending.length} request(s)?`,
      },
    });
    if (!ok) return false;
    const { needRequests } = await bulkDecideNeedRequests({ ids: pending.map((request) => request.id), action: "approve", note: null });
    mergeUpdated(needRequests);
    return true;
  };

  const handleBulkApprove = async (targets: NeedRequestRecord[]) => {
    if (!targets.some((request) => request.stage === "WAITING_HRD")) {
      toast.info(t("ไม่มีคำขอที่รอ HRD อนุมัติในรายการที่เลือก", "Nothing selected is waiting for HRD"));
      return;
    }
    setPendingAction(true);
    try {
      if (await approvePending(targets)) {
        toast.success(t("อนุมัติคำขอที่เลือกแล้ว", "Selected requests approved"));
        setSelectedIds(new Set());
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("อนุมัติไม่สำเร็จ", "Could not approve"));
    } finally {
      setPendingAction(false);
    }
  };

  /**
   * Approves what still needs it, then opens Training Rolling with every request attached. The ids
   * travel in the address, so the hand-off survives a reload or another browser - the old
   * localStorage hand-off did neither and only ever carried the first request of a group.
   */
  const handleApproveAndPlan = async (targets: NeedRequestRecord[]) => {
    const actionable = targets.filter(isActionable);
    if (actionable.length === 0) {
      toast.info(t("ไม่มีคำขอที่จัดรุ่นได้ในรายการที่เลือก", "Nothing selected can be planned"));
      return;
    }
    setPendingAction(true);
    try {
      if (!(await approvePending(actionable))) return;
      router.push(`/training-plan/training-rolling?needRequestIds=${actionable.map((request) => request.id).join(",")}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("อนุมัติไม่สำเร็จ", "Could not approve"));
    } finally {
      setPendingAction(false);
    }
  };

  const handleUnlink = async () => {
    if (!selectedRequest) return;
    const ok = await confirm({
      message: {
        th: `ยกเลิกการผูกคำขอ ${selectedRequest.requestNo} กับรุ่น ${selectedRequest.plan?.planCode ?? ""} หรือไม่? คำขอจะกลับเป็น "อนุมัติแล้ว" (รายชื่อผู้เข้าอบรมในรุ่นไม่ถูกลบ ต้องยกเลิกที่หน้าคัดคนเอง)`,
        en: `Unlink ${selectedRequest.requestNo} from batch ${selectedRequest.plan?.planCode ?? ""}? It returns to Approved. The enrollment in that batch stays until cancelled there.`,
      },
    });
    if (!ok) return;
    const updated = await applyAction("unlink", null);
    if (updated) toast.success(t(`ยกเลิกการผูก ${updated.requestNo} แล้ว`, `Unlinked ${updated.requestNo}`));
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
      toast.success(
        t(
          `ย้อนกลับสถานะคำขอ ${updated.requestNo} เป็นรอตรวจสอบแล้ว`,
          `Reverted ${updated.requestNo} to Pending`,
        ),
      );
    }
  };

  const handleOpenRejectModal = (ids: string[]) => {
    setRejectTargetIds(ids);
    setRejectionNote("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionNote.trim()) {
      toast.warning(t("กรุณาระบุเหตุผลที่ไม่อนุมัติ", "Please specify a rejection reason"));
      return;
    }

    setIsRejectModalOpen(false);
    setPendingAction(true);
    try {
      const { needRequests } = await bulkDecideNeedRequests({ ids: rejectTargetIds, action: "reject", note: rejectionNote.trim() });
      mergeUpdated(needRequests);
      setSelectedIds(new Set());
      toast.success(t(`ไม่อนุมัติคำขอ ${needRequests.length} รายการแล้ว`, `Rejected ${needRequests.length} request(s)`));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("บันทึกไม่สำเร็จ", "Could not save"));
    } finally {
      setPendingAction(false);
    }
  };

  const getStatusBadge = (status: NeedRequestStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <span className={`${styles.statusBadge} ${styles.statusBadgePending}`}>
            <span className={`${styles.statusDot} ${styles.dotPending} ${styles.dotPulse}`} />
            {t("รอตรวจสอบ", "Pending")}
          </span>
        );
      case "APPROVED":
        return (
          <span className={`${styles.statusBadge} ${styles.statusBadgeApproved}`}>
            <span className={`${styles.statusDot} ${styles.dotApproved} ${styles.dotPulse}`} />
            {t("อนุมัติแล้ว", "Approved")}
          </span>
        );
      case "PLANNED":
        return (
          <span className={`${styles.statusBadge} ${styles.statusBadgePlanned}`}>
            <span className={`${styles.statusDot} ${styles.dotPlanned} ${styles.dotPulse}`} />
            {t("จัดลงแผนแล้ว", "Planned")}
          </span>
        );
      case "REJECTED":
        return (
          <span className={`${styles.statusBadge} ${styles.statusBadgeRejected}`}>
            <span className={`${styles.statusDot} ${styles.dotRejected}`} />
            {t("ไม่อนุมัติ", "Rejected")}
          </span>
        );
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
            <Inbox size={20} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 8 }} />{t("คำขอจัดฝึกอบรมจากพนักงาน", "Training Need Requests Inbox")}
          </h2>
          <p>
            {t(
              "คำขอที่หัวหน้า (Section Head) อนุมัติแล้ว ติ๊กเลือกหลายรายการเพื่ออนุมัติ/ไม่อนุมัติ แล้วเปิดฟอร์มจัดทำแผน Rolling เพื่อลงชื่อพนักงานเข้ารุ่น",
              "Requests their section heads approved. Tick several to approve or reject, then open Training Rolling to put the people into a batch.",
            )}
          </p>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.scopeBadge}>
            {isFactoryUser ? (
              <span><Factory size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t(`HRD โรงงาน (${user?.companyCode || "Factory"})`, `Factory HRD (${user?.companyCode || "Factory"})`)}</span>
            ) : (
              <span><Building2 size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("HRD ส่วนกลาง (Center - ทุกบริษัท)", "Center HRD (All Companies)")}</span>
            )}
          </div>
          <button className={styles.refreshBtn} type="button" onClick={() => void loadRequests()} title="Refresh">
            <RefreshCw size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("รีเฟรช", "Refresh")}
          </button>
        </div>
      </header>

      {/* 2. Interactive KPI Stats Deck */}
      <div className={styles.statsGrid}>
        <button
          className={`${styles.statCard} ${styles.statCardPending} ${statusFilter === "PENDING" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "PENDING" ? "all" : "PENDING")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>
              <span className={`${styles.statusDot} ${styles.dotPending} ${styles.dotPulse}`} />
              {t("รอตรวจสอบ", "Pending")}
            </span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountPending}`}>{stats.pending}</strong>
        </button>

        <button
          className={`${styles.statCard} ${styles.statCardApproved} ${statusFilter === "APPROVED" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "APPROVED" ? "all" : "APPROVED")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>
              <span className={`${styles.statusDot} ${styles.dotApproved} ${styles.dotPulse}`} />
              {t("อนุมัติแล้ว", "Approved")}
            </span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountApproved}`}>{stats.approved}</strong>
        </button>

        <button
          className={`${styles.statCard} ${styles.statCardPlanned} ${statusFilter === "PLANNED" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "PLANNED" ? "all" : "PLANNED")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>
              <span className={`${styles.statusDot} ${styles.dotPlanned} ${styles.dotPulse}`} />
              {t("จัดลงแผนแล้ว", "Planned")}
            </span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountPlanned}`}>{stats.planned}</strong>
        </button>

        <button
          className={`${styles.statCard} ${styles.statCardRejected} ${statusFilter === "REJECTED" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter(statusFilter === "REJECTED" ? "all" : "REJECTED")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>
              <span className={`${styles.statusDot} ${styles.dotRejected}`} />
              {t("ไม่อนุมัติ", "Rejected")}
            </span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountRejected}`}>{stats.rejected}</strong>
        </button>

        <button
          className={`${styles.statCard} ${styles.statCardTotal} ${statusFilter === "all" ? styles.statCardActive : ""}`}
          type="button"
          onClick={() => setStatusFilter("all")}
        >
          <div className={styles.statCardHeader}>
            <span className={styles.statLabel}>
              <span className={`${styles.statusDot} ${styles.dotTotal} ${styles.dotPulse}`} />
              {t("คำขอทั้งหมด", "Total")}
            </span>
          </div>
          <strong className={`${styles.statCount} ${styles.statCountTotal}`}>{stats.total}</strong>
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
            <FileText size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("รายการคำขอ (รายคน)", "Request List")} ({visibleRequests.length})
          </button>
          <button
            className={`${styles.viewTab} ${activeTab === "demand" ? styles.viewTabActive : ""}`}
            type="button"
            onClick={() => setActiveTab("demand")}
          >
            <BarChart3 size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("รวมยอดตามหลักสูตร", "Demand by Course")} ({demandGroups.length})
          </button>
        </div>

        <div className={styles.filterControls}>
          <input
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ค้นหาเลขที่คำขอ, พนักงาน, หลักสูตร...", "Search request no, employee, course...")}
          />

          {!isFactoryUser && companies.length > 0 ? (
            <select
              className={styles.companySelect}
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="all">{t("ทุกบริษัท (All Companies)", "All Companies")}</option>
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
          <p style={{ color: "#ef4444", fontWeight: 700 }}><AlertTriangle size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{loadError}</p>
        </div>
      ) : null}

      {/* 4. Tab 1: Master-Detail List View */}
      {activeTab === "list" && actionableVisible.length > 0 ? (
        <div className={styles.bulkBar}>
          <label className={styles.bulkSelectAll}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() =>
                setSelectedIds(allVisibleSelected ? new Set() : new Set(actionableVisible.map((request) => request.id)))
              }
            />
            {t(`เลือกทั้งหมดที่ดำเนินการได้ (${actionableVisible.length})`, `Select all actionable (${actionableVisible.length})`)}
          </label>
          <span className={styles.bulkCount}>{t(`เลือกแล้ว ${selectedRequests.length}`, `${selectedRequests.length} selected`)}</span>
          <button className={styles.btnSecondary} type="button" disabled={pendingAction || selectedRequests.length === 0} onClick={() => void handleBulkApprove(selectedRequests)}>
            <Check size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
            {t("อนุมัติที่เลือก", "Approve selected")}
          </button>
          <button
            className={styles.btnDanger}
            type="button"
            disabled={pendingAction || selectedRequests.length === 0}
            onClick={() => handleOpenRejectModal(selectedRequests.map((request) => request.id))}
          >
            <X size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
            {t("ไม่อนุมัติที่เลือก", "Reject selected")}
          </button>
          <button className={styles.btnPrimary} type="button" disabled={pendingAction || selectedRequests.length === 0} onClick={() => void handleApproveAndPlan(selectedRequests)}>
            <Rocket size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
            {t("อนุมัติและเปิดฟอร์มจัดทำแผน Rolling", "Approve & open Training Rolling")}
          </button>
        </div>
      ) : null}

      {activeTab === "list" && (
        <div className={styles.mainLayout}>
          {/* Left Pane: Requests List */}
          <div className={styles.listPane}>
            {visibleRequests.length === 0 ? (
              <div className={styles.emptyStateContainer}>
                <p><Inbox size={24} style={{ display: "block", margin: "0 auto 8px" }} />{t("ไม่พบคำขอฝึกอบรมตามเงื่อนไขที่เลือก", "No training requests match your filters")}</p>
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
                      <span className={styles.requestNo}>
                        {isActionable(req) ? (
                          <input
                            type="checkbox"
                            className={styles.cardCheckbox}
                            checked={selectedIds.has(req.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleSelected(req.id)}
                            aria-label={t(`เลือก ${req.requestNo}`, `Select ${req.requestNo}`)}
                          />
                        ) : null}
                        {req.requestNo}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>
                    <h4 className={styles.requestCardTitle}>{req.requestedCourseName}</h4>
                    <div className={styles.requestCardMeta}>
                      <span className={styles.requesterBadge}>
                        <><User size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{req.employeeName} ({req.companyCode})</>
                      </span>
                      <span><CalendarDays size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{formatDate(req.requestedAt)}</span>
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
                    <><Tag size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />{selectedRequest.employeeCode} • <Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />{selectedRequest.companyCode} • <Folder size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />{selectedRequest.functionName || "-"}</>
                  </span>
                </div>
              </div>

              {selectedRequest.approver ? (
                <div className={styles.infoSection}>
                  <span className={styles.sectionLabel}>
                    <User size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("หัวหน้าผู้อนุมัติ (Section Head)", "Section head")}
                  </span>
                  <div className={styles.highlightBox}>
                    {selectedRequest.approver.name} ({selectedRequest.approver.employeeCode}) · {selectedRequest.approver.position || "-"}
                    <br />
                    {selectedRequest.approverDecision === "APPROVED"
                      ? t(`อนุมัติเมื่อ ${formatDate(selectedRequest.approverDecidedAt ?? "")}`, `Approved ${formatDate(selectedRequest.approverDecidedAt ?? "")}`)
                      : t("ยังไม่ตัดสิน", "Not decided yet")}
                    {selectedRequest.approverNote ? ` · ${selectedRequest.approverNote}` : ""}
                  </div>
                </div>
              ) : null}

              {selectedRequest.plan ? (
                <div className={styles.infoSection}>
                  <span className={styles.sectionLabel}>
                    <ClipboardList size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("รุ่นที่จัดเข้า", "Linked batch")}
                  </span>
                  <div className={styles.highlightBox}>
                    {selectedRequest.plan.planCode} · {selectedRequest.plan.planName} · {formatDate(selectedRequest.plan.startAt)}
                  </div>
                </div>
              ) : null}

              {/* Request Reason */}
              <div className={styles.infoSection}>
                <span className={styles.sectionLabel}><FileEdit size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("เหตุผลความจำเป็นในการขอรับการฝึกอบรม", "Reason for Request")}</span>
                <div className={styles.highlightBox}>
                  {selectedRequest.requestReason || "-"}
                </div>
              </div>

              {/* Preferred Dates */}
              <div className={styles.infoSection}>
                <span className={styles.sectionLabel}><CalendarDays size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("ช่วงเวลาที่สะดวกในการเข้าอบรม", "Preferred Schedule")}</span>
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
                  <span className={styles.sectionLabel} style={{ color: "#ef4444" }}><Ban size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("เหตุผลที่ไม่อนุมัติ", "Rejection Reason")}</span>
                  <div className={styles.highlightBox} style={{ borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.06)" }}>
                    {selectedRequest.rejectionReason}
                  </div>
                </div>
              )}

              {selectedRequest.reviewedAt && (
                <div className={styles.reviewHistoryCard}>
                  <span>
                    <Clock size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("พิจารณาเมื่อ:", "Reviewed at:")} {formatDate(selectedRequest.reviewedAt)}
                    {selectedRequest.reviewNote ? ` • Note: ${selectedRequest.reviewNote}` : ""}
                  </span>
                </div>
              )}

              {/* Decision Action Deck */}
              <div className={styles.actionsBar}>
                {!isFinalPlanned && (
                  <>
                    {selectedRequest.status !== "REJECTED" ? (
                      <button
                        className={styles.btnPrimary}
                        type="button"
                        disabled={pendingAction}
                        onClick={() => void handleApproveAndPlan([selectedRequest])}
                      >
                        <Rocket size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {selectedRequest.status === "APPROVED"
                          ? t("เปิดฟอร์มจัดทำแผน Rolling", "Open Training Rolling")
                          : t("อนุมัติและเปิดฟอร์มจัดทำแผน Rolling", "Approve & open Training Rolling")}
                      </button>
                    ) : null}

                    {selectedRequest.status === "APPROVED" && (
                      <button
                        className={styles.btnSecondary}
                        type="button"
                        disabled={pendingAction}
                        onClick={() => void handleRevertToPending()}
                      >
                        <RotateCcw size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("ย้อนกลับเป็นรอตรวจสอบ", "Revert to Pending")}
                      </button>
                    )}

                    {selectedRequest.status !== "REJECTED" && (
                      <button
                        className={styles.btnDanger}
                        type="button"
                        disabled={pendingAction}
                        onClick={() => handleOpenRejectModal([selectedRequest.id])}
                      >
                        <X size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{selectedRequest.status === "APPROVED" ? t("เปลี่ยนเป็นไม่อนุมัติ", "Change to Reject") : t("ไม่อนุมัติ", "Reject")}
                      </button>
                    )}

                    {selectedRequest.status === "REJECTED" && (
                      <button
                        className={styles.btnSecondary}
                        type="button"
                        disabled={pendingAction}
                        onClick={() => void handleRevertToPending()}
                      >
                        <RotateCcw size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("เปิดพิจารณาใหม่ (รอตรวจสอบ)", "Reopen to Pending")}
                      </button>
                    )}
                  </>
                )}

                {isFinalPlanned && (
                  <>
                    <p style={{ margin: 0, fontSize: "0.86rem", color: "#2563eb", fontWeight: 700 }}>
                      <Check size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("คำขอนี้จัดเข้ารุ่นอบรมแล้ว", "Linked to a training batch.")}
                    </p>
                    <button className={styles.btnSecondary} type="button" disabled={pendingAction} onClick={() => void handleUnlink()}>
                      <RotateCcw size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("ยกเลิกการผูกกับรุ่น", "Unlink from batch")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.emptyStateContainer}>
              <p><FileText size={20} style={{ display: "block", margin: "0 auto 8px" }} />{t("เลือกคำขอจากรายการด้านซ้ายเพื่อดูรายละเอียด", "Select a request to inspect")}</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Group by Course Demand View */}
      {activeTab === "demand" && (
        <div className={styles.demandGrid}>
          {demandGroups.length === 0 ? (
            <div className={styles.emptyStateContainer} style={{ gridColumn: "1 / -1" }}>
              <p><Inbox size={24} style={{ display: "block", margin: "0 auto 8px" }} />{t("ไม่มีข้อมูลความต้องการฝึกอบรม", "No course demand records")}</p>
            </div>
          ) : (
            demandGroups.map((group) => (
              <div key={group.courseKey} className={styles.demandCard}>
                <div className={styles.demandCardHeader}>
                  <h4 className={styles.demandCourseTitle}>{group.courseTitle}</h4>
                  <span className={styles.demandCountBadge}>
                    <><Users size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{group.totalRequests} {t("คน", "requesters")}</>
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {group.companies.map((comp) => (
                    <span key={comp} className={styles.scopeBadge} style={{ fontSize: "0.74rem", padding: "2px 8px" }}>
                      <><Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />{comp}</>
                    </span>
                  ))}
                  {group.pendingCount > 0 && (
                    <span className={`${styles.statusBadge} ${styles.statusBadgePending}`}>
                      <><Clock size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />{group.pendingCount} {t("รอตรวจ", "Pending")}</>
                    </span>
                  )}
                  {group.approvedCount > 0 && (
                    <span className={`${styles.statusBadge} ${styles.statusBadgeApproved}`}>
                      <><Check size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />{group.approvedCount} {t("อนุมัติแล้ว", "Approved")}</>
                    </span>
                  )}
                  {group.plannedCount > 0 && (
                    <span className={`${styles.statusBadge} ${styles.statusBadgePlanned}`}>
                      <><ClipboardList size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />{group.plannedCount} {t("ลงแผนแล้ว", "Planned")}</>
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
                    onClick={() => void handleApproveAndPlan(group.requests)}
                  >
                    <Rocket size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("อนุมัติกลุ่มนี้ & เปิดฟอร์มจัดทำแผน Rolling", "Approve group & open Training Rolling")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. Rejection Modal Dialog */}
      {isRejectModalOpen && rejectTargetIds.length > 0 ? (
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
                <Ban size={18} color="#ef4444" style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("ระบุเหตุผลที่ไม่อนุมัติคำขอ", "Reject Training Request")}
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{ background: "none", border: "none", display: "inline-flex", alignItems: "center", cursor: "pointer", color: "var(--ui-30-muted)" }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ui-30-text)" }}>
              {rejectTargetIds.length === 1
                ? (() => {
                    const target = requests.find((request) => request.id === rejectTargetIds[0]);
                    return (
                      <>
                        {t("คำขอเลขที่:", "Request No:")} <strong>{target?.requestNo}</strong> ({target?.requestedCourseName})
                      </>
                    );
                  })()
                : t(`ไม่อนุมัติคำขอที่เลือก ${rejectTargetIds.length} รายการ ด้วยเหตุผลเดียวกัน`, `Reject ${rejectTargetIds.length} selected requests with one reason`)}
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
              {HRD_REJECT_REASONS.map((reason) => t(reason.th, reason.en)).map((reasonText) => (
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
