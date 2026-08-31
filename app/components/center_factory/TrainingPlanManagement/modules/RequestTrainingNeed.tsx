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
import {
  NEED_REQUEST_STATUSES,
  needRequestStatusLabel,
} from "../../../../lib/trainingNeedRequests/labels";
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
  const [pendingAction, setPendingAction] = useState(false);

  // Rejection modal dialog state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const [requestsRes, companiesRes] = await Promise.all([
        listNeedRequests(),
        !isFactoryUser ? listCompanies().catch(() => ({ items: [] as CompanyRecord[] })) : Promise.resolve({ items: [] as CompanyRecord[] }),
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

  const handleApproveToPlan = async () => {
    const ok = await confirm({
      message: {
        th: `ยืนยันการอนุมัติคำขอ ${selectedRequest?.requestNo} และนำเข้าสู่การจัดทำแผน OAP หรือไม่?`,
        en: `Confirm approving request ${selectedRequest?.requestNo} and proceed to OAP planning?`,
      },
    });
    if (!ok) return;

    const updated = await applyAction("approve", null);
    if (!updated) return;

    window.localStorage.setItem(APPROVED_TRAINING_NEED_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("approved-training-need-changed"));
    toast.success(t(`อนุมัติคำขอ ${updated.requestNo} เรียบร้อยแล้ว`, `Approved ${updated.requestNo}`));
    onOpenTrainingOap?.();
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
      toast.success(t(`ปฏิเสธคำขอ ${updated.requestNo} แล้ว`, `Rejected ${updated.requestNo}`));
    }
  };

  const isDecided = Boolean(selectedRequest) && selectedRequest?.status !== "PENDING";

  return (
    <section className={styles.moduleWorkspace} aria-label="Request Training Need module">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{requestTrainingNeedModule.subtitle}</p>
          <h2>{requestTrainingNeedModule.title}</h2>
          <p>{requestTrainingNeedModule.description}</p>
          <span className={styles.permissionNote}>
            {isFactoryUser
              ? t("🏢 สิทธิ์ HRD โรงงาน: แสดงคำขอของพนักงานในบริษัทตนเอง", "Factory permission: showing requests in own company")
              : t("🏛️ สิทธิ์ HRD ส่วนกลาง: แสดงคำขอของพนักงานทุกบริษัท", "Center permission: showing requests from all companies")}
          </span>
        </div>
      </section>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
        <div
          onClick={() => setStatusFilter("all")}
          style={{
            background: statusFilter === "all" ? "var(--ui-60-surface)" : "var(--ui-60-surface-soft, #f8fafc)",
            border: statusFilter === "all" ? "2px solid var(--ui-30-primary, #007a3d)" : "1px solid var(--ui-30-border, #e2e8f0)",
            borderRadius: "10px",
            padding: "12px 16px",
            cursor: "pointer",
            transition: "all 140ms ease",
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
            {t("คำขอทั้งหมด", "All Requests")}
          </span>
          <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>{stats.total}</h3>
        </div>

        <div
          onClick={() => setStatusFilter("PENDING")}
          style={{
            background: statusFilter === "PENDING" ? "var(--ui-60-surface)" : "rgba(245, 158, 11, 0.04)",
            border: statusFilter === "PENDING" ? "2px solid #f59e0b" : "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "10px",
            padding: "12px 16px",
            cursor: "pointer",
            transition: "all 140ms ease",
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 700, textTransform: "uppercase" }}>
            🟡 {t("รอตรวจสอบ", "Pending")}
          </span>
          <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: "#b45309" }}>{stats.pending}</h3>
        </div>

        <div
          onClick={() => setStatusFilter("APPROVED")}
          style={{
            background: statusFilter === "APPROVED" ? "var(--ui-60-surface)" : "rgba(16, 185, 129, 0.04)",
            border: statusFilter === "APPROVED" ? "2px solid #10b981" : "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "10px",
            padding: "12px 16px",
            cursor: "pointer",
            transition: "all 140ms ease",
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#047857", fontWeight: 700, textTransform: "uppercase" }}>
            🟢 {t("อนุมัติแล้ว", "Approved")}
          </span>
          <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: "#047857" }}>{stats.approved}</h3>
        </div>

        <div
          onClick={() => setStatusFilter("PLANNED")}
          style={{
            background: statusFilter === "PLANNED" ? "var(--ui-60-surface)" : "rgba(59, 130, 246, 0.04)",
            border: statusFilter === "PLANNED" ? "2px solid #3b82f6" : "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "10px",
            padding: "12px 16px",
            cursor: "pointer",
            transition: "all 140ms ease",
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>
            🔵 {t("บรรจุในแผน OAP", "Planned")}
          </span>
          <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: "#1d4ed8" }}>{stats.planned}</h3>
        </div>

        <div
          onClick={() => setStatusFilter("REJECTED")}
          style={{
            background: statusFilter === "REJECTED" ? "var(--ui-60-surface)" : "rgba(239, 68, 68, 0.04)",
            border: statusFilter === "REJECTED" ? "2px solid #ef4444" : "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "10px",
            padding: "12px 16px",
            cursor: "pointer",
            transition: "all 140ms ease",
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#b91c1c", fontWeight: 700, textTransform: "uppercase" }}>
            🔴 {t("ไม่อนุมัติ", "Rejected")}
          </span>
          <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: "#b91c1c" }}>{stats.rejected}</h3>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search employee training requests"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(
              "🔍 ค้นหาเลขที่คำขอ, รหัสพนักงาน, ชื่อพนักงาน, หลักสูตร, เหตุผล...",
              "Search request, employee, course, reason...",
            )}
          />

          {!isFactoryUser && (
            <select
              aria-label="Filter company"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            >
              <option value="all">{t("-- ทุกบริษัท (All Companies) --", "-- All Companies --")}</option>
              {companies.map((c) => (
                <option key={c.companyCode} value={c.companyCode}>
                  {c.companyCode} - {language === "th" ? c.companyNameTh : (c.companyNameEn || c.companyNameTh)}
                </option>
              ))}
            </select>
          )}

          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as NeedRequestStatus | "all")}
          >
            <option value="all">{t("ทุกสถานะ (All status)", "All status")}</option>
            {NEED_REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {needRequestStatusLabel(status, language)}
              </option>
            ))}
          </select>

          <button
            className={styles.refreshButton}
            type="button"
            disabled={isLoading}
            onClick={() => void loadRequests()}
          >
            {isLoading ? t("กำลังโหลด...", "Loading...") : t("🔄 รีเฟรช", "Refresh")}
          </button>
        </div>

        {loadError ? (
          <div className={styles.emptyState} role="alert">
            {t("โหลดคำขอไม่สำเร็จ", "Could not load requests")}: {loadError}
          </div>
        ) : null}
      </section>

      <section className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>{t("กล่องคำขอจากพนักงาน", "Employee inbox")}</span>
              <h3>{t("คำขอฝึกอบรม", "Training Requests")}</h3>
            </div>
            <p>{t(`${visibleRequests.length} รายการ`, `${visibleRequests.length} in view`)}</p>
          </div>

          <div className={styles.requestList}>
            {visibleRequests.map((request) => (
              <button
                className={
                  request.id === selectedRequest?.id ? styles.activeRequest : styles.requestCard
                }
                key={request.id}
                type="button"
                onClick={() => setSelectedId(request.id)}
              >
                <span className={styles.cardTopline}>
                  <b>{request.requestNo}</b>
                  <small style={{ color: "#64748b" }}>{formatDate(request.requestedAt)}</small>
                </span>
                <strong>{request.requestedCourseName}</strong>
                <small>
                  👤 {request.employeeName} ({request.employeeCode || "-"}) • 🏢 {request.companyCode} • {request.functionName || "-"}
                </small>
                <span className={styles.statusPill}>
                  {needRequestStatusLabel(request.status, language)}
                </span>
              </button>
            ))}
            {visibleRequests.length === 0 ? (
              <div className={styles.emptyState}>
                {isLoading
                  ? t("กำลังโหลด...", "Loading...")
                  : t("ไม่พบคำขอฝึกอบรมตามเงื่อนไข", "No employee training requests match the filter.")}
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.detailPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>{t("รายละเอียดคำขอฝึกอบรม", "Training Request Details")}</span>
              <h3>{selectedRequest?.requestedCourseName ?? t("ยังไม่ได้เลือกคำขอ", "No request selected")}</h3>
            </div>
            {selectedRequest ? (
              <p>{needRequestStatusLabel(selectedRequest.status, language)}</p>
            ) : null}
          </div>

          {selectedRequest ? (
            <>
              <div className={styles.employeeRequestPreview}>
                <article>
                  <span>{t("หลักสูตรที่ขอเปิด / ขออบรมทบทวน", "Course Needed / Refresher")}</span>
                  <strong>{selectedRequest.requestedCourseName}</strong>
                </article>
                <article>
                  <span>{t("เหตุผลและความจำเป็น", "Request Reason")}</span>
                  <p>{selectedRequest.requestReason}</p>
                </article>
              </div>

              <dl className={styles.detailGrid}>
                <div>
                  <dt>{t("เลขที่คำขอ", "Request No.")}</dt>
                  <dd><strong>{selectedRequest.requestNo}</strong></dd>
                </div>
                <div>
                  <dt>{t("พนักงานผู้ส่งคำขอ", "Employee")}</dt>
                  <dd>
                    {selectedRequest.employeeName} ({selectedRequest.employeeCode || "-"})
                  </dd>
                </div>
                <div>
                  <dt>{t("บริษัท", "Company")}</dt>
                  <dd>{selectedRequest.companyCode}</dd>
                </div>
                <div>
                  <dt>{t("หน่วยงาน / สายงาน", "Function")}</dt>
                  <dd>{selectedRequest.functionName || "-"}</dd>
                </div>
                <div>
                  <dt>{t("ช่วงเวลาที่สะดวก", "Preferred Dates")}</dt>
                  <dd>
                    {selectedRequest.preferredStartDate
                      ? `📅 ${selectedRequest.preferredStartDate} ถึง ${selectedRequest.preferredEndDate ?? "-"}`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>{t("วันที่ส่งคำขอ", "Submitted Date")}</dt>
                  <dd>📅 {formatDate(selectedRequest.requestedAt)}</dd>
                </div>
              </dl>

              {selectedRequest.rejectionReason ? (
                <div className={styles.reasonBox}>
                  <span>{t("เหตุผลที่ไม่อนุมัติคำขอ", "Rejection Reason")}</span>
                  <p>🔴 {selectedRequest.rejectionReason}</p>
                </div>
              ) : null}

              <div className={styles.reviewActions}>
                <button
                  className={styles.actionButton}
                  type="button"
                  disabled={pendingAction || isDecided}
                  onClick={() => void handleApproveToPlan()}
                >
                  🚀 {t("อนุมัติและจัดลงแผน OAP", "Approve & Plan in OAP")}
                </button>
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={pendingAction || isDecided}
                  onClick={() => handleOpenRejectModal()}
                >
                  ✕ {t("ไม่อนุมัติ", "Reject")}
                </button>
              </div>

              {isDecided ? (
                <p className={styles.emptyState} style={{ padding: "10px", fontSize: "0.84rem" }}>
                  {t(
                    "คำขอนี้ได้ทำการพิจารณาตัดสินใจไปแล้ว",
                    "This request has already been decided.",
                  )}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      </section>

      {/* Modern Rejection Modal */}
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
              background: "#ffffff",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#b91c1c", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🚫</span> {t("ระบุเหตุผลที่ไม่อนุมัติคำขอ", "Reject Training Request")}
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569" }}>
              {t("คำขอเลขที่:", "Request No:")} <strong>{selectedRequest.requestNo}</strong> ({selectedRequest.requestedCourseName})
            </p>

            <textarea
              style={{
                width: "100%",
                minHeight: "90px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1.5px solid #cbd5e1",
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
              <span style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 700, alignSelf: "center" }}>
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
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
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
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                }}
              >
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                type="button"
                disabled={!rejectionNote.trim() || pendingAction}
                onClick={() => void handleConfirmReject()}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ef4444",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  opacity: !rejectionNote.trim() || pendingAction ? 0.6 : 1,
                }}
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
