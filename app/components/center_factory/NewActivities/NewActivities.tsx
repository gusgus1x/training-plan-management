"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useConfirm } from "../../ConfirmDialog";
import { useNotice } from "../../NoticeDialog";
import { useToast } from "../../ToastHost";
import { useUiLanguage } from "../../ThaiUiLocalization";
import type { CourseActivity, CompanyOption } from "../../../api/course-activities/route";
import styles from "./NewActivities.module.css";

interface NewActivitiesProps {
  isThai?: boolean;
  readOnly?: boolean;
}

const PAGE_SIZE = 3;

const DEFAULT_COMPANIES: CompanyOption[] = [
  { id: "center", code: "CENTER", name: "Center (ส่วนกลาง)" },
  { id: "1", code: "ATA", name: "ATA - Aisin Takaoka Asia Co., Ltd." },
  { id: "2", code: "TEP", name: "TEP - Thai Engineering Products Co., Ltd." },
  { id: "3", code: "ATFB", name: "ATFB - Aisin Takaoka Foundry Bangpakong Co., Ltd." },
  { id: "4", code: "NIC", name: "NIC - The Nawaloha Industry Co., Ltd." },
  { id: "5", code: "SATI", name: "SATI - Siam AT Industry Co., Ltd." },
  { id: "6", code: "SNF", name: "SNF - The Siam Nawaloha Foundry Co., Ltd." },
];

