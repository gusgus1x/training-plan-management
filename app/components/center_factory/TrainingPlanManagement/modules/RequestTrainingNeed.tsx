"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<NeedRequestStatus | "all">("all");
  const [pendingAction, setPendingAction] = useState(false);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      // The server scopes a factory HRD to their own company; no company filter is sent from here.
      const { needRequests } = await listNeedRequests();
      setRequests(needRequests);
      setLoadError(null);
    } catch (error: unknown) {
      // An empty inbox and a failed fetch look identical otherwise, and this inbox is the only
      // place an employee's request surfaces.
      setLoadError(error instanceof Error ? error.message : "Could not load requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
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

      return matchesStatus && matchesSearch;
    });
  }, [requests, search, statusFilter]);

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
    const updated = await applyAction("approve", null);
    if (!updated) return;

    // Same-tab handoff to the OAP form so it can prefill from the request. This is UI state that
    // dies with the tab, not the request itself - that now lives in training_need_request.
    window.localStorage.setItem(APPROVED_TRAINING_NEED_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("approved-training-need-changed"));
    toast.success(t(`อนุมัติคำขอ ${updated.requestNo} แล้ว`, `Approved ${updated.requestNo}`));
    onOpenTrainingOap?.();
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    const ok = await confirm({
      message: {
        th: "ยืนยันที่จะปฏิเสธคำขออบรมนี้หรือไม่?",
        en: "Confirm rejecting this training request?",
      },
      danger: true,
    });
    if (!ok) return;

    // The server refuses a rejection with no reason, so ask for one rather than let the call fail.
    const reason = window.prompt(
      t("เหตุผลที่ไม่อนุมัติ", "Reason for rejecting this request"),
      "",
    );
    if (!reason || !reason.trim()) {
      toast.warning(t("ต้องระบุเหตุผลที่ไม่อนุมัติ", "A rejection reason is required"));
      return;
    }

    const updated = await applyAction("reject", reason.trim());
    if (updated) {
      toast.success(t(`ปฏิเสธคำขอ ${updated.requestNo} แล้ว`, `Rejected ${updated.requestNo}`));
    }
  };

  // Only a PENDING request is still open; APPROVED, REJECTED and PLANNED are all past deciding.
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
              ? t("สิทธิ์โรงงาน: เห็นเฉพาะบริษัทตนเอง", "Factory permission: own company only")
              : t("สิทธิ์ส่วนกลาง: เห็นทุกบริษัท", "Center permission: all companies")}
          </span>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search employee training requests"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(
              "ค้นหาเลขคำขอ พนักงาน หลักสูตร เหตุผล",
              "Search request, employee, course, reason",
            )}
          />
          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as NeedRequestStatus | "all")}
          >
            <option value="all">{t("ทุกสถานะ", "All status")}</option>
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
            {isLoading ? t("กำลังโหลด...", "Loading...") : t("รีเฟรช", "Refresh")}
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
                </span>
                <strong>{request.requestedCourseName}</strong>
                <small>
                  {request.employeeName} / {request.companyCode} / {request.functionName || "-"}
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
                  : t("ยังไม่มีคำขอจากพนักงาน", "No employee training request found.")}
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.detailPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>{t("รายละเอียดคำขอ", "Employee request preview")}</span>
              <h3>{selectedRequest?.requestedCourseName ?? t("ยังไม่ได้เลือก", "No request selected")}</h3>
            </div>
            {selectedRequest ? (
              <p>{needRequestStatusLabel(selectedRequest.status, language)}</p>
            ) : null}
          </div>

          {selectedRequest ? (
            <>
              <div className={styles.employeeRequestPreview}>
                <article>
                  <span>{t("หลักสูตรที่ขอ", "Course Needed")}</span>
                  <strong>{selectedRequest.requestedCourseName}</strong>
                </article>
                <article>
                  <span>{t("เหตุผล", "Request Reason")}</span>
                  <p>{selectedRequest.requestReason}</p>
                </article>
              </div>

              <dl className={styles.detailGrid}>
                <div>
                  <dt>{t("เลขที่คำขอ", "Request No.")}</dt>
                  <dd>{selectedRequest.requestNo}</dd>
                </div>
                <div>
                  <dt>{t("พนักงาน", "Employee")}</dt>
                  <dd>
                    {selectedRequest.employeeCode || "-"} / {selectedRequest.employeeName}
                  </dd>
                </div>
                <div>
                  <dt>{t("บริษัท", "Company")}</dt>
                  <dd>{selectedRequest.companyCode}</dd>
                </div>
                <div>
                  <dt>{t("หน่วยงาน", "Function")}</dt>
                  <dd>{selectedRequest.functionName || "-"}</dd>
                </div>
                <div>
                  <dt>{t("ช่วงเวลาที่สะดวก", "Preferred Dates")}</dt>
                  <dd>
                    {selectedRequest.preferredStartDate
                      ? `${selectedRequest.preferredStartDate} - ${selectedRequest.preferredEndDate ?? "-"}`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>{t("ส่งเมื่อ", "Submitted")}</dt>
                  <dd>{formatDate(selectedRequest.requestedAt)}</dd>
                </div>
              </dl>

              {selectedRequest.rejectionReason ? (
                <div className={styles.reasonBox}>
                  <span>{t("เหตุผลที่ไม่อนุมัติ", "Rejection Reason")}</span>
                  <p>{selectedRequest.rejectionReason}</p>
                </div>
              ) : null}

              <div className={styles.reviewActions}>
                <button
                  className={styles.actionButton}
                  type="button"
                  disabled={pendingAction || isDecided}
                  onClick={() => void handleApproveToPlan()}
                >
                  {t("อนุมัติและสร้างหลักสูตร", "Approve & Create Training")}
                </button>
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={pendingAction || isDecided}
                  onClick={() => void handleReject()}
                >
                  {t("ไม่อนุมัติ", "Reject")}
                </button>
              </div>

              {isDecided ? (
                <p className={styles.emptyState}>
                  {t(
                    "คำขอนี้ตัดสินใจไปแล้ว ไม่สามารถแก้ไขได้",
                    "This request has already been decided.",
                  )}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      </section>
    </section>
  );
}
