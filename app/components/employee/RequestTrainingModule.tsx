"use client";

import { useEffect, useMemo, useState } from "react";
import { useRealtime } from "../useRealtime";
import {
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import {
  createNeedRequest,
  listNeedRequests,
  searchNeedRequestApprovers,
  updateNeedRequest,
} from "../../lib/trainingNeedRequests/client";
import type { NeedRequestRecord, NeedRequestStage } from "../../lib/trainingNeedRequests/types";
import { needRequestStageLabel, pointsToRegisterTrain } from "../../lib/trainingNeedRequests/labels";
import type { ReviewerCandidate } from "../../lib/trainingRecord/types";
import { isSectionHeadOrAbove } from "../../lib/employeeMasterData";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import { buildRecords, type EmployeeTrainingRecord } from "./RecordModule";
import { useNotice } from "../NoticeDialog";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import SearchableSelect from "../SearchableSelect";
import shell from "../shared/ModuleShell.module.css";
import styles from "./RequestTrainingModule.module.css";
import {
  Lightbulb,
  Send,
  FileEdit,
  RefreshCw,
  Info,
  Building2,
  Factory,
  Landmark,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Settings,
  ClipboardList,
  TrendingUp,
  Rocket,
  Link2,
  Ban,
} from "../icons/LucideIcons";

type RequestTrainingModuleProps = {
  reason: string;
  setReason: (value: string) => void;
  setTrainingNeed: (value: string) => void;
  trainingNeed: string;
  initialCourseId?: string;
  onNavigate?: (module: string) => void;
};

export default function RequestTrainingModule({
  reason,
  setReason,
  setTrainingNeed,
  trainingNeed,
  initialCourseId,
  onNavigate,
}: RequestTrainingModuleProps) {
  const authenticatedUser = useAuthenticatedUser();
  const [completedCourses, setCompletedCourses] = useState<EmployeeTrainingRecord[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || "");
  const [requestMode, setRequestMode] = useState<"record" | "custom">(initialCourseId ? "record" : "record");
  const [preferredStartDate, setPreferredStartDate] = useState("");
  const [preferredEndDate, setPreferredEndDate] = useState("");
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<NeedRequestRecord[]>([]);
  // The section heads this employee can send a request to, and the one they picked.
  const [approvers, setApprovers] = useState<ReviewerCandidate[]>([]);
  const [approverUserId, setApproverUserId] = useState("");
  // Requests other people sent to this employee as their section head.
  const [approvals, setApprovals] = useState<NeedRequestRecord[]>([]);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState("");

  const notice = useNotice();
  const toast = useToast();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);

  const selectedCourse = useMemo(
    () => completedCourses.find((course) => course.id === selectedCourseId) ?? null,
    [completedCourses, selectedCourseId],
  );

  // Load employee's completed training records from My Record
  useEffect(() => {
    let cancelled = false;
    setIsLoadingRecords(true);
    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then(({ enrollments }) => {
        if (cancelled) return;
        const records = buildRecords(enrollments || []);
        setCompletedCourses(records);
        if (initialCourseId && records.some((r) => r.id === initialCourseId)) {
          handleSelectCourse(initialCourseId, records);
        }
      })
      .catch((error) => {
        console.error("Failed to load completed courses for training need request", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRecords(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialCourseId]);

  const loadMyRequests = () =>
    listNeedRequests()
      .then(({ needRequests }) => setMyRequests(needRequests || []))
      .catch((err) => console.error("Failed to load my need requests", err));

  const loadApprovals = () =>
    listNeedRequests({ view: "approvals" })
      .then(({ needRequests }) => setApprovals(needRequests || []))
      .catch((err) => console.error("Failed to load requests awaiting approval", err));

  // A head deciding, or HRD answering, updates both lists without a reload.
  useRealtime(
    ["needRequest.changed"],
    () => {
      void loadMyRequests();
      void loadApprovals();
    },
    { debounceMs: 800 },
  );

  useEffect(() => {
    void loadMyRequests();
    void loadApprovals();
    searchNeedRequestApprovers("")
      .then(({ candidates }) => setApprovers(candidates))
      .catch(() => setApprovers([]));
  }, []);

  const waitingForMe = approvals.filter((request) => request.stage === "WAITING_HEAD");
  // Newest decision first: the head reads this to remember who they have already sent.
  const decidedByMe = approvals
    .filter((request) => request.approverDecision !== null)
    .sort((left, right) => (right.approverDecidedAt ?? "").localeCompare(left.approverDecidedAt ?? ""));
  // A head sees the approval card even when nothing is waiting, so they know where requests land.
  const showApprovals = approvals.length > 0 || isSectionHeadOrAbove(authenticatedUser);

  const decide = async (request: NeedRequestRecord, approve: boolean) => {
    const note = (decisionNotes[request.id] ?? "").trim();
    if (!approve && !note) {
      toast.warning(t("กรุณาระบุเหตุผลที่ไม่อนุมัติ", "Please give a reason for rejecting"));
      return;
    }
    setDecidingId(request.id);
    try {
      const { needRequest } = await updateNeedRequest(request.id, {
        action: approve ? "head_approve" : "head_reject",
        note: note || null,
      });
      setApprovals((current) => current.map((item) => (item.id === needRequest.id ? needRequest : item)));
      toast.success(
        approve
          ? t(`อนุมัติคำขอของ ${request.employeeName} แล้ว ส่งต่อให้ HRD`, `Approved ${request.employeeName}'s request and sent it to HRD`)
          : t(`ไม่อนุมัติคำขอของ ${request.employeeName}`, `Rejected ${request.employeeName}'s request`),
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("บันทึกไม่สำเร็จ", "Could not save"));
    } finally {
      setDecidingId("");
    }
  };

  const handleSelectCourse = (courseId: string, customList?: EmployeeTrainingRecord[]) => {
    const list = customList || completedCourses;
    const course = list.find((c) => c.id === courseId);
    setSelectedCourseId(courseId);

    if (course) {
      const codePrefix = course.courseCode ? `[${course.courseCode}] ` : "";
      setTrainingNeed(
        language === "th"
          ? `${codePrefix}${course.courseTitle} (ขออบรมทบทวน / Refresher)`
          : `${codePrefix}${course.courseTitle} (Refresher Training)`,
      );
      const dateText = course.completedDate ? `เมื่อวันที่ ${course.completedDate}` : "";
      setReason(
        language === "th"
          ? `เคยผ่านการอบรมหลักสูตร ${codePrefix}${course.courseTitle} ${dateText} มีความประสงค์ขอรับการฝึกอบรมทบทวนความรู้ (Refresher Training) เพื่อนำความรู้และทักษะมาประยุกต์ใช้ในการปฏิบัติงานจริง`
          : `I previously completed ${codePrefix}${course.courseTitle} on ${course.completedDate} and would like to request a refresher training session to maintain and improve operational skills.`,
      );
    }
  };

  const handleApplyQuickReason = (tagText: string) => {
    if (!reason.trim()) {
      setReason(tagText);
    } else {
      setReason(`${reason} • ${tagText}`);
    }
  };

  const handleSubmit = async () => {
    const courseNeed = trainingNeed.trim();
    const requestReason = reason.trim();

    const missingFields: string[] = [];
    if (!courseNeed) missingFields.push(t("หลักสูตรที่ต้องการอบรม (Course Needed)", "Course Needed"));
    if (!requestReason) missingFields.push(t("เหตุผลในการขออบรม (Request Reason)", "Request Reason"));
    if (!approverUserId) missingFields.push(t("หัวหน้าผู้อนุมัติ (Section Head)", "Approving section head"));
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }

    setIsSubmitting(true);
    try {
      const { needRequest } = await createNeedRequest({
        // Only when the course was picked from the record: a typed topic names no course yet, and
        // the id travels instead of the code so HRD reads the real owner rather than the text.
        courseId: requestMode === "record" ? selectedCourse?.courseId ?? null : null,
        requestedCourseName: courseNeed,
        requestReason,
        preferredStartDate: preferredStartDate || null,
        preferredEndDate: preferredEndDate || null,
        approverUserId,
      });

      setMyRequests((current) => [needRequest, ...current]);
      setTrainingNeed("");
      setReason("");
      setSelectedCourseId("");
      setPreferredStartDate("");
      setPreferredEndDate("");
      toast.success(
        t(
          `ส่งคำขอ ${needRequest.requestNo} ไปให้หัวหน้าอนุมัติแล้ว`,
          `Request ${needRequest.requestNo} sent to your section head for approval`,
        ),
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง", "Could not submit the request"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stageClasses = (stage: NeedRequestStage) => {
    switch (stage) {
      case "APPROVED":
        return { badge: styles.statusApproved, dot: styles.dotApproved };
      case "REJECTED":
      case "REJECTED_BY_HEAD":
        return { badge: styles.statusRejected, dot: styles.dotRejected };
      case "PLANNED":
        return { badge: styles.statusPlanned, dot: styles.dotPlanned };
      default:
        return { badge: styles.statusPending, dot: `${styles.dotPending} ${styles.dotPulse}` };
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(language === "th" ? "th-TH" : "en-GB");

  return (
    <section className={shell.moduleWorkspace}>
      <ModuleHeader
        eyebrow={t("ส่งคำขอฝึกอบรม", "Employee Training Request")}
        title={t("ขอจัดอบรมทบทวน / เปิดหลักสูตรฝึกอบรม", "Request Training Need")}
        detail={t(
          "ส่งคำขอฝึกอบรมผ่านหัวหน้า (Section Head) ของคุณ เมื่อหัวหน้าอนุมัติ คำขอจะถูกส่งต่อให้ HRD พิจารณาจัดรอบอบรม",
          "Send a training need through your section head. Once they approve, it goes to HRD to plan a batch.",
        )}
      />

      <div className={styles.container}>
        {/* 1. Hero Guide Card */}
        <div className={styles.heroGuideCard}>
          <div className={styles.heroGuideText}>
            <h3>
              <Lightbulb size={20} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {t("ต้องการอบรมทบทวน หรือเรียนรู้ทักษะใดเพิ่มเติม?", "Need a refresher or new training topic?")}
            </h3>
            <p>
              {t(
                "คุณสามารถเลือกหลักสูตรที่เคยเรียนจบแล้วจากประวัติ เพื่อให้ HRD จัดรอบทบทวนความรู้ใหม่อีกครั้ง หรือระบุหัวข้อใหม่ที่ต้องการได้ทันที",
                "Select a previously completed course to request a refresher, or submit any new skill topic directly to HRD.",
              )}
            </p>
          </div>
          <div className={styles.heroQuickStats}>
            <div className={styles.statPill}>
              <span className={styles.statPillDot} />
              <span>
                {completedCourses.length} {t("หลักสูตรที่เคยผ่าน", "completed")}
              </span>
            </div>
            <div className={styles.statPill}>
              <Send size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
              <span>
                {myRequests.length} {t("คำขอที่ส่งแล้ว", "requests sent")}
              </span>
            </div>
          </div>
        </div>

        {showApprovals ? (
          <section className={styles.mainCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>
                <span className={styles.cardHeaderIcon}>
                  <CheckCircle2 size={18} />
                </span>
                <h3>{t("คำขออบรมที่รอคุณอนุมัติ (หัวหน้า)", "Requests waiting for your approval")}</h3>
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--ui-30-primary)" }}>
                {waitingForMe.length} {t("รายการรออนุมัติ", "waiting")}
                {decidedByMe.length > 0 ? t(` · ตัดสินแล้ว ${decidedByMe.length}`, ` · ${decidedByMe.length} decided`) : ""}
              </span>
            </div>
            {waitingForMe.length === 0 ? (
              <p className={styles.approvalEmpty}>{t("ไม่มีคำขอที่รอคุณอนุมัติ", "Nothing is waiting for you")}</p>
            ) : (
              <div className={styles.approvalList}>
                {waitingForMe.map((request) => (
                  <div className={styles.historyItem} key={request.id}>
                    <p className={styles.approvalQuestion}>
                      {t(
                        `รหัส ${request.employeeCode} ${request.employeeName} ขออบรมคอร์ส "${request.requestedCourseName}" อนุมัติส่งตัวเข้าอบรมหรือไม่?`,
                        `${request.employeeCode} ${request.employeeName} asks to attend "${request.requestedCourseName}". Approve sending them?`,
                      )}
                    </p>
                    <p className={styles.historyReason}>
                      {t("เหตุผล:", "Reason:")} {request.requestReason}
                    </p>
                    <span className={styles.historyDate}>
                      {request.requestNo} · {t("ส่งเมื่อ", "Sent")} {formatDate(request.requestedAt)}
                      {request.preferredStartDate
                        ? ` · ${t("ช่วงที่สะดวก", "Preferred")} ${request.preferredStartDate}${request.preferredEndDate ? ` - ${request.preferredEndDate}` : ""}`
                        : ""}
                    </span>
                    <input
                      className={styles.textInput}
                      type="text"
                      value={decisionNotes[request.id] ?? ""}
                      onChange={(event) => setDecisionNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                      placeholder={t("หมายเหตุ (จำเป็นเมื่อไม่อนุมัติ)", "Note (required when rejecting)")}
                    />
                    <div className={styles.approvalActions}>
                      <button
                        type="button"
                        className={styles.approveBtn}
                        disabled={decidingId === request.id}
                        onClick={() => void decide(request, true)}
                      >
                        <CheckCircle2 size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {t("อนุมัติ", "Approve")}
                      </button>
                      <button
                        type="button"
                        className={styles.rejectBtn}
                        disabled={decidingId === request.id}
                        onClick={() => void decide(request, false)}
                      >
                        <Ban size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {t("ไม่อนุมัติ", "Reject")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* What this head has already decided: who they sent, who they turned down, and why. */}
            {decidedByMe.length > 0 ? (
              <details className={styles.approvalHistory}>
                <summary>
                  {t(`ประวัติการอนุมัติของฉัน (${decidedByMe.length} รายการ)`, `My approval history (${decidedByMe.length})`)}
                </summary>
                <div className={styles.approvalList}>
                  {decidedByMe.map((request) => (
                    <div className={styles.historyItem} key={request.id}>
                      <div className={styles.historyHeader}>
                        <span className={styles.historyReqNo}>{request.requestNo}</span>
                        <span
                          className={`${styles.statusBadge} ${
                            request.approverDecision === "APPROVED" ? styles.statusApproved : styles.statusRejected
                          }`}
                        >
                          <span
                            className={`${styles.statusDot} ${
                              request.approverDecision === "APPROVED" ? styles.dotApproved : styles.dotRejected
                            }`}
                          />
                          {request.approverDecision === "APPROVED" ? t("คุณอนุมัติ", "You approved") : t("คุณไม่อนุมัติ", "You rejected")}
                        </span>
                      </div>
                      <h5 className={styles.historyCourseName}>{request.requestedCourseName}</h5>
                      <span className={styles.historyDate}>
                        <User size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {request.employeeCode} {request.employeeName}
                        {request.approverDecidedAt ? ` · ${formatDate(request.approverDecidedAt)}` : ""}
                      </span>
                      {request.approverNote ? (
                        <p className={styles.historyReason}>
                          {t("หมายเหตุของคุณ:", "Your note:")} {request.approverNote}
                        </p>
                      ) : null}
                      {/* Where it went after the head: HRD may still have it, or it is already in a batch. */}
                      <span className={styles.historyDate}>
                        {t("สถานะตอนนี้:", "Now:")} {needRequestStageLabel(request.stage, language)}
                        {request.plan ? ` · ${request.plan.planCode} · ${formatDate(request.plan.startAt)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        ) : null}

        {/* 2. Main 2-Column Layout */}
        <div className={styles.requestLayout}>
          {/* Left Column: Form */}
          <section className={styles.mainCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>
                <span className={styles.cardHeaderIcon}>
                  <FileEdit size={18} />
                </span>
                <h3>{t("สร้างคำขอฝึกอบรม (New Request)", "New Training Request")}</h3>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className={styles.modeTabs}>
              <button
                className={`${styles.modeTab} ${requestMode === "record" ? styles.modeTabActive : ""}`}
                type="button"
                onClick={() => {
                  setRequestMode("record");
                }}
              >
                <RefreshCw size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                {t("ขออบรมทบทวนจากประวัติ (My Record)", "Refresher from My Record")}
              </button>
              <button
                className={`${styles.modeTab} ${requestMode === "custom" ? styles.modeTabActive : ""}`}
                type="button"
                onClick={() => {
                  setRequestMode("custom");
                  setSelectedCourseId("");
                }}
              >
                <FileEdit size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                {t("ระบุหัวข้อใหม่ / อื่นๆ", "New Course Topic")}
              </button>
            </div>

            {/* Mode 1: Select Past Course from My Record */}
            {requestMode === "record" && (
              <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>
                  <span>{t("1. เลือกหลักสูตรที่เคยอบรมจาก My Record", "1. Select from My Record")}</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--ui-30-primary)" }}>
                    {completedCourses.length} {t("หลักสูตรพร้อมทบทวน", "ready for refresher")}
                  </span>
                </div>

                {completedCourses.length === 0 && !isLoadingRecords ? (
                  <div className={styles.emptyRecordsAlert}>
                    <Info size={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--ui-30-primary)" }} />
                    <div>
                      <strong>{t("ยังไม่พบประวัติการอบรมที่เสร็จสมบูรณ์", "No completed training records found")}</strong>
                      <div>{t("คุณสามารถกดเลือกแท็บ 'ระบุหัวข้อใหม่' เพื่อพิมพ์ชื่อหลักสูตรที่ต้องการได้โดยตรง", "You can switch to 'New Course Topic' to type any course name directly.")}</div>
                    </div>
                  </div>
                ) : (
                  <SearchableSelect
                    options={completedCourses.map((course) => ({
                      value: course.id,
                      label: `[${course.courseCode}] ${course.courseTitle}`,
                      secondaryLabel: t(
                        `ผ่านเมื่อ: ${course.completedDate} • ${course.hours} ชม. • ${course.provider}`,
                        `Completed: ${course.completedDate} • ${course.hours} hrs • ${course.provider}`,
                      ),
                      badge: course.provider === "HRD Center" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Building2 size={12} /> Center
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Factory size={12} /> Factory
                        </span>
                      ),
                    }))}
                    value={selectedCourseId}
                    onChange={(val) => handleSelectCourse(val)}
                    placeholder={
                      isLoadingRecords
                        ? t("กำลังโหลดประวัติการอบรม...", "Loading training records...")
                        : t("พิมพ์ค้นหาหลักสูตรที่เคยอบรมจาก My Record...", "Search completed course from My Record...")
                    }
                    disabled={isLoadingRecords}
                  />
                )}

                {/* Past Course Detail Card */}
                {selectedCourse ? (
                  <div className={styles.pastCourseCard}>
                    <div className={styles.pastCourseHeader}>
                      <h4 className={styles.pastCourseTitle}>
                        [{selectedCourse.courseCode}] {selectedCourse.courseTitle}
                      </h4>
                      <span className={styles.providerBadge}>
                        {selectedCourse.provider === "HRD Center" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Landmark size={13} /> HRD Center
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Factory size={13} /> Factory HRD
                          </span>
                        )}
                      </span>
                    </div>

                    <div className={styles.pastCourseGrid}>
                      <div className={styles.pastCourseMetaItem}>
                        <span>{t("วันที่เคยอบรม", "Completed Date")}</span>
                        <strong>
                          <Calendar size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                          {selectedCourse.completedDate}
                        </strong>
                      </div>
                      <div className={styles.pastCourseMetaItem}>
                        <span>{t("จำนวนชั่วโมง", "Duration")}</span>
                        <strong>
                          <Clock size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                          {selectedCourse.hours} {t("ชม.", "hrs")}
                        </strong>
                      </div>
                      <div className={styles.pastCourseMetaItem}>
                        <span>{t("วิทยากรผู้สอน", "Instructor")}</span>
                        <strong>
                          <User size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                          {selectedCourse.instructor || "-"}
                        </strong>
                      </div>
                      <div className={styles.pastCourseMetaItem}>
                        <span>{t("ผลการอบรมเดิม", "Past Result")}</span>
                        <strong>
                          <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4, color: "var(--ui-color-green, #10b981)" }} />
                          {selectedCourse.result || "Completed"}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Form Fields */}
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label>
                  {requestMode === "record"
                    ? t("2. หลักสูตรที่ขออบรมทบทวน", "2. Refresher Course Name")
                    : t("1. หลักสูตร/ทักษะที่ต้องการขออบรม", "1. Requested Course / Skill Name")}
                  <b style={{ color: "var(--ui-10-accent)", marginLeft: "4px" }}>*</b>
                </label>
                <input
                  className={styles.textInput}
                  type="text"
                  value={trainingNeed}
                  onChange={(e) => setTrainingNeed(e.target.value)}
                  placeholder={t("ระบุชื่อหลักสูตร หรือทักษะที่ต้องการขอรับการอบรม", "Specify course name or skill topic")}
                />
              </div>

              <div className={styles.formField}>
                <label>
                  {t("เหตุผลและความจำเป็นในการขอรับการอบรม", "Reason for Request")}
                  <b style={{ color: "var(--ui-10-accent)", marginLeft: "4px" }}>*</b>
                </label>
                <textarea
                  className={styles.textareaInput}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("อธิบายเหตุผลว่าทำไมถึงต้องการอบรมหลักสูตรนี้ หรือต้องการความรู้เรื่องนี้ไปใช้ในงานใด", "Explain why you need this training or how it applies to your work")}
                />

                {/* Quick Reasons */}
                <div className={styles.quickTagsContainer}>
                  <span style={{ fontSize: "0.76rem", color: "var(--ui-30-muted)", alignSelf: "center", fontWeight: 700 }}>
                    {t("เหตุผลด่วน:", "Quick tags:")}
                  </span>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("ขออบรมทบทวนความรู้เดิม (Refresher Training)", "Refresher Training"))}
                  >
                    <RefreshCw size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("ขออบรมทบทวนความรู้เดิม", "Refresher")}
                  </button>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("นำความรู้ไปประยุกต์ใช้กับโครงการ/หน้าที่รับผิดชอบใหม่", "Apply to new project"))}
                  >
                    <Settings size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("ประยุกต์ใช้กับงานใหม่", "New Project")}
                  </button>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("ทบทวนมาตรฐานและข้อกำหนดการปฏิบัติงาน", "Review standard requirements"))}
                  >
                    <ClipboardList size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("ทบทวนมาตรฐานการทำงาน", "Standard Review")}
                  </button>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("พัฒนาทักษะเพิ่มเติมเพื่อเพิ่มประสิทธิภาพงาน", "Skill Enhancement"))}
                  >
                    <TrendingUp size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("พัฒนาทักษะการทำงาน", "Skill Enhancement")}
                  </button>
                </div>
              </div>

              <div className={styles.formField}>
                <label>{t("ช่วงเวลาที่สะดวกเข้าอบรม (Preferred Timing - ไม่บังคับ)", "Preferred Timing (Optional)")}</label>
                <div className={styles.dateRangeGrid}>
                  <div>
                    <span style={{ fontSize: "0.76rem", color: "var(--ui-30-muted)" }}>{t("ตั้งแต่ (From)", "From")}</span>
                    <input
                      type="date"
                      value={preferredStartDate}
                      onChange={(e) => setPreferredStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.76rem", color: "var(--ui-30-muted)" }}>{t("ถึง (To)", "To")}</span>
                    <input
                      type="date"
                      min={preferredStartDate}
                      value={preferredEndDate}
                      onChange={(e) => setPreferredEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formField}>
                <label>
                  {t("หัวหน้าผู้อนุมัติ (Section Head)", "Approving section head")}
                  <b style={{ color: "var(--ui-10-accent)", marginLeft: "4px" }}>*</b>
                </label>
                <SearchableSelect
                  options={approvers.map((head) => ({
                    value: head.reviewerUserId,
                    label: `${head.name} (${head.employeeCode})`,
                    // The list spans every company for now, so the company code comes first: it is
                    // what tells two heads of the same name apart.
                    secondaryLabel: [head.company, head.position, head.department, head.section]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                  value={approverUserId}
                  onChange={setApproverUserId}
                  placeholder={
                    approvers.length === 0
                      ? t("ไม่พบหัวหน้าแผนก", "No section heads found")
                      : t("ค้นหาชื่อหรือรหัสหัวหน้า...", "Search a section head by name or code...")
                  }
                />
              </div>

              <button
                className={styles.submitBtn}
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? (
                  t("กำลังส่งคำขอ...", "Submitting...")
                ) : (
                  <>
                    <Rocket size={15} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                    {t("ส่งคำขอให้หัวหน้าอนุมัติ", "Send to my section head")}
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Right Column: History & Live Preview */}
          <aside className={styles.sideCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>
                <span className={styles.cardHeaderIcon}>
                  <ClipboardList size={18} />
                </span>
                <h3>{t("ประวัติคำขอของฉัน", "My Requests")}</h3>
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--ui-30-primary)" }}>
                {myRequests.length} {t("รายการ", "items")}
              </span>
            </div>

            <div className={styles.sideContent}>
              {/* Live Preview Box */}
              <div className={styles.previewCard}>
                <span>{t("ตัวอย่างคำขอที่จะส่ง", "Request Preview")}</span>
                <h4>{trainingNeed || t("ชื่อหลักสูตรจะแสดงที่นี่...", "Course name will appear here...")}</h4>
                <p>{reason || t("เหตุผลการขอจะแสดงที่นี่...", "Request reason will appear here...")}</p>
                {selectedCourse ? (
                  <small style={{ color: "var(--ui-30-primary)", marginTop: "4px", display: "block", fontWeight: 600 }}>
                    <Link2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    [{selectedCourse.courseCode}] {selectedCourse.courseTitle}
                  </small>
                ) : null}
              </div>

              {/* History List */}
              <div>
                <strong style={{ fontSize: "0.88rem", color: "var(--ui-30-ink)" }}>
                  {t("คำขอที่เคยส่งไปแล้ว", "Submitted Requests")}
                </strong>

                {myRequests.length === 0 ? (
                  <p style={{ fontSize: "0.84rem", color: "var(--ui-30-muted)", marginTop: "8px" }}>
                    {t("ยังไม่มีคำขอฝึกอบรมที่ส่งไป", "No submitted requests yet")}
                  </p>
                ) : null}

                <div className={styles.historyList}>
                  {myRequests.map((request) => (
                    <div className={styles.historyItem} key={request.id}>
                      <div className={styles.historyHeader}>
                        <span className={styles.historyReqNo}>{request.requestNo}</span>
                        <span className={`${styles.statusBadge} ${stageClasses(request.stage).badge}`}>
                          <span className={`${styles.statusDot} ${stageClasses(request.stage).dot}`} />
                          {needRequestStageLabel(request.stage, language)}
                        </span>
                      </div>
                      <h5 className={styles.historyCourseName}>{request.requestedCourseName}</h5>
                      <p className={styles.historyReason}>{request.requestReason}</p>

                      {request.approver ? (
                        <span className={styles.historyDate}>
                          <User size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                          {t("หัวหน้าผู้อนุมัติ:", "Section head:")} {request.approver.name}
                        </span>
                      ) : null}

                      {/* Whose "no" it was matters: the employee talks to their head or to HRD. */}
                      {request.rejectionReason && (request.stage === "REJECTED" || request.stage === "REJECTED_BY_HEAD") ? (
                        <div className={styles.historyRejectionBox}>
                          <Ban size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                          {request.stage === "REJECTED_BY_HEAD" ? t("เหตุผลจากหัวหน้า:", "Section head's note:") : t("เหตุผลจาก HRD:", "HRD Note:")}{" "}
                          {request.rejectionReason}
                        </div>
                      ) : null}
                      {request.stage === "REJECTED" && pointsToRegisterTrain(request.rejectionReason) && onNavigate ? (
                        <button type="button" className={styles.quickTagBtn} onClick={() => onNavigate("register")}>
                          <Rocket size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                          {t("ไปหน้า Register Train", "Go to Register Train")}
                        </button>
                      ) : null}

                      {request.plan ? (
                        <span className={styles.historyDate}>
                          <Calendar size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                          {t("จัดเข้ารุ่น", "Batch")} {request.plan.planCode} · {formatDate(request.plan.startAt)}
                        </span>
                      ) : null}

                      <span className={styles.historyDate}>
                        <Calendar size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {formatDate(request.requestedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
