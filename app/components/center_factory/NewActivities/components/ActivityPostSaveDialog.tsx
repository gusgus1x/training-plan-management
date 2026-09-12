"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./ActivityPostSaveDialog.module.css";

export interface ActivityPostSaveDialogProps {
  isOpen: boolean;
  activityId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  isThai?: boolean;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

export const ActivityPostSaveDialog: React.FC<ActivityPostSaveDialogProps> = ({
  isOpen,
  activityId,
  onClose,
  onSuccess,
  isThai = true,
  showToast,
}) => {
  const [postSaveDashboard, setPostSaveDashboard] = useState<boolean>(true);
  const [postSaveLoginPage, setPostSaveLoginPage] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset checkboxes to default whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      setPostSaveDashboard(true);
      setPostSaveLoginPage(false);
      setIsConfirming(false);
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
        showToast?.(
          isThai
            ? "บันทึกการตั้งค่าการแสดงผลเรียบร้อยแล้ว"
            : "Display destinations updated successfully",
          "success"
        );
        onSuccess?.();
        onClose();
      } else {
        showToast?.(
          isThai ? "เกิดข้อผิดพลาดในการบันทึก" : "Failed to update display destinations",
          "error"
        );
      }
    } catch {
      showToast?.(
        isThai ? "เกิดข้อผิดพลาดในการบันทึก" : "Failed to update display destinations",
        "error"
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return createPortal(
    <div
      className={styles.postSaveOverlay}
      onClick={() => {
        if (!isConfirming) onClose();
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
            if (!isConfirming) onClose();
          }}
          disabled={isConfirming}
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
                ? "กิจกรรมของคุณถูกสร้างแล้ว — เลือกว่าจะให้แสดงที่ไหนบ้าง"
                : "Your activity has been created — choose where to display it"}
            </p>
          </div>
        </div>

        {/* Options */}
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
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
              checked={postSaveDashboard}
              onChange={(e) => setPostSaveDashboard(e.target.checked)}
              disabled={isConfirming}
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
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
              checked={postSaveLoginPage}
              onChange={(e) => setPostSaveLoginPage(e.target.checked)}
              disabled={isConfirming}
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

        {/* Footer */}
        <div className={styles.postSaveFooter}>
          <button
            type="button"
            className={styles.postSaveSkipBtn}
            onClick={onClose}
            disabled={isConfirming}
          >
            {isThai ? "ข้ามขั้นตอนนี้" : "Skip"}
          </button>
          <button
            type="button"
            className={styles.postSaveConfirmBtn}
            onClick={handleConfirm}
            disabled={isConfirming}
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
    </div>,
    document.body
  );
};

export default ActivityPostSaveDialog;
