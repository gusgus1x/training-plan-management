"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import type { ReportModuleProps } from "./index";
import styles from "./NewActivitiesReport.module.css";

export const newActivitiesReportModule = {
  title: "New Activities",
  subtitle: "Company news, training events & CSR activities",
  description:
    "Browse, search, and analyze all training activities, CSR highlights, and company announcements with rich gallery and tabular reporting.",
} as const;

export type CourseActivity = {
  id: string;
  title: string;
  date: string;
  formattedDate?: string;
  year: string;
  location?: string;
  description: string;
  imageUrl: string;
  images?: string[];
  isCourseLinked?: boolean;
  linkedCourseId?: string | null;
  linkedCourseCode?: string | null;
  linkedCourseName?: string | null;
  linkedPlanId?: string | null;
  linkedTrainingDate?: string | null;
  linkedEndDate?: string | null;
  registrationNote?: string | null;
  isVisibleOnDashboard?: boolean;
  status?: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  createdAt: string;
  updatedAt?: string;
};

export type CompanyOption = {
  id: string;
  code: string;
  name: string;
};

const DEFAULT_COMPANIES: CompanyOption[] = [
  { id: "center", code: "CENTER", name: "Center (ส่วนกลาง)" },
  { id: "1", code: "ATA", name: "ATA - Aisin Takaoka Asia Co., Ltd." },
  { id: "2", code: "TEP", name: "TEP - Thai Engineering Products Co., Ltd." },
  { id: "3", code: "ATFB", name: "ATFB - Aisin Takaoka Foundry Bangpakong Co., Ltd." },
  { id: "4", code: "NIC", name: "NIC - The Nawaloha Industry Co., Ltd." },
  { id: "5", code: "SATI", name: "SATI - Siam AT Industry Co., Ltd." },
  { id: "6", code: "SNF", name: "SNF - The Siam Nawaloha Foundry Co., Ltd." },
];

