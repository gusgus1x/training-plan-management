"use client";

import { useState } from "react";
import { listCourses } from "../lib/courses/client";
import { isSectionHeadOrAbove } from "../lib/employeeMasterData";
import type { WorkflowStandard } from "../lib/trainingWorkflow";
import { useAuthenticatedUser } from "./AuthenticatedUserContext";
import { useUiLanguage } from "./ThaiUiLocalization";
import { useToast } from "./ToastHost";
import { downloadRollingCourseOutline, type RollingPlan } from "./center_factory/TrainingPlanManagement/modules/TrainingRolling";

// Loaded once per page, on the first click: the outline's target-group section needs the standards.
let standardsOnce: Promise<WorkflowStandard[]> | null = null;
const loadStandards = () =>
  (standardsOnce ??= listCourses({ search: null, status: null })
    .then((result) => result.standards || [])
    .catch((error) => {
      standardsOnce = null;
      throw error;
    }));

/**
 * "Download Course Outline" for one batch, shown only to Section Head and above (and HRD). The
 * server checks the same rule, so hiding the button is convenience, not the guard.
 */
export default function CourseOutlineButton({ plan, className }: { plan: RollingPlan; className?: string }) {
  const user = useAuthenticatedUser();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!isSectionHeadOrAbove(user)) return null;

  const download = async () => {
    setBusy(true);
    try {
      const courseCode = await downloadRollingCourseOutline(plan, await loadStandards());
      toast.success(t(`ดาวน์โหลด Course Outline ${courseCode} แล้ว`, `Course Outline ${courseCode} downloaded`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ดาวน์โหลด Course Outline ไม่สำเร็จ", "Could not download the Course Outline"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        void download();
      }}
      title={t("ดาวน์โหลด Course Outline (Excel)", "Download the Course Outline (Excel)")}
    >
      <span>{busy ? t("กำลังสร้าง...", "Preparing...") : t("Course Outline", "Course Outline")}</span>
    </button>
  );
}
