"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import {
  createNeedRequest,
  listNeedRequests,
} from "../../lib/trainingNeedRequests/client";
import type { NeedRequestRecord, NeedRequestStatus } from "../../lib/trainingNeedRequests/types";
import { needRequestStatusLabel } from "../../lib/trainingNeedRequests/labels";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import { buildRecords, type EmployeeTrainingRecord } from "./RecordModule";
import { useNotice } from "../NoticeDialog";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import SearchableSelect from "../SearchableSelect";
import shell from "../shared/ModuleShell.module.css";
import styles from "./RequestTrainingModule.module.css";

type RequestTrainingModuleProps = {
  reason: string;
  setReason: (value: string) => void;
  setTrainingNeed: (value: string) => void;
  trainingNeed: string;
  initialCourseId?: string;
  onNavigate?: (module: string) => void;
};

const courseOwnerOf = (record: EmployeeTrainingRecord) =>
  record.provider === "Factory HRD" ? "Factory" : "Center";

export default function RequestTrainingModule({
  reason,
  setReason,
  setTrainingNeed,
  trainingNeed,
  initialCourseId,
}: RequestTrainingModuleProps) {
  const authenticatedUser = useAuthenticatedUser();
  const profileItems = buildProfileItems(authenticatedUser);
  const [completedCourses, setCompletedCourses] = useState<EmployeeTrainingRecord[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || "");
  const [preferredStartDate, setPreferredStartDate] = useState("");
  const [preferredEndDate, setPreferredEndDate] = useState("");
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<NeedRequestRecord[]>([]);

  const notice = useNotice();
  const toast = useToast();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);

  const selectedCourse = useMemo(
    () => completedCourses.find((course) => course.id === selectedCourseId) ?? null,
    [completedCourses, selectedCourseId],
  );

  const selectedCourseOwner = selectedCourse ? courseOwnerOf(selectedCourse) : "Center";

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

  useEffect(() => {
    void loadMyRequests();
  }, []);

  const handleSelectCourse = (courseId: string, customList?: EmployeeTrainingRecord[]) => {
    const list = customList || completedCourses;
    const course = list.find((c) => c.id === courseId);
    setSelectedCourseId(courseId);

    if (course) {
      const codePrefix = course.courseCode ? `[${course.courseCode}] ` : "";
      setTrainingNeed(`${codePrefix}${course.courseTitle} (ขออบรมทบทวน / Refresher)`);
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
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }

    setIsSubmitting(true);
    try {
      const { needRequest } = await createNeedRequest({
        requestedCourseName: courseNeed,
        requestReason,
        preferredStartDate: preferredStartDate || null,
        preferredEndDate: preferredEndDate || null,
      });

      setMyRequests((current) => [needRequest, ...current]);
      setTrainingNeed("");
      setReason("");
      setSelectedCourseId("");
      setPreferredStartDate("");
      setPreferredEndDate("");
      toast.success(
        t(
          `ส่งคำขอ ${needRequest.requestNo} ไปยัง HRD สำเร็จแล้ว`,
          `Request ${needRequest.requestNo} submitted to HRD successfully`,
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

  const getStatusBadgeClass = (status: NeedRequestStatus) => {
    switch (status) {
      case "APPROVED":
        return styles.statusApproved;
      case "REJECTED":
        return styles.statusRejected;
      case "PLANNED":
        return styles.statusPlanned;
      case "PENDING":
      default:
        return styles.statusPending;
    }
  };

  return (
    <section className={shell.moduleWorkspace}>
      <ModuleHeader
        eyebrow={t("ขอเปิดหลักสูตรฝึกอบรม", "Request Training Need")}
        title={t("ขอจัดอบรมทบทวน / เปิดหลักสูตรใหม่", "Request Training Need")}
        detail={t(
          "เลือกหลักสูตรที่เคยเข้าอบรมแล้วจากประวัติ (My Record) เพื่อส่งคำขอให้ HRD Center หรือ Factory HRD จัดอบรมทบทวนความรู้ใหม่อีกครั้ง",
          "Select a previously completed course from your training records to request HRD Center or Factory HRD to organize a refresher training session.",
        )}
      />

      <div className={styles.container}>
        {/* Employee Profile Quick Strip */}
        <div className={styles.employeeStrip}>
          {profileItems.slice(0, 4).map((item) => (
            <div className={styles.employeeStripItem} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value || "-"}</strong>
            </div>
          ))}
        </div>

        <div className={styles.requestLayout}>
          {/* Left Column: Request Form */}
          <section className={styles.mainCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>
                <span className={styles.cardHeaderIcon}>📝</span>
                <h3>{t("สร้างคำขอฝึกอบรม (New Training Need Request)", "New Training Need Request")}</h3>
              </div>
            </div>

            {/* Step 1: Select Past Course from My Record */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionTitle}>
                <span>{t("1. เลือกหลักสูตรที่เคยอบรมจาก My Record", "1. Select from My Record")}</span>
                <span style={{ fontSize: "0.8rem", color: "#007a3d" }}>
                  {completedCourses.length} {t("หลักสูตรที่เคยผ่าน", "completed courses")}
                </span>
              </div>
              <p className={styles.sectionHint}>
                {t(
                  "เลือกหลักสูตรที่คุณเคยผ่านการอบรมแล้ว เพื่อขอให้เปิดรุ่นอบรมทบทวน (Refresher)",
                  "Choose a course you have completed before to request a refresher session.",
                )}
              </p>

              {completedCourses.length === 0 && !isLoadingRecords ? (
                <div className={styles.emptyRecordsAlert}>
                  <span>ℹ️</span>
                  <div>
                    <strong>{t("ยังไม่พบประวัติการอบรมที่เสร็จสมบูรณ์", "No completed training records found")}</strong>
                    <div>{t("คุณสามารถพิมพ์ชื่อหลักสูตรที่ต้องการในช่องด้านล่างได้โดยตรง", "You can still type any course name needed in the field below.")}</div>
                  </div>
                </div>
              ) : (
                <SearchableSelect
                  options={completedCourses.map((course) => ({
                    value: course.id,
                    label: `[${course.courseCode}] ${course.courseTitle}`,
                    secondaryLabel: `ผ่านเมื่อ: ${course.completedDate} • ${course.hours} ชม. • ${course.provider}`,
                    badge: course.provider === "HRD Center" ? "🏢 Center" : "🏬 Factory",
                  }))}
                  value={selectedCourseId}
                  onChange={(val) => handleSelectCourse(val)}
                  placeholder={
                    isLoadingRecords
                      ? t("กำลังโหลดประวัติการอบรม...", "Loading training records...")
                      : t("🔍 พิมพ์ค้นหาหลักสูตรที่เคยอบรมจาก My Record...", "Search completed course from My Record...")
                  }
                  disabled={isLoadingRecords}
                />
              )}

              {/* Past Course Detail Card */}
              {selectedCourse ? (
                <div className={styles.pastCourseCard}>
                  <div className={styles.pastCourseHeader}>
                    <div>
                      <h4 className={styles.pastCourseTitle}>
                        [{selectedCourse.courseCode}] {selectedCourse.courseTitle}
                      </h4>
                    </div>
                    <span className={styles.providerBadge}>
                      {selectedCourse.provider === "HRD Center" ? "🏛️ HRD Center" : "🏭 Factory HRD"}
                    </span>
                  </div>

                  <div className={styles.pastCourseGrid}>
                    <div className={styles.pastCourseMetaItem}>
                      <span>{t("วันที่เคยอบรม", "Completed Date")}</span>
                      <strong>📅 {selectedCourse.completedDate}</strong>
                    </div>
                    <div className={styles.pastCourseMetaItem}>
                      <span>{t("จำนวนชั่วโมง", "Duration")}</span>
                      <strong>⏱️ {selectedCourse.hours} {t("ชม.", "hrs")}</strong>
                    </div>
                    <div className={styles.pastCourseMetaItem}>
                      <span>{t("วิทยากรผู้สอน", "Instructor")}</span>
                      <strong>👨‍🏫 {selectedCourse.instructor || "-"}</strong>
                    </div>
                    <div className={styles.pastCourseMetaItem}>
                      <span>{t("ผลการอบรมเดิม", "Past Result")}</span>
                      <strong>✅ {selectedCourse.result || "Completed"}</strong>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Step 2: Request Form Fields */}
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label>
                  {t("2. หลักสูตรที่ต้องการขออบรม (Course Needed)", "2. Course Needed")} <b style={{ color: "#d71920" }}>*</b>
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
                  {t("3. เหตุผลและความจำเป็นในการขอรับการอบรม (Request Reason)", "3. Request Reason")} <b style={{ color: "#d71920" }}>*</b>
                </label>
                <textarea
                  className={styles.textareaInput}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("อธิบายเหตุผลว่าทำไมถึงต้องการอบรมหลักสูตรนี้ซ้ำ หรือต้องการความรู้เรื่องนี้ไปใช้ในงานใด", "Explain why you need this training or how it applies to your work")}
                />

                <div className={styles.quickTagsContainer}>
                  <span style={{ fontSize: "0.76rem", color: "#64748b", alignSelf: "center", fontWeight: 600 }}>
                    {t("เหตุผลด่วน:", "Quick tags:")}
                  </span>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("ขออบรมทบทวนความรู้เดิม (Refresher Training)", "Refresher Training"))}
                  >
                    🔄 {t("ขออบรมทบทวนความรู้เดิม", "Refresher")}
                  </button>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("นำความรู้ไปประยุกต์ใช้กับโครงการ/หน้าที่รับผิดชอบใหม่", "Apply to new project"))}
                  >
                    ⚙️ {t("ประยุกต์ใช้กับงานใหม่", "New Project")}
                  </button>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("ทบทวนมาตรฐานและข้อกำหนดการปฏิบัติงาน", "Review standard requirements"))}
                  >
                    📋 {t("ทบทวนมาตรฐานการทำงาน", "Standard Review")}
                  </button>
                  <button
                    className={styles.quickTagBtn}
                    type="button"
                    onClick={() => handleApplyQuickReason(t("พัฒนาทักษะเพิ่มเติมเพื่อเพิ่มประสิทธิภาพงาน", "Skill Enhancement"))}
                  >
                    📈 {t("พัฒนาทักษะการทำงาน", "Skill Enhancement")}
                  </button>
                </div>
              </div>

              <div className={styles.formField}>
                <label>{t("4. ช่วงเวลาที่สะดวกเข้าอบรม (Preferred Timing - ไม่บังคับ)", "4. Preferred Timing (Optional)")}</label>
                <div className={styles.dateRangeGrid}>
                  <div>
                    <span style={{ fontSize: "0.76rem", color: "#64748b" }}>{t("ตั้งแต่ (From)", "From")}</span>
                    <input
                      type="date"
                      value={preferredStartDate}
                      onChange={(e) => setPreferredStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.76rem", color: "#64748b" }}>{t("ถึง (To)", "To")}</span>
                    <input
                      type="date"
                      min={preferredStartDate}
                      value={preferredEndDate}
                      onChange={(e) => setPreferredEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                className={styles.submitBtn}
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting
                  ? t("กำลังส่งคำขอ...", "Submitting...")
                  : t("🚀 ส่งคำขอฝึกอบรมไปยัง HRD", "Submit Training Need Request")}
              </button>
            </div>
          </section>

          {/* Right Column: Preview & My Requests History */}
          <aside className={styles.sideCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}>
                <span className={styles.cardHeaderIcon}>📋</span>
                <h3>{t("ประวัติคำขอของฉัน", "My Requests")}</h3>
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#007a3d" }}>
                {myRequests.length} {t("รายการ", "items")}
              </span>
            </div>

            <div className={styles.previewPanel}>
              {/* Live Preview Box */}
              <div className={styles.previewCard}>
                <span>{t("ตัวอย่างคำขอที่จะส่ง", "Request Preview")}</span>
                <h4>{trainingNeed || t("ชื่อหลักสูตรจะแสดงที่นี่...", "Course name will appear here...")}</h4>
                <p>{reason || t("เหตุผลการขอจะแสดงที่นี่...", "Request reason will appear here...")}</p>
                {selectedCourse ? (
                  <small style={{ color: "#007a3d", marginTop: "4px", display: "block" }}>
                    🔗 {t("อ้างอิงจากประวัติ:", "Based on record:")} [{selectedCourse.courseCode}] {selectedCourse.courseTitle} ({selectedCourseOwner})
                  </small>
                ) : null}
              </div>

              {/* History List */}
              <div>
                <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>
                  {t("คำขอที่เคยส่งไปแล้ว", "Submitted Requests")}
                </strong>

                {myRequests.length === 0 ? (
                  <p style={{ fontSize: "0.84rem", color: "#64748b", marginTop: "8px" }}>
                    {t("ยังไม่มีคำขอฝึกอบรมที่ส่งไป", "No submitted requests yet")}
                  </p>
                ) : null}

                <div className={styles.historyList}>
                  {myRequests.map((request) => (
                    <div className={styles.historyItem} key={request.id}>
                      <div className={styles.historyHeader}>
                        <span className={styles.historyReqNo}>{request.requestNo}</span>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(request.status)}`}>
                          {needRequestStatusLabel(request.status, language)}
                        </span>
                      </div>
                      <h5 className={styles.historyCourseName}>{request.requestedCourseName}</h5>
                      <p className={styles.historyReason}>{request.requestReason}</p>
                      <span className={styles.historyDate}>
                        📅 {new Date(request.requestedAt).toLocaleDateString(language === "th" ? "th-TH" : "en-GB")}
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
