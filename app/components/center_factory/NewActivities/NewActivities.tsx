"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useConfirm } from "../../ConfirmDialog";
import { useNotice } from "../../NoticeDialog";
import { useToast } from "../../ToastHost";
import { useUiLanguage } from "../../ThaiUiLocalization";
import type { CourseActivity, CompanyOption } from "../../../api/course-activities/route";
import { createEnrollment, listEnrollments, updateEnrollmentStatus } from "../../../lib/trainingEnrollment/client";
import { ACTIVE_ENROLLMENT_STATUSES, type EnrollmentRecord } from "../../../lib/trainingEnrollment/types";
import { loadWorkflowRollingPlans, type RollingPlan } from "../TrainingPlanManagement/modules/TrainingRolling";
import { isCourseDateOrTimeEnded } from "../../../lib/calendarDate";
import styles from "./NewActivities.module.css";

interface NewActivitiesProps {
  isThai?: boolean;
  readOnly?: boolean;
  onOpenModule?: () => void;
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

export default function NewActivities({
  isThai: propIsThai,
  readOnly = false,
  onOpenModule,
}: NewActivitiesProps) {
  const { language } = useUiLanguage();
  const isThai = propIsThai !== undefined ? propIsThai : language === "th";
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();

  const router = useRouter();
  const authenticatedUser = useAuthenticatedUser();
  const isCenterOrAdmin = authenticatedUser?.roleCode === "HRD_CENTER" || authenticatedUser?.roleCode === "ADMIN";
  const isFactory = authenticatedUser?.roleCode === "HRD_FACTORY";
  const isHrd = isCenterOrAdmin || isFactory;
  const isEmployee = readOnly || authenticatedUser?.roleCode === "EMPLOYEE";
  const isCompanyScoped = isFactory || isEmployee;
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
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [activeActivity, setActiveActivity] = useState<CourseActivity | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxHovered, setIsLightboxHovered] = useState<boolean>(false);
  const [cardImageTick, setCardImageTick] = useState<number>(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const detailModalDialogRef = useRef<HTMLDivElement>(null);
  const detailModalBodyRef = useRef<HTMLDivElement>(null);

  // Form input states
  const [formId, setFormId] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formCompanyId, setFormCompanyId] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formLocation, setFormLocation] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  
  // Multi-image states
  const [formImages, setFormImages] = useState<string[]>([]);
  const [selectedNewFiles, setSelectedNewFiles] = useState<{ file: File; previewUrl: string }[]>([]);

  // Course linking states
  const [availablePlans, setAvailablePlans] = useState<RollingPlan[]>([]);
  const [formIsCourseLinked, setFormIsCourseLinked] = useState<boolean>(false);
  const [formLinkedPlanId, setFormLinkedPlanId] = useState<string>("");
  const [formLinkedCourseId, setFormLinkedCourseId] = useState<string>("");
  const [formLinkedCourseCode, setFormLinkedCourseCode] = useState<string>("");
  const [formLinkedCourseName, setFormLinkedCourseName] = useState<string>("");
  const [formLinkedTrainingDate, setFormLinkedTrainingDate] = useState<string>("");
  const [formLinkedEndDate, setFormLinkedEndDate] = useState<string>("");
  const [formRegistrationNote, setFormRegistrationNote] = useState<string>("");
  const [formIsVisibleOnDashboard, setFormIsVisibleOnDashboard] = useState<boolean>(true);

  // Determine if a linked training course has already ended (date/time passed or completed/cancelled)
  const isActivityCourseEnded = (act: CourseActivity | null): boolean => {
    if (!act || !act.isCourseLinked) return false;
    if (act.linkedPlanId) {
      const plan = availablePlans.find((p) => p.rollingId === act.linkedPlanId);
      if (plan) {
        if (plan.status === "Cancel" || String(plan.dbStatus || "").toUpperCase() === "COMPLETED" || String(plan.dbStatus || "").toUpperCase() === "CANCELLED") return true;
        return isCourseDateOrTimeEnded(plan.trainingDate, plan.endDate, plan.endTime);
      }
    }
    if (act.linkedTrainingDate) {
      return isCourseDateOrTimeEnded(act.linkedTrainingDate, act.linkedEndDate);
    }
    return false;
  };

  // Selectable plans: hide courses that have passed their date/time or are completed/cancelled
  const selectablePlans = useMemo(() => {
    return availablePlans.filter((plan) => {
      if (formLinkedPlanId && plan.rollingId === formLinkedPlanId) return true;
      if (plan.status === "Cancel" || String(plan.dbStatus || "").toUpperCase() === "COMPLETED" || String(plan.dbStatus || "").toUpperCase() === "CANCELLED") return false;
      return !isCourseDateOrTimeEnded(plan.trainingDate, plan.endDate, plan.endTime);
    });
  }, [availablePlans, formLinkedPlanId]);

  // Employee enrollments state
  const [employeeEnrollments, setEmployeeEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);

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
    setIsMounted(true);
    fetchActivities();
    loadWorkflowRollingPlans().then(setAvailablePlans).catch(() => []);
  }, []);

  useEffect(() => {
    if (authenticatedUser?.employeeId) {
      listEnrollments({
        employeeId: authenticatedUser.employeeId,
        planId: null,
        employeeUserId: null,
      })
        .then((res) => setEmployeeEnrollments(res.enrollments || []))
        .catch(() => []);
    }
  }, [authenticatedUser?.employeeId]);

  const isActivityEnrolledByEmployee = (act: CourseActivity | null): boolean => {
    if (!act || !act.linkedPlanId) return false;
    return employeeEnrollments.some(
      (e) =>
        e.planId === act.linkedPlanId &&
        ACTIVE_ENROLLMENT_STATUSES.includes(e.status)
    );
  };

  const isAlreadyEnrolled = isActivityEnrolledByEmployee(activeActivity);

  const handleNavigateToTrainingSurvey = (activity: CourseActivity) => {
    const target = activity.linkedCourseCode || activity.linkedCourseId || activity.linkedPlanId || "";
    const url = target
      ? `/training-plan/training-accept-survey?courseId=${encodeURIComponent(target)}`
      : `/training-plan/training-accept-survey`;
    router.push(url);
  };

  // Filter activities: Center/Admin sees all; Factory/Employee sees Center + their own company
  // Only show activities where isVisibleOnDashboard !== false and status !== "ARCHIVED"
  const visibleActivities = useMemo(() => {
    const activeOnly = activities.filter((act) => {
      if (act.isVisibleOnDashboard === false || act.status === "ARCHIVED") {
        return false;
      }
      return true;
    });

    if (isCenterOrAdmin) return activeOnly;

    return activeOnly.filter((act) => {
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

  // Companies accessible in dropdown
  // For HRD Factory: ONLY their own company (strictly cannot touch or choose other companies)
  // For HRD Center / Admin: Center (ส่วนกลาง) + all available companies
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
    if (selectedCompany === companyId && companyId !== "all") {
      setSelectedCompany("all");
    } else {
      setSelectedCompany(companyId);
    }
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

  // Card image 5-second auto-advance for activities with multiple photos
  useEffect(() => {
    const timer = setInterval(() => {
      setCardImageTick((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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

  // Ensure detail modal always starts scrolled to the very top (so images are 100% visible)
  useEffect(() => {
    if (isDetailModalOpen) {
      if (detailModalBodyRef.current) {
        detailModalBodyRef.current.scrollTop = 0;
      }
      if (detailModalDialogRef.current) {
        detailModalDialogRef.current.scrollTop = 0;
      }
    }
  }, [isDetailModalOpen, activeActivity]);

  // Close form modal and cleanup any pending object URLs
  const handleCloseFormModal = () => {
    selectedNewFiles.forEach((item) => {
      if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setSelectedNewFiles([]);
    setFormImages([]);
    setFormId("");
    setFormTitle("");
    setFormDate("");
    setFormLocation("");
    setFormDescription("");
    setFormIsCourseLinked(false);
    setFormLinkedPlanId("");
    setFormLinkedCourseId("");
    setFormLinkedCourseCode("");
    setFormLinkedCourseName("");
    setFormLinkedTrainingDate("");
    setFormLinkedEndDate("");
    setFormRegistrationNote("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsFormModalOpen(false);
  };

  // Open modal to add new activity
  const handleOpenAdd = () => {
    selectedNewFiles.forEach((item) => {
      if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setSelectedNewFiles([]);
    setFormImages([]);
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
    setFormIsCourseLinked(false);
    setFormLinkedPlanId("");
    setFormLinkedCourseId("");
    setFormLinkedCourseCode("");
    setFormLinkedCourseName("");
    setFormLinkedTrainingDate("");
    setFormLinkedEndDate("");
    setFormRegistrationNote("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsFormModalOpen(true);
  };

  // Open modal to edit existing activity
  const handleOpenEdit = (e: React.MouseEvent, activity: CourseActivity) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canManageActivity(activity)) return;

    selectedNewFiles.forEach((item) => {
      if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setSelectedNewFiles([]);

    const existingImgs = activity.images && activity.images.length > 0
      ? [...activity.images]
      : activity.imageUrl ? [activity.imageUrl] : [];
    setFormImages(existingImgs);

    setIsEditing(true);
    setFormId(activity.id);
    setFormTitle(activity.title);
    setFormCompanyId(activity.companyId || (isFactory && factoryOwnCompany ? factoryOwnCompany.id : "center"));
    setFormIsVisibleOnDashboard(activity.isVisibleOnDashboard !== false && activity.status !== "ARCHIVED");
    setFormDate(activity.date || "");
    setFormLocation(activity.location || "");
    setFormDescription(activity.description || "");

    setFormIsCourseLinked(Boolean(activity.isCourseLinked));
    setFormLinkedPlanId(activity.linkedPlanId || "");
    setFormLinkedCourseId(activity.linkedCourseId || "");
    setFormLinkedCourseCode(activity.linkedCourseCode || "");
    setFormLinkedCourseName(activity.linkedCourseName || "");
    setFormLinkedTrainingDate(activity.linkedTrainingDate || "");
    setFormLinkedEndDate(activity.linkedEndDate || "");
    setFormRegistrationNote(activity.registrationNote || "");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsFormModalOpen(true);
    setIsDetailModalOpen(false);
  };

  // Open detail modal to view activity
  const handleOpenDetail = (activity: CourseActivity) => {
    setActiveActivity(activity);
    setLightboxIndex(0);
    setIsLightboxHovered(false);
    setIsDetailModalOpen(true);
    requestAnimationFrame(() => {
      if (detailModalBodyRef.current) {
        detailModalBodyRef.current.scrollTop = 0;
      }
      if (detailModalDialogRef.current) {
        detailModalDialogRef.current.scrollTop = 0;
      }
    });
  };

  // Multiple files selection
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

  // Remove an existing image from list
  const handleRemoveExistingImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Remove a newly added image before uploading
  const handleRemoveNewFile = (index: number) => {
    setSelectedNewFiles((prev) => {
      const item = prev[index];
      if (item && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Set an existing image as primary cover (move to index 0)
  const handleSetCoverExisting = (index: number) => {
    if (index === 0) return;
    setFormImages((prev) => {
      const target = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [target, ...rest];
    });
  };

  // Set a new file as primary cover
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

      // Upload any newly selected image files
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
          toast.error(errData.error || (isThai ? "อัปโหลดรูปภาพไม่สำเร็จ" : "Failed to upload images"));
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
        status: formIsVisibleOnDashboard ? "PUBLISHED" : "ARCHIVED",
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

  // Enroll in linked training course from detail modal
  const handleEnrollInLinkedCourse = async (activity: CourseActivity) => {
    if (!activity.linkedPlanId) return;

    if (isHrd) {
      toast.warning(
        isThai
          ? "ฝ่าย HRD ไม่สามารถลงทะเบียนตนเองได้ กรุณากด 'ส่งคนเข้าอบรม' เพื่อส่งรายชื่อพนักงานเข้าอบรมในระบบ Training Survey"
          : "HRD cannot self-enroll. Please click 'Dispatch Trainees' to nominate employees."
      );
      return;
    }

    if (isActivityCourseEnded(activity)) {
      toast.error(
        isThai
          ? "ไม่สามารถสมัครได้ เนื่องจากการอบรมนี้สิ้นสุดหรือผ่านเวลาไปแล้ว"
          : "Cannot enroll: this training course has already ended"
      );
      return;
    }

    const confirmed = await confirm({
      message: {
        th: `คุณต้องการสมัครเข้าร่วมการอบรมหลักสูตร:\n• ${activity.linkedCourseCode ? `[${activity.linkedCourseCode}] ` : ""}${activity.linkedCourseName}\nใช่หรือไม่?`,
        en: `Confirm course registration for:\n• ${activity.linkedCourseCode ? `[${activity.linkedCourseCode}] ` : ""}${activity.linkedCourseName}?`,
      },
    });

    if (!confirmed) return;

    try {
      setIsEnrolling(true);
      await createEnrollment({
        planId: activity.linkedPlanId,
        employeeId: authenticatedUser?.employeeId ?? "0",
        employeeUserId: null,
        source: "EMPLOYEE",
      });

      toast.success(
        isThai
          ? "ส่งคำขอสมัครอบรมเรียบร้อยแล้ว รอ HRD ดำเนินการอนุมัติครับ"
          : "Registration submitted successfully. Awaiting approval."
      );

      // Refresh enrollments list
      if (authenticatedUser?.employeeId) {
        const enrollResult = await listEnrollments({
          employeeId: authenticatedUser.employeeId,
          planId: null,
          employeeUserId: null,
        }).catch(() => ({ enrollments: [] }));
        setEmployeeEnrollments(enrollResult.enrollments || []);
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : isThai
          ? "สมัครอบรมไม่สำเร็จ"
          : "Could not submit enrollment"
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  // Cancel enrollment in linked training course
  const handleCancelEnrollment = async (activity: CourseActivity) => {
    if (!activity.linkedPlanId) return;

    const existing = employeeEnrollments.find(
      (e) => e.planId === activity.linkedPlanId && ACTIVE_ENROLLMENT_STATUSES.includes(e.status)
    );

    if (!existing) {
      toast.error(isThai ? "ไม่พบข้อมูลการลงทะเบียน" : "Enrollment record not found");
      return;
    }

    const confirmed = await confirm({
      message: {
        th: `คุณต้องการยกเลิกการสมัครเข้าร่วมการอบรมหลักสูตร:\n• ${activity.linkedCourseCode ? `[${activity.linkedCourseCode}] ` : ""}${activity.linkedCourseName}\nใช่หรือไม่?`,
        en: `Are you sure you want to cancel your registration for:\n• ${activity.linkedCourseCode ? `[${activity.linkedCourseCode}] ` : ""}${activity.linkedCourseName}?`,
      },
      danger: true,
    });

    if (!confirmed) return;

    try {
      setIsEnrolling(true);
      await updateEnrollmentStatus(existing.id, { action: "cancel" });

      toast.success(
        isThai
          ? "ยกเลิกการสมัครอบรมเรียบร้อยแล้ว"
          : "Registration cancelled successfully"
      );

      // Refresh enrollments list
      if (authenticatedUser?.employeeId) {
        const enrollResult = await listEnrollments({
          employeeId: authenticatedUser.employeeId,
          planId: null,
          employeeUserId: null,
        }).catch(() => ({ enrollments: [] }));
        setEmployeeEnrollments(enrollResult.enrollments || []);
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : isThai
          ? "ยกเลิกการสมัครไม่สำเร็จ"
          : "Could not cancel registration"
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  // Delete activity
  const handleDelete = async (e: React.MouseEvent, activity: CourseActivity) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canManageActivity(activity)) return;
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

  // Archive activity (hide from Dashboard)
  const handleArchiveActivity = async (activity: CourseActivity) => {
    if (!canManageActivity(activity)) return;

    const confirmed = await confirm({
      message: {
        th: `คุณต้องการจัดเก็บกิจกรรม "${activity.title}" ใช่หรือไม่?\n\n(กิจกรรมจะถูกซ่อนออกจากหน้าหลัก Dashboard ทันที โดยคุณสามารถดูและนำกลับมาแสดงใหม่ได้ในหน้ารายงานกิจกรรม)`,
        en: `Archive "${activity.title}"?\n\n(This will hide it from the Dashboard. You can view or restore it in the Activity Report page).`,
      },
    });

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/course-activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activity.id,
          isVisibleOnDashboard: false,
          status: "ARCHIVED",
        }),
      });

      if (res.ok) {
        toast.success(
          isThai
            ? "จัดเก็บกิจกรรมเรียบร้อยแล้ว (ซ่อนจาก Dashboard)"
            : "Activity archived and hidden from dashboard"
        );
        if (isDetailModalOpen && activeActivity?.id === activity.id) {
          setIsDetailModalOpen(false);
          setActiveActivity(null);
        }
        await fetchActivities();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || (isThai ? "จัดเก็บกิจกรรมไม่สำเร็จ" : "Failed to archive activity"));
      }
    } catch {
      toast.error(isThai ? "เกิดข้อผิดพลาดในการจัดเก็บกิจกรรม" : "An error occurred");
    } finally {
      setIsSubmitting(false);
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
        {(() => {
          const cardImages = act.images && act.images.length > 0 ? act.images : act.imageUrl ? [act.imageUrl] : [];
          const currentImg = cardImages.length > 0 ? cardImages[cardImageTick % cardImages.length] : null;
          return currentImg ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={currentImg}
              src={currentImg}
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
                  fb.innerText = isThai ? "ไม่สามารถแสดงรูปภาพได้" : "Image unavailable";
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
          );
        })()}

        {/* Photo count badge if multiple photos */}
        {act.images && act.images.length > 1 && (
          <span className={styles.photoCountBadge} title={`${act.images.length} ${isThai ? "รูป" : "photos"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{act.images.length} {isThai ? "รูป" : "photos"}</span>
          </span>
        )}

        {/* Course promotion badge or ended badge */}
        {act.isCourseLinked && (
          isActivityCourseEnded(act) ? (
            <span className={styles.courseEndedBadge} title={isThai ? "สิ้นสุดการอบรมแล้ว (ปิดรับสมัคร)" : "Course Ended (Closed)"}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{isThai ? "สิ้นสุดการอบรมแล้ว" : "Course Ended"}</span>
            </span>
          ) : (
            <span className={styles.courseLinkedBadge} title={act.linkedCourseName || (isThai ? "เปิดรับสมัครอบรม" : "Open for Enrollment")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
              </svg>
              <span>{isThai ? "เปิดรับสมัครอบรม" : "Enrollment Open"}</span>
            </span>
          )
        )}

        {/* Floating company badge with frosted glass */}
        <span
          className={`${styles.companyBadgeFloating} ${styles[`companyBadge_${act.companyCode}`] || styles.companyBadge_CENTER}`}
          title={act.companyName || act.companyCode}
        >
          {act.companyCode === "CENTER" ? "Center" : act.companyCode}
        </span>
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
        </div>
        <h3 className={styles.cardTitle}>{act.title}</h3>
        <p className={styles.cardDescription}>{act.description}</p>

        {/* Quick Course Action Box if linked */}
        {act.isCourseLinked && act.linkedCourseName && (() => {
          const isEnded = isActivityCourseEnded(act);
          const isEnrolled = !isHrd && isActivityEnrolledByEmployee(act);
          return (
            <div className={styles.cardCourseBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.cardCourseTop}>
                <span className={styles.cardCourseTag}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
                  </svg>
                  <span>{isThai ? "หลักสูตรฝึกอบรม" : "Training Course"}</span>
                </span>
                {isEnded ? (
                  <span className={styles.courseMiniStatusEnded}>
                    {isThai ? "ปิดรับสมัคร" : "Closed"}
                  </span>
                ) : isEnrolled ? (
                  <span className={styles.courseMiniStatusEnrolled}>
                    {isThai ? "ลงทะเบียนแล้ว" : "Enrolled"}
                  </span>
                ) : (
                  <span className={styles.courseMiniStatusOpen}>
                    {isThai ? "เปิดรับสมัคร" : "Open"}
                  </span>
                )}
              </div>

              <div className={styles.cardCourseBottomRow}>
                <div className={styles.cardCourseTitle} title={act.linkedCourseName}>
                  {act.linkedCourseCode && (
                    <span className={styles.cardCourseCodeBadge}>{act.linkedCourseCode}</span>
                  )}
                  <span className={styles.cardCourseNameText}>{act.linkedCourseName}</span>
                </div>

                <div className={styles.cardCourseActionFooter}>
                  {isHrd ? (
                    <button
                      type="button"
                      className={styles.cardHrdDispatchBtn}
                      onClick={() => handleNavigateToTrainingSurvey(act)}
                      title={
                        isThai
                          ? "ไปที่หน้า Training Survey เพื่อส่งคนเข้าอบรม"
                          : "Open Training Survey to dispatch participants"
                      }
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>{isThai ? "ส่งคนเข้าอบรม" : "Dispatch Trainees"}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ) : isEnrolled ? (
                    <div className={styles.cardEnrolledActionGroup}>
                      <div className={styles.cardEnrolledPill}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{isThai ? "ลงทะเบียนแล้ว" : "Enrolled"}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.cardCancelEnrollBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEnrollment(act);
                        }}
                        title={isThai ? "ยกเลิกการสมัครอบรม" : "Cancel registration"}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>{isThai ? "ยกเลิก" : "Cancel"}</span>
                      </button>
                    </div>
                  ) : isEnded ? (
                    <div className={styles.cardEndedPill}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{isThai ? "สิ้นสุดการรับสมัคร" : "Closed"}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.cardEmployeeEnrollBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnrollInLinkedCourse(act);
                      }}
                      title={isThai ? "คลิกเพื่อสมัครเข้าอบรม" : "Click to register"}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                      <span>{isThai ? "สมัครอบรม" : "Register Training"}</span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        
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

          {canManageActivity(act) && (
            <div className={styles.cardActionsRow}>
              <button
                type="button"
                className={`${styles.cardActionBtn} ${styles.cardActionBtnArchive}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleArchiveActivity(act);
                }}
                title={isThai ? "จัดเก็บกิจกรรม (ซ่อนออกจาก Dashboard)" : "Archive Activity (hide from Dashboard)"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="5" rx="1" />
                  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                  <path d="M12 11v5" />
                  <path d="M9.5 13.5L12 16l2.5-2.5" />
                </svg>
              </button>
              <button
                type="button"
                className={`${styles.cardActionBtn} ${styles.cardActionBtnEdit}`}
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

  // If employee and there are no visible activities, don't show the section at all
  if (isEmployee && (isLoading || visibleActivities.length === 0)) {
    return null;
  }

  return (
    <section className={styles.activitiesSection} aria-label="New Activities">
      {/* Section Header */}
      <div className={styles.sectionHeader}>
        {/* Top Tier: Title on Left, Action Buttons on Right */}
        <div className={styles.sectionHeaderTop}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.titleContainer}>
              <span className={styles.pulseDot} aria-hidden="true" />
              <h2 className={styles.mainTitle}>
                <span>New Activities</span>
              </h2>
            </div>
            <span className={styles.countBadge}>
              {filteredActivities.length} {isThai ? "กิจกรรม" : "activities"}
            </span>
          </div>

          <div className={styles.headerActions}>
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

            {/* Open Full Module Button */}
            {onOpenModule && (
              <button
                type="button"
                className={styles.openModuleHeaderBtn}
                onClick={onOpenModule}
                title={isThai ? "เปิดดูในโมดูลเต็มหน้าจอ" : "Open full module"}
              >
                <span>{isThai ? "ดูทั้งหมดในโมดูล" : "View in Module"}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Tier: Filter Strip Bar */}
        <div className={styles.filterStripBar}>
          {/* Year Filter Group */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{isThai ? "ปี:" : "Year:"}</span>
            </span>
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
          </div>

          <div className={styles.filterDivider} aria-hidden="true" />

          {/* Company Filter Group */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" />
                <path d="M16 6h.01" />
                <path d="M8 10h.01" />
                <path d="M16 10h.01" />
                <path d="M8 14h.01" />
                <path d="M16 14h.01" />
              </svg>
              <span>{isThai ? "บริษัท:" : "Company:"}</span>
            </span>
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
                  const isSelected = selectedCompany === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`${styles.companyPillBtn} ${isSelected ? styles.companyPillBtnActive : ""}`}
                      onClick={() => handleCompanyChange(c.id)}
                      title={c.name || c.code}
                    >
                      <span>{c.code}</span>
                    </button>
                  );
                })}
            </div>
          </div>
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
              ? isEmployee
                ? "ยังไม่มีข้อมูลกิจกรรมตามเงื่อนไขที่เลือก"
                : "ยังไม่มีข้อมูลกิจกรรมตามเงื่อนไขที่เลือก สามารถกดปุ่ม \"เพิ่มกิจกรรม\" ด้านบนเพื่อสร้างกิจกรรมใหม่ได้ครับ"
              : isEmployee
                ? "No activities found matching the selected criteria."
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
      {isMounted && isFormModalOpen && createPortal(
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
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* Multi-Image Upload & Thumbnail Gallery Manager */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {isThai ? "รูปภาพกิจกรรม (Activity Photos)" : "Activity Photos"}
                    <span style={{ fontSize: "0.78rem", fontWeight: "normal", color: "var(--ui-30-muted, #64748b)", marginLeft: "8px" }}>
                      {isThai ? "(สามารถเลือกได้หลายรูป โดยรูปแรกจะเป็นภาพหน้าปก)" : "(Multiple photos allowed; first photo is cover)"}
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
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div className={styles.multiUploadText}>
                      {isThai ? "คลิกเพื่อเลือกรูปภาพกิจกรรม (เลือกได้หลายรูปพร้อมกัน)" : "Click to select activity photos (multiple allowed)"}
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
                          <div key={`exist-${imgUrl}-${idx}`} className={`${styles.thumbCard} ${isCover ? styles.thumbCardCover : ""}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imgUrl} alt={`Activity ${idx + 1}`} className={styles.thumbImage} />
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
                          <div key={`new-${item.previewUrl}-${idx}`} className={`${styles.thumbCard} ${isCover ? styles.thumbCardCover : ""}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.previewUrl} alt={`New upload ${idx + 1}`} className={styles.thumbImage} />
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
                    <span className={styles.requiredDot} title={isThai ? "จำเป็นต้องระบุ" : "Required"} aria-label="required" />
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
                    <span>{isThai ? "บริษัท (Company)" : "Company"}</span>
                    <span className={styles.requiredDot} title={isThai ? "จำเป็นต้องระบุ" : "Required"} aria-label="required" />
                  </label>
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
                        {isThai ? "บริษัทของคุณ (ล็อกอัตโนมัติ)" : "Assigned Company (Locked)"}
                      </span>
                    </div>
                  ) : (
                    <select
                      className={styles.formSelect}
                      value={formCompanyId}
                      onChange={(e) => setFormCompanyId(e.target.value)}
                      required
                    >
                      <option value="">
                        {isThai ? "-- กรุณาเลือกบริษัท --" : "-- Please select company --"}
                      </option>
                      {availableCompanies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code === "CENTER" ? (isThai ? "Center (ส่วนกลาง)" : "Center") : c.name}
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

                {/* Course Linking Toggle & Selector */}
                <div className={`${styles.courseLinkToggleCard} ${formIsCourseLinked ? styles.courseLinkToggleCardActive : ""}`}>
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
                      style={{ width: "18px", height: "18px", accentColor: "#0284c7", cursor: "pointer" }}
                    />
                    <span>
                      {isThai ? "เชื่อมโยงกิจกรรมนี้กับการเปิดรับสมัครอบรม (Link to Training Course)" : "Link this activity to a Training Course for enrollment"}
                    </span>
                  </label>

                  {formIsCourseLinked && (
                    <div className={styles.courseLinkFields}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          <span>{isThai ? "เลือกหลักสูตรที่เปิดรับสมัคร (Select Course / Rolling Plan)" : "Select Course / Plan"}</span>
                          <span className={styles.requiredDot} title={isThai ? "จำเป็นต้องระบุ" : "Required"} aria-label="required" />
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
                            {isThai ? "-- กรุณาเลือกหลักสูตรฝึกอบรม --" : "-- Please select course --"}
                          </option>
                          {selectablePlans.map((plan) => (
                            <option key={plan.rollingId} value={plan.rollingId}>
                              [{plan.course?.code || "COURSE"}] {plan.course?.name || "Untitled Course"} {plan.batch ? `(${plan.batch})` : ""} {plan.trainingDate ? `• ${plan.trainingDate}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          {isThai ? "ข้อความประชาสัมพันธ์การรับสมัคร (Registration Note)" : "Registration Note"}
                        </label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={formRegistrationNote}
                          onChange={(e) => setFormRegistrationNote(e.target.value)}
                          placeholder={isThai ? "เช่น เปิดรับสมัครจำนวนจำกัด 25 ท่าน ปิดรับสมัคร 20 ก.ย. นี้" : "e.g. Limited to 25 seats, register by Sep 20"}
                        />
                      </div>
                    </div>
                  )}
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
        </div>,
        document.body
      )}

      {/* Detail View Modal with Multi-Image Lightbox Gallery & Linked Course CTA */}
      {isMounted && isDetailModalOpen && activeActivity && (() => {
        const currentImages = activeActivity.images && activeActivity.images.length > 0
          ? activeActivity.images
          : activeActivity.imageUrl ? [activeActivity.imageUrl] : [];
        const safeIdx = Math.min(lightboxIndex, Math.max(0, currentImages.length - 1));

        return createPortal(
          <div className={styles.modalOverlay} onClick={() => setIsDetailModalOpen(false)}>
            <div
              className={styles.modalDialog}
              ref={detailModalDialogRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div className={styles.modalMetaChips}>
                  <span className={styles.detailDateBadge}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{activeActivity.formattedDate || activeActivity.date}</span>
                  </span>
                  <span
                    className={`${styles.companyBadge} ${styles[`companyBadge_${activeActivity.companyCode}`] || styles.companyBadge_CENTER}`}
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    {activeActivity.companyCode === "CENTER"
                      ? (isThai ? "Center (ส่วนกลาง)" : "Center")
                      : (activeActivity.companyName || activeActivity.companyCode)}
                  </span>
                  {activeActivity.location ? (
                    <span className={styles.detailLocationBadge}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>{activeActivity.location}</span>
                    </span>
                  ) : null}
                  {activeActivity.isCourseLinked && (
                    <span className={styles.courseLinkedBadge} style={{ position: "static" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
                      </svg>
                      <span>{isThai ? "เปิดรับสมัครอบรม" : "Enrollment Open"}</span>
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

              <div className={styles.modalBody} ref={detailModalBodyRef}>
                {/* Multi-Image Lightbox Gallery */}
                {currentImages.length > 0 ? (
                  <div
                    className={styles.lightboxGalleryContainer}
                    onMouseEnter={() => setIsLightboxHovered(true)}
                    onMouseLeave={() => setIsLightboxHovered(false)}
                  >
                    <div className={styles.lightboxMainStage}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentImages[safeIdx]}
                        alt={`${activeActivity.title} - ${safeIdx + 1}`}
                        className={styles.lightboxMainImg}
                      />

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

                <h2 className={styles.detailTitle}>
                  {activeActivity.title}
                </h2>

                <p className={styles.detailDescription}>
                  {activeActivity.description}
                </p>

                {/* Linked Course Card with Quick Enrollment */}
                {activeActivity.isCourseLinked && activeActivity.linkedCourseName && (() => {
                  const isDetailEnded = isActivityCourseEnded(activeActivity);
                  return (
                    <div className={styles.detailLinkedCourseCard}>
                      <div className={styles.linkedCourseHeader}>
                        <div className={styles.linkedCourseTag}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                            <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
                          </svg>
                          <span>{isThai ? "หลักสูตรฝึกอบรมที่เชื่อมโยง (Training Course)" : "Linked Training Course"}</span>
                        </div>
                        {activeActivity.linkedPlanId ? (
                          isDetailEnded ? (
                            <span style={{ fontSize: "0.78rem", color: "#ef4444", fontWeight: 700 }}>
                              {isThai ? "• สิ้นสุดการอบรมแล้ว (ปิดรับสมัคร)" : "• Course Ended (Closed)"}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 700 }}>
                              {isThai ? "• พร้อมเปิดรับลงทะเบียน" : "• Open for registration"}
                            </span>
                          )
                        ) : null}
                      </div>

                      <div className={styles.linkedCourseTitle}>
                        {activeActivity.linkedCourseCode ? `[${activeActivity.linkedCourseCode}] ` : ""}{activeActivity.linkedCourseName}
                      </div>

                      {activeActivity.registrationNote ? (
                        <div className={styles.linkedCourseNote}>
                          <strong>{isThai ? "ข้อความประชาสัมพันธ์: " : "Note: "}</strong>
                          {activeActivity.registrationNote}
                        </div>
                      ) : null}

                      {/* Course Action: HRD Dispatch vs Employee Enrollment */}
                      {isHrd ? (
                        <div className={styles.hrdDispatchPanel}>
                          <div className={styles.hrdDispatchHeader}>
                            <div className={styles.hrdDispatchBadge}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                              <span>{isThai ? "สำหรับฝ่ายทรัพยากรบุคคล (HRD)" : "HRD Management"}</span>
                            </div>
                            <span className={styles.hrdDispatchSubtext}>
                              {isThai
                                ? isFactory
                                  ? `ส่งพนักงานในสังกัด (${userCompanyName || userCompanyCode || "บริษัทของคุณ"})`
                                  : "ส่งพนักงานเข้าอบรม (Center / All Companies)"
                                : "Dispatch participants"}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={styles.hrdDispatchActionBtn}
                            onClick={() => {
                              setIsDetailModalOpen(false);
                              handleNavigateToTrainingSurvey(activeActivity);
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span>{isThai ? "ส่งคนเข้าอบรม (ไปที่ Training Survey)" : "Go to Training Survey"}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className={styles.linkedCourseEnrollCta}>
                          {isAlreadyEnrolled ? (
                            <div className={styles.enrolledButtonGroup}>
                              <div className={styles.enrolledSuccessBadge}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>{isThai ? "ท่านได้ลงทะเบียนเข้าร่วมหลักสูตรนี้เรียบร้อยแล้ว" : "You have already registered for this course"}</span>
                              </div>
                              <button
                                type="button"
                                className={styles.detailCancelEnrollBtn}
                                onClick={() => handleCancelEnrollment(activeActivity)}
                                disabled={isEnrolling}
                                title={isThai ? "ยกเลิกการสมัครอบรม" : "Cancel registration"}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                                <span>{isThai ? "ยกเลิกการสมัคร" : "Cancel Registration"}</span>
                              </button>
                            </div>
                          ) : isDetailEnded ? (
                            <div className={styles.endedNoticeBadge}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <span>
                                {isThai
                                  ? "การอบรมนี้ได้ผ่านพ้นหรือสิ้นสุดไปแล้ว จึงไม่เปิดให้ลงทะเบียนสมัคร"
                                  : "This training course has already ended. Registration is closed."}
                              </span>
                            </div>
                          ) : activeActivity.linkedPlanId ? (
                            <button
                              type="button"
                              className={styles.detailEnrollBtn}
                              onClick={() => handleEnrollInLinkedCourse(activeActivity)}
                              disabled={isEnrolling}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                              </svg>
                              <span>
                                {isEnrolling
                                  ? (isThai ? "กำลังส่งคำขอสมัคร..." : "Submitting enrollment...")
                                  : (isThai ? "สมัครเข้ารับการอบรมหลักสูตรนี้" : "Enroll in this Course")}
                              </span>
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.82rem", color: "var(--ui-30-muted, #64748b)" }}>
                              {isThai ? "* กิจกรรมนี้เป็นข้อมูลประชาสัมพันธ์ ยังไม่เปิดรอบรุ่นสมัครในขณะนี้" : "* Informational announcement; no open batch configured"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className={styles.modalFooter}>
                {canManageActivity(activeActivity) && (
                  <>
                    <button
                      type="button"
                      className={styles.editActionBtn}
                      onClick={(e) => handleOpenEdit(e, activeActivity)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>{isThai ? "แก้ไข" : "Edit"}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.archiveActionBtn}
                      onClick={() => handleArchiveActivity(activeActivity)}
                      disabled={isSubmitting}
                      title={isThai ? "จัดเก็บกิจกรรม (ซ่อนออกจาก Dashboard)" : "Archive activity (hide from Dashboard)"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="21 8 21 21 3 21 3 8" />
                        <rect x="1" y="3" width="22" height="5" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                      </svg>
                      <span>{isThai ? "จัดเก็บ" : "Archive"}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.deleteActionBtn}
                      onClick={(e) => handleDelete(e, activeActivity)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>{isThai ? "ลบ" : "Delete"}</span>
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
          </div>,
          document.body
        );
      })()}
    </section>
  );
}