export default function NewActivities({ isThai: propIsThai, readOnly = false }: NewActivitiesProps) {
  const { language } = useUiLanguage();
  const isThai = propIsThai !== undefined ? propIsThai : language === "th";
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();

  const authenticatedUser = useAuthenticatedUser();
  const isEmployee = readOnly || authenticatedUser?.roleCode === "EMPLOYEE";
  const userCompanyId = authenticatedUser?.companyId ? String(authenticatedUser.companyId).trim() : null;
  const userCompanyCode = authenticatedUser?.companyCode ? authenticatedUser.companyCode.trim().toUpperCase() : null;
  const userCompanyName = authenticatedUser?.companyName ? authenticatedUser.companyName.trim().toLowerCase() : null;

  const [activities, setActivities] = useState<CourseActivity[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>(DEFAULT_COMPANIES);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carousel state for smooth sliding window (shows 3 items at a time, advances every 5 seconds)
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [activeActivity, setActiveActivity] = useState<CourseActivity | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form input states
  const [formId, setFormId] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formCompanyId, setFormCompanyId] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formLocation, setFormLocation] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formImageUrl, setFormImageUrl] = useState<string>("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch activities and companies from API
  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/course-activities");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        if (data.companies && Array.isArray(data.companies)) {
          setCompanies(data.companies);
        }
      }
    } catch (err) {
      console.error("Failed to load course activities:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Filter activities for employees: Center + their own company
  const visibleActivities = useMemo(() => {
    if (!isEmployee) return activities;

    return activities.filter((act) => {
      // 1. Center (ส่วนกลาง) -> everyone can see
      const isCenter =
        !act.companyId ||
        act.companyId === "center" ||
        act.companyId === "ALL" ||
        act.companyCode?.toUpperCase() === "CENTER";

      if (isCenter) return true;

      // 2. User's own company -> only people in that company can see
      if (userCompanyId && String(act.companyId).trim() === userCompanyId) return true;
      if (userCompanyCode && act.companyCode?.trim().toUpperCase() === userCompanyCode) return true;
      if (userCompanyName && act.companyName && act.companyName.toLowerCase().includes(userCompanyName)) return true;

      return false;
    });
  }, [activities, isEmployee, userCompanyId, userCompanyCode, userCompanyName]);

  // Companies accessible in dropdown
  const availableCompanies = useMemo(() => {
    if (!isEmployee) return companies;
    return companies.filter((c) => {
      if (c.id === "center" || c.code?.trim().toUpperCase() === "CENTER") return true;
      if (userCompanyId && String(c.id).trim() === userCompanyId) return true;
      if (userCompanyCode && c.code?.trim().toUpperCase() === userCompanyCode) return true;
      if (userCompanyName && c.name && c.name.toLowerCase().includes(userCompanyName)) return true;
      return false;
    });
  }, [companies, isEmployee, userCompanyId, userCompanyCode, userCompanyName]);

  // Compute available distinct years sorted descending
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    visibleActivities.forEach((act) => {
      if (act.year) yearsSet.add(act.year);
    });
    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [visibleActivities]);

  // Filter activities by selected year and company
  const filteredActivities = useMemo(() => {
    return visibleActivities.filter((act) => {
      const matchYear = selectedYear === "all" || act.year === selectedYear;
      const matchCompany =
        selectedCompany === "all" ||
        (selectedCompany === "center" && (act.companyCode === "CENTER" || !act.companyId || act.companyId === "center")) ||
        act.companyId === selectedCompany ||
        act.companyCode === selectedCompany;
      return matchYear && matchCompany;
    });
  }, [visibleActivities, selectedYear, selectedCompany]);

  // Carousel items preparation: when > 3 items, render [prev, slot1, slot2, slot3, next] for continuous sliding
  const carouselItems = useMemo(() => {
    const N = filteredActivities.length;
    if (N <= 3) return [];
    return [
      { act: filteredActivities[(currentIndex - 1 + N) % N], slotKey: "prev" },
      { act: filteredActivities[currentIndex % N], slotKey: "slot1" },
      { act: filteredActivities[(currentIndex + 1) % N], slotKey: "slot2" },
      { act: filteredActivities[(currentIndex + 2) % N], slotKey: "slot3" },
      { act: filteredActivities[(currentIndex + 3) % N], slotKey: "next" },
    ];
  }, [filteredActivities, currentIndex]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setCurrentIndex(0);
    setIsSliding(false);
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompany(companyId);
    setCurrentIndex(0);
    setIsSliding(false);
  };

  // Next slide: item 1 slides away to the left, items 2, 3, 4 slide into view
  const handleNextSlide = () => {
    if (isSliding || filteredActivities.length <= 3) return;
    setSlideDirection("next");
    setIsSliding(true);
  };

  // Previous slide: slides to the right
  const handlePrevSlide = () => {
    if (isSliding || filteredActivities.length <= 3) return;
    setSlideDirection("prev");
    setIsSliding(true);
  };

  // Smooth transition end: resets track transform without any visual jump
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    setIsSliding(false);
    if (slideDirection === "next") {
      setCurrentIndex((prev) => (prev + 1) % filteredActivities.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + filteredActivities.length) % filteredActivities.length);
    }
  };

  // Auto-advance every 5 seconds (5 วิ) - pauses on hover or modal open
  useEffect(() => {
    if (filteredActivities.length <= 3) return;
    if (isHovered || isFormModalOpen || isDetailModalOpen || isSliding) return;

    const timer = setInterval(() => {
      handleNextSlide();
    }, 5000);

    return () => clearInterval(timer);
  }, [filteredActivities.length, isHovered, isFormModalOpen, isDetailModalOpen, isSliding, currentIndex]);

  // Close form modal and cleanup any pending object URLs
  const handleCloseFormModal = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImageFile(null);
    setPreviewUrl("");
    setFormImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsFormModalOpen(false);
  };

  // Open modal to add new activity
  const handleOpenAdd = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setIsEditing(false);
    setFormId("");
    setFormTitle("");
    setFormCompanyId("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormLocation("");
    setFormDescription("");
    setFormImageUrl("");
    setSelectedImageFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsFormModalOpen(true);
  };

  // Open modal to edit existing activity
  const handleOpenEdit = (e: React.MouseEvent, activity: CourseActivity) => {
    e.preventDefault();
    e.stopPropagation();
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setIsEditing(true);
    setFormId(activity.id);
    setFormTitle(activity.title);
    setFormCompanyId(activity.companyId || "center");
    setFormDate(activity.date || "");
    setFormLocation(activity.location || "");
    setFormDescription(activity.description || "");
    setSelectedImageFile(null);
    setFormImageUrl(activity.imageUrl || "");
    setPreviewUrl(activity.imageUrl || "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsFormModalOpen(true);
    setIsDetailModalOpen(false);
  };

  // Open detail modal to view activity
  const handleOpenDetail = (activity: CourseActivity) => {
    setActiveActivity(activity);
    setIsDetailModalOpen(true);
  };

  // Remove selected image
  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImageFile(null);
    setPreviewUrl("");
    setFormImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file selection with local preview only (DO NOT upload to server yet)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate supported image formats
    const fileName = (file.name || "").toLowerCase();
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
    const isImageMime = Boolean(file.type && file.type.startsWith("image/"));
    const hasImageExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isImageMime && !hasImageExt) {
      toast.error(
        isThai
          ? "รองรับเฉพาะไฟล์รูปภาพ (.jpg, .jpeg, .jfif, .png, .webp, .gif, .svg, .bmp, .avif)"
          : "Only image files are supported (.jpg, .jpeg, .jfif, .png, .webp, .gif, .svg, .bmp, .avif)"
      );
      return;
    }

    // Revoke previous blob URL if any
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    // Instant local preview in browser memory only
    try {
      const localUrl = URL.createObjectURL(file);
      setSelectedImageFile(file);
      setPreviewUrl(localUrl);
    } catch (err) {
      console.error("Local preview error:", err);
    }
  };

  // Submit form (Create or Update) - Upload image to server ONLY here upon saving!
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

      let finalImageUrl = formImageUrl || "";

      // If user selected a new image file, upload it now upon save
      if (selectedImageFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", selectedImageFile);

        const uploadRes = await fetch("/api/course-activities/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          toast.error(errData.error || (isThai ? "อัปโหลดรูปภาพไม่สำเร็จ" : "Failed to upload image"));
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData.url;
        setFormImageUrl(uploadData.url);
        setIsUploading(false);
      }

      const payload = {
        id: formId,
        title: formTitle,
        date: formDate,
        location: formLocation,
        description: formDescription,
        imageUrl: finalImageUrl,
        companyId: formCompanyId,
      };

      const res = await fetch("/api/course-activities", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          isEditing
            ? isThai ? "แก้ไขกิจกรรมเรียบร้อยแล้ว" : "Activity updated"
            : isThai ? "เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว" : "Activity created"
        );
        handleCloseFormModal();
        await fetchActivities();
      } else {
        toast.error(isThai ? "ไม่สามารถบันทึกข้อมูลได้" : "Failed to save activity");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error(isThai ? "เกิดข้อผิดพลาดในการบันทึก" : "Error saving activity");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  // Delete activity
  const handleDelete = async (e: React.MouseEvent, activity: CourseActivity) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await confirm({
      message: {
        th: `คุณต้องการลบกิจกรรม "${activity.title}" ใช่หรือไม่?`,
        en: `Are you sure you want to delete "${activity.title}"?`,
      },
      danger: true,
    });

    if (!confirmed) return;

    try {
      const query = new URLSearchParams({ id: activity.id });
      if (activity.imageUrl) {
        query.set("imageUrl", activity.imageUrl);
      }
      const res = await fetch(`/api/course-activities?${query.toString()}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(isThai ? "ลบกิจกรรมเรียบร้อยแล้ว" : "Activity deleted");
        if (isDetailModalOpen && activeActivity?.id === activity.id) {
          setIsDetailModalOpen(false);
        }
        await fetchActivities();
      } else {
        toast.error(isThai ? "ไม่สามารถลบกิจกรรมได้" : "Failed to delete activity");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(isThai ? "เกิดข้อผิดพลาดในการลบ" : "Error deleting activity");
    }
  };

  const renderActivityCard = (act: CourseActivity) => (
    <div
      className={styles.activityCard}
      onClick={() => handleOpenDetail(act)}
      title={isThai ? "คลิกเพื่อดูรายละเอียด" : "Click to view details"}
    >
      {/* Card Image Banner */}
      <div className={styles.cardImageContainer}>
        {act.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={act.imageUrl}
            alt={act.title}
            className={styles.cardImage}
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent && !parent.querySelector(".img-load-fallback")) {
                const fb = document.createElement("div");
                fb.className = "img-load-fallback";
                fb.style.cssText =
                  "display:flex;align-items:center;justify-content:center;height:100%;width:100%;color:var(--ui-30-muted,#94a3b8);font-size:0.85rem;font-weight:600;background:var(--ui-60-surface-soft,#f1f5f9);";
                fb.innerText = isThai ? "📷 ไม่สามารถแสดงรูปภาพได้" : "📷 Image unavailable";
                parent.appendChild(fb);
              }
            }}
          />
        ) : (
          <div className={styles.noImagePlaceholder}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>{isThai ? "ไม่มีรูปภาพ" : "No Image"}</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className={styles.cardBody}>
        <div className={styles.cardMetaRow}>
          <div className={styles.cardDate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{act.formattedDate || act.date}</span>
          </div>
          <span
            className={`${styles.companyBadge} ${styles[`companyBadge_${act.companyCode}`] || styles.companyBadge_CENTER}`}
            title={act.companyName || act.companyCode}
          >
            {act.companyCode === "CENTER" ? "Center" : act.companyCode}
          </span>
        </div>
        <h3 className={styles.cardTitle}>{act.title}</h3>
        <p className={styles.cardDescription}>{act.description}</p>
        
        {/* Card Footer: Location (left) & Action Buttons Edit/Delete (right) */}
        <div className={styles.cardFooter}>
          {act.location ? (
            <div className={styles.cardLocation}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{act.location}</span>
            </div>
          ) : (
            <div />
          )}

          {!isEmployee && (
            <div className={styles.cardActionsRow}>
              <button
                type="button"
                className={styles.cardActionBtn}
                onClick={(e) => handleOpenEdit(e, act)}
                title={isThai ? "แก้ไขกิจกรรม" : "Edit Activity"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                type="button"
                className={`${styles.cardActionBtn} ${styles.cardActionBtnDelete}`}
                onClick={(e) => handleDelete(e, act)}
                title={isThai ? "ลบกิจกรรม" : "Delete Activity"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <section className={styles.activitiesSection} aria-label="New Activities">
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.mainTitle}>
            <span>{isThai ? "New Activities" : "New Activities"}</span>
          </h2>
          <span className={styles.countBadge}>
            {filteredActivities.length} {isThai ? "กิจกรรม" : "activities"}
          </span>
        </div>

        {/* Header Controls: Filters + Add Button */}
        <div className={styles.headerControls}>
          <div className={styles.filtersGroup}>
            {/* Year Filter Pills */}
            <div className={styles.filterPillsRow}>
              <button
                type="button"
                className={`${styles.pillBtn} ${selectedYear === "all" ? styles.pillBtnActive : ""}`}
                onClick={() => handleYearChange("all")}
              >
                {isThai ? "All" : "All"}
              </button>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  className={`${styles.pillBtn} ${selectedYear === yr ? styles.pillBtnActive : ""}`}
                  onClick={() => handleYearChange(yr)}
                >
                  {yr}
                </button>
              ))}
            </div>

            {/* Company Filter */}
            <select
              className={styles.companyFilterSelect}
              value={selectedCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
              title={isThai ? "กรองตามบริษัท" : "Filter by company"}
            >
              <option value="all">
                {isEmployee
                  ? (isThai ? "🏢 ทั้งหมด (All)" : "🏢 All")
                  : (isThai ? "🏢 ทุกบริษัท (All Companies)" : "🏢 All Companies")}
              </option>
              <option value="center">{isThai ? "🏛️ Center (ส่วนกลาง)" : "🏛️ Center"}</option>
              {availableCompanies
                .filter((c) => c.id !== "center")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.code}
                  </option>
                ))}
            </select>
          </div>

          {/* Add Activity Button (only for Admins / HR) */}
          {!isEmployee && (
            <button
              type="button"
              className={styles.addActivityHeaderBtn}
              onClick={handleOpenAdd}
              title={isThai ? "เพิ่มกิจกรรมใหม่" : "Add Activity"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{isThai ? "เพิ่มกิจกรรม" : "Add Activity"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State or Cards Display */}
      {filteredActivities.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconCircle}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>
            {isThai ? "ยังไม่มีกิจกรรมการอบรม" : "No Course Activities"}
          </h3>
          <p className={styles.emptyDesc}>
            {isThai
              ? "ยังไม่มีข้อมูลกิจกรรมตามเงื่อนไขที่เลือก สามารถกดปุ่ม \"เพิ่มกิจกรรม\" ด้านบนเพื่อสร้างกิจกรรมใหม่ได้ครับ"
              : "No activities match your criteria. Click \"Add Activity\" above to add a new one."}
          </p>
        </div>
      ) : filteredActivities.length <= 3 ? (
        /* Static 3-column grid when 3 or fewer items */
        <div className={styles.cardsGrid}>
          {filteredActivities.map((act) => (
            <div key={act.id} className={styles.gridCardWrapper}>
              {renderActivityCard(act)}
            </div>
          ))}
        </div>
      ) : (
        /* Sliding Carousel Window when more than 3 items */
        <div
          className={styles.carouselContainer}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={`${styles.carouselTrack} ${
              isSliding && slideDirection === "next"
                ? styles.trackSlidingNext
                : isSliding && slideDirection === "prev"
                ? styles.trackSlidingPrev
                : ""
            }`}
            onTransitionEnd={handleTransitionEnd}
          >
            {carouselItems.map(({ act, slotKey }) => (
              <div key={`${act.id}-${slotKey}`} className={styles.carouselSlide}>
                {renderActivityCard(act)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carousel Dots Indicator (shown when more than 3 activities) */}
      {filteredActivities.length > 3 && (
        <div className={styles.paginationWrapper}>
          <div className={styles.carouselDots}>
            {filteredActivities.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`${styles.carouselDot} ${currentIndex === idx ? styles.carouselDotActive : ""}`}
                onClick={() => {
                  if (isSliding || currentIndex === idx) return;
                  setIsSliding(false);
                  setCurrentIndex(idx);
                }}
                title={isThai ? `กิจกรรมที่ ${idx + 1}` : `Activity ${idx + 1}`}
                aria-label={`Go to item ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isFormModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseFormModal}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {isEditing
                  ? (isThai ? "แก้ไขกิจกรรม (Edit Activity)" : "Edit Activity")
                  : (isThai ? "เพิ่มกิจกรรมใหม่ (Add Activity)" : "Add Activity")}
              </h3>
              <button
                type="button"
                className={styles.closeButton}
                onClick={handleCloseFormModal}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* Image Upload / Preview */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {isThai ? "รูปภาพกิจกรรม (Activity Photo)" : "Activity Photo"}
                  </label>
                  {(previewUrl || formImageUrl) ? (
                    <div className={styles.modalImagePreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl || formImageUrl}
                        alt="Preview"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector(".preview-fallback")) {
                            const fb = document.createElement("div");
                            fb.className = "preview-fallback";
                            fb.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;width:100%;color:#94a3b8;font-size:0.85rem;font-weight:600;";
                            fb.innerText = isThai ? "📷 ไม่สามารถแสดงรูปภาพได้" : "📷 Image preview unavailable";
                            parent.appendChild(fb);
                          }
                        }}
                      />
                      <div className={styles.imagePreviewToolbar}>
                        <button
                          type="button"
                          className={styles.removeImageBtn}
                          onClick={handleRemoveImage}
                          title={isThai ? "ลบรูปภาพนี้" : "Remove photo"}
                        >
                          ✕ {isThai ? "ลบรูปภาพ" : "Remove"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <input
                    type="file"
                    ref={fileInputRef}
                    className={styles.fileInputHidden}
                    accept="image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.svg,.bmp,.avif"
                    onChange={handleFileChange}
                  />

                  <div
                    className={styles.fileDropZone}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className={styles.fileDropZoneText}>
                      {(previewUrl || formImageUrl)
                        ? (isThai ? "คลิกเพื่อเปลี่ยนรูปภาพใหม่" : "Click to change photo")
                        : (isThai ? "คลิกเพื่อเลือกไฟล์รูปภาพจากเครื่องคอมพิวเตอร์" : "Click to choose photo file")}
                    </span>
                    <span className={styles.fileDropZoneSubtext}>
                      {isThai
                        ? "รองรับไฟล์ JPG, JPEG, PNG, WEBP, GIF, SVG, JFIF, BMP, AVIF"
                        : "Supports JPG, JPEG, PNG, WEBP, GIF, SVG, JFIF, BMP, AVIF"}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {isThai ? "ชื่อกิจกรรม (Title) *" : "Title *"}
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={isThai ? "เช่น SNF CSR 2019 หรือ Leadership Workshop" : "e.g. SNF CSR 2019"}
                    required
                  />
                </div>

                {/* Company */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {isThai ? "บริษัท (Company) *" : "Company *"}
                  </label>
                  <select
                    className={styles.formSelect}
                    value={formCompanyId}
                    onChange={(e) => setFormCompanyId(e.target.value)}
                    required
                  >
                    <option value="">
                      {isThai ? "-- กรุณาเลือกบริษัท --" : "-- Please select company --"}
                    </option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code === "CENTER" ? (isThai ? "🏛️ Center (ส่วนกลาง)" : "🏛️ Center") : `🏢 ${c.name}`}
                      </option>
                    ))}
                  </select>
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
                      placeholder={isThai ? "เช่น Wat Nhongbua School, Saraburi" : "e.g. Training Room 1"}
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
                    placeholder={isThai ? "ระบุรายละเอียดกิจกรรมหรือโครงการฝึกอบรม..." : "Enter activity details..."}
                    rows={4}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleCloseFormModal}
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
                    ? (isThai ? "กำลังบันทึกข้อมูล..." : "Saving activity...")
                    : (isThai ? "บันทึกกิจกรรม" : "Save Activity")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {isDetailModalOpen && activeActivity && (
        <div className={styles.modalOverlay} onClick={() => setIsDetailModalOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span className={styles.detailDateBadge}>
                  📅 {activeActivity.formattedDate || activeActivity.date}
                </span>
                <span
                  className={`${styles.companyBadge} ${styles[`companyBadge_${activeActivity.companyCode}`] || styles.companyBadge_CENTER}`}
                  style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                >
                  {activeActivity.companyCode === "CENTER"
                    ? (isThai ? "🏛️ Center (ส่วนกลาง)" : "🏛️ Center")
                    : `🏢 ${activeActivity.companyName || activeActivity.companyCode}`}
                </span>
                {activeActivity.location ? (
                  <span style={{ fontSize: "0.82rem", color: "var(--ui-30-muted)", fontWeight: 700 }}>
                    📍 {activeActivity.location}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {activeActivity.imageUrl ? (
                <div className={styles.modalImagePreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeActivity.imageUrl} alt={activeActivity.title} />
                </div>
              ) : null}

              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0", color: "var(--ui-30-ink)" }}>
                {activeActivity.title}
              </h2>

              <p className={styles.detailDescription}>
                {activeActivity.description}
              </p>
            </div>

            <div className={styles.modalFooter}>
              {!isEmployee && (
                <>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={(e) => handleOpenEdit(e, activeActivity)}
                  >
                    ✏️ {isThai ? "แก้ไข" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                    onClick={(e) => handleDelete(e, activeActivity)}
                  >
                    🗑️ {isThai ? "ลบ" : "Delete"}
                  </button>
                </>
              )}
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => setIsDetailModalOpen(false)}
              >
                {isThai ? "ปิด" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
