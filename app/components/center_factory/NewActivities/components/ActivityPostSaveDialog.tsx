"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import type { CourseActivity } from "../../../../api/course-activities/route";
import styles from "./ActivityPostSaveDialog.module.css";

export interface ActivityPostSaveDialogProps {
  isOpen: boolean;
  activityId: string | null;
  activity?: CourseActivity | null;
  onClose: () => void;
  onSuccess?: () => void;
  onBackToEdit?: (activity: CourseActivity) => void;
  isThai?: boolean;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

export const ActivityPostSaveDialog: React.FC<ActivityPostSaveDialogProps> = ({
  isOpen,
  activityId,
  activity = null,
  onClose,
  onSuccess,
  onBackToEdit,
  isThai = true,
  showToast,
}) => {
  const confirm = useConfirm();
  const internalToast = useToast();
  const [postSaveDashboard, setPostSaveDashboard] = useState<boolean>(true);
  const [postSaveLoginPage, setPostSaveLoginPage] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [currentActivity, setCurrentActivity] = useState<CourseActivity | null>(activity || null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync or fetch activity details for live preview
  useEffect(() => {
    if (activity) {
      setCurrentActivity(activity);
    } else if (activityId && isOpen) {
      let active = true;
      fetch("/api/course-activities")
        .then((res) => res.json())
        .then((data) => {
          if (active && data && Array.isArray(data.activities)) {
            const found = data.activities.find(
              (a: CourseActivity) => String(a.id) === String(activityId)
            );
            if (found) setCurrentActivity(found);
          }
        })
        .catch(() => {});

      return () => {
        active = false;
      };
    }
  }, [activity, activityId, isOpen]);

  // Reset states whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      setPostSaveDashboard(true);
      setPostSaveLoginPage(false);
      setIsConfirming(false);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!mounted || !isOpen || typeof document === "undefined") {
    return null;
  }

  const handleConfirm = async () => {
    if (!activityId) {
      onClose();
      return;
    }

    try {
      setIsConfirming(true);
      const computedStatus = postSaveDashboard || postSaveLoginPage ? "PUBLISHED" : "ARCHIVED";
      const res = await fetch("/api/course-activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activityId,
          isVisibleOnDashboard: postSaveDashboard,
          showOnLoginPage: postSaveLoginPage,
          status: computedStatus,
        }),
      });

