"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import type { CourseActivity, CompanyOption } from "../../../../api/course-activities/route";
import { loadWorkflowRollingPlans, type RollingPlan } from "../../TrainingPlanManagement/modules/TrainingRolling";
import styles from "./ActivityFormModal.module.css";

const DEFAULT_COMPANIES: CompanyOption[] = [
  { id: "center", code: "CENTER", name: "Center (ส่วนกลาง)" },
  { id: "1", code: "ATA", name: "ATA - Aisin Takaoka Asia Co., Ltd." },
  { id: "2", code: "TEP", name: "TEP - Thai Engineering Products Co., Ltd." },
  { id: "3", code: "ATFB", name: "ATFB - Aisin Takaoka Foundry Bangpakong Co., Ltd." },
  { id: "4", code: "NIC", name: "NIC - The Nawaloha Industry Co., Ltd." },
  { id: "5", code: "SATI", name: "SATI - Siam AT Industry Co., Ltd." },
  { id: "6", code: "SNF", name: "SNF - The Siam Nawaloha Foundry Co., Ltd." },
];

const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);

export interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newActivityId?: string, isEdit?: boolean) => void;
  activityToEdit?: CourseActivity | null;
  isThai?: boolean;
}

export const ActivityFormModal: React.FC<ActivityFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activityToEdit = null,
  isThai = true,
}) => {
  const notice = useNotice();
  const toast = useToast();
  const authenticatedUser = useAuthenticatedUser();

  const isCenterOrAdmin =
    authenticatedUser?.roleCode === "HRD_CENTER" || authenticatedUser?.roleCode === "ADMIN";
  const isFactory = authenticatedUser?.roleCode === "HRD_FACTORY";
  const userCompanyId = authenticatedUser?.companyId
    ? String(authenticatedUser.companyId).trim()
    : null;
  const userCompanyCode = authenticatedUser?.companyCode
    ? authenticatedUser.companyCode.trim().toUpperCase()
    : null;
  const userCompanyName = authenticatedUser?.companyName
    ? authenticatedUser.companyName.trim().toLowerCase()
    : null;

  const isEditing = Boolean(activityToEdit && activityToEdit.id);

  // Companies & Rolling Plans
  const [companies, setCompanies] = useState<CompanyOption[]>(DEFAULT_COMPANIES);
  const [availablePlans, setAvailablePlans] = useState<RollingPlan[]>([]);

  // Form states
  const [formId, setFormId] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formCompanyId, setFormCompanyId] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formLocation, setFormLocation] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");

  // Images
  const [formImages, setFormImages] = useState<string[]>([]);
  const [selectedNewFiles, setSelectedNewFiles] = useState<{ file: File; previewUrl: string }[]>([]);

  // Course linking
  const [formIsCourseLinked, setFormIsCourseLinked] = useState<boolean>(false);
  const [formLinkedPlanId, setFormLinkedPlanId] = useState<string>("");
  const [formLinkedCourseId, setFormLinkedCourseId] = useState<string>("");
  const [formLinkedCourseCode, setFormLinkedCourseCode] = useState<string>("");
  const [formLinkedCourseName, setFormLinkedCourseName] = useState<string>("");
  const [formLinkedTrainingDate, setFormLinkedTrainingDate] = useState<string>("");
  const [formLinkedEndDate, setFormLinkedEndDate] = useState<string>("");
  const [formRegistrationNote, setFormRegistrationNote] = useState<string>("");
  const [formIsVisibleOnDashboard, setFormIsVisibleOnDashboard] = useState<boolean>(true);
  const [formShowOnLoginPage, setFormShowOnLoginPage] = useState<boolean>(false);

  // Status
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Fetch available companies
    fetch("/api/course-activities")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.companies && Array.isArray(data.companies)) {
          setCompanies(data.companies);
        }
      })
      .catch(() => {});

    // Fetch available rolling plans
    loadWorkflowRollingPlans().then(setAvailablePlans).catch(() => []);
  }, []);

  // Factory own company resolver
  const factoryOwnCompany = useMemo<CompanyOption | null>(() => {
    if (!isFactory) return null;
    if (userCompanyId) {
      const match = companies.find(
        (c) =>
          String(c.id).toLowerCase() === userCompanyId.toLowerCase() ||
          (c.code && c.code.toLowerCase() === userCompanyId.toLowerCase())
      );
      if (match) return match;
    }
    if (userCompanyCode) {
      const match = companies.find(
        (c) => c.code && c.code.toUpperCase() === userCompanyCode
      );
      if (match) return match;
    }
    if (userCompanyName) {
      const match = companies.find((c) =>
        c.name.toLowerCase().includes(userCompanyName)
      );
      if (match) return match;
    }
    if (userCompanyId || userCompanyCode) {
      return {
        id: userCompanyId || "factory",
        code: userCompanyCode || "FACTORY",
        name: isThai
          ? `บริษัทของคุณ (${userCompanyCode || userCompanyId})`
          : (userCompanyCode || `Company ${userCompanyId}`),
      };
    }
    return null;
  }, [isFactory, companies, userCompanyId, userCompanyCode, userCompanyName, isThai]);

  // Companies accessible in dropdown
  const availableCompanies = useMemo(() => {
    if (isCenterOrAdmin) return companies;
    if (isFactory) {
      return factoryOwnCompany ? [factoryOwnCompany] : [];
    }
    return companies;
  }, [companies, isCenterOrAdmin, isFactory, factoryOwnCompany]);

  // Clean up blob URLs when dialog closes
  const cleanupPreviewUrls = useCallback(() => {
    selectedNewFiles.forEach((item) => {
      if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setSelectedNewFiles([]);
  }, [selectedNewFiles]);

  // Reset or populate form whenever modal opens or activityToEdit changes
  useEffect(() => {
    if (!isOpen) {
      cleanupPreviewUrls();
      return;
    }

    if (activityToEdit && activityToEdit.id) {
      // Edit Mode
      setFormId(activityToEdit.id);
      setFormTitle(activityToEdit.title || "");
      const existingImgs =
        activityToEdit.images && activityToEdit.images.length > 0
          ? [...activityToEdit.images]
          : activityToEdit.imageUrl
          ? [activityToEdit.imageUrl]
          : [];
      setFormImages(existingImgs);
      setSelectedNewFiles([]);

      let targetCompanyId = activityToEdit.companyId || "";
      if (targetCompanyId && targetCompanyId !== "center" && targetCompanyId !== "ALL") {
        const matchById = companies.find(
          (c) => String(c.id).toLowerCase() === String(targetCompanyId).toLowerCase()
        );
        if (matchById) {
          targetCompanyId = matchById.id;
        } else {
          const matchByCode = companies.find(
            (c) => c.code && c.code.toUpperCase() === String(targetCompanyId).toUpperCase()
          );
          if (matchByCode) {
            targetCompanyId = matchByCode.id;
          }
        }
      }
      if (
        (!targetCompanyId || targetCompanyId === "center") &&
        activityToEdit.companyCode &&
        activityToEdit.companyCode !== "CENTER"
      ) {
        const matchByCode = companies.find(
          (c) => c.code && c.code.toUpperCase() === activityToEdit.companyCode.toUpperCase()
        );
        if (matchByCode) {
          targetCompanyId = matchByCode.id;
        }
      }
      if (!targetCompanyId) {
        targetCompanyId = isFactory && factoryOwnCompany ? factoryOwnCompany.id : "center";
      }
      setFormCompanyId(targetCompanyId);

      setFormDate(activityToEdit.date || "");
      setFormLocation(activityToEdit.location || "");
      setFormDescription(activityToEdit.description || "");
      setFormIsVisibleOnDashboard(
        activityToEdit.isVisibleOnDashboard !== false && activityToEdit.status !== "ARCHIVED"
      );
      setFormShowOnLoginPage(Boolean(activityToEdit.showOnLoginPage));

      setFormIsCourseLinked(Boolean(activityToEdit.isCourseLinked));
      setFormLinkedPlanId(activityToEdit.linkedPlanId || "");
      setFormLinkedCourseId(activityToEdit.linkedCourseId || "");
      setFormLinkedCourseCode(activityToEdit.linkedCourseCode || "");
      setFormLinkedCourseName(activityToEdit.linkedCourseName || "");
      setFormLinkedTrainingDate(activityToEdit.linkedTrainingDate || "");
      setFormLinkedEndDate(activityToEdit.linkedEndDate || "");
      setFormRegistrationNote(activityToEdit.registrationNote || "");
    } else {
      // Add Mode
      setFormId("");
      setFormTitle("");
      setFormImages([]);
      setSelectedNewFiles([]);
      if (isFactory) {
        setFormCompanyId(factoryOwnCompany ? factoryOwnCompany.id : (userCompanyId || ""));
      } else {
        setFormCompanyId("center");
      }
      setFormDate(new Date().toISOString().slice(0, 10));
      setFormLocation("");
      setFormDescription("");
      setFormIsVisibleOnDashboard(true);
      setFormShowOnLoginPage(false);

      setFormIsCourseLinked(false);
      setFormLinkedPlanId("");
      setFormLinkedCourseId("");
      setFormLinkedCourseCode("");
      setFormLinkedCourseName("");
      setFormLinkedTrainingDate("");
      setFormLinkedEndDate("");
      setFormRegistrationNote("");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [isOpen, activityToEdit, isFactory, factoryOwnCompany, userCompanyId, companies]);

  // Current company code for plan filtering
  const currentFormCompanyCode = useMemo<string>(() => {
    if (isFactory) {
      if (factoryOwnCompany?.code) return factoryOwnCompany.code.toUpperCase().trim();
      if (userCompanyCode) return userCompanyCode.toUpperCase().trim();
    }
    if (formCompanyId === "center" || formCompanyId === "ALL") return "CENTER";
    const found = companies.find(
      (c) =>
        String(c.id).toLowerCase() === String(formCompanyId).toLowerCase() ||
        (c.code && c.code.toUpperCase() === String(formCompanyId).toUpperCase())
    );
    if (found && found.code) return found.code.toUpperCase().trim();
    if (!formCompanyId) return "CENTER";
    return String(formCompanyId).toUpperCase().trim();
  }, [isFactory, factoryOwnCompany, userCompanyCode, companies, formCompanyId]);

  // Filter selectable rolling plans based on company
  const isPlanMatchingCompany = useCallback(
    (plan: RollingPlan, targetCompanyCode: string): boolean => {
      if (!targetCompanyCode) return false;
      const target = targetCompanyCode.toUpperCase().trim();
      if (target === "CENTER") {
        return (
          plan.owner === "CENTER" ||
          !plan.company ||
          plan.company.toUpperCase().trim() === "CENTER" ||
          plan.company.toUpperCase().trim() === "ALL"
        );
      }
      return (
        plan.owner === "FACTORY" &&
        Boolean(plan.company && plan.company.toUpperCase().trim() === target)
      );
    },
    []
  );

  const selectablePlans = useMemo(() => {
    return availablePlans.filter((plan) => {
      if (!plan.rollingId) return false;
      if (plan.status === "Cancel") return false;
      const dbStatus = String(plan.dbStatus || "").toUpperCase();
      if (dbStatus === "CANCELLED" || dbStatus === "COMPLETED") return false;
      return isPlanMatchingCompany(plan, currentFormCompanyCode);
    });
  }, [availablePlans, currentFormCompanyCode, isPlanMatchingCompany]);

  // File selection
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validExtensions = [
      ".jpg",
      ".jpeg",
      ".jfif",
      ".png",
      ".webp",
      ".gif",
      ".svg",
      ".bmp",
      ".avif",
      ".tiff",
      ".tif",
    ];

    const newItems: { file: File; previewUrl: string }[] = [];

    for (const file of files) {
      const fileName = (file.name || "").toLowerCase();
      const isImageMime = Boolean(file.type && file.type.startsWith("image/"));
      const hasImageExt = validExtensions.some((ext) => fileName.endsWith(ext));

      if (!isImageMime && !hasImageExt) {
        toast.error(
          isThai
            ? `ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่รองรับ`
            : `File "${file.name}" is not a supported image`
        );
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({ file, previewUrl });
    }

    setSelectedNewFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveExistingImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewFile = (index: number) => {
    setSelectedNewFiles((prev) => {
      const item = prev[index];
      if (item && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSetCoverExisting = (index: number) => {
    if (index === 0) return;
    setFormImages((prev) => {
      const target = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [target, ...rest];
    });
  };

  const handleSetCoverNew = (index: number) => {
    setSelectedNewFiles((prev) => {
      const target = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [target, ...rest];
    });
  };

  // Submit form (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      await notice({
        missingFields: [isThai ? "ชื่อกิจกรรม (Activity Title)" : "Activity Title"],
      });
      return;
    }
    if (!formCompanyId) {
      await notice({
        missingFields: [isThai ? "บริษัท (Company)" : "Company"],
      });
      return;
    }

    try {
      setIsSubmitting(true);

      let uploadedUrls: string[] = [];

      // Upload newly selected image files
      if (selectedNewFiles.length > 0) {
        setIsUploading(true);
        const formData = new FormData();
        selectedNewFiles.forEach((item) => {
          formData.append("files", item.file);
        });

        const uploadRes = await fetch("/api/course-activities/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          toast.error(
            errData.error || (isThai ? "อัปโหลดรูปภาพไม่สำเร็จ" : "Failed to upload images")
          );
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        if (Array.isArray(uploadData.urls)) {
          uploadedUrls = uploadData.urls;
        } else if (uploadData.url) {
          uploadedUrls = [uploadData.url];
        }
        setIsUploading(false);
      }

      const allImages = [...formImages, ...uploadedUrls];
      const primaryImageUrl = allImages.length > 0 ? allImages[0] : "";

      const payload = {
        id: formId,
        title: formTitle.trim(),
        date: formDate,
        location: formLocation.trim(),
        description: formDescription.trim(),
        imageUrl: primaryImageUrl,
        images: allImages,
        isCourseLinked: formIsCourseLinked,
        linkedCourseId: formLinkedCourseId || null,
        linkedCourseCode: formLinkedCourseCode || null,
        linkedCourseName: formLinkedCourseName || null,
        linkedPlanId: formLinkedPlanId || null,
        linkedTrainingDate: formLinkedTrainingDate || null,
        linkedEndDate: formLinkedEndDate || null,
        registrationNote: formRegistrationNote.trim() || null,
        isVisibleOnDashboard: formIsVisibleOnDashboard,
        showOnLoginPage: formShowOnLoginPage,
        status: formIsVisibleOnDashboard || formShowOnLoginPage ? "PUBLISHED" : "ARCHIVED",
        companyId: formCompanyId,
      };

      const res = await fetch("/api/course-activities", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (isEditing) {
          toast.success(isThai ? "แก้ไขกิจกรรมเรียบร้อยแล้ว" : "Activity updated");
          cleanupPreviewUrls();
          onClose();
          onSuccess?.(formId, true);
        } else {
          const created = await res.json().catch(() => ({}));
          const newId = created?.activity?.id ?? created?.id ?? "";
          cleanupPreviewUrls();
          onClose();
          onSuccess?.(String(newId), false);
        }
      } else {
        toast.error(isThai ? "ไม่สามารถบันทึกข้อมูลได้" : "Failed to save activity");
      }
    } catch {
      toast.error(isThai ? "เกิดข้อผิดพลาดในการบันทึก" : "An error occurred");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  if (!mounted || !isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {isEditing
              ? isThai
                ? "แก้ไขกิจกรรม (Edit Activity)"
                : "Edit Activity"
              : isThai
              ? "เพิ่มกิจกรรมใหม่ (Add Activity)"
              : "Add Activity"}
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmitForm} className={styles.modalForm}>
          <div className={styles.modalBody}>
            {/* Multi-Image Upload & Thumbnail Gallery */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                {isThai ? "รูปภาพกิจกรรม (Activity Photos)" : "Activity Photos"}
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: "normal",
                    color: "var(--ui-30-muted, #64748b)",
                    marginLeft: "8px",
                  }}
                >
                  {isThai
                    ? "(สามารถเลือกได้หลายรูป โดยรูปแรกจะเป็นภาพหน้าปก)"
                    : "(Multiple photos allowed; first photo is cover)"}
                </span>
              </label>

              <input
                type="file"
                ref={fileInputRef}
                className={styles.fileInputHidden}
                accept="image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.svg,.bmp,.avif"
                multiple
                onChange={handleFilesChange}
              />

              <div
                className={styles.multiUploadZone}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={styles.multiUploadIcon}>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div className={styles.multiUploadText}>
                  {isThai
                    ? "คลิกเพื่อเลือกรูปภาพกิจกรรม (เลือกได้หลายรูปพร้อมกัน)"
                    : "Click to select activity photos (multiple allowed)"}
                </div>
                <div className={styles.multiUploadHint}>
                  {isThai
                    ? "รองรับ JPG, JPEG, PNG, WEBP, GIF, SVG, JFIF, BMP, AVIF (รูปแรกคือภาพหน้าปก)"
                    : "Supports JPG, JPEG, PNG, WEBP, GIF (First image is cover photo)"}
                </div>
              </div>

              {/* Thumbnail Previews Grid */}
              {(formImages.length > 0 || selectedNewFiles.length > 0) && (
                <div className={styles.thumbGrid}>
                  {/* Existing saved images */}
                  {formImages.map((imgUrl, idx) => {
                    const isCover = idx === 0;
                    return (
                      <div
                        key={`exist-${imgUrl}-${idx}`}
                        className={`${styles.thumbCard} ${isCover ? styles.thumbCardCover : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={`Activity ${idx + 1}`}
                          className={styles.thumbImage}
                        />
                        {isCover && (
                          <span className={styles.thumbCoverBadge}>
                            {isThai ? "หน้าปก" : "Cover"}
                          </span>
                        )}
                        <div className={styles.thumbOverlayActions}>
                          {!isCover && (
                            <button
                              type="button"
                              className={styles.thumbActionBtn}
                              onClick={() => handleSetCoverExisting(idx)}
                              title={isThai ? "ตั้งเป็นภาพหน้าปก" : "Set as cover"}
                            >
                              {isThai ? "ตั้งหน้าปก" : "Cover"}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.thumbActionBtn} ${styles.thumbDeleteBtn}`}
                            onClick={() => handleRemoveExistingImage(idx)}
                            title={isThai ? "ลบรูปนี้" : "Remove"}
                          >
                            {isThai ? "ลบ" : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Newly selected files */}
                  {selectedNewFiles.map((item, idx) => {
                    const isCover = formImages.length === 0 && idx === 0;
                    return (
                      <div
                        key={`new-${item.previewUrl}-${idx}`}
                        className={`${styles.thumbCard} ${isCover ? styles.thumbCardCover : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.previewUrl}
                          alt={`New upload ${idx + 1}`}
                          className={styles.thumbImage}
                        />
                        {isCover && (
                          <span className={styles.thumbCoverBadge}>
                            {isThai ? "หน้าปก" : "Cover"}
                          </span>
                        )}
                        <div className={styles.thumbOverlayActions}>
                          {!isCover && (
                            <button
                              type="button"
                              className={styles.thumbActionBtn}
                              onClick={() => handleSetCoverNew(idx)}
                              title={isThai ? "ตั้งเป็นภาพหน้าปก" : "Set as cover"}
                            >
                              {isThai ? "ตั้งหน้าปก" : "Cover"}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.thumbActionBtn} ${styles.thumbDeleteBtn}`}
                            onClick={() => handleRemoveNewFile(idx)}
                            title={isThai ? "ลบรูปนี้" : "Remove"}
                          >
                            {isThai ? "ลบ" : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Title */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>{isThai ? "ชื่อกิจกรรม (Title)" : "Title"}</span>
                <RequiredIndicator isFilled={Boolean(formTitle && formTitle.trim().length > 0)} />
              </label>
              <input
                type="text"
                className={styles.formInput}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={
                  isThai ? "เช่น SNF CSR 2019 หรือ Leadership Workshop" : "e.g. SNF CSR 2019"
                }
                required
              />
            </div>

            {/* Company */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <span>{isThai ? "บริษัท (Company)" : "Company"}</span>
                <RequiredIndicator
                  isFilled={isFactory || Boolean(formCompanyId && formCompanyId !== "")}
                />
              </label>
              {isFactory ? (
                <div className={styles.lockedCompanyBox}>
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className={styles.lockedCompanyName}>
                    {factoryOwnCompany?.name ||
                      userCompanyCode ||
                      (isThai ? "สังกัดของท่าน" : "Your Company")}
                  </span>
                  <span className={styles.lockedCompanyBadge}>
                    {isThai ? "บริษัทของคุณ (ล็อกอัตโนมัติ)" : "Assigned Company (Locked)"}
                  </span>
                </div>
              ) : (
                <select
                  className={styles.formSelect}
                  value={formCompanyId}
                  onChange={(e) => {
                    const newCompanyId = e.target.value;
                    setFormCompanyId(newCompanyId);
                    setFormLinkedPlanId("");
                    setFormLinkedCourseId("");
                    setFormLinkedCourseCode("");
                    setFormLinkedCourseName("");
                    setFormLinkedTrainingDate("");
                    setFormLinkedEndDate("");
                    setFormRegistrationNote("");
                  }}
                  required
                >
                  <option value="">
                    {isThai ? "-- กรุณาเลือกบริษัท --" : "-- Please select company --"}
                  </option>
                  {availableCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code === "CENTER"
                        ? isThai
                          ? "Center (ส่วนกลาง)"
                          : "Center"
                        : c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date & Location row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  {isThai ? "วันที่จัดกิจกรรม (Date)" : "Date"}
                </label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  {isThai ? "สถานที่ (Location)" : "Location"}
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder={
                    isThai ? "เช่น Wat Nhongbua School, Saraburi" : "e.g. Training Room 1"
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                {isThai ? "คำบรรยายกิจกรรม (Description)" : "Description"}
              </label>
              <textarea
                className={styles.formTextarea}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={
                  isThai
                    ? "ระบุรายละเอียดกิจกรรมหรือโครงการฝึกอบรม..."
                    : "Enter activity details..."
                }
                rows={4}
              />
            </div>

            {/* Course Linking Toggle & Selector */}
            <div
              className={`${styles.courseLinkToggleCard} ${
                formIsCourseLinked ? styles.courseLinkToggleCardActive : ""
              }`}
            >
              <label className={styles.courseLinkCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={formIsCourseLinked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormIsCourseLinked(checked);
                    if (!checked) {
                      setFormLinkedPlanId("");
                      setFormLinkedCourseId("");
                      setFormLinkedCourseCode("");
                      setFormLinkedCourseName("");
                      setFormRegistrationNote("");
                    }
                  }}
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "#0284c7",
                    cursor: "pointer",
                  }}
                />
                <span>
                  {isThai
                    ? "เชื่อมโยงกิจกรรมนี้กับการเปิดรับสมัครอบรม (Link to Training Course)"
                    : "Link this activity to a Training Course for enrollment"}
                </span>
              </label>

              {formIsCourseLinked && (
                <div className={styles.courseLinkFields}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      <span>
                        {isThai
                          ? `เลือกหลักสูตรที่เปิดรับสมัคร (เฉพาะของ ${
                              currentFormCompanyCode || "สังกัดตัวเอง"
                            })`
                          : `Select Course / Rolling Plan (Only for ${
                              currentFormCompanyCode || "Your Company"
                            })`}
                      </span>
                      <RequiredIndicator
                        isFilled={Boolean(formLinkedPlanId && formLinkedPlanId !== "")}
                      />
                    </label>
                    <select
                      className={styles.formSelect}
                      value={formLinkedPlanId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setFormLinkedPlanId("");
                          setFormLinkedCourseId("");
                          setFormLinkedCourseCode("");
                          setFormLinkedCourseName("");
                          setFormLinkedTrainingDate("");
                          setFormLinkedEndDate("");
                          return;
                        }
                        const plan = availablePlans.find((p) => p.rollingId === val);
                        if (plan) {
                          setFormLinkedPlanId(plan.rollingId);
                          setFormLinkedCourseId(plan.course?.id || "");
                          setFormLinkedCourseCode(plan.course?.code || "");
                          setFormLinkedCourseName(plan.course?.name || "");
                          setFormLinkedTrainingDate(plan.trainingDate || "");
                          setFormLinkedEndDate(plan.endDate || "");
                        }
                      }}
                    >
                      <option value="">
                        {selectablePlans.length === 0
                          ? isThai
                            ? `-- ไม่พบหลักสูตรฝึกอบรมของ ${
                                currentFormCompanyCode || "บริษัทนี้"
                              } --`
                            : `-- No training courses for ${
                                currentFormCompanyCode || "this company"
                              } --`
                          : isThai
                          ? "-- กรุณาเลือกหลักสูตรฝึกอบรม --"
                          : "-- Please select course --"}
                      </option>
                      {selectablePlans.map((plan) => (
                        <option key={plan.rollingId} value={plan.rollingId}>
                          [{plan.course?.code || "COURSE"}] {plan.course?.name || "Untitled Course"}{" "}
                          {plan.batch ? `(${plan.batch})` : ""}{" "}
                          {plan.trainingDate ? `• ${plan.trainingDate}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {isThai
                        ? "ข้อความประชาสัมพันธ์การรับสมัคร (Registration Note)"
                        : "Registration Note"}
                    </label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formRegistrationNote}
                      onChange={(e) => setFormRegistrationNote(e.target.value)}
                      placeholder={
                        isThai
                          ? "เช่น เปิดรับสมัครจำนวนจำกัด 25 ท่าน ปิดรับสมัคร 20 ก.ย. นี้"
                          : "e.g. Limited to 25 seats, register by Sep 20"
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting || isUploading}
            >
              {isThai ? "ยกเลิก" : "Cancel"}
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting || isUploading
                ? isThai
                  ? "กำลังบันทึกข้อมูล..."
                  : "Saving activity..."
                : isThai
                ? "บันทึกกิจกรรม"
                : "Save Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ActivityFormModal;
