"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import type { ReportModuleProps } from "./index";
import styles from "./NewActivitiesReport.module.css";
import { ActivityFormModal, AddActivityButton } from "../../NewActivities/components";

export const newActivitiesReportModule = {
  title: "New Activities",
  titleTh: "ภาพข่าวกิจกรรม (New Activities)",
  subtitle: "Company news, training events & CSR activities",
  subtitleTh: "ข่าวสารบริษัท กิจกรรมฝึกอบรม และกิจกรรม CSR",
  description:
    "Browse, search, and analyze all training activities, CSR highlights, and company announcements with rich gallery and tabular reporting.",
  descriptionTh:
    "เรียกดู ค้นหา และวิเคราะห์กิจกรรมการฝึกอบรม ข่าวสารประชาสัมพันธ์ และกิจกรรมเพื่อสังคม (CSR) พร้อมแกลเลอรีรูปภาพและตารางรายงานสรุป",
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
  showOnLoginPage?: boolean;
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
  const [activeActivity, setActiveActivity] = useState<CourseActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<CourseActivity | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "archived">("all");

  // Lightbox & Multi-Image Gallery states
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxHovered, setIsLightboxHovered] = useState<boolean>(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState<boolean>(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number>(0);

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

  // Filtered activities based on search, status, and dropdown selections (sorted chronologically by date descending)
  const filteredActivities = useMemo(() => {
    return visibleActivities
      .filter((act) => {
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
      })
      .sort((a, b) => {
        // 1. Primary: Activity date descending (newest date first: 2026-09-14 before 2026-09-11)
        const dateStrA = a.date || (a.createdAt ? a.createdAt.slice(0, 10) : "");
        const dateStrB = b.date || (b.createdAt ? b.createdAt.slice(0, 10) : "");
        const dateCmp = dateStrB.localeCompare(dateStrA);
        if (dateCmp !== 0) return dateCmp;

        // 2. Secondary: Creation timestamp descending
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdB !== createdA) return createdB - createdA;

        return Number(b.id) - Number(a.id);
      });
  }, [visibleActivities, selectedStatus, selectedYear, selectedCompany, searchTerm]);

  // Open Edit Activity Modal
  const handleOpenEdit = (act: CourseActivity) => {
    if (!canManageActivity(act)) return;
    setEditingActivity(act);
    setIsEditModalOpen(true);
    setIsDetailModalOpen(false);
  };

  // View Activity Detail Modal
  const handleViewDetail = (act: CourseActivity) => {
    setActiveActivity(act);
    setLightboxIndex(0);
    setIsLightboxHovered(false);
    setIsFullscreenOpen(false);
    setFullscreenIndex(0);
    setIsDetailModalOpen(true);
  };

  // Detail modal lightbox 5-second auto-advance (pauses on hover or manual interaction)
  useEffect(() => {
    if (!isDetailModalOpen || !activeActivity || isLightboxHovered) return;
    const currentImages = activeActivity.images && activeActivity.images.length > 0
      ? activeActivity.images
      : activeActivity.imageUrl ? [activeActivity.imageUrl] : [];
    if (currentImages.length <= 1) return;

    const timer = setInterval(() => {
      setLightboxIndex((prev) => (prev + 1) % currentImages.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isDetailModalOpen, activeActivity, isLightboxHovered, lightboxIndex]);

  // Keyboard navigation for lightbox and fullscreen view
  useEffect(() => {
    if (!isDetailModalOpen && !isFullscreenOpen) return;
    const currentImages = activeActivity?.images && activeActivity.images.length > 0
      ? activeActivity.images
      : activeActivity?.imageUrl ? [activeActivity.imageUrl] : [];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreenOpen) {
          setIsFullscreenOpen(false);
        } else if (isDetailModalOpen) {
          setIsDetailModalOpen(false);
        }
        return;
      }

      if (currentImages.length <= 1) return;

      if (e.key === "ArrowLeft") {
        if (isFullscreenOpen) {
          setFullscreenIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
        } else {
          setLightboxIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
        }
      } else if (e.key === "ArrowRight") {
        if (isFullscreenOpen) {
          setFullscreenIndex((prev) => (prev + 1) % currentImages.length);
        } else {
          setLightboxIndex((prev) => (prev + 1) % currentImages.length);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailModalOpen, isFullscreenOpen, activeActivity]);

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
            <h1 className={styles.heroTitle} translate="no">
              New Activities & News Feed
            </h1>
            <p className={styles.heroDesc}>
              {isThai
                ? "ศูนย์รวมการรายงานกิจกรรมการอบรม กิจกรรม CSR และข่าวสารประชาสัมพันธ์ของทุกบริษัทในเครือ พร้อมระบบค้นหาและรายงานผล"
                : "Comprehensive report of corporate training events, CSR highlights, and announcements across entities."}
            </p>
          </div>

          <div className={styles.heroActions}>
            {!isEmployee && (
              <AddActivityButton
                isThai={isThai}
                onSuccess={fetchActivities}
              />
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
                {act.images && act.images.length > 1 && (
                  <span className={styles.photoCountBadge} title={`${act.images.length} ${isThai ? "รูป" : "photos"}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>{act.images.length} {isThai ? "รูป" : "photos"}</span>
                  </span>
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
                      <div style={{ position: "relative", display: "inline-block" }}>
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
                        {act.images && act.images.length > 1 && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: -2,
                              right: -2,
                              background: "#0284c7",
                              color: "#ffffff",
                              fontSize: "0.62rem",
                              fontWeight: 800,
                              padding: "1px 5px",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                              pointerEvents: "none",
                            }}
                          >
                            +{act.images.length}
                          </span>
                        )}
                      </div>
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
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {(() => {
              const currentImages = activeActivity.images && activeActivity.images.length > 0
                ? activeActivity.images
                : activeActivity.imageUrl ? [activeActivity.imageUrl] : [];
              const safeIdx = Math.min(lightboxIndex, Math.max(0, currentImages.length - 1));

              return (
                <div className={styles.modalBody}>
                  {/* Multi-Image Lightbox Gallery */}
                  {currentImages.length > 0 ? (
                    <div
                      className={styles.lightboxGalleryContainer}
                      onMouseEnter={() => setIsLightboxHovered(true)}
                      onMouseLeave={() => setIsLightboxHovered(false)}
                    >
                      <div
                        className={styles.lightboxMainStage}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setFullscreenIndex(safeIdx);
                          setIsFullscreenOpen(true);
                        }}
                        title={isThai ? "คลิกเพื่อดูรูปภาพขนาดเต็ม" : "Click to view full image"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentImages[safeIdx]}
                          alt={`${activeActivity.title} - ${safeIdx + 1}`}
                          className={styles.lightboxMainImg}
                        />

                        <span className={styles.zoomHintBadge}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                          {isThai ? "คลิกดูรูปใหญ่" : "Click to enlarge"}
                        </span>

                        {currentImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              className={`${styles.lightboxNavBtn} ${styles.lightboxNavPrev}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
                              }}
                              aria-label="Previous photo"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className={`${styles.lightboxNavBtn} ${styles.lightboxNavNext}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex((prev) => (prev + 1) % currentImages.length);
                              }}
                              aria-label="Next photo"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </button>
                            <span className={styles.lightboxCounter}>
                              {safeIdx + 1} / {currentImages.length}
                            </span>
                          </>
                        )}
                      </div>

                      {currentImages.length > 1 && (
                        <div className={styles.lightboxThumbStrip}>
                          {currentImages.map((img, idx) => (
                            <button
                              key={`${img}-${idx}`}
                              type="button"
                              className={`${styles.lightboxThumbBtn} ${safeIdx === idx ? styles.lightboxThumbBtnActive : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex(idx);
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={`Thumb ${idx + 1}`} className={styles.lightboxThumbImg} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <h2 style={{ fontSize: "1.35rem", fontWeight: 900, margin: 0, color: "var(--ui-30-ink)" }}>
                    {activeActivity.title}
                  </h2>

              <div className={styles.detailDescription}>
                {activeActivity.description}
              </div>
            </div>
            );
          })()}

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

      {/* 7. Modal: Edit Activity Dialog (Shared) */}
      <ActivityFormModal
        isOpen={isEditModalOpen}
        activityToEdit={editingActivity}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingActivity(null);
        }}
        onSuccess={async () => {
          setIsEditModalOpen(false);
          setEditingActivity(null);
          await fetchActivities();
        }}
        isThai={isThai}
      />

      {/* Fullscreen Image Lightbox Modal */}
      {isFullscreenOpen && activeActivity && (() => {
        const currentImages = activeActivity.images && activeActivity.images.length > 0
          ? activeActivity.images
          : activeActivity.imageUrl ? [activeActivity.imageUrl] : [];
        const safeFsIdx = Math.min(fullscreenIndex, Math.max(0, currentImages.length - 1));

        if (currentImages.length === 0 || typeof document === "undefined") return null;

        return createPortal(
          <div
            className={styles.fullscreenLightboxOverlay}
            onClick={() => {
              setLightboxIndex(safeFsIdx);
              setIsFullscreenOpen(false);
            }}
          >
            <div
              className={styles.fullscreenLightboxHeader}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.fullscreenLightboxTitle}>
                {activeActivity.title}
              </div>
              <div className={styles.fullscreenLightboxControls}>
                <span className={styles.fullscreenLightboxCounter}>
                  {safeFsIdx + 1} / {currentImages.length}
                </span>
                <button
                  type="button"
                  className={styles.fullscreenLightboxCloseBtn}
                  onClick={() => {
                    setLightboxIndex(safeFsIdx);
                    setIsFullscreenOpen(false);
                  }}
                  aria-label="Close"
                  title={isThai ? "ปิด (Esc)" : "Close (Esc)"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              className={styles.fullscreenLightboxStage}
              onClick={(e) => e.stopPropagation()}
            >
              {currentImages.length > 1 && (
                <button
                  type="button"
                  className={`${styles.fullscreenLightboxNavBtn} ${styles.fullscreenLightboxNavPrev}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
                  }}
                  aria-label="Previous photo"
                  title={isThai ? "รูปก่อนหน้า (ลูกศรซ้าย)" : "Previous photo (Left arrow)"}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImages[safeFsIdx]}
                alt={`${activeActivity.title} - ${safeFsIdx + 1}`}
                className={styles.fullscreenLightboxImg}
                onClick={(e) => e.stopPropagation()}
              />

              {currentImages.length > 1 && (
                <button
                  type="button"
                  className={`${styles.fullscreenLightboxNavBtn} ${styles.fullscreenLightboxNavNext}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenIndex((prev) => (prev + 1) % currentImages.length);
                  }}
                  aria-label="Next photo"
                  title={isThai ? "รูปถัดไป (ลูกศรขวา)" : "Next photo (Right arrow)"}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>

            {currentImages.length > 1 && (
              <div
                className={styles.fullscreenLightboxThumbStrip}
                onClick={(e) => e.stopPropagation()}
              >
                {currentImages.map((img, idx) => (
                  <button
                    key={`fs-thumb-${img}-${idx}`}
                    type="button"
                    className={`${styles.fullscreenLightboxThumbBtn} ${safeFsIdx === idx ? styles.fullscreenLightboxThumbBtnActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullscreenIndex(idx);
                    }}
                    title={`Photo ${idx + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Thumb ${idx + 1}`} className={styles.fullscreenLightboxThumbImg} />
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body
        );
      })()}

    </section>
  );
}