      if (res.ok) {
        const msg = isThai
          ? "บันทึกการตั้งค่าการแสดงผลเรียบร้อยแล้ว"
          : "Display destinations updated successfully";
        showToast ? showToast(msg, "success") : internalToast.success(msg);
        onSuccess?.();
        onClose();
      } else {
        const msg = isThai ? "เกิดข้อผิดพลาดในการบันทึก" : "Failed to update display destinations";
        showToast ? showToast(msg, "error") : internalToast.error(msg);
      }
    } catch {
      const msg = isThai ? "เกิดข้อผิดพลาดในการบันทึก" : "Failed to update display destinations";
      showToast ? showToast(msg, "error") : internalToast.error(msg);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelActivity = async () => {
    if (!activityId) {
      onClose();
      return;
    }

    const confirmed = await confirm({
      message: {
        th: `คุณต้องการยกเลิกและลบกิจกรรม "${currentActivity?.title || ""}" ใช่หรือไม่?`,
        en: `Are you sure you want to cancel and delete "${currentActivity?.title || "this activity"}"?`,
      },
      danger: true,
    });
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/course-activities?id=${encodeURIComponent(activityId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const msg = isThai ? "ยกเลิกกิจกรรมเรียบร้อยแล้ว" : "Activity cancelled and deleted";
        showToast ? showToast(msg, "success") : internalToast.success(msg);
        onSuccess?.();
        onClose();
      } else {
        const msg = isThai ? "ไม่สามารถยกเลิกกิจกรรมได้" : "Failed to cancel activity";
        showToast ? showToast(msg, "error") : internalToast.error(msg);
      }
    } catch {
      const msg = isThai ? "เกิดข้อผิดพลาดในการยกเลิกกิจกรรม" : "Failed to cancel activity";
      showToast ? showToast(msg, "error") : internalToast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return createPortal(
    <div
      className={styles.postSaveOverlay}
      onClick={() => {
        if (!isConfirming && !isDeleting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isThai ? "ตั้งค่าการแสดงกิจกรรม" : "Activity display settings"}
    >
      <div className={styles.postSaveDialog} onClick={(e) => e.stopPropagation()}>
        {/* Close button in top-right */}
        <button
          type="button"
          className={styles.postSaveCloseBtn}
          onClick={() => {
            if (!isConfirming && !isDeleting) onClose();
          }}
          disabled={isConfirming || isDeleting}
          aria-label={isThai ? "ปิดหน้าต่าง" : "Close dialog"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className={styles.postSaveHeader}>
          <div className={styles.postSaveSuccessIcon} aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className={styles.postSaveHeaderText}>
            <h2 className={styles.postSaveTitle}>
              {isThai ? "บันทึกกิจกรรมสำเร็จ!" : "Activity Saved!"}
            </h2>
            <p className={styles.postSaveSubtitle}>
              {isThai
                ? "ตรวจสอบตัวอย่างและเลือกว่าจะนำไปแสดงบนหน้าแรกหรือหน้า Login"
                : "Review preview and choose whether to publish on Dashboard or Login page"}
            </p>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className={styles.postSaveBodyScroll}>
          {/* Live Preview Card Section */}
          {currentActivity && (
            <div className={styles.previewSection}>
              <div className={styles.previewSectionHeader}>
                <span className={styles.previewSectionBadge}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>{isThai ? "ตัวอย่างการแสดงผล (Card Preview)" : "Live Card Preview"}</span>
                </span>
                <span className={styles.previewHint}>
                  {isThai ? "อัปเดตตามตัวเลือกปลายทางแบบเรียลไทม์" : "Updates dynamically"}
                </span>
              </div>

              <div className={styles.previewCard}>
                <div className={styles.previewMedia}>
                  {currentActivity.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentActivity.imageUrl}
                      alt={currentActivity.title}
                      className={styles.previewImage}
                    />
                  ) : (
                    <div className={styles.previewNoImage}>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>{isThai ? "ไม่มีรูปภาพ" : "No photo"}</span>
                    </div>
                  )}

                  {currentActivity.images && currentActivity.images.length > 1 && (
                    <span
                      className={styles.previewPhotoCount}
                      title={`${currentActivity.images.length} ${isThai ? "รูป" : "photos"}`}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>
                        {currentActivity.images.length} {isThai ? "รูป" : "photos"}
                      </span>
                    </span>
                  )}

                  {/* Live Destination Badges on preview image */}
                  <div className={styles.previewOverlayBadges}>
                    {postSaveDashboard && (
                      <span
                        className={styles.previewBadgeDashboard}
                        title={isThai ? "แสดงบนหน้าแรก (Dashboard)" : "On Dashboard"}
                      >
                        <span className={styles.previewBadgeDot} />
                        {isThai ? "หน้าแรก" : "Dashboard"}
                      </span>
                    )}
                    {postSaveLoginPage && (
                      <span
                        className={styles.previewBadgeLogin}
                        title={isThai ? "แสดงบนหน้า Login" : "On Login"}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <polyline points="10 17 15 12 10 7" />
                          <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                        {isThai ? "หน้า Login" : "Login"}
                      </span>
                    )}
                    {!postSaveDashboard && !postSaveLoginPage && (
                      <span
                        className={styles.previewBadgeArchived}
                        title={isThai ? "จัดเก็บ (ไม่แสดงบนหน้าแรก)" : "Archived"}
                      >
                        {isThai ? "จัดเก็บ / ซ่อน" : "Archived"}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.previewContent}>
                  <div className={styles.previewMetaRow}>
                    <span className={styles.previewDate}>
                      {currentActivity.formattedDate || currentActivity.date}
                    </span>
                    <span
                      className={`${styles.companyBadge} ${
                        styles[`companyBadge_${currentActivity.companyCode}`] ||
                        styles.companyBadge_CENTER
                      }`}
                    >
                      {currentActivity.companyCode === "CENTER"
                        ? isThai
                          ? "ส่วนกลาง"
                          : "Center"
                        : currentActivity.companyCode || "CENTER"}
                    </span>
                  </div>

                  <h4 className={styles.previewTitle}>{currentActivity.title}</h4>
                  {currentActivity.description && (
                    <p className={styles.previewDesc}>{currentActivity.description}</p>
                  )}

                  <div className={styles.previewFooterRow}>
                    {currentActivity.location && (
                      <span className={styles.previewLocation} title={currentActivity.location}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{currentActivity.location}</span>
                      </span>
                    )}
                    {currentActivity.isCourseLinked &&
                      (currentActivity.linkedCourseCode || currentActivity.linkedCourseName) && (
                        <span
                          className={styles.previewCourseBadge}
                          title={currentActivity.linkedCourseName || ""}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                            <path d="M6 12v5c3 3 9 3 12 0v-5" />
                          </svg>
                          <span>
                            {currentActivity.linkedCourseCode || currentActivity.linkedCourseName}
                          </span>
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Options Section Header */}
          <div className={styles.destinationTitleRow}>
            <span className={styles.destinationTitleText}>
              {isThai ? "เลือกปลายทางการแสดงผล" : "Choose Display Destinations"}
            </span>
          </div>

          {/* Options Cards */}
          <div className={styles.postSaveOptions}>
            {/* Dashboard option */}
            <label
              className={`${styles.postSaveOptionCard} ${
                postSaveDashboard ? styles.postSaveOptionCardActive : ""
              }`}
              htmlFor="postSaveDashboardShared"
            >
              <input
                id="postSaveDashboardShared"
                type="checkbox"
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "none",
                  width: 0,
                  height: 0,
                }}
                checked={postSaveDashboard}
                onChange={(e) => setPostSaveDashboard(e.target.checked)}
                disabled={isConfirming || isDeleting}
              />
              <div
                className={`${styles.customCheckbox} ${
                  postSaveDashboard ? styles.customCheckboxChecked : ""
                }`}
                aria-hidden="true"
              >
                {postSaveDashboard && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className={styles.postSaveOptionIcon}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div className={styles.postSaveOptionText}>
                <span className={styles.postSaveOptionLabel}>
                  {isThai ? "แสดงบนหน้าแรก (Dashboard)" : "Show on Dashboard"}
                </span>
                <span className={styles.postSaveOptionDesc}>
                  {isThai
                    ? "กิจกรรมนี้จะเปิดแสดงในภาพสไลด์และรายการบนหน้าแรกของระบบ"
                    : "Activity will appear in the carousel and cards on the dashboard"}
                </span>
              </div>
              <div
                className={`${styles.statusChip} ${
                  postSaveDashboard ? styles.statusChipActive : styles.statusChipInactive
                }`}
              >
                <span className={styles.statusDot} />
                <span>
                  {postSaveDashboard
                    ? isThai
                      ? "เปิดแสดง"
                      : "Active"
                    : isThai
                    ? "ไม่แสดง"
                    : "Hidden"}
                </span>
              </div>
            </label>

            {/* Login page option */}
            <label
              className={`${styles.postSaveOptionCard} ${
                postSaveLoginPage ? styles.postSaveOptionCardLoginActive : ""
              }`}
              htmlFor="postSaveLoginPageShared"
            >
              <input
                id="postSaveLoginPageShared"
                type="checkbox"
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "none",
                  width: 0,
                  height: 0,
                }}
                checked={postSaveLoginPage}
                onChange={(e) => setPostSaveLoginPage(e.target.checked)}
                disabled={isConfirming || isDeleting}
              />
              <div
                className={`${styles.customCheckbox} ${
                  postSaveLoginPage ? styles.customCheckboxLoginChecked : ""
                }`}
                aria-hidden="true"
              >
                {postSaveLoginPage && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className={styles.postSaveOptionIcon}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <div className={styles.postSaveOptionText}>
                <span className={styles.postSaveOptionLabel}>
                  {isThai ? "แสดงบนหน้า Login" : "Show on Login Page"}
                </span>
                <span className={styles.postSaveOptionDesc}>
                  {isThai
                    ? "กิจกรรมนี้จะแสดงในกล่องข่าวสารที่หน้าเข้าสู่ระบบให้ผู้ใช้ทั่วไปเห็น"
                    : "Activity will appear in the news box on the Login page"}
                </span>
              </div>
              <div
                className={`${styles.statusChip} ${
                  postSaveLoginPage ? styles.statusChipLoginActive : styles.statusChipInactive
                }`}
              >
                <span className={styles.statusDot} />
                <span>
                  {postSaveLoginPage
                    ? isThai
                      ? "เปิดแสดง"
                      : "Active"
                    : isThai
                    ? "ไม่แสดง"
                    : "Hidden"}
                </span>
              </div>
            </label>
          </div>

          {/* Notice when nothing is selected */}
          {!postSaveDashboard && !postSaveLoginPage && (
            <div className={styles.postSaveNotice} role="alert">
              <svg
                className={styles.postSaveNoticeIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                {isThai
                  ? "กิจกรรมของคุณจะถูกเก็บไว้โดยไม่แสดงบนหน้า Dashboard หรือ Login — ยังสามารถดูและจัดการได้ผ่านโมดูล "
                  : "Your activity will be saved but not shown on Dashboard or Login page — it can still be viewed and managed in the "}
                <strong>Report → New Activities</strong>
                {isThai ? " เท่านั้น" : " module only"}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.postSaveFooter}>
          <div className={styles.postSaveFooterLeft}>
            {onBackToEdit && currentActivity && (
              <button
                type="button"
                className={styles.postSaveBackEditBtn}
                onClick={() => onBackToEdit(currentActivity)}
                disabled={isConfirming || isDeleting}
                title={isThai ? "กลับไปแก้ไขข้อมูลกิจกรรมนี้" : "Back to edit this activity"}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>{isThai ? "กลับไปแก้ไข" : "Edit"}</span>
              </button>
            )}

            <button
              type="button"
              className={styles.postSaveCancelBtn}
              onClick={handleCancelActivity}
              disabled={isConfirming || isDeleting}
              title={isThai ? "ยกเลิกและลบกิจกรรมนี้" : "Cancel & delete activity"}
            >
              {isDeleting ? (
                <span>{isThai ? "กำลังยกเลิก..." : "Cancelling..."}</span>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>{isThai ? "ยกเลิกกิจกรรม" : "Cancel"}</span>
                </>
              )}
            </button>
          </div>

          <div className={styles.postSaveFooterRight}>
            <button
              type="button"
              className={styles.postSaveSkipBtn}
              onClick={onClose}
              disabled={isConfirming || isDeleting}
            >
              {isThai ? "ข้ามขั้นตอนนี้" : "Skip"}
            </button>
            <button
              type="button"
              className={styles.postSaveConfirmBtn}
              onClick={handleConfirm}
              disabled={isConfirming || isDeleting}
            >
              {isConfirming ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    style={{ animation: "postSaveSpin 1s linear infinite" }}
                  >
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                  <span>{isThai ? "กำลังบันทึก..." : "Saving..."}</span>
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{isThai ? "ยืนยันการตั้งค่า" : "Confirm"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ActivityPostSaveDialog;