export default function NewActivitiesReport({ initialYear }: ReportModuleProps) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();

  const authenticatedUser = useAuthenticatedUser();
  const isCenterOrAdmin = authenticatedUser?.roleCode === "HRD_CENTER" || authenticatedUser?.roleCode === "ADMIN";
  const isFactory = authenticatedUser?.roleCode === "HRD_FACTORY";
  const isEmployee = authenticatedUser?.roleCode === "EMPLOYEE";
  const isCompanyScoped = isFactory || isEmployee;
  const userCompanyId = authenticatedUser?.companyId ? String(authenticatedUser.companyId).trim() : null;
  const userCompanyCode = authenticatedUser?.companyCode ? authenticatedUser.companyCode.trim().toUpperCase() : null;
  const userCompanyName = authenticatedUser?.companyName ? authenticatedUser.companyName.trim().toLowerCase() : null;

  const [activities, setActivities] = useState<CourseActivity[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>(DEFAULT_COMPANIES);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(initialYear || "all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [activeActivity, setActiveActivity] = useState<CourseActivity | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form states
  const [formId, setFormId] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formCompanyId, setFormCompanyId] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formLocation, setFormLocation] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formImageUrl, setFormImageUrl] = useState<string>("");
  const [formIsVisibleOnDashboard, setFormIsVisibleOnDashboard] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "archived">("all");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch activities from API
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
      console.error("Failed to load course activities in report:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Filter activities based on visibility restrictions
  const visibleActivities = useMemo(() => {
    if (isCenterOrAdmin) return activities;

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
  }, [activities, isCenterOrAdmin, userCompanyId, userCompanyCode, userCompanyName]);

  // Find the exact company assigned to the current HRD Factory user
  const factoryOwnCompany = useMemo<CompanyOption | null>(() => {
    if (!isFactory) return null;
    const matched = companies.find((c) =>
      c.id !== "center" && (
        (userCompanyId && String(c.id).trim() === userCompanyId) ||
        (userCompanyCode && c.code?.trim().toUpperCase() === userCompanyCode) ||
        (userCompanyName && c.name?.toLowerCase().includes(userCompanyName))
      )
    );
    if (matched) return matched;
    if (userCompanyId || userCompanyCode) {
      return {
        id: userCompanyId || userCompanyCode || "own_company",
        code: userCompanyCode || "",
        name: userCompanyName
          ? `${userCompanyCode ? `${userCompanyCode} - ` : ""}${userCompanyName}`
          : (userCompanyCode || `Company ${userCompanyId}`),
      };
    }
    return null;
  }, [isFactory, companies, userCompanyId, userCompanyCode, userCompanyName]);

  // Accessible companies in dropdown
  // For HRD Factory: ONLY their own company (cannot touch or choose other companies)
  // For HRD Center / Admin: Center + all available companies
  const availableCompanies = useMemo(() => {
    if (isCenterOrAdmin) return companies;
    if (isFactory) {
      return factoryOwnCompany ? [factoryOwnCompany] : [];
    }
    return companies;
  }, [companies, isCenterOrAdmin, isFactory, factoryOwnCompany]);

  const canManageActivity = (act: CourseActivity | null) => {
    if (!act || isEmployee) return false;
    if (isCenterOrAdmin) return true;
    if (isFactory) {
      // HRD Factory can only edit/delete activities of their own company
      const isOwnCompany =
        (userCompanyId && String(act.companyId).trim() === userCompanyId) ||
        (userCompanyCode && act.companyCode?.trim().toUpperCase() === userCompanyCode) ||
        (userCompanyName && act.companyName && act.companyName.toLowerCase().includes(userCompanyName));
      return !!isOwnCompany;
    }
    return false;
  };

  const handleCompanyChange = (companyId: string) => {
    if (selectedCompany === companyId) {
      setSelectedCompany("all");
    } else {
      setSelectedCompany(companyId);
    }
  };

  // Compute available distinct years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    visibleActivities.forEach((act) => {
      if (act.year) yearsSet.add(act.year);
    });
    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [visibleActivities]);

  // KPI Statistics
  const currentYear = new Date().getFullYear().toString();
  const kpiStats = useMemo(() => {
    const total = visibleActivities.length;
    const activeCount = visibleActivities.filter(
      (a) => a.isVisibleOnDashboard !== false && a.status !== "ARCHIVED"
    ).length;
    const archivedCount = visibleActivities.filter(
      (a) => a.isVisibleOnDashboard === false || a.status === "ARCHIVED"
    ).length;
    const centerCount = visibleActivities.filter(
      (a) => !a.companyId || a.companyId === "center" || a.companyCode === "CENTER"
    ).length;
    const companyCount = total - centerCount;
    const thisYearCount = visibleActivities.filter((a) => a.year === currentYear).length;

    return { total, activeCount, archivedCount, centerCount, companyCount, thisYearCount };
  }, [visibleActivities, currentYear]);

  // Filtered activities based on search, status, and dropdown selections
  const filteredActivities = useMemo(() => {
    return visibleActivities.filter((act) => {
      // Status filter
      if (selectedStatus === "active" && (act.isVisibleOnDashboard === false || act.status === "ARCHIVED")) return false;
      if (selectedStatus === "archived" && act.isVisibleOnDashboard !== false && act.status !== "ARCHIVED") return false;

      // Year filter
      if (selectedYear !== "all" && act.year !== selectedYear) return false;

      // Company filter
      if (selectedCompany !== "all" && act.companyId !== selectedCompany) return false;

      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesTitle = act.title.toLowerCase().includes(query);
        const matchesDesc = act.description.toLowerCase().includes(query);
        const matchesLocation = (act.location || "").toLowerCase().includes(query);
        const matchesCompany = (act.companyCode || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesLocation && !matchesCompany) return false;
      }

      return true;
    });
  }, [visibleActivities, selectedStatus, selectedYear, selectedCompany, searchTerm]);

  // Open Add Activity Modal
  const handleOpenAdd = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setIsEditing(false);
    setFormId("");
    setFormTitle("");
    if (isFactory) {
      setFormCompanyId(factoryOwnCompany ? factoryOwnCompany.id : (userCompanyId || ""));
    } else {
      setFormCompanyId("center");
    }
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormLocation("");
    setFormDescription("");
    setFormIsVisibleOnDashboard(true);
    setFormImageUrl("");
    setSelectedImageFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsFormModalOpen(true);
  };

  // Open Edit Activity Modal
  const handleOpenEdit = (act: CourseActivity) => {
    if (!canManageActivity(act)) return;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setIsEditing(true);
    setFormId(act.id);
    setFormTitle(act.title);
    setFormCompanyId(act.companyId || (isFactory && factoryOwnCompany ? factoryOwnCompany.id : "center"));
    setFormIsVisibleOnDashboard(act.isVisibleOnDashboard !== false && act.status !== "ARCHIVED");
    setFormDate(act.date);
    setFormLocation(act.location || "");
    setFormDescription(act.description);
    setFormImageUrl(act.imageUrl || "");
    setSelectedImageFile(null);
    setPreviewUrl(act.imageUrl || "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsDetailModalOpen(false);
    setIsFormModalOpen(true);
  };

  // View Activity Detail Modal
  const handleViewDetail = (act: CourseActivity) => {
    setActiveActivity(act);
    setIsDetailModalOpen(true);
  };

  // Handle Image File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(isThai ? "กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)" : "Please select an image file only");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error(isThai ? "ขนาดไฟล์ต้องไม่เกิน 8MB ครับ" : "File size must not exceed 8MB");
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  // Handle Remove Selected Image
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

  // Submit Activity Form (Create / Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      await notice({
        missingFields: [isThai ? "หัวข้อกิจกรรม (Activity Title)" : "Activity Title"],
      });
      return;
    }
    if (!formDate) {
      await notice({
        missingFields: [isThai ? "วันที่จัดกิจกรรม (Activity Date)" : "Activity Date"],
      });
      return;
    }

    try {
      setIsSubmitting(true);
      let finalImageUrl = formImageUrl;

      if (selectedImageFile) {
        setIsUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append("file", selectedImageFile);

        const uploadRes = await fetch("/api/course-activities/upload", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "Failed to upload image");
        }

        const uploadResult = await uploadRes.json();
        finalImageUrl = uploadResult.imageUrl;
        setIsUploading(false);
      }

      const payload = {
        title: formTitle.trim(),
        date: formDate,
        location: formLocation.trim(),
        description: formDescription.trim(),
        imageUrl: finalImageUrl,
        isVisibleOnDashboard: formIsVisibleOnDashboard,
        status: formIsVisibleOnDashboard ? "PUBLISHED" : "ARCHIVED",
        companyId: formCompanyId || "center",
      };

      if (isEditing) {
        const res = await fetch("/api/course-activities", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: formId, ...payload }),
        });
        if (!res.ok) throw new Error("Failed to update activity");
        toast.success(isThai ? "แก้ไขกิจกรรมสำเร็จเรียบร้อย" : "Activity updated successfully");
      } else {
        const res = await fetch("/api/course-activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create activity");
        toast.success(isThai ? "เพิ่มกิจกรรมใหม่สำเร็จเรียบร้อย" : "Activity created successfully");
      }

      setIsFormModalOpen(false);
      await fetchActivities();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (isThai ? "เกิดข้อผิดพลาดในการบันทึกข้อมูล" : "Error saving activity"));
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  // Delete Activity
  const handleDelete = async (act: CourseActivity) => {
    if (!canManageActivity(act)) return;
    const confirmed = await confirm({
      message: {
        th: `คุณต้องการลบกิจกรรม "${act.title}" ใช่หรือไม่?`,
        en: `Are you sure you want to delete "${act.title}"?`,
      },
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/course-activities?id=${encodeURIComponent(act.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete activity");

      toast.success(isThai ? "ลบกิจกรรมเรียบร้อยแล้ว" : "Activity deleted successfully");
      if (activeActivity?.id === act.id) {
        setIsDetailModalOpen(false);
      }
      await fetchActivities();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (isThai ? "เกิดข้อผิดพลาดในการลบกิจกรรม" : "Failed to delete activity"));
    }
  };

  // Toggle Archive / Dashboard Display
  const handleToggleArchive = async (act: CourseActivity) => {
    if (!canManageActivity(act)) return;
    const isCurrentlyArchived = act.isVisibleOnDashboard === false || act.status === "ARCHIVED";
    const nextShow = isCurrentlyArchived;
    const actionText = nextShow
      ? (isThai ? "นำกลับมาแสดงบนหน้าแรก (Dashboard)" : "restore to Dashboard")
      : (isThai ? "จัดเก็บและซ่อนออกจากหน้าแรก (Dashboard)" : "archive (hide from Dashboard)");

    const confirmed = await confirm({
      message: {
        th: `คุณต้องการ${actionText}สำหรับกิจกรรม "${act.title}" ใช่หรือไม่?`,
        en: `Are you sure you want to ${actionText} "${act.title}"?`,
      },
    });
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/course-activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: act.id,
          isVisibleOnDashboard: nextShow,
          status: nextShow ? "PUBLISHED" : "ARCHIVED",
        }),
      });

      if (res.ok) {
        toast.success(
          nextShow
            ? (isThai ? "นำกิจกรรมกลับมาแสดงบนหน้าแรกเรียบร้อยแล้ว" : "Activity restored to dashboard")
            : (isThai ? "จัดเก็บกิจกรรมเรียบร้อยแล้ว (ไม่แสดงบน Dashboard)" : "Activity archived")
        );
        if (activeActivity?.id === act.id) {
          setActiveActivity((prev) => prev ? { ...prev, isVisibleOnDashboard: nextShow, status: nextShow ? "PUBLISHED" : "ARCHIVED" } : null);
        }
        await fetchActivities();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || (isThai ? "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ" : "Failed to change status"));
      }
    } catch {
      toast.error(isThai ? "เกิดข้อผิดพลาดในการเชื่อมต่อ" : "Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.page} aria-label="New Activities Report">
      {/* 1. Hero Header Banner with KPI Stat Cards */}
      <header className={styles.heroHeader}>
        <div className={styles.heroTopRow}>
          <div className={styles.heroTitleGroup}>
            <div className={styles.heroBadgeRow}>
              <span className={styles.heroTag}>NEWS & HIGHLIGHTS</span>
              <span className={styles.scopeBadge}>
                {isEmployee
                  ? (isThai ? "สิทธิ์มุมมองพนักงาน (Employee View)" : "Employee View")
                  : (isThai ? "ผู้ดูแลระบบ (HR & Center Admin)" : "Administrator")}
              </span>
            </div>
            <h1 className={styles.heroTitle}>
              {isThai ? "ภาพข่าวกิจกรรมและการอบรม (New Activities)" : "New Activities & News Feed"}
            </h1>
            <p className={styles.heroDesc}>
              {isThai
                ? "ศูนย์รวมการรายงานกิจกรรมการอบรม กิจกรรม CSR และข่าวสารประชาสัมพันธ์ของทุกบริษัทในเครือ พร้อมระบบค้นหาและรายงานผล"
                : "Comprehensive report of corporate training events, CSR highlights, and announcements across entities."}
            </p>
          </div>

          <div className={styles.heroActions}>
            {!isEmployee && (
              <button
                type="button"
                className={styles.addBtnPrimary}
                onClick={handleOpenAdd}
                title={isThai ? "สร้างกิจกรรมใหม่" : "Add New Activity"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{isThai ? "เพิ่มกิจกรรมใหม่" : "Add Activity"}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 KPI Quick Summary Stat Cards */}
        <div className={styles.kpiStatsGrid}>
          <article className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ color: "#007a3d" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div className={styles.kpiMeta}>
              <span className={styles.kpiLabel}>{isThai ? "กิจกรรมทั้งหมด" : "Total Activities"}</span>
              <div className={styles.kpiValueRow}>
                <strong className={styles.kpiValue}>{kpiStats.total}</strong>
                <span className={styles.kpiUnit}>{isThai ? "รายการ" : "items"}</span>
              </div>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ color: "#2563eb" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
            <div className={styles.kpiMeta}>
              <span className={styles.kpiLabel}>{isThai ? "กิจกรรมส่วนกลาง (Center)" : "Center Activities"}</span>
              <div className={styles.kpiValueRow}>
                <strong className={styles.kpiValue}>{kpiStats.centerCount}</strong>
                <span className={styles.kpiUnit}>{isThai ? "รายการ" : "items"}</span>
              </div>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ color: "#d97706" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg></div>
            <div className={styles.kpiMeta}>
              <span className={styles.kpiLabel}>{isThai ? "กิจกรรมโรงงาน / บริษัท" : "Company Activities"}</span>
              <div className={styles.kpiValueRow}>
                <strong className={styles.kpiValue}>{kpiStats.companyCount}</strong>
                <span className={styles.kpiUnit}>{isThai ? "รายการ" : "items"}</span>
              </div>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ color: "#8b5cf6" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
            <div className={styles.kpiMeta}>
              <span className={styles.kpiLabel}>{isThai ? `กิจกรรมปีนี้ (${currentYear})` : `This Year (${currentYear})`}</span>
              <div className={styles.kpiValueRow}>
                <strong className={styles.kpiValue}>{kpiStats.thisYearCount}</strong>
                <span className={styles.kpiUnit}>{isThai ? "รายการ" : "items"}</span>
              </div>
            </div>
          </article>
        </div>
      </header>

      {/* 2. Interactive Filter & Search Bar */}
      <div className={styles.filterBar}>
        {/* Tier 1: Search + Year Pills + View Mode */}
        <div className={styles.filterTopRow}>
          {/* Search Box */}
          <div className={styles.searchBox}>
            <span className={styles.searchIconWrapper} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={isThai ? "ค้นหากิจกรรม, สถานที่ หรือรายละเอียด..." : "Search activities, location, or details..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchTerm("")}
                title={isThai ? "ล้างข้อความค้นหา" : "Clear search"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Right Controls: Year Filter + View Mode Switcher */}
          <div className={styles.topRightControls}>
            {/* Year Filter Pills */}
            <div className={styles.yearPillsGroup}>
              <span className={styles.filterSectionLabel}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{isThai ? "ปี:" : "Year:"}</span>
              </span>
              <div className={styles.yearPillsRow}>
                <button
                  type="button"
                  className={`${styles.yearPillBtn} ${selectedYear === "all" ? styles.yearPillBtnActive : ""}`}
                  onClick={() => setSelectedYear("all")}
                >
                  {isThai ? "ทุกปี" : "All"}
                </button>
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    className={`${styles.yearPillBtn} ${selectedYear === yr ? styles.yearPillBtnActive : ""}`}
                    onClick={() => setSelectedYear(yr)}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter Pills */}
            <div className={styles.yearPillsGroup}>
              <span className={styles.filterSectionLabel}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{isThai ? "สถานะ:" : "Status:"}</span>
              </span>
              <div className={styles.yearPillsRow}>
                <button
                  type="button"
                  className={`${styles.yearPillBtn} ${selectedStatus === "all" ? styles.yearPillBtnActive : ""}`}
                  onClick={() => setSelectedStatus("all")}
                >
                  {isThai ? "ทั้งหมด" : "All"}
                </button>
                <button
                  type="button"
                  className={`${styles.yearPillBtn} ${selectedStatus === "active" ? styles.yearPillBtnActive : ""}`}
                  onClick={() => setSelectedStatus("active")}
                >
                  {isThai ? "แสดงบนหน้าแรก" : "Active"}
                </button>
                <button
                  type="button"
                  className={`${styles.yearPillBtn} ${selectedStatus === "archived" ? styles.yearPillBtnActive : ""}`}
                  onClick={() => setSelectedStatus("archived")}
                >
                  {isThai ? "จัดเก็บแล้ว" : "Archived"}
                </button>
              </div>
            </div>

            <div className={styles.controlDivider} aria-hidden="true" />

            {/* View Mode Switcher (Grid vs Table) */}
            <div className={styles.viewModeToggle}>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.viewModeBtnActive : ""}`}
                onClick={() => setViewMode("grid")}
                title={isThai ? "แสดงแบบการ์ด (Grid)" : "Grid View"}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                <span>{isThai ? "การ์ด" : "Cards"}</span>
              </button>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === "table" ? styles.viewModeBtnActive : ""}`}
                onClick={() => setViewMode("table")}
                title={isThai ? "แสดงแบบตารางรายงาน (Table)" : "Table View"}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span>{isThai ? "ตาราง" : "Table"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tier 2: Company Filter Selector Bar */}
        <div className={styles.companyFilterSection}>
          <div className={styles.companyFilterHeader}>
            <span className={styles.companyFilterIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" />
                <path d="M16 6h.01" />
                <path d="M8 10h.01" />
                <path d="M16 10h.01" />
                <path d="M8 14h.01" />
                <path d="M16 14h.01" />
              </svg>
            </span>
            <span className={styles.companyFilterText}>
              {isThai ? "บริษัท:" : "Company:"}
            </span>
          </div>

          <div className={styles.companyPillsRow}>
            <button
              type="button"
              className={`${styles.companyPillBtn} ${selectedCompany === "all" ? styles.companyPillBtnActive : ""}`}
              onClick={() => handleCompanyChange("all")}
              title={isThai ? "ดูกิจกรรมทุกบริษัท" : "All Companies"}
            >
              <span>
                {isCompanyScoped
                  ? (isThai ? "ทั้งหมด (All)" : "All")
                  : (isThai ? "ทุกบริษัท (All)" : "All")}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.companyPillBtn} ${selectedCompany === "center" ? styles.companyPillBtnActive : ""}`}
              onClick={() => handleCompanyChange("center")}
              title={isThai ? "กิจกรรมส่วนกลาง (Center)" : "Center"}
            >
              <span>Center</span>
            </button>

            {availableCompanies
              .filter((c) => c.id !== "center")
              .map((c) => {
                const isActive = selectedCompany === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.companyPillBtn} ${isActive ? styles.companyPillBtnActive : ""}`}
                    onClick={() => handleCompanyChange(c.id)}
                    title={c.name}
                  >
                    <span>{c.code}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* 3. Content Display */}
      {isLoading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconCircle}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>{isThai ? "กำลังโหลดข้อมูล..." : "Loading activities..."}</h3>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconCircle}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>{isThai ? "ไม่พบข้อมูลกิจกรรม" : "No activities found"}</h3>
          <p className={styles.emptyDesc}>
            {searchTerm
              ? (isThai ? `ไม่พบกิจกรรมที่ตรงกับคำค้นหา "${searchTerm}"` : `No activities match "${searchTerm}"`)
              : (isThai ? "ยังไม่มีกิจกรรมในเงื่อนไขที่เลือก" : "No activities match the selected filters")}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* 4. Grid View (Gallery Cards) */
        <div className={styles.galleryGrid}>
          {filteredActivities.map((act) => (
            <article key={act.id} className={styles.activityCard}>
              <div className={styles.cardMediaBox} onClick={() => handleViewDetail(act)} style={{ cursor: "pointer" }}>
                {act.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={act.imageUrl}
                    alt={act.title}
                    className={styles.cardImage}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className={styles.noImagePlaceholder}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardMetaRow}>
                  <div className={styles.cardDate}>
                    <span>{act.formattedDate || act.date}</span>
                    {(act.isVisibleOnDashboard === false || act.status === "ARCHIVED") && (
                      <span className={styles.cardArchivedBadge}>
                        {isThai ? "จัดเก็บแล้ว" : "Archived"}
                      </span>
                    )}
                  </div>
                  <span
                    className={`${styles.companyBadge} ${styles[`companyBadge_${act.companyCode}`] || styles.companyBadge_CENTER}`}
                    title={act.companyName || act.companyCode}
                  >
                    {act.companyCode === "CENTER" ? (isThai ? "ส่วนกลาง" : "Center") : act.companyCode}
                  </span>
                </div>

                <h3 className={styles.cardTitle} onClick={() => handleViewDetail(act)} style={{ cursor: "pointer" }}>
                  {act.title}
                </h3>
                <p className={styles.cardDesc}>{act.description}</p>

                <div className={styles.cardFooter}>
                  {act.location ? (
                    <span className={styles.cardLocation} title={act.location}>
                      {act.location}
                    </span>
                  ) : (
                    <div />
                  )}

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.detailBtn}
                      onClick={() => handleViewDetail(act)}
                      title={isThai ? "ดูรายละเอียด" : "View details"}
                    >
                      <span>{isThai ? "รายละเอียด" : "Details"}</span>
                    </button>

                    {canManageActivity(act) && (
                      <>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${act.isVisibleOnDashboard === false || act.status === "ARCHIVED" ? styles.iconBtnRestore : styles.iconBtnArchive}`}
                          onClick={() => handleToggleArchive(act)}
                          title={
                            act.isVisibleOnDashboard === false || act.status === "ARCHIVED"
                              ? (isThai ? "ยกเลิกจัดเก็บ (แสดงบนหน้าแรก)" : "Restore to Dashboard")
                              : (isThai ? "จัดเก็บกิจกรรม (ซ่อนจากหน้าแรก)" : "Archive activity")
                          }
                        >
                          {act.isVisibleOnDashboard === false || act.status === "ARCHIVED" ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="3" width="20" height="5" rx="1" />
                              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                              <path d="M12 16v-5" />
                              <path d="M9.5 13.5L12 11l2.5 2.5" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="3" width="20" height="5" rx="1" />
                              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                              <path d="M12 11v5" />
                              <path d="M9.5 13.5L12 16l2.5-2.5" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnEdit}`}
                          onClick={() => handleOpenEdit(act)}
                          title={isThai ? "แก้ไข" : "Edit"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDelete}`}
                          onClick={() => handleDelete(act)}
                          title={isThai ? "ลบ" : "Delete"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* 5. Table / List Report View */
        <div className={styles.tableContainer}>
          <div className={styles.tableWrapper}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th style={{ width: "45px", textAlign: "center" }}>#</th>
                  <th style={{ width: "70px" }}>{isThai ? "รูปภาพ" : "Photo"}</th>
                  <th style={{ width: "120px" }}>{isThai ? "วันที่จัด" : "Date"}</th>
                  <th style={{ width: "100px" }}>{isThai ? "บริษัท" : "Company"}</th>
                  <th style={{ width: "115px" }}>{isThai ? "สถานะ" : "Status"}</th>
                  <th>{isThai ? "ชื่อกิจกรรม" : "Activity Title"}</th>
                  <th style={{ width: "160px" }}>{isThai ? "สถานที่" : "Location"}</th>
                  <th>{isThai ? "รายละเอียด" : "Description"}</th>
                  <th style={{ width: "160px", textAlign: "center" }}>{isThai ? "การจัดการ" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((act, index) => (
                  <tr key={act.id}>
                    <td style={{ textAlign: "center", color: "var(--ui-30-muted)", fontWeight: 700 }}>
                      {index + 1}
                    </td>
                    <td>
                      {act.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={act.imageUrl}
                          alt={act.title}
                          className={styles.tableThumb}
                          onClick={() => handleViewDetail(act)}
                          style={{ cursor: "pointer" }}
                        />
                      ) : (
                        <div className={styles.tableThumbPlaceholder}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                      {act.formattedDate || act.date}
                    </td>
                    <td>
                      <span
                        className={`${styles.companyBadge} ${styles[`companyBadge_${act.companyCode}`] || styles.companyBadge_CENTER}`}
                      >
                        {act.companyCode === "CENTER" ? (isThai ? "ส่วนกลาง" : "Center") : act.companyCode}
                      </span>
                    </td>
                    <td>
                      {act.isVisibleOnDashboard === false || act.status === "ARCHIVED" ? (
                        <span className={styles.tableArchivedBadge}>
                          {isThai ? "จัดเก็บแล้ว" : "Archived"}
                        </span>
                      ) : (
                        <span className={styles.tableActiveBadge}>
                          {isThai ? "แสดงบนหน้าแรก" : "Active"}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      <span
                        onClick={() => handleViewDetail(act)}
                        style={{ cursor: "pointer", color: "var(--ui-30-ink)" }}
                      >
                        {act.title}
                      </span>
                    </td>
                    <td style={{ color: "var(--ui-30-muted)" }}>
                      {act.location ? `${act.location}` : "-"}
                    </td>
                    <td style={{ color: "var(--ui-30-muted)", maxWidth: "260px" }}>
                      <span
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {act.description}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => handleViewDetail(act)}
                          title={isThai ? "ดูรายละเอียด" : "View details"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        {canManageActivity(act) && (
                          <>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${act.isVisibleOnDashboard === false || act.status === "ARCHIVED" ? styles.iconBtnRestore : styles.iconBtnArchive}`}
                              onClick={() => handleToggleArchive(act)}
                              title={
                                act.isVisibleOnDashboard === false || act.status === "ARCHIVED"
                                  ? (isThai ? "ยกเลิกจัดเก็บ (แสดงบนหน้าแรก)" : "Restore to Dashboard")
                                  : (isThai ? "จัดเก็บกิจกรรม (ซ่อนจากหน้าแรก)" : "Archive activity")
                              }
                            >
                              {act.isVisibleOnDashboard === false || act.status === "ARCHIVED" ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="3" width="20" height="5" rx="1" />
                                  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                                  <path d="M12 16v-5" />
                                  <path d="M9.5 13.5L12 11l2.5 2.5" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="3" width="20" height="5" rx="1" />
                                  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                                  <path d="M12 11v5" />
                                  <path d="M9.5 13.5L12 16l2.5-2.5" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnEdit}`}
                              onClick={() => handleOpenEdit(act)}
                              title={isThai ? "แก้ไข" : "Edit"}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnDelete}`}
                              onClick={() => handleDelete(act)}
                              title={isThai ? "ลบ" : "Delete"}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Modal: Activity Detail Dialog */}
      {isDetailModalOpen && activeActivity && (
        <div className={styles.modalOverlay} onClick={() => setIsDetailModalOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.detailMetaRow}>
                <span
                  className={`${styles.companyBadge} ${styles[`companyBadge_${activeActivity.companyCode}`] || styles.companyBadge_CENTER}`}
                >
                  {activeActivity.companyName || activeActivity.companyCode}
                </span>
                {activeActivity.isVisibleOnDashboard === false || activeActivity.status === "ARCHIVED" ? (
                  <span className={styles.tableArchivedBadge}>
                    {isThai ? "จัดเก็บแล้ว (ซ่อนจากหน้าแรก)" : "Archived"}
                  </span>
                ) : (
                  <span className={styles.tableActiveBadge}>
                    {isThai ? "แสดงบนหน้าแรก (Dashboard)" : "Active on Dashboard"}
                  </span>
                )}
                <span style={{ fontSize: "0.85rem", color: "var(--ui-30-muted)", fontWeight: 600 }}>
                  {activeActivity.formattedDate || activeActivity.date}
                </span>
                {activeActivity.location && (
                  <span style={{ fontSize: "0.85rem", color: "var(--ui-30-muted)", fontWeight: 600 }}>
                    {activeActivity.location}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsDetailModalOpen(false)}
              >
                
              </button>
            </div>

            <div className={styles.modalBody}>
              {activeActivity.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeActivity.imageUrl}
                  alt={activeActivity.title}
                  className={styles.detailImageBanner}
                />
              ) : null}

              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, margin: 0, color: "var(--ui-30-ink)" }}>
                {activeActivity.title}
              </h2>

              <div className={styles.detailDescription}>
                {activeActivity.description}
              </div>
            </div>

            <div className={styles.modalFooter}>
              {canManageActivity(activeActivity) && (
                <>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => handleOpenEdit(activeActivity)}
                  >
                    {isThai ? "แก้ไขกิจกรรม" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => handleToggleArchive(activeActivity)}
                  >
                    {activeActivity.isVisibleOnDashboard === false || activeActivity.status === "ARCHIVED"
                      ? (isThai ? "นำกลับมาแสดงบนหน้าแรก" : "Restore to Dashboard")
                      : (isThai ? "จัดเก็บ (ซ่อนจากหน้าแรก)" : "Archive Activity")}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                    onClick={() => handleDelete(activeActivity)}
                  >
                    {isThai ? "ลบกิจกรรม" : "Delete"}
                  </button>
                </>
              )}
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => setIsDetailModalOpen(false)}
              >
                {isThai ? "ปิดหน้าต่าง" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Add / Edit Activity Dialog */}
      {isFormModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsFormModalOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>
                {isEditing
                  ? (isThai ? "แก้ไขกิจกรรมการอบรม" : "Edit Course Activity")
                  : (isThai ? "เพิ่มกิจกรรมการอบรมใหม่" : "Add New Course Activity")}
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsFormModalOpen(false)}
              >
                
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className={styles.modalBody}>
                {/* Title */}
                <div className={styles.formField}>
                  <label>{isThai ? "หัวข้อกิจกรรม *" : "Activity Title *"}</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder={isThai ? "เช่น กิจกรรม Big Cleaning Day 2026" : "e.g. Safety Training 2026"}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                {/* Company & Date */}
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label>{isThai ? "บริษัท / หน่วยงาน *" : "Company *"}</label>
                    {isFactory ? (
                      <div className={styles.lockedCompanyBox}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span className={styles.lockedCompanyName}>
                          {factoryOwnCompany?.name || userCompanyCode || (isThai ? "สังกัดของท่าน" : "Your Company")}
                        </span>
                        <span className={styles.lockedCompanyBadge}>
                          {isThai ? "บริษัทของคุณ (ล็อกอัตโนมัติ)" : "Assigned (Locked)"}
                        </span>
                      </div>
                    ) : (
                      <select
                        className={styles.formSelect}
                        value={formCompanyId}
                        onChange={(e) => setFormCompanyId(e.target.value)}
                        required
                      >
                        <option value="center">{isThai ? "Center (ส่วนกลาง)" : "Center"}</option>
                        {availableCompanies
                          .filter((c) => c.id !== "center")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name || c.code}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  <div className={styles.formField}>
                    <label>{isThai ? "วันที่จัดกิจกรรม *" : "Activity Date *"}</label>
                    <input
                      type="date"
                      required
                      className={styles.formInput}
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Location */}
                <div className={styles.formField}>
                  <label>{isThai ? "สถานที่จัดกิจกรรม" : "Location"}</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder={isThai ? "เช่น ห้องประชุมใหญ่ อาคาร 2 หรือ โรงงาน ATA" : "e.g. Main Auditorium or ATA Plant"}
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className={styles.formField}>
                  <label>{isThai ? "รายละเอียดกิจกรรม" : "Description"}</label>
                  <textarea
                    rows={4}
                    className={styles.formTextarea}
                    placeholder={isThai ? "ระบุรายละเอียดกิจกรรมหรือเนื้อหาการฝึกอบรม..." : "Enter details about the event..."}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {/* Image Upload */}
                <div className={styles.formField}>
                  <label>{isThai ? "รูปภาพกิจกรรม (อัปโหลดไฟล์ หรือใส่ URL)" : "Activity Photo"}</label>
                  
                  {previewUrl ? (
                    <div style={{ position: "relative", marginBottom: "8px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Preview"
                        style={{ width: "100%", maxHeight: "240px", objectFit: "cover", borderRadius: "10px" }}
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          background: "rgba(239, 68, 68, 0.9)",
                          color: "#ffffff",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                        }}
                      >
                        {isThai ? "ลบรูปภาพ" : "Remove"}
                      </button>
                    </div>
                  ) : null}

                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept="image/*"
                    onChange={handleFileChange}
                  />

                  <div
                    className={styles.fileDropZone}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>{isThai ? "คลิกเพื่อเลือกไฟล์รูปภาพ (JPG, PNG, WebP สูงสุด 8MB)" : "Click to select photo (max 8MB)"}</span>
                  </div>
                </div>

                {/* Visibility on Dashboard Toggle */}
                <div className={`${styles.visibilityToggleCard} ${formIsVisibleOnDashboard ? styles.visibilityToggleCardActive : styles.visibilityToggleCardArchived}`}>
                  <label className={styles.visibilityCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={formIsVisibleOnDashboard}
                      onChange={(e) => setFormIsVisibleOnDashboard(e.target.checked)}
                      className={styles.visibilityCheckbox}
                    />
                    <div className={styles.visibilityTextGroup}>
                      <div className={styles.visibilityHeaderRow}>
                        <span className={styles.visibilityTitle}>
                          {isThai ? "แสดงบนหน้าแรก (Dashboard)" : "Display on Dashboard"}
                        </span>
                        <span className={formIsVisibleOnDashboard ? styles.statusActiveBadge : styles.statusArchivedBadge}>
                          {formIsVisibleOnDashboard
                            ? (isThai ? "เปิดแสดงบนหน้าแรก" : "Active on Dashboard")
                            : (isThai ? "จัดเก็บ (ไม่แสดงบนหน้าแรก)" : "Archived / Hidden")}
                        </span>
                      </div>
                      <span className={styles.visibilitySubtitle}>
                        {formIsVisibleOnDashboard
                          ? (isThai
                              ? "กิจกรรมนี้จะเปิดแสดงในภาพสไลด์และรายการบนหน้าแรกของระบบ"
                              : "This activity will be visible in the carousel and cards on the dashboard")
                          : (isThai
                              ? "กิจกรรมนี้จะถูกจัดเก็บและซ่อนออกจากหน้าแรก (ยังคงดู ตรวจสอบ และนำกลับมาแสดงใหม่ได้ในหน้ารายงานกิจกรรม)"
                              : "This activity is archived and hidden from the dashboard. It remains accessible in the Activity Report.")}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsFormModalOpen(false)}
                >
                  {isThai ? "ยกเลิก" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className={styles.submitBtn}
                >
                  {isSubmitting
                    ? (isThai ? "กำลังบันทึก..." : "Saving...")
                    : isEditing
                    ? (isThai ? "บันทึกการแก้ไข" : "Save Changes")
                    : (isThai ? "สร้างกิจกรรม" : "Create Activity")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
