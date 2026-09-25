"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NeedRequestRecord } from "../../../../lib/trainingNeedRequests/types";
import {
  enrollAndLink,
  loadHandoffRequests,
  matchOapForRequests,
  NeedRequestAttachPanel,
  needRequestQuery,
  useNeedRequestIds,
} from "./needRequestHandoff";
import {
  getCourseDisplayName,
  getCourseSecondaryName,
  isWorkflowOwner,
  type PlanTargetGroupSnapshot,
  type WorkflowCourse,
  type WorkflowOwner,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { getCourseOutlineFileName } from "../../../../lib/courseOutlineExport";
import { listCourses } from "../../../../lib/courses/client";
import { calculateBudgetEstimate, formatBaht } from "../../../../lib/trainingBudgetEstimate";
import { listOapPlans } from "../../../../lib/trainingOap/client";
import type { OapPlanRecord } from "../../../../lib/trainingOap/types";
import {
  createRollingPlan,
  deleteRollingPlan,
  listRollingPlans,
  updateRollingPlan,
} from "../../../../lib/trainingRolling/client";
import type { RollingPlanFormOverrides, RollingPlanRecord } from "../../../../lib/trainingRolling/types";
import { toDataURL as generateQrCodeDataUrl } from "qrcode";
import { listAssessments } from "../../../../lib/assessments/client";
import { listEvaluations } from "../../../../lib/evaluations/client";
import type { EvaluationTiming } from "../../../../lib/evaluations/types";
import { listInstructors } from "../../../../lib/instructors/client";
import type { InstructorRecord } from "../../../../lib/instructors/types";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import TypewriterLoader from "../../../TypewriterLoader";
import SearchableSelect from "../../../SearchableSelect";
import {
  getLocalDateString,
  formatDateDayMonthYear,
  formatDateRangeDayMonthYear,
} from "../../../../lib/calendarDate";
import {
  Search,
  ClipboardCheck,
  FileEdit,
  Tag,
  Folder,
  Clock,
  Building2,
  Factory,
  Target,
  Users,
  Star,
  BookOpen,
  Coins,
  User,
  Wallet,
  CalendarDays,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
} from "../../../icons/LucideIcons";
import styles from "./TrainingRolling.module.css";

export const trainingRollingModule = {
  title: "Training Rolling",
  subtitle: "Monthly training plan",
  description: "Convert annual OAP items into monthly rolling training schedules.",
} as const;

export type RollingStatus = "Planning" | "Planned" | "Cancel";

// Matches the bespoke course-detail shape every other rolling-plan consumer
// (TrainingAcceptSurvey, TrainingActual, TrainingRecord, ScheduleCalendar,
// SummaryDashboard, RegisterTrainingModule, UserDashboard, trainingFinanceSummary)
// already reads via plan.course.code / plan.course.name, kept separate from
// WorkflowCourse so those files don't need touching.
export type RollingCourseDetail = {
  id?: string;
  code: string;
  name: string;
  nameEn?: string;
  nameTh?: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  evaluationAfter30Day: string;
  preTestLink?: string;
  postTestLink?: string;
  evaluationLink?: string;
  evaluationAfter30DayLink?: string;
  lifeCycleMonth: string;
  courseType: string;
  courseGroup: string;
  remark: string;
  targetPositions?: string[];
  targetLevels?: string[];
  targetCompanies?: string[];
  orgScope?: {
    functionName?: string;
    division?: string;
    department?: string;
    section?: string;
  };
};

// Kept structurally identical to the legacy WorkflowRollingPlan shape (see
// app/lib/trainingWorkflow.ts) so every other module that already reads a rolling
// plan's fields (TrainingAcceptSurvey, TrainingActual, TrainingRecord, ScheduleCalendar,
// SummaryDashboard, RegisterTrainingModule, UserDashboard, trainingFinanceSummary) keeps
// working unchanged; only the data source underneath (real API instead of localStorage)
// and the write path (New form) changed.
export type RollingPlan = {
  // Alias of oapId, kept only because a few legacy call sites build a fallback
  // group key off plan.id from the pre-unification OapSource & {...} type.
  id: string;
  rollingId: string;
  scheduleGroupId: string;
  oapId: string;
  sequence: number;
  course: RollingCourseDetail;
  targetSnapshot?: PlanTargetGroupSnapshot;
  participants: string;
  hours: string;
  budget: string;
  budgetInstructor: string;
  budgetTraveling: string;
  budgetSeminarRoom: string;
  budgetAccommodation: string;
  budgetMaterial: string;
  budgetFoodBeverage: string;
  trainer: string;
  instructorId?: string | null;
  provider: string;
  ownerName: string;
  owner: WorkflowOwner;
  // Duplicate of owner; a few legacy call sites still read ownerScope from
  // before owner/ownerCompany were unified with WorkflowRollingPlan's convention.
  ownerScope: WorkflowOwner;
  ownerCompany: string;
  batchNo: number;
  batch: string;
  location: string;
  trainingDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  company: string;
  relatedCompanies: string[];
  status: RollingStatus;
  dbStatus?: string;
  updatedAt: string;
  /** This batch's own forms; "" on a field means it follows the course. */
  formOverrides: RollingPlanFormOverrides;
  /** False once the course has started - every form opens at the start datetime. */
  canEditForms: boolean;
};

type FormPickerOption = {
  id: string;
  label: string;
  kind: "PRE_TEST" | "POST_TEST" | "GENERAL" | "EVALUATION";
  /** Evaluations only. Which stage the form was written for, which is what keeps a 30-day
   *  follow-up out of the after-training slot and the other way round. */
  timing?: EvaluationTiming;
};

/**
 * The forms offered for one stage. An evaluation is written for a particular moment - the
 * after-training form asks about the course, the 30-day one asks what changed in the person since -
 * so offering either in either slot invites a batch to be set up asking the wrong questions.
 * Assessments are matched by purpose instead, with a general one usable at either end.
 */
export const optionsForStage = (
  stage: (typeof FORM_STAGES)[number],
  assessmentOptions: FormPickerOption[],
  evaluationOptions: FormPickerOption[],
) =>
  stage.kind === "EVALUATION"
    ? evaluationOptions.filter((option) => option.timing === stage.timing)
    : assessmentOptions.filter((option) => option.kind === stage.kind || option.kind === "GENERAL");

/**
 * Per-batch form overrides. The course sets the default; this swaps one for a single batch without
 * touching the course every other batch shares.
 *
 * Editable only until the course starts, because every form opens at start_datetime: before then
 * nobody can have answered, so the swap is free; after it, changing the form would hand trainees in
 * the same batch different papers. The server enforces the same rule - this only mirrors it.
 */
const PlanFormOverrideCard = ({
  plan,
  assessmentOptions,
  evaluationOptions,
  onSaved,
}: {
  plan: RollingPlan;
  assessmentOptions: FormPickerOption[];
  evaluationOptions: FormPickerOption[];
  onSaved: (plan: RollingPlan) => void;
}) => {
  const toast = useToast();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // The saved state is a key rather than something an effect copies into local state: when the save
  // lands (or another batch is opened) the key changes and the draft falls back to what is stored,
  // with no synchronous setState inside an effect and no frame showing the previous batch's forms.
  const savedKey = [
    plan.rollingId,
    plan.formOverrides.preAssessmentId,
    plan.formOverrides.postAssessmentId,
    plan.formOverrides.evaluationFormId,
    plan.formOverrides.evaluationFormAfter30DayId,
  ].join("|");
  const [edited, setEdited] = useState<{ key: string; value: RollingPlanFormOverrides } | null>(null);
  const draft = edited?.key === savedKey ? edited.value : plan.formOverrides;
  const setDraft = (update: (current: RollingPlanFormOverrides) => RollingPlanFormOverrides) =>
    setEdited({ key: savedKey, value: update(draft) });

  const dirty =
    draft.preAssessmentId !== plan.formOverrides.preAssessmentId ||
    draft.postAssessmentId !== plan.formOverrides.postAssessmentId ||
    draft.evaluationFormId !== plan.formOverrides.evaluationFormId ||
    draft.evaluationFormAfter30DayId !== plan.formOverrides.evaluationFormAfter30DayId;

  const courseDefaults: Record<string, string> = {
    preAssessmentId: plan.course.preTest || plan.course.preTestLink || "-",
    postAssessmentId: plan.course.postTest || plan.course.postTestLink || "-",
    evaluationFormId: plan.course.evaluation || plan.course.evaluationLink || "-",
    evaluationFormAfter30DayId: plan.course.evaluationAfter30Day || plan.course.evaluationAfter30DayLink || "-",
  };
  const rows = FORM_STAGES.map((stage) => ({
    stage,
    courseValue: courseDefaults[stage.idKey],
    options: optionsForStage(stage, assessmentOptions, evaluationOptions),
  }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updateRollingPlan(plan.rollingId, { formOverrides: draft });
      onSaved(mapRecordToRollingPlan(saved.rollingPlan));
      setEditing(false);
      toast.success("บันทึกแบบทดสอบ/แบบประเมินของรุ่นนี้แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.previewCard}>
      <div className={styles.previewCardHeader}>
        <span>
          <ClipboardCheck size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
          แบบทดสอบ / แบบประเมิน
        </span>
        {/* Read-only until Edit is pressed, like every other card on this detail panel. The card
            used to render live dropdowns straight away, so the page looked editable when it was
            only meant to be read. */}
        {!plan.canEditForms ? (
          <small style={{ color: "var(--ui-30-muted)" }}>อบรมเริ่มแล้ว แก้ไม่ได้</small>
        ) : editing ? null : (
          <button type="button" className={styles.formOverrideEditButton} onClick={() => setEditing(true)}>
            <FileEdit size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
            แก้ไข
          </button>
        )}
      </div>

      {rows.map(({ stage, courseValue, options }) => {
        const link = draft[stage.linkKey];
        const usingLink = Boolean(link.trim());
        const overridden = Boolean(draft[stage.idKey]) || usingLink;
        return (
          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`} key={stage.idKey}>
            <span className={styles.previewFieldLabel}>
              {stage.label}
              {overridden ? (
                <em style={{ marginLeft: "6px", fontStyle: "normal", fontWeight: 700, color: "#c2410c" }}>
                  แก้เฉพาะรุ่นนี้
                </em>
              ) : null}
            </span>

            {editing ? (
              <select
                value={usingLink || Boolean(draft[stage.linkKey]) ? LINK_MODE_VALUE : draft[stage.idKey]}
                onChange={(event) => setDraft((current) => setStageChoice(current, stage, event.target.value))}
                style={{ width: "100%", minHeight: "34px", fontSize: "0.8rem" }}
              >
                <option value="">— {t("ใช้ตามหลักสูตร", "Use Course Default")} ({courseValue}) —</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
                <option value={LINK_MODE_VALUE}>{t("ใช้ลิงก์ภายนอก (External Link)", "Use External Link")}</option>
              </select>
            ) : usingLink ? (
              // Nothing here for link mode: the link row below already shows it, and printing the
              // raw URL twice is what pushed it out of the card.
              null
            ) : (
              <span className={styles.previewFieldValue}>
                {draft[stage.idKey]
                  ? options.find((option) => option.id === draft[stage.idKey])?.label ?? "(ชุดที่เลือกไว้)"
                  : courseValue}
              </span>
            )}

            {/* The link row shows while editing link mode, and whenever a link is already set -
                a started batch can no longer be edited but still needs its QR to hand out. */}
            {(editing && Boolean(draft[stage.linkKey])) || usingLink ? (
              <span className={styles.sessionLinkRow}>
                {editing ? (
                  <input
                    type="url"
                    placeholder="https://forms.gle/..."
                    value={link.trim()}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [stage.linkKey]: event.target.value || " " }))
                    }
                  />
                ) : (
                  <a
                    className={styles.sessionLinkText}
                    href={link.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.trim()}
                  >
                    {shortenLink(link)}
                  </a>
                )}
                <button
                  type="button"
                  title={t("ดาวน์โหลด QR code ของลิงก์นี้", "Download QR code for this link")}
                  disabled={!link.trim()}
                  onClick={() =>
                    void downloadQrCode(link, `${plan.course.code || "course"}-${plan.batch || "batch"}-${stage.idKey}`).catch(() =>
                      toast.error("สร้าง QR code ไม่สำเร็จ"),
                    )
                  }
                >
                  <DownloadIcon />
                  โหลด QR
                </button>
              </span>
            ) : null}

            {/* In-system forms get a QR too, encoding the plan rather than the link: the form URL
                is per-employee, so the QR points at a landing page that resolves whoever scans it
                to their own copy. Blue, so HRD can tell the two kinds of QR apart at a glance. */}
            {!usingLink && stageHasInSystemForm(plan, stage) ? (
              <span className={styles.sessionLinkRow}>
                <CopyableUrl url={scanUrl(plan.rollingId, stage)} />
                <button
                  type="button"
                  className={styles.systemQrButton}
                  title="ดาวน์โหลด QR code สำหรับให้ผู้เข้าอบรมสแกนเข้าแบบฟอร์มในระบบ"
                  onClick={() =>
                    void downloadQrCode(
                      scanUrl(plan.rollingId, stage),
                      `${plan.course.code || "course"}-${plan.batch || "batch"}-${stage.idKey}-system`,
                    ).catch(() => toast.error("สร้าง QR code ไม่สำเร็จ"))
                  }
                >
                  <DownloadIcon />
                  โหลด QR (ฟอร์มในระบบ)
                </button>
              </span>
            ) : null}
          </div>
        );
      })}

      {editing ? (
        <div className={styles.formOverrideActions}>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEdited(null);
              setEditing(false);
            }}
          >
            ยกเลิก
          </button>
          <button type="button" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? "กำลังบันทึก..." : "บันทึกเฉพาะรุ่นนี้"}
          </button>
        </div>
      ) : null}
    </div>
  );
};

const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);

const rollingCompanyOptions = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

export const getRollingPlanCompanies = (plan: RollingPlan): string[] => {
  if (plan.relatedCompanies?.length) {
    return plan.relatedCompanies;
  }

  return plan.company === "All Companies"
    ? [...rollingCompanyOptions]
    : [plan.company];
};

export const formatRollingPlanCompanies = (plan: RollingPlan): string => {
  const selectedCompanies = getRollingPlanCompanies(plan);

  return selectedCompanies.length === rollingCompanyOptions.length
    ? "All Companies"
    : selectedCompanies.join(", ");
};

export const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;
/**
 * The year filter used to be the literal list ["2026", "2025", "2024"], with "2026" also hardcoded
 * as the initial and reset value. That works until it does not: come January the filter defaults to
 * a year in the past and the dropdown offers no way to reach the current one, so every plan in it
 * is simply invisible - with no error to notice.
 *
 * Derived from the plans on screen plus the current year instead, so it always covers exactly the
 * years that have something in them.
 */
export const currentYear = () => String(new Date().getFullYear());

export const rollingYearOptions = (plans: Array<{ trainingDate?: string }>) => {
  const years = new Set<string>([currentYear()]);
  for (const plan of plans) {
    const year = plan.trainingDate?.slice(0, 4);
    if (year && /^\d{4}$/.test(year)) years.add(year);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
};

const mapCourseDetail = (course: WorkflowCourse): RollingCourseDetail => ({
  id: course.id,
  code: course.courseCode,
  name: getCourseDisplayName(course),
  nameEn: course.courseNameEn || "",
  nameTh: course.courseNameTh || "",
  objective: course.objective,
  learningContent: course.learningContent,
  targetGroup: course.targetGroup,
  methodology: course.methodology,
  preTest: course.preTest,
  postTest: course.postTest,
  evaluation: course.evaluation,
  evaluationAfter30Day: course.evaluationAfter30Day,
  preTestLink: course.preTestLink,
  postTestLink: course.postTestLink,
  evaluationLink: course.evaluationLink,
  evaluationAfter30DayLink: course.evaluationAfter30DayLink,
  lifeCycleMonth: course.lifeCycleMonth,
  courseType: course.courseType,
  courseGroup: course.courseGroup,
  remark: course.remark || "",
  targetPositions: (course as unknown as Record<string, unknown>).targetPositions as string[] || [],
  targetLevels: (course as unknown as Record<string, unknown>).targetLevels as string[] || [],
  targetCompanies: (course as unknown as Record<string, unknown>).targetCompanies as string[] || [],
  orgScope: course.orgScope,
});

const mapRecordToRollingPlan = (record: RollingPlanRecord): RollingPlan => {
  const isCentral = record.owner === "CENTER";
  return {
    id: record.oapPlanId,
    rollingId: record.id,
    scheduleGroupId: record.oapPlanId,
    oapId: record.oapPlanId,
    sequence: 0,
    course: mapCourseDetail(record.course),
    targetSnapshot: record.targetSnapshot,
    participants: record.oapParticipants,
    hours: record.oapHours,
    budget: record.oapBudget,
    budgetInstructor: record.oapBudgetInstructor,
    budgetTraveling: record.oapBudgetTraveling,
    budgetSeminarRoom: record.oapBudgetSeminarRoom,
    budgetAccommodation: record.oapBudgetAccommodation,
    budgetMaterial: record.oapBudgetMaterial,
    budgetFoodBeverage: record.oapBudgetFoodBeverage,
    trainer: record.oapTrainer,
    instructorId: record.oapInstructorId ?? null,
    provider: record.oapProvider,
    ownerName: record.createdBy,
    owner: record.owner,
    ownerScope: record.owner,
    ownerCompany: record.ownerCompany,
    batchNo: record.batchNo,
    batch: record.batchName || `Batch ${record.batchNo}`,
    location: record.venue,
    trainingDate: record.trainingDate,
    endDate: record.endDate || record.trainingDate,
    startTime: record.startTime,
    endTime: record.endTime,
    company: isCentral ? "All Companies" : record.ownerCompany,
    relatedCompanies: isCentral ? [...rollingCompanyOptions] : [record.ownerCompany],
    status: record.status,
    dbStatus: record.dbStatus,
    updatedAt: record.updatedAt,
    formOverrides: record.formOverrides,
    canEditForms: record.canEditForms,
  };
};

export const loadWorkflowRollingPlans = async (): Promise<RollingPlan[]> => {
  try {
    const result = await listRollingPlans({ search: null, status: null, oapPlanId: null });
    return (result.rollingPlans || []).map(mapRecordToRollingPlan);
  } catch (error) {
    console.error("Failed to load Training Rolling plans", error);
    return [];
  }
};

type RollingSessionForm = {
  id: string;
  dbId: string | null;
  status: RollingStatus;
  batchName: string;
  location: string;
  trainingDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  /** Per-batch forms, chosen while the batch is being created. "" follows the course. */
  formOverrides: RollingPlanFormOverrides;
};

type RollingForm = {
  oapId: string;
  sessions: RollingSessionForm[];
};

const createEmptySession = (index = 0, batchName = ""): RollingSessionForm => ({
  id: `session-${Date.now()}-${index}`,
  dbId: null,
  status: "Planning",
  batchName,
  location: "",
  trainingDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "16:00",
  formOverrides: emptyFormOverrides(),
});

const emptyFormOverrides = (): RollingPlanFormOverrides => ({
  preAssessmentId: "",
  postAssessmentId: "",
  evaluationFormId: "",
  evaluationFormAfter30DayId: "",
  preTestLink: "",
  postTestLink: "",
  evaluationLink: "",
  evaluationAfter30DayLink: "",
});

/** The four stages, each with the id field, the link field, and where the course's default lives.
 *  Declared once so the create form and the detail panel cannot drift apart. */
export const FORM_STAGES = [
  { idKey: "preAssessmentId", linkKey: "preTestLink", label: "แบบทดสอบก่อนเรียน", kind: "PRE_TEST" },
  { idKey: "postAssessmentId", linkKey: "postTestLink", label: "แบบทดสอบหลังเรียน", kind: "POST_TEST" },
  {
    idKey: "evaluationFormId",
    linkKey: "evaluationLink",
    label: "แบบประเมิน",
    kind: "EVALUATION",
    timing: "AFTER_TRAINING",
  },
  {
    idKey: "evaluationFormAfter30DayId",
    linkKey: "evaluationAfter30DayLink",
    label: "แบบประเมินหลัง 30 วัน",
    kind: "EVALUATION",
    timing: "FOLLOW_UP_30_DAYS",
  },
] as const;

const LINK_MODE_VALUE = "__LINK__";

/** Maps each override stage onto the URL segment the employee-facing routes use. */
const SCAN_STAGE: Record<(typeof FORM_STAGES)[number]["idKey"], string> = {
  preAssessmentId: "PRE_TEST",
  postAssessmentId: "POST_TEST",
  evaluationFormId: "EVALUATION",
  evaluationFormAfter30DayId: "EVALUATION_30DAY",
};

/** The URL a scanned QR opens. Encodes the PLAN, not an enrollment - one QR serves the whole room,
 *  and the landing page resolves each scanner to their own copy of the form.
 *
 *  Built from the browser's own origin, so a QR generated from the deployed site carries the
 *  deployed domain with nothing to configure. Shown next to the button so HRD can see what it
 *  encodes before handing it out. */
const scanUrl = (planId: string, stage: (typeof FORM_STAGES)[number]) =>
  typeof window === "undefined" ? "" : `${window.location.origin}/training-form/plan/${planId}/${SCAN_STAGE[stage.idKey]}`;

/** Whether this stage actually resolves to an in-system form for this batch - the batch's own
 *  choice when it made one, otherwise the course's. A stage on a link, or with nothing set at all,
 *  has no in-system form to point a QR at. */
const stageHasInSystemForm = (plan: RollingPlan, stage: (typeof FORM_STAGES)[number]) => {
  if (plan.formOverrides[stage.linkKey].trim()) return false;
  if (plan.formOverrides[stage.idKey]) return true;
  // The course snapshot carries the form's NAME (empty when the course has none) rather than its
  // id, and a course stage resolves to a form whenever that name is set.
  const course = plan.course;
  const courseFormName =
    stage.idKey === "preAssessmentId"
      ? course.preTest
      : stage.idKey === "postAssessmentId"
        ? course.postTest
        : stage.idKey === "evaluationFormId"
          ? course.evaluation
          : course.evaluationAfter30Day;
  return Boolean(courseFormName?.trim());
};

/** A stage holds either an in-system form or a link, never both - choosing one clears the other. */
const setStageChoice = (
  current: RollingPlanFormOverrides,
  stage: (typeof FORM_STAGES)[number],
  value: string,
): RollingPlanFormOverrides =>
  value === LINK_MODE_VALUE
    ? { ...current, [stage.idKey]: "", [stage.linkKey]: current[stage.linkKey] || " " }
    : { ...current, [stage.idKey]: value, [stage.linkKey]: "" };

/** A Google Forms URL is ~90 characters of opaque id. Shown as host + a clipped path, with the
 *  full URL on the title attribute and the anchor still pointing at the real thing. */
const shortenLink = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const tail = `${url.pathname}${url.search}`.replace(/\/$/, "");
    const host = url.hostname.replace(/^www\./, "");
    return tail.length > 24 ? `${host}${tail.slice(0, 24)}…` : `${host}${tail}`;
  } catch {
    return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
  }
};

/** Inline SVG rather than an emoji: the arrow keeps its shape and colour on every platform, and it
 *  inherits the button's text colour instead of rendering as a coloured glyph. */
const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);

/**
 * A URL that copies itself when clicked, with a chat-bubble confirmation at the label.
 *
 * The URL is longer than the card is wide, and truncating it left HRD unable to read what the QR
 * actually encodes. Copying is the useful action anyway - the URL exists to be pasted into a chat
 * or an email, not to be transcribed by eye.
 */
const CopyableUrl = ({ url }: { url: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      // navigator.clipboard only exists in a secure context - HTTPS or localhost. The team serves
      // this over plain http on a LAN address, where it is undefined, so the old textarea trick is
      // the path that actually runs in practice rather than a theoretical fallback.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const holder = document.createElement("textarea");
        holder.value = url;
        holder.setAttribute("readonly", "");
        holder.style.position = "fixed";
        holder.style.opacity = "0";
        document.body.appendChild(holder);
        holder.select();
        document.execCommand("copy");
        document.body.removeChild(holder);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={styles.copyableUrl} title={`${url}\n(คลิกเพื่อคัดลอก)`} onClick={() => void copy()}>
      <span className={styles.copyableUrlText}>{url}</span>
      <span className={styles.copyIcon} aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </span>
      {copied ? <span className={styles.copiedBubble} role="status">คัดลอกแล้ว</span> : null}
    </button>
  );
};

const downloadQrCode = async (link: string, filename: string) => {
  const trimmed = link.trim();
  if (!trimmed) return;
  const dataUrl = await generateQrCodeDataUrl(trimmed, { width: 480, margin: 2 });
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = `${filename}-qr.png`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const createEmptyForm = (): RollingForm => ({
  oapId: "",
  sessions: [createEmptySession()],
});

export const getJobStatus = (item: { status?: RollingStatus; trainingDate: string; dbStatus?: string }) => {
  if (item.status === "Planning" || item.status === "Cancel") {
    return "Planning";
  }
  if (item.dbStatus === "COMPLETED") {
    return "Completed";
  }
  return "Rolling";
};

// A published session can be pulled back until its training day arrives; after that the
// session has already run, so cancelling it would rewrite history instead of a plan.
// Only published sessions cancel — drafts are deleted outright.
export const canCancelSession = (
  plan: { status?: RollingStatus; trainingDate: string },
  now: Date = new Date(),
) => {
  if (plan.status !== "Planned") return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return new Date(`${plan.trainingDate}T00:00:00`) >= today;
};

const ROLLING_PAGE_SIZE = 25;
const PAGE_WINDOW_SIZE = 5;

// Same sliding page window Employee Data uses, so both screens paginate identically.
const pageWindow = (current: number, totalPages: number) => {
  if (totalPages <= PAGE_WINDOW_SIZE) return { start: 1, end: totalPages };
  let start = Math.max(1, current - Math.floor(PAGE_WINDOW_SIZE / 2));
  let end = start + PAGE_WINDOW_SIZE - 1;
  if (end > totalPages) {
    end = totalPages;
    start = end - PAGE_WINDOW_SIZE + 1;
  }
  return { start, end };
};

export const resolveRollingPlanStandard = (plan: RollingPlan, standards: WorkflowStandard[]) => {
  const snapshot = plan.targetSnapshot || (plan as unknown as { targetSnapshot?: PlanTargetGroupSnapshot }).targetSnapshot;
  const courseAny = plan.course as unknown as {
    targetPositions?: string[];
    targetLevels?: string[];
    targetCompanies?: string[];
    orgScope?: {
      functionName?: string;
      division?: string;
      department?: string;
      section?: string;
    };
  };

  if (snapshot) {
    return {
      companies: snapshot.targetCompanies || [],
      positions: snapshot.targetPositions || [],
      levels: snapshot.targetLevels || [],
      functionName: snapshot.orgScope?.functionName || "",
      division: snapshot.orgScope?.division || "",
      department: snapshot.orgScope?.department || "",
      section: snapshot.orgScope?.section || "",
      targetGroup: snapshot.targetGroup || plan.course?.targetGroup || "",
      isSnapshot: true,
    };
  }

  if (
    courseAny?.targetPositions?.length ||
    courseAny?.targetLevels?.length ||
    courseAny?.targetCompanies?.length ||
    courseAny?.orgScope
  ) {
    return {
      companies: courseAny.targetCompanies || [],
      positions: courseAny.targetPositions || [],
      levels: courseAny.targetLevels || [],
      functionName: courseAny.orgScope?.functionName || "",
      division: courseAny.orgScope?.division || "",
      department: courseAny.orgScope?.department || "",
      section: courseAny.orgScope?.section || "",
      targetGroup: plan.course?.targetGroup || "",
      isSnapshot: true,
    };
  }

  const planYear = plan.trainingDate ? parseInt(plan.trainingDate.slice(0, 4), 10) : undefined;
  const planCourseId = plan.course?.id ? String(plan.course.id).trim() : "";
  const planCourseCode = plan.course?.code ? plan.course.code.trim().toLowerCase() : "";

  if (planYear) {
    const yearMatched = standards.find(
      (item) =>
        ((item.courseId && planCourseId && String(item.courseId).trim() === planCourseId) ||
         (item.courseCode && planCourseCode && item.courseCode.trim().toLowerCase() === planCourseCode)) &&
        (item as unknown as { standardYear?: number }).standardYear === planYear,
    );
    if (yearMatched) return { ...yearMatched, isSnapshot: false };
  }

  const courseMatched = standards.find(
    (item) =>
      (item.courseId && planCourseId && String(item.courseId).trim() === planCourseId) ||
      (item.courseCode && planCourseCode && item.courseCode.trim().toLowerCase() === planCourseCode),
  );
  if (courseMatched) return { ...courseMatched, isSnapshot: false };

  return null;
};

/**
 * Builds and downloads one batch's Course Outline; returns the course code. The OAP plan is
 * optional: the outline only reads its trainer, provider, hours and budget, which the batch carries
 * too, so pages whose users cannot list OAP plans (calendar, Register) can offer the same file.
 * The server decides who may have it.
 */
export const downloadRollingCourseOutline = async (
  plan: RollingPlan,
  standards: WorkflowStandard[],
  oapPlan?: OapPlanRecord | null,
) => {
  const course: WorkflowCourse = oapPlan?.course ?? {
    id: plan.course.code,
    courseCode: plan.course.code,
    courseNameTh: plan.course.name,
    courseNameEn: plan.course.name,
    objective: plan.course.objective,
    learningContent: plan.course.learningContent,
    targetGroup: plan.course.targetGroup,
    methodology: plan.course.methodology,
    preTest: plan.course.preTest,
    postTest: plan.course.postTest,
    evaluation: plan.course.evaluation,
    evaluationAfter30Day: plan.course.evaluationAfter30Day,
    preTestLink: plan.course.preTestLink,
    postTestLink: plan.course.postTestLink,
    evaluationLink: plan.course.evaluationLink,
    evaluationAfter30DayLink: plan.course.evaluationAfter30DayLink,
    lifeCycleMonth: plan.course.lifeCycleMonth,
    courseType: plan.course.courseType,
    courseGroup: plan.course.courseGroup,
    remark: plan.course.remark || "",
    status: "Active",
    updatedAt: plan.updatedAt,
    owner: plan.owner,
    ownerCompany: plan.ownerCompany,
    createdBy: plan.ownerName,
  };

  const schedule = {
    date: plan.trainingDate || "",
    time: [plan.startTime, plan.endTime].filter(Boolean).join(" - ") || (plan.hours ? `${plan.hours} ชั่วโมง` : ""),
    location: plan.location || "",
  };

  const budget = {
    budgetInstructor: plan.budgetInstructor,
    budgetTraveling: plan.budgetTraveling,
    budgetSeminarRoom: plan.budgetSeminarRoom,
    budgetAccommodation: plan.budgetAccommodation,
    budgetMaterial: plan.budgetMaterial,
    budgetFoodBeverage: plan.budgetFoodBeverage,
    totalBudget: plan.budget,
  };

  const outlineOap = oapPlan ?? {
    id: plan.oapId,
    sequence: 0,
    course,
    participants: plan.participants,
    hours: plan.hours,
    budget: plan.budget,
    trainer: plan.trainer,
    provider: plan.provider,
    createdBy: plan.ownerName,
    status: "Planned" as const,
    owner: plan.owner,
    ownerCompany: plan.ownerCompany,
  };

  const response = await fetch("/api/course-master/course-outline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      course,
      standard: resolveRollingPlanStandard(plan, standards),
      oapPlan: outlineOap,
      schedule,
      budget,
    }),
  });
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string | { message?: string } } | null;
    const error = errorPayload?.error;
    throw new Error((typeof error === "string" ? error : error?.message) || "Unable to create Course Outline.");
  }

  const file = await response.blob();
  const downloadUrl = URL.createObjectURL(file);
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = getCourseOutlineFileName(course, schedule);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  return course.courseCode;
};


const resolveRollingOapStandard = (oap: OapPlanRecord, standards: WorkflowStandard[]) => {
  const snapshot = (oap as unknown as { targetSnapshot?: PlanTargetGroupSnapshot }).targetSnapshot;
  const courseAny = oap.course as unknown as {
    targetPositions?: string[];
    targetLevels?: string[];
    targetCompanies?: string[];
    orgScope?: {
      functionName?: string;
      division?: string;
      department?: string;
      section?: string;
    };
  };

  if (snapshot) {
    return {
      companies: snapshot.targetCompanies || [],
      positions: snapshot.targetPositions || [],
      levels: snapshot.targetLevels || [],
      functionName: snapshot.orgScope?.functionName || "",
      division: snapshot.orgScope?.division || "",
      department: snapshot.orgScope?.department || "",
      section: snapshot.orgScope?.section || "",
      targetGroup: snapshot.targetGroup || oap.course?.targetGroup || "",
      isSnapshot: true,
    };
  }

  if (
    courseAny?.targetPositions?.length ||
    courseAny?.targetLevels?.length ||
    courseAny?.targetCompanies?.length ||
    courseAny?.orgScope
  ) {
    return {
      companies: courseAny.targetCompanies || [],
      positions: courseAny.targetPositions || [],
      levels: courseAny.targetLevels || [],
      functionName: courseAny.orgScope?.functionName || "",
      division: courseAny.orgScope?.division || "",
      department: courseAny.orgScope?.department || "",
      section: courseAny.orgScope?.section || "",
      targetGroup: oap.course?.targetGroup || "",
      isSnapshot: true,
    };
  }

  if (oap.planYear) {
    const yearMatched = standards.find(
      (item) => item.courseId === oap.course?.id && (item as unknown as { standardYear?: number }).standardYear === oap.planYear,
    );
    if (yearMatched) return { ...yearMatched, isSnapshot: false };
  }

  const courseMatched = standards.find((item) => item.courseId === oap.course?.id);
  if (courseMatched) return { ...courseMatched, isSnapshot: false };

  return null;
};

export default function TrainingRolling() {
  const router = useRouter();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const userCompanyCode = profileValue(user?.companyCode);
  const [oapPlans, setOapPlans] = useState<OapPlanRecord[]>([]);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  // Only published forms are offered, the same rule Course Master applies - a draft has no business
  // being attached to a batch people will actually take.
  const [assessmentOptions, setAssessmentOptions] = useState<FormPickerOption[]>([]);
  const [evaluationOptions, setEvaluationOptions] = useState<FormPickerOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listAssessments({ search: null, status: "ACTIVE", purpose: null }).catch(() => ({ items: [] })),
      listEvaluations({ search: null, status: "PUBLISHED", timing: null, respondentType: null }).catch(() => ({ items: [] })),
    ]).then(([assessments, evaluations]) => {
      if (cancelled) return;
      setAssessmentOptions(
        assessments.items.map((item) => ({
          id: item.assessmentId,
          label: `[${item.seriesCode}] ${item.seriesName}`,
          kind: item.purpose === "PRE_TEST" ? "PRE_TEST" : item.purpose === "POST_TEST" ? "POST_TEST" : "GENERAL",
        })),
      );
      setEvaluationOptions(
        evaluations.items.map((item) => ({
          id: item.evaluationFormId,
          label: `[${item.formCode}] ${item.formName}`,
          kind: "EVALUATION" as const,
          timing: item.timing,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [standards, setStandards] = useState<WorkflowStandard[]>([]);
  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
  const [form, setForm] = useState<RollingForm>(createEmptyForm);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [openDetailId, setOpenDetailId] = useState("");

  useEffect(() => {
    if (!isNewOpen && !openDetailId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isNewOpen) setIsNewOpen(false);
        if (openDetailId) setOpenDetailId("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isNewOpen, openDetailId]);

  const activeDetailPlan = useMemo(
    () => (openDetailId ? rollingPlans.find((p) => p.rollingId === openDetailId) ?? null : null),
    [openDetailId, rollingPlans]
  );

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RollingStatus>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [exportingPlanId, setExportingPlanId] = useState("");
  const [deletedSessionDbIds, setDeletedSessionDbIds] = useState<string[]>([]);
  // Tracks the CLOSED sections, not the open ones, so every section — including a company
  // that only appears after a filter change — starts expanded without seeding state for it.
  const [closedSections, setClosedSections] = useState<string[]>([]);
  const [sectionPage, setSectionPage] = useState<Record<string, number>>({});

  const isSectionOpen = (key: string) => !closedSections.includes(key);
  const toggleSection = (key: string) =>
    setClosedSections((current) =>
      current.includes(key) ? current.filter((closedKey) => closedKey !== key) : [...current, key],
    );

  const [isLoading, setIsLoading] = useState(true);
  // Approved training need requests sent over from Request Training Need, to enrol and link on save.
  const handoffIds = useNeedRequestIds();
  const [handoffRequests, setHandoffRequests] = useState<NeedRequestRecord[]>([]);
  const [handoffChecked, setHandoffChecked] = useState<Set<string>>(new Set());
  const [handoffSession, setHandoffSession] = useState(0);

  const loadWorkspace = async () => {
    setIsLoading(true);
    try {
      const [oapData, rollingData, courseData, instructorData] = await Promise.all([
        listOapPlans({ search: null, status: null }),
        loadWorkflowRollingPlans(),
        listCourses({ search: "", status: null }),
        listInstructors({ status: "ACTIVE" }).catch(() => ({ items: [] })),
      ]);
      setOapPlans(oapData.oapPlans || []);
      setRollingPlans(rollingData);
      setStandards(courseData.standards || []);
      setInstructors(instructorData.items || []);
    } catch (error) {
      console.error("Failed to load Training Rolling workspace", error);
      setOapPlans([]);
      setRollingPlans([]);
      setStandards([]);
      setInstructors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (handoffIds.length === 0) return;
    Promise.all([loadHandoffRequests(handoffIds), listOapPlans({ search: null, status: null })])
      .then(([requests, { oapPlans: plans }]) => {
        setHandoffRequests(requests);
        setHandoffChecked(new Set(requests.map((request) => request.id)));
        // Open on the course these requests are asking for, with the first session filled in from
        // the plan and the dates the requesters asked for, so HRD can save a draft straight away.
        // A plan outside this user's scope simply does not show as chosen.
        const match = matchOapForRequests(requests, plans || []);
        const preferredStart = requests.map((request) => request.preferredStartDate).find(Boolean) ?? "";
        const preferredEnd = requests.map((request) => request.preferredEndDate).find(Boolean) ?? "";
        const session = createEmptySession();
        setForm({
          ...createEmptyForm(),
          oapId: match?.id ?? "",
          sessions: [{ ...session, trainingDate: preferredStart, endDate: preferredEnd || preferredStart }],
        });
        setIsNewOpen(true);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : String(error)));
    // Re-runs when the address changes, which is how the hand-off arrives on a client navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffIds]);

  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const isCenterUser = user?.roleCode === "HRD_CENTER";

  const oapSources = useMemo(
    () =>
      oapPlans.filter(
        (plan) => {
          if (plan.status === "Cancel") return false;
          if (isFactoryUser) {
            return (
              plan.owner === "FACTORY" &&
              plan.ownerCompany === userCompanyCode
            );
          }
          if (isCenterUser) {
            return (
              plan.owner === "CENTER" ||
              plan.ownerCompany === "CENTER" ||
              plan.ownerCompany === "HRD Center" ||
              !plan.ownerCompany
            );
          }
          return isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode);
        },
      ),
    [oapPlans, user?.roleCode, userCompanyCode, isFactoryUser, isCenterUser],
  );
  const selectedOap = oapSources.find((source) => source.id === form.oapId) ?? null;

  const formatInstructorFullName = (ins: InstructorRecord | null | undefined): string => {
    if (!ins) return "";
    return [ins.title, ins.firstName, ins.lastName].filter(Boolean).join(" ").trim();
  };

  const selectedOapInstructor = useMemo(() => {
    if (selectedOap?.instructorId) {
      const byId = instructors.find((ins) => ins.instructorId === selectedOap.instructorId);
      if (byId) return byId;
    }
    if (!selectedOap?.trainer?.trim()) return null;
    const t = selectedOap.trainer.trim().toLowerCase();
    return (
      instructors.find(
        (ins) =>
          formatInstructorFullName(ins).toLowerCase() === t ||
          `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === t ||
          ins.instructorCode.toLowerCase() === t,
      ) ?? null
    );
  }, [selectedOap, instructors]);
  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) => {
        if (isFactoryUser) {
          // Factory users see plans from their factory OR plans from CENTER (which target all companies / factory)
          const isCenter = plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.owner === "CENTER" || plan.company === "All Companies";
          const isOwnFactory = plan.ownerCompany === userCompanyCode || plan.company === userCompanyCode;
          return isCenter || isOwnFactory;
        }
        return isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode);
      }),
    [rollingPlans, isFactoryUser, user?.roleCode, userCompanyCode],
  );
  const yearOptions = useMemo(() => rollingYearOptions(scopedRollingPlans), [scopedRollingPlans]);
  const selectedMonthLabel =
    selectedMonth === "all"
      ? "All Year"
      : monthOptions.find((month) => month.value === selectedMonth)?.label ??
        "Selected month";
  const visiblePlans = useMemo(
    () =>
      [...scopedRollingPlans]
        .sort(
          (a, b) =>
            a.trainingDate.localeCompare(b.trainingDate) ||
            (a.startTime || "").localeCompare(b.startTime || ""),
        )
        .map((plan, index) => ({ ...plan, sequence: index + 1 }))
        .filter((plan) => {
          if (companyFilter !== "all") {
            const planCompanies = getRollingPlanCompanies(plan);
            const matchesCompany =
              companyFilter === "CENTER"
                ? plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies"
                : planCompanies.includes(companyFilter) ||
                  plan.ownerCompany === companyFilter ||
                  plan.company === companyFilter;
            if (!matchesCompany) return false;
          }
          return (
            plan.trainingDate.startsWith(`${selectedYear}-`) &&
            (selectedMonth === "all" ||
              plan.trainingDate.startsWith(`${selectedYear}-${selectedMonth}`)) &&
            (statusFilter === "all" || plan.status === statusFilter) &&
            [
              plan.course.name,
              plan.course.nameEn,
              plan.course.nameTh,
              plan.course.code,
              plan.course.courseGroup,
              plan.course.courseType,
              plan.batch,
              plan.location,
              formatRollingPlanCompanies(plan),
              plan.status,
              getJobStatus(plan),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())
          );
        }),
    [companyFilter, scopedRollingPlans, search, selectedMonth, selectedYear, statusFilter],
  );

  const factoryCourseTypeAllowlist = ["IN-HOUSE", "PUBLIC", "OJT"];

  const getStatusLabel = (status: string) => {
    if (language === "en") {
      if (status === "Planned") return "Planned";
      if (status === "Planning") return "Planning";
      if (status === "Cancel") return "Cancelled";
      return status;
    }
    if (status === "Planned") return "วางแผนแล้ว";
    if (status === "Planning") return "รอวางแผน";
    if (status === "Cancel") return "ยกเลิก";
    return status;
  };

  // Same center-ownership test the group rows already do inline; named once so the
  // merged session table applies the identical factory read-only rule.
  const isCenterOwned = (plan: RollingPlan) =>
    plan.ownerScope === "CENTER" ||
    plan.ownerCompany === "HRD Center" ||
    plan.ownerName === "Center HRD" ||
    plan.provider === "HRD Center" ||
    plan.owner === "CENTER" ||
    plan.company === "All Companies";

  const allCompanyCodes = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

  const companyColumns = useMemo(() => {
    const userComp = userCompanyCode && userCompanyCode !== "CENTER" ? userCompanyCode : "";
    if (userComp && allCompanyCodes.includes(userComp as any)) {
      return [userComp, ...allCompanyCodes.filter((c) => c !== userComp)];
    }
    return [...allCompanyCodes];
  }, [userCompanyCode]);

  const isCompanyIncludedInRolling = (plan: RollingPlan, company: string) => {
    if (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies") {
      return true;
    }
    const companies = getRollingPlanCompanies(plan);
    return companies.includes(company) || plan.ownerCompany === company || plan.company === company;
  };

  const isCompanyOwnerOfRolling = (plan: RollingPlan, company: string) => {
    if (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center") {
      return false;
    }
    return plan.ownerCompany === company || plan.company === company;
  };

  const getCompanySortWeight = (plan: RollingPlan) => {
    const currentUserCompany = userCompanyCode || "CENTER";
    const planCompanies = getRollingPlanCompanies(plan);
    const planOwner = plan.ownerCompany || plan.company;

    if (
      planOwner === currentUserCompany ||
      planCompanies.includes(currentUserCompany) ||
      (currentUserCompany === "CENTER" && (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies"))
    ) {
      return 0;
    }
    if (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies") {
      return 1;
    }
    return 2;
  };

  const visiblePlanGroups = useMemo(() => {
    const groups = new Map<string, RollingPlan[]>();

    visiblePlans.forEach((plan) => {
      groups.set(plan.scheduleGroupId, [...(groups.get(plan.scheduleGroupId) ?? []), plan]);
    });

    const mappedGroups = [...groups.entries()].map(([id, plans]) => {
      const sortedPlans = [...plans].sort(
        (a, b) =>
          a.trainingDate.localeCompare(b.trainingDate) ||
          (a.startTime || "").localeCompare(b.startTime || ""),
      );
      return {
        id,
        plans: sortedPlans,
        firstPlan: sortedPlans[0],
      };
    });

    return mappedGroups
      .sort((groupA, groupB) => {
        const dateA = groupA.firstPlan.trainingDate;
        const dateB = groupB.firstPlan.trainingDate;
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const timeA = groupA.firstPlan.startTime || "";
        const timeB = groupB.firstPlan.startTime || "";
        if (timeA !== timeB) return timeA.localeCompare(timeB);

        const weightA = getCompanySortWeight(groupA.firstPlan);
        const weightB = getCompanySortWeight(groupB.firstPlan);
        if (weightA !== weightB) return weightA - weightB;

        const companyA = formatRollingPlanCompanies(groupA.firstPlan);
        const companyB = formatRollingPlanCompanies(groupB.firstPlan);
        return companyA.localeCompare(companyB);
      })
      .map((group, index) => ({
        id: group.id,
        plans: group.plans,
        sequence: index + 1,
      }));
  }, [visiblePlans, userCompanyCode]);
  const companyPlanGroups = useMemo(() => {
    const groupsMap = new Map<string, typeof visiblePlanGroups>();

    visiblePlanGroups.forEach((group) => {
      const plan = group.plans[0];
      const isCenter = plan?.ownerScope === "CENTER" || plan?.ownerCompany === "HRD Center" || plan?.ownerName === "Center HRD" || plan?.provider === "HRD Center";
      const compKey = isCenter ? "HRD Center" : (plan?.ownerCompany || plan?.company || "Other");

      groupsMap.set(compKey, [...(groupsMap.get(compKey) ?? []), group]);
    });

    const userCompLabel = userCompanyCode && userCompanyCode !== "CENTER" ? userCompanyCode : "";

    const entries = [...groupsMap.entries()].map(([companyName, groupList]) => ({
      companyName,
      groups: groupList,
      isUserCompany: userCompLabel ? companyName === userCompLabel : companyName === "HRD Center",
    }));

    return entries.sort((a, b) => {
      if (a.isUserCompany && !b.isUserCompany) return -1;
      if (!a.isUserCompany && b.isUserCompany) return 1;

      if (a.companyName === "HRD Center") return -1;
      if (b.companyName === "HRD Center") return 1;

      return a.companyName.localeCompare(b.companyName);
    });
  }, [visiblePlanGroups, userCompanyCode]);

  const selectedGroup =
    visiblePlanGroups.find((group) => group.id === selectedGroupId) ?? null;
  const isSelectedGroupCenter = selectedGroup
    ? (selectedGroup.plans[0]?.ownerScope === "CENTER" ||
       selectedGroup.plans[0]?.ownerCompany === "HRD Center" ||
       selectedGroup.plans[0]?.ownerName === "Center HRD" ||
       selectedGroup.plans[0]?.provider === "HRD Center")
    : false;
  const isSelectedGroupReadOnlyForFactory = isFactoryUser && isSelectedGroupCenter;

  const getNextBatchNumber = (oapId: string): string => {
    if (!oapId) return "1";
    const matchingPlans = rollingPlans.filter((p) => p.oapId === oapId);
    const targetOap = oapPlans.find((o) => o.id === oapId);
    const courseCode = targetOap?.course?.courseCode;
    const sameCoursePlans = courseCode
      ? rollingPlans.filter((p) => p.course?.code === courseCode || p.oapId === oapId)
      : matchingPlans;

    const plansToScan = sameCoursePlans.length > 0 ? sameCoursePlans : matchingPlans;
    if (plansToScan.length === 0) return "1";

    let maxBatch = 0;
    for (const plan of plansToScan) {
      if (typeof plan.batchNo === "number" && !isNaN(plan.batchNo) && plan.batchNo > maxBatch) {
        maxBatch = plan.batchNo;
      }
      if (plan.batch) {
        const matches = plan.batch.match(/\d+/g);
        if (matches) {
          for (const m of matches) {
            const num = parseInt(m, 10);
            if (!isNaN(num) && num > maxBatch) {
              maxBatch = num;
            }
          }
        }
      }
    }
    return String(maxBatch + 1);
  };

  const updateOap = (value: string) => {
    const nextBatch = getNextBatchNumber(value);
    setForm((current) => {
      const isInitialOrNumeric = current.sessions.every(
        (s) => !s.batchName || /^\d+$/.test(s.batchName.trim())
      );
      return {
        ...current,
        oapId: value,
        sessions: current.sessions.map((session) => ({
          ...session,
          batchName: isInitialOrNumeric || !session.batchName ? nextBatch : session.batchName,
        })),
      };
    });
  };

  const updateSession = <Field extends Exclude<keyof RollingSessionForm, "id" | "dbId">>(
    sessionId: string,
    field: Field,
    value: RollingSessionForm[Field],
  ) => {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    }));
  };

  const addSession = () => {
    const prevSession = form.sessions[form.sessions.length - 1];
    const defaultBatch =
      prevSession?.batchName?.trim() || getNextBatchNumber(form.oapId);
    setForm((current) => ({
      ...current,
      sessions: [
        ...current.sessions,
        createEmptySession(current.sessions.length, defaultBatch),
      ],
    }));
  };

  const removeSession = (sessionId: string) => {
    const sessionToRemove = form.sessions.find((s) => s.id === sessionId);
    if (sessionToRemove?.dbId) {
      setDeletedSessionDbIds((prev) => [...prev, sessionToRemove.dbId!]);
    }
    setForm((current) => ({
      ...current,
      sessions:
        current.sessions.length === 1
          ? current.sessions
          : current.sessions.filter((session) => session.id !== sessionId),
    }));
  };

  const handleSave = async () => {
    const missingFields: string[] = [];

    if (!selectedOap) {
      missingFields.push("แผน OAP (OAP Plan) — เลือกแผนจากตารางก่อน");
    }
    if (form.sessions.length === 0) {
      missingFields.push("รุ่นการอบรม (Session) — เพิ่มอย่างน้อย 1 รุ่น");
    }
    form.sessions.forEach((session, index) => {
      const label = session.batchName.trim() || `รุ่นที่ ${index + 1} (Session ${index + 1})`;
      if (!session.location.trim()) {
        missingFields.push(`สถานที่อบรมของ ${label} (Location)`);
      }
      if (!session.trainingDate) {
        missingFields.push(`วันที่เริ่มอบรมของ ${label} (Start Date)`);
      }
    });

    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    if (!selectedOap) {
      return;
    }

    const today = getLocalDateString();
    // Read before the form is reset below, otherwise the toast reports 0.
    const sessionCount = form.sessions.length;

    try {
      // 1. Delete any sessions removed from the form
      for (const dbId of deletedSessionDbIds) {
        await deleteRollingPlan(dbId);
      }
      setDeletedSessionDbIds([]);

      // 2. Save or update remaining sessions, remembering each batch id for the request hand-off.
      const savedPlanIds: string[] = [];
      for (const session of form.sessions) {
        const startDate = session.trainingDate || today;
        const input = {
          oapPlanId: selectedOap.id,
          batchName: session.batchName.trim() || null,
          venue: session.location.trim(),
          trainingDate: startDate,
          endDate: session.endDate || startDate,
          startTime: session.startTime || "09:00",
          endTime: session.endTime || "16:00",
          formOverrides: session.formOverrides,
        };

        if (session.dbId) {
          await updateRollingPlan(session.dbId, input);
          savedPlanIds.push(session.dbId);
        } else {
          const { rollingPlan } = await createRollingPlan({ ...input, status: "Planning" });
          savedPlanIds.push(rollingPlan.id);
        }
      }

      // 3. Enrol the attached requesters into the chosen batch and mark their requests planned.
      const toLink = handoffRequests.filter((request) => handoffChecked.has(request.id));
      const targetPlanId = savedPlanIds[Math.min(handoffSession, savedPlanIds.length - 1)];
      if (toLink.length > 0 && targetPlanId) {
        const outcome = await enrollAndLink(toLink, targetPlanId, isFactoryUser ? "HRD_FACTORY" : "HRD_CENTER", confirm);
        if (outcome.linked > 0) {
          toast.success(t(`ลงชื่อและจัดคำขอเข้ารุ่นแล้ว ${outcome.linked} คน`, `Enrolled and planned ${outcome.linked} requester(s)`));
        }
        if (outcome.skipped.length > 0 || outcome.failed.length > 0) {
          const lines = [
            outcome.skipped.length ? t(`ข้าม: ${outcome.skipped.join(", ")}`, `Skipped: ${outcome.skipped.join(", ")}`) : "",
            ...outcome.failed.map((item) => t(`ไม่สำเร็จ: ${item.name} - ${item.message}`, `Failed: ${item.name} - ${item.message}`)),
          ];
          await notice({ title: t("บางคนยังไม่ได้ลงชื่อเข้ารุ่น", "Some requesters were not added"), message: lines.filter(Boolean).join("\n") });
        }
        setHandoffRequests([]);
        router.replace("/training-plan/training-rolling");
      }

      setForm(createEmptyForm());
      setIsNewOpen(false);
      await loadWorkspace();
      toast.success(
        `บันทึกแผน Rolling ${sessionCount} รุ่นแล้ว / Saved ${sessionCount} session(s)`,
      );
    } catch (error) {
      console.error("Failed to save Training Rolling plan", error);
      toast.error("บันทึกแผน Rolling ไม่สำเร็จ / Failed to save Training Rolling plan");
    }
  };

  const handleEditGroup = (group: { id: string; plans: RollingPlan[] }) => {
    const plan = group.plans[0];
    setDeletedSessionDbIds([]);
    setForm({
      oapId: plan.oapId,
      sessions: group.plans.map((p, index) => ({
        id: p.rollingId || `session-${index}`,
        dbId: p.rollingId,
        status: p.status,
        batchName: p.batch,
        location: p.location,
        trainingDate: p.trainingDate,
        endDate: p.endDate || p.trainingDate,
        startTime: p.startTime || "09:00",
        endTime: p.endTime || "16:00",
        formOverrides: p.formOverrides,
      })),
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDeleteGroup = async (group: { id: string; plans: RollingPlan[] }) => {
    const courseName = group.plans[0]?.course.name || "selected plan";
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบรุ่นการอบรมทั้ง ${group.plans.length} รุ่นของ "${courseName}" หรือไม่?`, en: `Confirm deleting all ${group.plans.length} session(s) for "${courseName}"?` }, danger: true }))) {
      return;
    }
    try {
      for (const plan of group.plans) {
        await deleteRollingPlan(plan.rollingId);
      }
      setSelectedGroupId("");
      if (openDetailId === group.id) {
        setOpenDetailId("");
      }
      await loadWorkspace();
      toast.success(
        `ลบแผน Rolling ${group.plans.length} รุ่นแล้ว / Deleted ${group.plans.length} session(s)`,
      );
    } catch (error) {
      console.error("Failed to delete Training Rolling plan", error);
      toast.error("ลบแผน Rolling ไม่สำเร็จ / Failed to delete Training Rolling plan");
    }
  };

  const handleEditSession = (plan: RollingPlan) => {
    setDeletedSessionDbIds([]);
    setForm({
      oapId: plan.oapId,
      sessions: [
        {
          id: plan.rollingId,
          dbId: plan.rollingId,
          status: plan.status,
          batchName: plan.batch,
          location: plan.location,
          trainingDate: plan.trainingDate,
          endDate: plan.endDate || plan.trainingDate,
          startTime: plan.startTime,
          endTime: plan.endTime,
          formOverrides: plan.formOverrides,
        },
      ],
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = async (rollingId: string) => {
    if (!(await confirm({ message: { th: "ยืนยันที่จะลบรุ่นการอบรมนี้หรือไม่?", en: "Confirm deleting this session?" }, danger: true }))) {
      return;
    }
    try {
      await deleteRollingPlan(rollingId);
      if (openDetailId === rollingId) {
        setOpenDetailId("");
      }
      await loadWorkspace();
      toast.success("ลบรุ่นการอบรมแล้ว / Session deleted");
    } catch (error) {
      console.error("Failed to delete Training Rolling plan", error);
      toast.error("ลบรุ่นการอบรมไม่สำเร็จ / Failed to delete Training Rolling plan");
    }
  };

  const handleCancelSession = async (plan: RollingPlan) => {
    if (
      !(await confirm({
        message: {
          th: "ยืนยันที่จะยกเลิกรุ่นการอบรมที่เผยแพร่แล้วหรือไม่? พนักงานจะไม่เห็นและลงทะเบียนไม่ได้อีก",
          en: "Confirm cancelling this published session? Employees can no longer see or enrol.",
        },
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await updateRollingPlan(plan.rollingId, { status: "Cancel" });
      await loadWorkspace();
      toast.success("ยกเลิกรุ่นการอบรมที่เผยแพร่แล้ว / Published session cancelled");
    } catch (error) {
      console.error("Failed to cancel Training Rolling session", error);
      toast.error("ยกเลิกรุ่นการอบรมไม่สำเร็จ / Failed to cancel Training Rolling session");
    }
  };

  const handleExportOutline = async (plan: RollingPlan) => {
    setExportingPlanId(plan.rollingId);
    try {
      const oapPlan = oapPlans.find((item) => item.id === plan.oapId) ?? null;
      const courseCode = await downloadRollingCourseOutline(plan, standards, oapPlan);
      toast.success(`ดาวน์โหลด Course Outline ${courseCode} แล้ว / Course Outline exported`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ส่งออก Course Outline ไม่สำเร็จ / Unable to export Course Outline",
      );
    } finally {
      setExportingPlanId("");
    }
  };

  const handleRefresh = async () => {
    await loadWorkspace();
    setForm(createEmptyForm());
    setIsNewOpen(false);
    setOpenDetailId("");
    setSelectedGroupId("");
    setSearch("");
    setSelectedYear(currentYear());
    setSelectedMonth("all");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setForm(createEmptyForm());
    setOpenDetailId("");
    setSelectedGroupId("");
    setIsNewOpen(true);
  };

  const handleConfirm = async (rollingId: string) => {
    if (!(await confirm({ message: { th: "ยืนยันที่จะเผยแพร่รุ่นการอบรมนี้หรือไม่? พนักงานจะมองเห็นและลงทะเบียนได้ทันที", en: "Confirm publishing this session? Employees can see and enrol immediately." } }))) return;
    try {
      await updateRollingPlan(rollingId, { status: "Planned" });
      await loadWorkspace();
      toast.success("เผยแพร่รุ่นการอบรมแล้ว พนักงานลงทะเบียนได้ทันที / Session published");
    } catch (error) {
      console.error("Failed to publish Training Rolling plan", error);
      toast.error("เผยแพร่รุ่นการอบรมไม่สำเร็จ / Failed to publish Training Rolling plan");
    }
  };

  if (isLoading) {
    return (
      <section className={styles.page} aria-label="Training Rolling monthly plan">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{trainingRollingModule.subtitle}</p>
            <h2>{trainingRollingModule.title}</h2>
            <p>{trainingRollingModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label="กำลังโหลดข้อมูลแผนการอบรมรายเดือน (Rolling Plan)..." />
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Training Rolling monthly plan">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingRollingModule.subtitle}</p>
          <h2>{trainingRollingModule.title}</h2>
          <p>{trainingRollingModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.kicker}>Monthly view</p>
            <h3>{selectedMonthLabel} {selectedYear} rolling schedule</h3>
          </div>
          <span>{visiblePlans.length} shown</span>
        </div>

        <section className={styles.toolbar} aria-label="Training Rolling toolbar">
          <div className={styles.filterRow}>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                aria-label="Search monthly rolling plan"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("ค้นหารหัสหลักสูตร, ชื่อ, รุ่น, สถานที่, สถานะ...", "Search course code, name, batch, location, status...")}
              />
            </div>
            <div className={styles.filterGroup}>
              {user?.roleCode === "HRD_CENTER" ? (
                <label className={styles.filterLabel}>
                  <span>{t("บริษัท", "Company")}</span>
                  <select
                    className={styles.selectInput}
                    aria-label="Filter company"
                    value={companyFilter}
                    onChange={(event) => setCompanyFilter(event.target.value)}
                  >
                    <option value="all">{t("ทุกบริษัท", "All Companies")}</option>
                    <option value="CENTER">HRD Center</option>
                    <option value="ATA">ATA</option>
                    <option value="TEP">TEP</option>
                    <option value="ATFB">ATFB</option>
                    <option value="NIC">NIC</option>
                    <option value="SATI">SATI</option>
                    <option value="SNF">SNF</option>
                  </select>
                </label>
              ) : null}
              <label className={styles.filterLabel}>
                <span>{t("ปี", "Year")}</span>
                <select className={styles.selectInput} aria-label="Filter year" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                  {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className={styles.filterLabel}>
                <span>{t("เดือน", "Month")}</span>
                <select className={styles.selectInput} aria-label="Filter month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                  <option value="all">{t("ตลอดทั้งปี", "All Year")}</option>
                  {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                </select>
              </label>
              <label className={styles.filterLabel}>
                <span>{t("สถานะ", "Status")}</span>
                <select className={styles.selectInput} aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | RollingStatus)}>
                  <option value="all">All status</option>
                  <option value="Planning">Planning</option>
                  <option value="Planned">Planned</option>
                  <option value="Cancel">Cancel</option>
                </select>
              </label>
            </div>
          </div>
          <div className={styles.actionRow}>
            <button
              className={styles.primaryButton}
              disabled={oapSources.length === 0}
              title={oapSources.length === 0 ? "Create a Training OAP before creating a rolling plan." : "Create monthly rolling plan"}
              type="button"
              onClick={handleNew}
            >
              + New
            </button>
            <button
              className={styles.secondaryButton}
              disabled={!selectedGroup || isSelectedGroupReadOnlyForFactory}
              title={isSelectedGroupReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้ (ส่งผู้เข้าร่วมได้ใน Training Accept Survey)" : "Edit monthly rolling plan"}
              type="button"
              onClick={() => selectedGroup && !isSelectedGroupReadOnlyForFactory && handleEditGroup(selectedGroup)}
            >
              Edit
            </button>
            <button
              className={styles.dangerButton}
              disabled={!selectedGroup || isSelectedGroupReadOnlyForFactory}
              title={isSelectedGroupReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : "Delete monthly rolling plan"}
              type="button"
              onClick={() => selectedGroup && !isSelectedGroupReadOnlyForFactory && void handleDeleteGroup(selectedGroup)}
            >
              Delete
            </button>
            <button
              className={styles.secondaryButton}
              disabled={!selectedGroup || Boolean(exportingPlanId)}
              type="button"
              onClick={() => selectedGroup && void handleExportOutline(selectedGroup.plans[0])}
            >
              {exportingPlanId ? "Preparing..." : "Export Outline"}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => void handleRefresh()}>
              Refresh
            </button>
          </div>
        </section>

        <p className={styles.selectionHint} aria-live="polite">
          {selectedGroup
            ? `Selected: ${selectedGroup.plans[0]?.course.code} / ${selectedGroup.plans[0]?.course.name}`
            : "Click on any course row to select, Edit, Delete, Export Outline or view details."}
        </p>

        {isNewOpen ? (
          <div className={styles.modalOverlay} onClick={() => setIsNewOpen(false)}>
            <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <p className={styles.kicker}>New monthly plan</p>
                  <h3 className={styles.modalTitle}>{form.sessions.some((session) => session.dbId) ? "Edit Training Rolling" : "Create Training Rolling"}</h3>
                </div>
                <button
                  aria-label="Close"
                  className={styles.modalCloseButton}
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
              <div className={styles.fullField}>
                <span>{t("หลักสูตร (Course Name)", "Course Name")} <RequiredIndicator isFilled={Boolean(form.oapId)} /></span>
                <SearchableSelect
                  options={oapSources.map((source) => {
                    const tag = source.course.courseGroup || source.course.courseType;
                    const primaryName = getCourseDisplayName(source.course);
                    const secondaryName = getCourseSecondaryName(source.course);
                    const oapDetails = `แผน OAP #${source.id}: ${source.participants} คน • ${source.hours} ชม. • ${source.ownerCompany || source.owner}`;
                    const enName = source.course.courseNameEn?.trim() || "";
                    const thName = source.course.courseNameTh?.trim() || "";

                    return {
                      value: source.id,
                      label: `[${source.course.courseCode}] ${primaryName}`,
                      secondaryLabel: secondaryName ? `${secondaryName} • ${oapDetails}` : oapDetails,
                      badge: tag || undefined,
                      keywords: `${enName} ${thName} ${source.course.courseCode} ${source.id} ${tag || ""}`,
                    };
                  })}
                  value={form.oapId}
                  onChange={(oapId) => updateOap(oapId)}
                  placeholder="พิมพ์เพื่อค้นหาหลักสูตร/แผน OAP... / Search course or OAP plan..."
                />
              </div>

              {handoffIds.length > 0 ? (
                <NeedRequestAttachPanel
                  requests={handoffRequests}
                  checkedIds={handoffChecked}
                  onToggle={(id) =>
                    setHandoffChecked((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  sessionLabels={form.sessions.map((session, index) => `${t("รุ่น", "Session")} ${session.batchName || index + 1}${session.trainingDate ? ` · ${formatDateRangeDayMonthYear(session.trainingDate, session.endDate, isThai)}` : ""}`)}
                  targetSession={handoffSession}
                  onTargetSession={setHandoffSession}
                  planCompanyCode={selectedOap?.owner === "FACTORY" ? selectedOap.ownerCompany : null}
                  hasPlan={selectedOap !== null}
                  onCreateOap={() => router.push(`/training-plan/training-oap${needRequestQuery(handoffIds)}`)}
                  isThai={isThai}
                />
              ) : null}

              <div className={`${styles.fullField} ${styles.sessionSection}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <strong>Training sessions</strong>
                    <span>Add another session when the course has a different batch, date, time, or location.</span>
                  </div>
                  <button className={styles.addSessionButton} disabled={!selectedOap} type="button" onClick={addSession}>
                    Add session
                  </button>
                </div>

                <div className={styles.sessionList}>
                  {form.sessions.map((session, index) => (
                    <article className={styles.sessionCard} key={session.id}>
                      <div className={styles.sessionHeader}>
                        <strong>{t(`รุ่นที่ ${index + 1}`, `Session ${index + 1}`)}</strong>
                        <button
                          className={styles.removeSessionButton}
                          disabled={!selectedOap || form.sessions.length === 1 || session.status !== "Planning"}
                          title={session.status !== "Planning" ? "Published sessions must be cancelled from the detail panel." : undefined}
                          type="button"
                          onClick={() => removeSession(session.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className={styles.sessionGrid}>
                        <label>
                          <span>{language === 'th' ? 'รุ่นการอบรม (Batch)' : 'Batch'} <RequiredIndicator isFilled={Boolean(session.batchName.trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            placeholder={language === 'th' ? "เช่น 1, 2 หรือระบุชื่อรุ่น" : "Optional label, e.g. 1, 2 or Batch label"}
                            value={session.batchName}
                            onChange={(event) =>
                              updateSession(session.id, "batchName", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>{t("สถานที่จัดอบรม (Location)", "Location")} <RequiredIndicator isFilled={Boolean(session.location.trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            value={session.location}
                            onChange={(event) =>
                              updateSession(session.id, "location", event.target.value)
                            }
                          />
                        </label>

                        <label>
                          <span>{t("วันที่เริ่ม (Start Date)", "Start Date")} <RequiredIndicator isFilled={Boolean(session.trainingDate.trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            type="date"
                            value={session.trainingDate}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
                            onChange={(event) => {
                              const newDate = event.target.value;
                              updateSession(session.id, "trainingDate", newDate);
                              if (!session.endDate || session.endDate < newDate) {
                                updateSession(session.id, "endDate", newDate);
                              }
                            }}
                          />
                        </label>
                        <label>
                          <span>{t("วันที่สิ้นสุด (End Date)", "End Date")} <RequiredIndicator isFilled={Boolean((session.endDate || session.trainingDate).trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            type="date"
                            min={session.trainingDate}
                            value={session.endDate || session.trainingDate}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
                            onChange={(event) =>
                              updateSession(session.id, "endDate", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>{t("เวลาเริ่ม (Start Time)", "Start Time")} <RequiredIndicator isFilled={Boolean(session.startTime.trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.startTime}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
                            onChange={(event) =>
                              updateSession(session.id, "startTime", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>{t("เวลาสิ้นสุด (End Time)", "End Time")} <RequiredIndicator isFilled={Boolean(session.endTime.trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.endTime}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
                            onChange={(event) =>
                              updateSession(session.id, "endTime", event.target.value)
                            }
                          />
                        </label>
                      </div>

                      {/* Per-batch forms. Left on "ใช้ตามหลักสูตร" this batch simply follows the
                          course, which is what almost every batch wants - so the whole block is
                          folded away until someone opens it. */}
                      {selectedOap ? (
                        <details className={styles.sessionFormOverrides}>
                          <summary>
                            <ClipboardCheck size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                            {" "}{t("แบบทดสอบ / แบบประเมินของรุ่นนี้", "Session Test / Evaluation Forms")}
                            {Object.values(session.formOverrides).some(Boolean) ? (
                              <em> · {t("แก้เฉพาะรุ่นนี้", "Session override")}</em>
                            ) : (
                              <em> · {t("ใช้ตามหลักสูตร", "Use course default")}</em>
                            )}
                          </summary>
                          <div className={styles.sessionFormOverrideGrid}>
                            {FORM_STAGES.map((stage) => {
                              const options = optionsForStage(stage, assessmentOptions, evaluationOptions);
                              const courseDefault =
                                stage.idKey === "preAssessmentId"
                                  ? selectedOap.course.preTest || selectedOap.course.preTestLink
                                  : stage.idKey === "postAssessmentId"
                                    ? selectedOap.course.postTest || selectedOap.course.postTestLink
                                    : stage.idKey === "evaluationFormId"
                                      ? selectedOap.course.evaluation || selectedOap.course.evaluationLink
                                      : selectedOap.course.evaluationAfter30Day || selectedOap.course.evaluationAfter30DayLink;
                              const link = session.formOverrides[stage.linkKey];
                              const usingLink = Boolean(link);
                              return (
                                <label key={stage.idKey}>
                                  <span>{stage.label}</span>
                                  <select
                                    value={usingLink ? LINK_MODE_VALUE : session.formOverrides[stage.idKey]}
                                    onChange={(event) =>
                                      updateSession(
                                        session.id,
                                        "formOverrides",
                                        setStageChoice(session.formOverrides, stage, event.target.value),
                                      )
                                    }
                                  >
                                    <option value="">— {t("ใช้ตามหลักสูตร", "Use course default")} ({courseDefault || t("ไม่มี", "None")}) —</option>
                                    {options.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                    <option value={LINK_MODE_VALUE}>ใช้ลิงก์ภายนอก (External Link)</option>
                                  </select>
                                  {usingLink ? (
                                    <span className={styles.sessionLinkRow}>
                                      <input
                                        type="url"
                                        placeholder="https://forms.gle/..."
                                        value={link.trim()}
                                        onChange={(event) =>
                                          updateSession(session.id, "formOverrides", {
                                            ...session.formOverrides,
                                            [stage.linkKey]: event.target.value || " ",
                                          })
                                        }
                                      />
                                      <button
                                        type="button"
                                        title="ดาวน์โหลด QR code ของลิงก์นี้"
                                        disabled={!link.trim()}
                                        onClick={() =>
                                          void downloadQrCode(link, `${session.batchName || "batch"}-${stage.idKey}`).catch(
                                            () => toast.error("สร้าง QR code ไม่สำเร็จ"),
                                          )
                                        }
                                      >
                                        <DownloadIcon />
                                        โหลด QR
                                      </button>
                                    </span>
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            </div>
            {selectedOap ? (
              <div className={styles.coursePreview}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitleWrap}>
                    <div className={styles.previewTitleMain}>
                      <span className={styles.previewCodeBadge}>{selectedOap.course.courseCode}</span>
                      <strong>{getCourseDisplayName(selectedOap.course)}</strong>
                    </div>
                  </div>
                  <div className={styles.previewBadges}>
                    {selectedOap.course.courseType ? (
                      <span className={`${styles.previewBadge} ${styles.previewBadgeHighlight}`}>
                        <Tag size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {selectedOap.course.courseType}
                      </span>
                    ) : null}
                    {selectedOap.course.courseGroup ? (
                      <span className={styles.previewBadge} translate="no">
                        <Folder size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {selectedOap.course.courseGroup}
                      </span>
                    ) : null}
                    <span className={styles.previewBadge}>
                      <Clock size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {!selectedOap.course.lifeCycleMonth || selectedOap.course.lifeCycleMonth === "0" || Number(selectedOap.course.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : `${selectedOap.course.lifeCycleMonth} Months`}
                    </span>
                    <span className={styles.previewBadge}>
                      <Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {selectedOap.ownerCompany || selectedOap.owner}
                    </span>
                  </div>
                </div>

                <div className={styles.previewSections}>
                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <Target size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("วัตถุประสงค์และเนื้อหา (Objectives & Content)", "Objectives & Content")}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ที่มา (Background)", "Background")}</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.remark || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("วัตถุประสงค์", "Objective")}</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.objective || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("หัวข้อการเรียนรู้", "Learning Content")}</span>
                      <span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>
                        {selectedOap.course.learningContent || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("วิธีการอบรม", "Methodology")}</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.methodology || "-"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>{t("ประมาณการงบประมาณและการจัด (Budget & Capacity)", "Budget & Capacity Estimation")}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ผู้เข้าอบรมต่อรุ่น", "Participants / Batch")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.participants ? (isThai ? `${selectedOap.participants} ท่าน` : `${selectedOap.participants} seats`) : "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ชั่วโมงการอบรม", "Training Hours")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.hours ? (isThai ? `${selectedOap.hours} ชม.` : `${selectedOap.hours} hrs`) : "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าวิทยากร", "Instructor")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.budgetInstructor ? `฿${Number(selectedOap.budgetInstructor).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าเดินทาง", "Traveling")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.budgetTraveling ? `฿${Number(selectedOap.budgetTraveling).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าห้องสัมมนา", "Seminar Room")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.budgetSeminarRoom ? `฿${Number(selectedOap.budgetSeminarRoom).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าที่พัก", "Accommodation")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.budgetAccommodation ? `฿${Number(selectedOap.budgetAccommodation).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าเอกสาร/อุปกรณ์", "Material")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.budgetMaterial ? `฿${Number(selectedOap.budgetMaterial).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าอาหาร/เครื่องดื่ม", "Food & Beverage")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.budgetFoodBeverage ? `฿${Number(selectedOap.budgetFoodBeverage).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewBudgetTotalRow}`}>
                      <span className={styles.previewFieldLabel}><strong>{t("งบประมาณรวม (Total Budget)", "Total Budget")}</strong></span>
                      <span className={styles.previewFieldValue}>
                        <strong className={styles.previewBudgetTotalText}>
                          ฿{selectedOap.budget ? Number(selectedOap.budget).toLocaleString("en-US") : "0"}
                        </strong>
                        {Number(selectedOap.participants) > 0 && Number(selectedOap.budget) > 0 ? (
                          <span className={styles.previewBudgetPerHead}>
                            (~฿{Math.round(Number(selectedOap.budget) / Number(selectedOap.participants)).toLocaleString("en-US")} / " + t("ท่าน", "seat") + ")
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>{t("รายละเอียดวิทยากรและสถาบัน (Instructor & Provider)", "Instructor & Provider Details")}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ชื่อวิทยากร", "Instructor Name")}</span>
                      <span className={styles.previewFieldValue}>
                        {(selectedOapInstructor ? formatInstructorFullName(selectedOapInstructor) : selectedOap.trainer) || "-"}
                      </span>
                    </div>
                    {selectedOapInstructor?.instructorCode ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>{t("รหัสวิทยากร", "Instructor Code")}</span>
                        <span className={styles.previewFieldValue}>{selectedOapInstructor.instructorCode}</span>
                      </div>
                    ) : null}
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("สถาบัน / ผู้ให้บริการ", "Provider")}</span>
                      <span className={styles.previewFieldValue}>{selectedOap.providerName || selectedOap.providerId || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("มหาวิทยาลัย", "University")}</span>
                      <span className={styles.previewFieldValue}>{selectedOapInstructor?.university || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("วุฒิการศึกษา", "Education")}</span>
                      <span className={styles.previewFieldValue}>{selectedOapInstructor?.education || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("หน่วยงาน / สังกัด", "Organization")}</span>
                      <span className={styles.previewFieldValue}>{selectedOapInstructor?.organizationName || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("เบอร์โทรศัพท์", "Telephone")}</span>
                      <span className={styles.previewFieldValue}>{selectedOapInstructor?.telephone || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("อีเมล", "Email")}</span>
                      <span className={styles.previewFieldValue}>{selectedOapInstructor?.email || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ขอบเขตแผน", "Plan Scope")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.owner === "CENTER" ? t("ทุกบริษัท (All Companies)", "All Companies") : selectedOap.ownerCompany}
                      </span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <Users size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("กลุ่มเป้าหมายมาตรฐาน (Standard Target)", "Standard Target Group")}
                      </span>
                    </div>
                    {(() => {
                      const std = resolveRollingOapStandard(selectedOap, standards);
                      return (
                        <>
                          {std?.isSnapshot ? (
                            <div style={{ padding: "0 0 8px 0" }}>
                              <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, background: "rgba(34, 197, 94, 0.1)", color: "#16a34a", border: "1px solid rgba(34, 197, 94, 0.25)", fontWeight: 500 }}>
                                {t("เกณฑ์ ณ วันบันทึกแผน", "Saved Plan Target")}
                              </span>
                            </div>
                          ) : null}
                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                            <span className={styles.previewFieldLabel}>Companies</span>
                            {std?.companies?.length ? (
                              <span className={styles.previewBadges}>
                                {std.companies.map((company) => (
                                  <span key={company} className={styles.previewBadge}>{company}</span>
                                ))}
                              </span>
                            ) : (
                              <span className={styles.previewFieldValue}>All Companies</span>
                            )}
                          </div>
                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                            <span className={styles.previewFieldLabel}>Org Scope</span>
                            <span className={styles.previewFieldValue}>
                              {std
                                ? [std.functionName, std.division, std.department, std.section].filter(Boolean).join(" / ") || "All Function"
                                : "No standard defined"}
                            </span>
                          </div>
                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                            <span className={styles.previewFieldLabel}>Positions</span>
                            {std?.positions.length ? (
                              <span className={styles.previewBadges}>
                                {std.positions.map((position) => (
                                  <span key={position} className={styles.previewBadge}>{position}</span>
                                ))}
                              </span>
                            ) : (
                              <span className={styles.previewFieldValue}>All Positions</span>
                            )}
                          </div>
                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                            <span className={styles.previewFieldLabel}>Levels</span>
                            {std?.levels.length ? (
                              <span className={styles.previewBadges}>
                                {std.levels.map((level) => (
                                  <span key={level} className={styles.previewBadge}>{level}</span>
                                ))}
                              </span>
                            ) : (
                              <span className={styles.previewFieldValue}>All Levels</span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <ClipboardCheck size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        Assessments & Evaluation
                      </span>
                    </div>
                    <div className={styles.assessmentGrid}>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Pre-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.preTest || selectedOap.course.preTestLink || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Post-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.postTest || selectedOap.course.postTestLink || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Course Evaluation</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluation || selectedOap.course.evaluationLink || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>30-Day Follow-Up</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluationAfter30Day || selectedOap.course.evaluationAfter30DayLink || "None"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.secondaryButton} type="button" onClick={() => { setForm(createEmptyForm()); setIsNewOpen(false); }}>Cancel</button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => void handleSave()}
                >
                  {form.sessions.some((session) => session.dbId) ? "Save changes" : "Save Draft"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.companySectionsContainer}>
          {companyPlanGroups.map((companySection) => {
            const sessions = companySection.groups
              .flatMap((group) => group.plans.map((plan) => ({ ...plan, group })))
              .sort(
                (a, b) =>
                  a.trainingDate.localeCompare(b.trainingDate) ||
                  (a.startTime || "").localeCompare(b.startTime || ""),
              );
            const totalPages = Math.max(1, Math.ceil(sessions.length / ROLLING_PAGE_SIZE));
            const page = Math.min(sectionPage[companySection.companyName] ?? 1, totalPages);
            const pageStart = (page - 1) * ROLLING_PAGE_SIZE;
            const { start: windowStart, end: windowEnd } = pageWindow(page, totalPages);
            const goToPage = (pageNumber: number) =>
              setSectionPage((current) => ({ ...current, [companySection.companyName]: pageNumber }));
            const section = {
              ...companySection,
              pageStart,
              pageSessions: sessions.slice(pageStart, pageStart + ROLLING_PAGE_SIZE),
            };

            return (
            <div
              key={section.companyName}
              className={`${styles.companySectionBlock} ${isSectionOpen(section.companyName) ? styles.openSection : ""}`}
            >
              <button
                className={`${styles.companySectionHeader} ${section.isUserCompany ? styles.ownCompanySectionHeader : ""}`}
                type="button"
                aria-expanded={isSectionOpen(section.companyName)}
                onClick={() => toggleSection(section.companyName)}
              >
                <div className={styles.companySectionTitle}>
                  <span className={styles.chevron} aria-hidden="true" />
                  <span className={styles.companyIcon}>{section.companyName === "HRD Center" ? <Building2 size={18} /> : <Factory size={18} />}</span>
                  <h4>{t(`แผนอบรม ${section.companyName}`, `Training Plan - ${section.companyName}`)}</h4>
                  {section.isUserCompany ? (
                    <span className={styles.ownCompanySectionTag}>
                      <Star size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {t(`บริษัทของฉัน (${userCompanyCode || "HRD Center"})`, `My Company (${userCompanyCode || "HRD Center"})`)}
                    </span>
                  ) : null}
                </div>
                <span className={styles.companyCountBadge} translate="no">{sessions.length} {t("รอบอบรม", "sessions")}</span>
              </button>

              {!isSectionOpen(section.companyName) ? null : (
              <div className={styles.tableWrap}>
                <table className={styles.rollingTable}>
                  <thead>
                    <tr>
                      <th>Seq.</th>
                      <th>Course Name</th>
                      <th>Actions</th>
                      <th>Course Group</th>
                      <th>Batch</th>
                      <th>Date &amp; Time</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Job Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.pageSessions.map((plan, index) => {
                      const group = plan.group;
                      const isOpen = openDetailId === plan.rollingId;
                      const isCenterGroup = isCenterOwned(plan);
                      const isRowReadOnlyForFactory = isFactoryUser && isCenterGroup;
                      const jobStatus = getJobStatus(plan);

                      return (
                        <Fragment key={plan.rollingId}>
                          <tr
                            className={`${group.id === selectedGroupId ? styles.selectedRow : ""} ${styles.clickableRow}`}
                            onClick={() => setSelectedGroupId(group.id === selectedGroupId ? "" : group.id)}
                          >
                            <td>
                              <label className={styles.selectionControl} onClick={(e) => e.stopPropagation()}>
                                <input
                                  aria-label={`Select ${plan.course.code} ${plan.batch}`}
                                  checked={group.id === selectedGroupId}
                                  name="selected-rolling-group"
                                  type="radio"
                                  onChange={() => setSelectedGroupId(group.id)}
                                />
                                <span translate="no">{section.pageStart + index + 1}</span>
                              </label>
                            </td>
                            <td>
                              <strong>{plan.course.name}</strong>
                              <span>
                                {plan.course.code}
                                {plan.course.nameTh && plan.course.nameTh !== plan.course.name ? ` / ${plan.course.nameTh}` : ""}
                              </span>
                              {isCenterGroup ? (
                                <div>
                                  <span className={styles.creatorBadgeCenter}>
                                    <Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                                    {t("จัดหลักสูตรโดย HRD Center", "Organized by HRD Center")}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className={styles.creatorBadgeFactory}>
                                    <Factory size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                                    {t(`จัดหลักสูตรโดย ${plan.ownerCompany || plan.company}`, `Organized by ${plan.ownerCompany || plan.company}`)}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                              <div className={styles.actionButtons}>
                                <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(plan.rollingId)}>
                                  {t("ดูรายละเอียด", "Details")}
                                </button>
                                <button
                                  className={styles.secondaryButton}
                                  disabled={isRowReadOnlyForFactory || plan.status === "Cancel"}
                                  title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้ (ส่งผู้เข้าร่วมได้ใน Training Accept Survey)" : undefined}
                                  type="button"
                                  onClick={() => {
                                    if (isRowReadOnlyForFactory) return;
                                    setSelectedGroupId(group.id);
                                    handleEditSession(plan);
                                  }}
                                >
                                  Edit
                                </button>
                                {plan.status === "Planning" ? (
                                  <>
                                    <button
                                      className={styles.dangerButton}
                                      disabled={isRowReadOnlyForFactory}
                                      title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
                                      type="button"
                                      onClick={() => !isRowReadOnlyForFactory && void handleDelete(plan.rollingId)}
                                    >
                                      Delete
                                    </button>
                                    <button
                                      className={styles.primaryButton}
                                      disabled={isRowReadOnlyForFactory}
                                      title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถเผยแพร่ได้" : undefined}
                                      type="button"
                                      onClick={() => !isRowReadOnlyForFactory && void handleConfirm(plan.rollingId)}
                                    >
                                      Publish
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className={styles.dangerButton}
                                    disabled={isRowReadOnlyForFactory || !canCancelSession(plan)}
                                    title={
                                      isRowReadOnlyForFactory
                                        ? "HRD Center sessions cannot be cancelled by a factory."
                                        : plan.status === "Cancel"
                                        ? "This session has already been cancelled."
                                        : !canCancelSession(plan)
                                        ? "The training date has passed, so this session can no longer be cancelled."
                                        : undefined
                                    }
                                    type="button"
                                    onClick={() => !isRowReadOnlyForFactory && void handleCancelSession(plan)}
                                  >
                                    {plan.status === "Cancel" ? "Cancelled" : "Cancel session"}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td translate="no">{plan.course.courseGroup || "-"}</td>
                            <td translate="no">{plan.batch}</td>
                            <td translate="no">
                              {formatDateRangeDayMonthYear(plan.trainingDate, plan.endDate, isThai)}
                              <span>{plan.startTime} - {plan.endTime}</span>
                            </td>
                            <td translate="no">{plan.location || "-"}</td>
                            <td>
                              <span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>
                                <span className={styles.statusDot} />
                                {getStatusLabel(plan.status)}
                              </span>
                            </td>
                            <td><span className={`${styles.jobPill} ${styles[`job${jobStatus}`]}`}>{jobStatus}</span></td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {totalPages > 1 ? (
                  <div className={styles.pagination}>
                    {windowStart > 1 ? (
                      <>
                        <button className={styles.paginationButton} type="button" aria-label="First page" onClick={() => goToPage(1)}>«</button>
                        <button className={styles.paginationButton} type="button" aria-label="Previous page" onClick={() => goToPage(page - 1)}>‹</button>
                      </>
                    ) : null}
                    {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        className={pageNumber === page ? styles.paginationButtonActive : styles.paginationButton}
                        type="button"
                        translate="no"
                        onClick={() => goToPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    {windowEnd < totalPages ? (
                      <>
                        <button className={styles.paginationButton} type="button" aria-label="Next page" onClick={() => goToPage(page + 1)}>›</button>
                        <button className={styles.paginationButton} type="button" aria-label="Last page" onClick={() => goToPage(totalPages)}>»</button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              )}
            </div>
            );
          })}
          {visiblePlanGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>{oapSources.length === 0 ? "No Training OAP found" : "No rolling plans found"}</strong>
              <span>
                {oapSources.length === 0
                  ? "Create a Training OAP plan first before creating a monthly rolling plan."
                  : "Try changing the month, year, status, or search text."}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {activeDetailPlan ? (() => {
        const plan = activeDetailPlan;
        const group = visiblePlanGroups.find((g) => g.plans.some((p) => p.rollingId === plan.rollingId));
        const std = resolveRollingPlanStandard(plan, standards);
        const companies = std?.companies ?? [];
        const estimate = calculateBudgetEstimate({
          totalBudget: plan.budget,
          participants: plan.participants,
          companyCount: companies.length,
        });
        const matchedRollingInstructor = instructors.find(
          (ins) =>
            (plan.instructorId && ins.instructorId === plan.instructorId) ||
            formatInstructorFullName(ins).toLowerCase() === plan.trainer?.trim().toLowerCase() ||
            `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === plan.trainer?.trim().toLowerCase() ||
            ins.instructorCode.toLowerCase() === plan.trainer?.trim().toLowerCase(),
        );

        return (
          <div className={styles.modalOverlay} onClick={() => setOpenDetailId("")}>
            <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <p className={styles.kicker}>Rolling detail</p>
                  <h3 className={styles.modalTitle}>{plan.course.name}</h3>
                </div>
                <div className={styles.modalHeaderActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={Boolean(exportingPlanId)}
                    type="button"
                    onClick={() => void handleExportOutline(plan)}
                  >
                    {exportingPlanId === plan.rollingId ? "Preparing..." : "Export Outline"}
                  </button>
                  <button
                    aria-label="Close"
                    className={styles.modalCloseButton}
                    type="button"
                    onClick={() => setOpenDetailId("")}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.previewSections}>
                  <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <BookOpen size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("หลักสูตร (Course)", "Course Details")}
                      </span>
                    </div>
                    <div className={styles.previewFieldGrid}>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("กลุ่มหลักสูตร", "Course Group")}</span><span className={styles.previewFieldValue} translate="no">{plan.course.courseGroup || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("รหัสหลักสูตร", "Course Code")}</span><span className={styles.previewFieldValue}>{plan.course.code}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("ที่มา (Background)", "Background")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.remark || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("วัตถุประสงค์การเรียนรู้", "Learning Objective")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.objective}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("หัวข้อการเรียนรู้", "Learning Content")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.learningContent}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("วิธีการอบรม", "Methodology")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.methodology}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ประเภทหลักสูตร", "Course Type")}</span><span className={styles.previewFieldValue}>{plan.course.courseType}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("อายุหลักสูตร (เดือน)", "Validity (Months)")}</span><span className={styles.previewFieldValue}>{!plan.course.lifeCycleMonth || plan.course.lifeCycleMonth === "0" || Number(plan.course.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : plan.course.lifeCycleMonth}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ผู้เข้าอบรม / รุ่น", "Participants / Batch")}</span><span className={styles.previewFieldValue}>{plan.participants} {t("ท่าน", "seats")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชั่วโมงอบรม", "Training Hours")}</span><span className={styles.previewFieldValue}>{plan.hours} {t("ชม.", "hrs")}</span></div>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <Target size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("กลุ่มเป้าหมาย (Target Group)", "Target Group")}
                        {std?.isSnapshot ? (
                          <span style={{ marginLeft: 8, fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, background: "rgba(34, 197, 94, 0.1)", color: "#16a34a", border: "1px solid rgba(34, 197, 94, 0.25)", fontWeight: 500 }}>
                            {t("เกณฑ์ ณ วันบันทึกแผน", "Saved Plan Target")}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("กลุ่มผู้เข้าอบรม", "Target Audience")}</span><span className={styles.previewFieldValue}>{std?.targetGroup || plan.course.targetGroup}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Standard Companies</span>
                      {std?.companies?.length ? (
                        <span className={styles.previewBadges}>
                          {std.companies.map((company) => (
                            <span key={company} className={styles.previewBadge}>{company}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.previewFieldValue}>All Companies</span>
                      )}
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Org Scope</span>
                      <span className={styles.previewFieldValue}>
                        {std
                          ? [std.functionName, std.division, std.department, std.section].filter(Boolean).join(" / ") || "All Function"
                          : "No standard defined"}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Standard Positions</span>
                      {std?.positions.length ? (
                        <span className={styles.previewBadges}>
                          {std.positions.map((position) => (
                            <span key={position} className={styles.previewBadge}>{position}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.previewFieldValue}>All Positions</span>
                      )}
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Standard Levels</span>
                      {std?.levels.length ? (
                        <span className={styles.previewBadges}>
                          {std.levels.map((level) => (
                            <span key={level} className={styles.previewBadge}>{level}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.previewFieldValue}>All Levels</span>
                      )}
                    </div>
                  </div>

                  <PlanFormOverrideCard
                    plan={plan}
                    assessmentOptions={assessmentOptions}
                    evaluationOptions={evaluationOptions}
                    onSaved={(next) => {
                      setRollingPlans((current) =>
                        current.map((item) => (item.rollingId === next.rollingId ? next : item)),
                      );
                    }}
                  />

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <Coins size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        Budget
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Instructor Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetInstructor || 0).toLocaleString("en-US")}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Traveling Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetTraveling || 0).toLocaleString("en-US")}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Seminar Room Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetSeminarRoom || 0).toLocaleString("en-US")}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Accommodation Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetAccommodation || 0).toLocaleString("en-US")}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Material Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetMaterial || 0).toLocaleString("en-US")}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Food &amp; Beverage Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetFoodBeverage || 0).toLocaleString("en-US")}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewTotalRow}`}><span className={styles.previewFieldLabel}>Total Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budget).toLocaleString("en-US")}</span></div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <User size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("ข้อมูลวิทยากร & สถาบัน (Instructor & Provider)", "Instructor & Provider Details")}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("วิทยากร", "Instructor Name")}</span><span className={styles.previewFieldValue}>{(matchedRollingInstructor ? formatInstructorFullName(matchedRollingInstructor) : plan.trainer) || "-"}</span></div>
                    {matchedRollingInstructor?.instructorCode ? (
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("รหัสวิทยากร", "Instructor Code")}</span><span className={styles.previewFieldValue}>{matchedRollingInstructor.instructorCode}</span></div>
                    ) : null}
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("มหาวิทยาลัย", "University")}</span><span className={styles.previewFieldValue}>{matchedRollingInstructor?.university || "-"}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("วุฒิการศึกษา", "Education")}</span><span className={styles.previewFieldValue}>{matchedRollingInstructor?.education || "-"}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("หน่วยงาน / สังกัด", "Organization")}</span><span className={styles.previewFieldValue}>{matchedRollingInstructor?.organizationName || "-"}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("เบอร์โทรศัพท์", "Telephone")}</span><span className={styles.previewFieldValue}>{matchedRollingInstructor?.telephone || "-"}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("อีเมล", "Email")}</span><span className={styles.previewFieldValue}>{matchedRollingInstructor?.email || "-"}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ผู้ให้บริการ", "Provider")}</span><span className={styles.previewFieldValue}>{plan.provider || "-"}</span></div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>
                        <Wallet size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("ค่าใช้จ่ายประมาณการ", "Estimated Expenses")}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>{t("จำนวนที่แต่ละบริษัทส่งได้", "Quota per Company")}</span>
                      <span className={styles.previewFieldValue}>
                        {estimate.seatsPerCompany === null ? "-" : (isThai ? `${estimate.seatsPerCompany} คน` : `${estimate.seatsPerCompany} seats`)}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("งบประมาณรวม", "Total Budget")}</span><span className={styles.previewFieldValue}>{formatBaht(estimate.totalBudget)}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ค่าใช้จ่ายประมาณการต่อคน (กรณีเต็มจำนวน)", "Est. Cost per Person (full capacity)")}</span><span className={styles.previewFieldValue}>{formatBaht(estimate.costPerPerson)}</span></div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewTotalRow}`}><span className={styles.previewFieldLabel}>{t("ค่าใช้จ่ายประมาณการต่อบริษัท (กรณีเต็มจำนวน)", "Est. Cost per Company (full capacity)")}</span><span className={styles.previewFieldValue}>{formatBaht(estimate.costPerCompany)}</span></div>
                  </div>

                  <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                    <div className={styles.previewCardHeader}><span><CalendarDays size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("กำหนดการ / สถานะ", "Schedule & Status")}</span></div>
                    <div className={styles.previewFieldGrid}>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ลำดับหลักสูตร", "Sequence")}</span><span className={styles.previewFieldValue} translate="no">{group?.sequence ?? "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("รุ่น (Sessions)", "Sessions")}</span><span className={styles.previewFieldValue}>{group?.plans.length ?? 1}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("สถานะ", "Status")}</span><span className={styles.previewFieldValue}>{getStatusLabel(plan.status)}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Job Status</span><span className={styles.previewFieldValue}>{getJobStatus(plan)}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ขอบเขต (Scope)", "Scope")}</span><span className={styles.previewFieldValue}>{formatRollingPlanCompanies(plan)}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Last Updated</span><span className={styles.previewFieldValue}>{plan.updatedAt}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}>
                        <span className={styles.previewFieldLabel}>Created By</span>
                        <span className={styles.previewFieldValue}>
                          {plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerName === "Center HRD"
                            ? (<><Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />HRD Center ({t("ส่วนกลางจัดอบรมให้บริษัท", "Center organized for")} {formatRollingPlanCompanies(plan)})</>)
                            : (<><Factory size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{plan.ownerCompany || plan.company} ({t("โรงงานจัดอบรมเอง", "Factory self-organized")})</>)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                {plan.status === "Planning" ? (
                  <>
                    <button
                      className={styles.dangerButton}
                      disabled={isFactoryUser && isCenterOwned(plan)}
                      title={isFactoryUser && isCenterOwned(plan) ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
                      type="button"
                      onClick={() => {
                        const id = plan.rollingId;
                        setOpenDetailId("");
                        void handleDelete(id);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className={styles.primaryButton}
                      disabled={isFactoryUser && isCenterOwned(plan)}
                      title={isFactoryUser && isCenterOwned(plan) ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถเผยแพร่ได้" : undefined}
                      type="button"
                      onClick={() => {
                        const id = plan.rollingId;
                        void handleConfirm(id);
                      }}
                    >
                      Publish
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.dangerButton}
                    disabled={(isFactoryUser && isCenterOwned(plan)) || !canCancelSession(plan)}
                    title={
                      isFactoryUser && isCenterOwned(plan)
                        ? "HRD Center sessions cannot be cancelled by a factory."
                        : plan.status === "Cancel"
                        ? "This session has already been cancelled."
                        : !canCancelSession(plan)
                        ? "The training date has passed, so this session can no longer be cancelled."
                        : undefined
                    }
                    type="button"
                    onClick={() => {
                      void handleCancelSession(plan);
                    }}
                  >
                    {plan.status === "Cancel" ? "Cancelled" : "Cancel session"}
                  </button>
                )}
                <button className={styles.secondaryButton} type="button" onClick={() => setOpenDetailId("")}>
                  {t("ปิด", "Close")}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </section>
  );
}
