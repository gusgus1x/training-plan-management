"use client";

import { useEffect, useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import SearchableSelect from "../../../SearchableSelect";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import { listEmployees } from "../../../../lib/employees/client";
import type { EmployeeRecord } from "../../../../lib/employees/types";
import { createEnrollment, EnrollmentApiError, listEnrollments, setEnrollmentAttendance } from "../../../../lib/trainingEnrollment/client";
import {
  emptyEnrollmentStage,
  type EnrollmentAssessmentInfo,
  type EnrollmentRecord,
} from "../../../../lib/trainingEnrollment/types";
import {
  getCostBreakdown,
  saveTrainingRecordExpenses,
  saveTrainingResults,
} from "../../../../lib/trainingRecord/client";
import {
  EXPENSE_ITEMS,
  completionStatusLabel,
  expiryFrom,
  type CompletionStatus,
} from "../../../../lib/trainingRecord/types";
import { gradeSubmission, listPendingGrading, publishSubmissionResults } from "../../../../lib/trainingForms/client";
import type { PendingGradingSubmission } from "../../../../lib/trainingForms/types";
import type { CostBreakdown } from "../../../../lib/trainingRecord/types";
import styles from "./TrainingRecord.module.css";

export const trainingActualModule = {
  title: "Training Actual",
  subtitle: "Actual Attendance",
  description:
    "Check actual attendance, record real training expenses, and save the completed actual record.",
} as const;

/** One master-data employee as a SearchableSelect option for the "add attendee" search - the
 *  component filters on label, secondaryLabel and badge together, so code, English name, Thai
 *  name, company and department are all searchable even though only the Thai name is shown as
 *  the main label. */
const employeeSelectOption = (employee: EmployeeRecord) => {
  const nameEn = `${employee.firstNameEn || ""} ${employee.lastNameEn || ""}`.trim();
  return {
    value: employee.employeeId,
    label: `${employee.firstNameTh} ${employee.lastNameTh}`.trim(),
    secondaryLabel: [employee.employeeCode, nameEn, employee.functionName].filter(Boolean).join(" • "),
    badge: employee.companyCode,
  };
};

type ExpenseKey =
  | "instructor"
  | "traveling"
  | "seminarRoom"
  | "accommodation"
  | "material"
  | "foodBeverage";

type Attendee = {
  id: string;
  employeeCode: string;
  name: string;
  prefix: string;
  firstName: string;
  lastName: string;
  company?: string;
  section?: string;
  division?: string;
  department: string;
  position?: string;
  level?: string;
  registered: boolean;
  attended: boolean;
};

/** One attendee's result while it is being typed. Everything is a string so a half-typed score
 *  does not have to survive a round trip through Number. */
type ResultDraft = {
  preScore: string;
  postScore: string;
  completionStatus: CompletionStatus;
  validUntil: string;
  certificateNo: string;
};

const emptyResultDraft: ResultDraft = {
  preScore: "",
  postScore: "",
  completionStatus: "PENDING",
  validUntil: "",
  certificateNo: "",
};

/**
 * Seeds the form from what is already stored. Without this the boxes come back empty after a
 * save, and editing one person's score rebuilt their whole row from the blank draft - so saving
 * again wiped the certificate number, expiry and status that had been recorded for them.
 */
const draftsFromEnrollments = (records: EnrollmentRecord[]): Record<string, ResultDraft> => {
  const drafts: Record<string, ResultDraft> = {};
  for (const record of records) {
    // The expiry follows from the course's validity period and the training date, so it is filled
    // in rather than asked for. HRD can still change it; what they cannot do is get it wrong on
    // thirty rows by hand.
    const derivedExpiry = expiryFrom(record.plan.startAt, record.plan.validityMonths) ?? "";

    if (!record.result) {
      // Only worth a draft when there is something to prefill.
      if (derivedExpiry) drafts[record.id] = { ...emptyResultDraft, validUntil: derivedExpiry };
      continue;
    }

    drafts[record.id] = {
      preScore: record.result.preScore === null ? "" : String(record.result.preScore),
      postScore: record.result.postScore === null ? "" : String(record.result.postScore),
      completionStatus: record.result.completionStatus,
      validUntil: record.result.validUntil ?? derivedExpiry,
      certificateNo: record.result.certificateNo ?? "",
    };
  }
  return drafts;
};

const parseNameParts = (fullName: string) => {
  const knownPrefixes = [
    "นางสาว",
    "นาย",
    "นาง",
    "Mr.",
    "Ms.",
    "Mrs.",
    "Dr.",
    "ดร.",
  ];

  let raw = (fullName || "").trim();
  let foundPrefix = "";

  for (const p of knownPrefixes) {
    if (raw.startsWith(p)) {
      foundPrefix = p;
      raw = raw.slice(p.length).trim();
      break;
    }
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || raw || "-";
  const lastName = parts.slice(1).join(" ") || "-";

  return {
    prefix: foundPrefix || "-",
    firstName,
    lastName,
  };
};

type ActualCourse = {
  id: string;
  groupId: string;
  code: string;
  title: string;
  date: string;
  batch?: string;
  startTime?: string;
  endTime?: string;
  time: string;
  room: string;
  company: string;
  relatedCompanies?: string[];
  owner: "CENTER" | "FACTORY";
  ownerCompany?: string;
  instructor: string;
  hours?: string;
  budget?: string;
};

type ActualCourseGroup = {
  id: string;
  code: string;
  title: string;
  owner: "CENTER" | "FACTORY";
  sessions: ActualCourse[];
};

type CourseOwner = ActualCourse["owner"];
type CourseOwnerFilter = CourseOwner | "";

// Shared with Training Record. Each screen used to keep its own list, so the same key read
// "ค่าวัดผล / เอกสารประกอบ" on the form and "ค่าเอกสาร & อุปกรณ์" on the report.
const expenseFields = EXPENSE_ITEMS;

const emptyExpenses: Record<ExpenseKey, string> = {
  instructor: "",
  traveling: "",
  seminarRoom: "",
  accommodation: "",
  material: "",
  foodBeverage: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

const parseMoney = (value?: string) => {
  const normalizedValue = value?.replace(/[^\d.-]/g, "") ?? "";
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

// Same shape TrainingRolling.tsx already uses to detect a center-owned plan — a course is
// "center" if it's owned centrally or targets every company, regardless of which field carries
// that signal for a given data source.
const isCenterCourse = (course: Pick<ActualCourse, "owner" | "ownerCompany" | "company">) =>
  course.owner === "CENTER" ||
  (course.ownerCompany ?? course.company) === "HRD Center" ||
  course.company === "All Companies";

type GradeDraft = Record<string, { scoreAwarded: string; reviewComment: string }>;

/**
 * The written-answer questions no autograder can score, waiting on an HRD reviewer. Lives here
 * (not on Training Record's open/close panel) because grading produces a score, and this is
 * already where HRD enters every other score for the plan.
 */
const PendingGradingPanel = ({ planId, onGraded }: { planId: string; onGraded: (enrollmentId: string) => void }) => {
  const toast = useToast();
  const [submissions, setSubmissions] = useState<PendingGradingSubmission[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, GradeDraft>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);

  const load = () => {
    listPendingGrading(planId)
      .then((result) => setSubmissions(result.submissions))
      .catch(() => setSubmissions([]));
  };

  useEffect(() => {
    setSubmissions(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const setAnswerDraft = (submissionId: string, answerId: string, patch: Partial<GradeDraft[string]>) =>
    setDrafts((current) => {
      const existing = current[submissionId]?.[answerId] ?? { scoreAwarded: "0", reviewComment: "" };
      return {
        ...current,
        [submissionId]: { ...current[submissionId], [answerId]: { ...existing, ...patch } },
      };
    });

  const handleSave = async (submission: PendingGradingSubmission) => {
    const draft = drafts[submission.submissionId] ?? {};
    const answers = submission.pendingAnswers.map((answer) => {
      const entry = draft[answer.answerId] ?? { scoreAwarded: "0", reviewComment: "" };
      return {
        answerId: answer.answerId,
        scoreAwarded: Number(entry.scoreAwarded) || 0,
        reviewComment: entry.reviewComment.trim() || null,
      };
    });

    setSavingSubmissionId(submission.submissionId);
    try {
      await gradeSubmission(planId, submission.submissionId, { answers });
      toast.success(`บันทึกคะแนนของ ${submission.employeeName} แล้ว`);
      load();
      onGraded(submission.enrollmentId);
    } catch {
      toast.error("บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSavingSubmissionId(null);
    }
  };

  const handlePublish = async (submission: PendingGradingSubmission) => {
    setSavingSubmissionId(submission.submissionId);
    try {
      await publishSubmissionResults(planId, submission.submissionId);
      toast.success(`ประกาศผลของ ${submission.employeeName} แล้ว`);
      load();
      onGraded(submission.enrollmentId);
    } catch {
      toast.error("ประกาศผลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSavingSubmissionId(null);
    }
  };

  if (submissions === null || submissions.length === 0) return null;

  return (
    <section className={styles.actualResultsPanel} aria-label="Pending written-answer grading" style={{ marginBottom: "16px" }}>
      <div className={styles.actualResultsHeader}>
        <div>
          <span>รอตรวจ / รอประกาศผล</span>
          <strong>Pending Grading &amp; Release</strong>
        </div>
        <small>{submissions.length} รายการ</small>
      </div>

      <div className={styles.actualResultsRows}>
        {submissions.map((submission) => (
          <article key={submission.submissionId} className={styles.actualResultRow} style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
            <div className={styles.actualResultWho}>
              <strong>{submission.employeeName}</strong>
              <small>
                {submission.employeeCode || "-"} · {submission.stage === "PRE_TEST" ? "Pre Test" : "Post Test"} · ครั้งที่{" "}
                {submission.attemptNo} · {submission.awaitingPublication ? "ตรวจแล้ว รอประกาศผล" : "รอตรวจข้อเขียน"}
              </small>
            </div>

            {submission.pendingAnswers.map((answer) => {
              const entry = drafts[submission.submissionId]?.[answer.answerId] ?? { scoreAwarded: "0", reviewComment: "" };
              return (
                <div key={answer.answerId} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "8px 10px", borderRadius: "8px", background: "var(--ui-60-surface-soft)" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{answer.questionText}</span>
                  <p style={{ margin: 0, fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>{answer.answerText || "(ไม่มีคำตอบ)"}</p>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <label style={{ fontSize: "0.76rem" }}>
                      คะแนน (เต็ม {answer.questionScore})
                      <input
                        type="number"
                        min={0}
                        max={Number(answer.questionScore)}
                        value={entry.scoreAwarded}
                        onChange={(e) => setAnswerDraft(submission.submissionId, answer.answerId, { scoreAwarded: e.target.value })}
                        style={{ marginLeft: "6px", width: "70px" }}
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="ความเห็น (ถ้ามี)"
                      value={entry.reviewComment}
                      onChange={(e) => setAnswerDraft(submission.submissionId, answer.answerId, { reviewComment: e.target.value })}
                      style={{ flex: 1, fontSize: "0.76rem" }}
                    />
                  </div>
                </div>
              );
            })}

            {submission.awaitingPublication ? (
              <button
                type="button"
                disabled={savingSubmissionId === submission.submissionId}
                onClick={() => void handlePublish(submission)}
                style={{ alignSelf: "flex-end" }}
              >
                {savingSubmissionId === submission.submissionId ? "กำลังประกาศผล..." : "ประกาศผลให้พนักงาน"}
              </button>
            ) : (
              <button
                type="button"
                disabled={savingSubmissionId === submission.submissionId}
                onClick={() => void handleSave(submission)}
                style={{ alignSelf: "flex-end" }}
              >
                {savingSubmissionId === submission.submissionId ? "กำลังบันทึก..." : "บันทึกคะแนน"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default function TrainingActual() {
  const user = useAuthenticatedUser();
  const toast = useToast();
  const confirm = useConfirm();
  const [masterEmployees, setMasterEmployees] = useState<EmployeeRecord[]>([]);
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [draftAttendees, setDraftAttendees] = useState<EmployeeRecord[]>([]);
  const [isSavingDraftAttendees, setIsSavingDraftAttendees] = useState(false);
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [isSavingResults, setIsSavingResults] = useState(false);
  const noAssessment: EnrollmentAssessmentInfo = {
    preTest: emptyEnrollmentStage,
    postTest: emptyEnrollmentStage,
    evaluation: emptyEnrollmentStage,
    evaluationAfter30Day: emptyEnrollmentStage,
  };
  const { language } = useUiLanguage();
  const [courses, setCourses] = useState<ActualCourse[]>([]);
  const [courseOwnerFilter, setCourseOwnerFilter] = useState<CourseOwnerFilter>("");
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [savedSummaryData, setSavedSummaryData] = useState<{
    courseCode: string;
    courseTitle: string;
    batch: string;
    date: string;
    actualCount: number;
    totalCost: number;
    costPerPerson: number;
    savedTime: string;
  } | null>(null);
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [expenses, setExpenses] = useState<Record<ExpenseKey, string>>(emptyExpenses);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);

  useEffect(() => {
    let active = true;
    void loadWorkflowRollingPlans().then((plans) => {
      if (active) setRollingPlans(plans);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listEmployees()
      .then((result) => {
        if (active) setMasterEmployees(result.items || []);
      })
      .catch(() => {
        if (active) setMasterEmployees([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextCourses = rollingPlans
      .filter((plan) => plan.status === "Planned")
      .map<ActualCourse>((plan) => ({
        id: plan.rollingId,
        groupId: plan.scheduleGroupId,
        code: plan.course.code,
        title: plan.course.name,
        date: plan.trainingDate,
        batch: plan.batch,
        startTime: plan.startTime,
        endTime: plan.endTime,
        time: `${plan.startTime} - ${plan.endTime}`,
        room: plan.location,
        company: formatRollingPlanCompanies(plan),
        relatedCompanies: getRollingPlanCompanies(plan),
        owner: plan.ownerScope === "CENTER" ? "CENTER" : "FACTORY",
        ownerCompany:
          plan.ownerScope === "CENTER"
            ? "HRD Center"
            : plan.ownerCompany ?? plan.company,
        instructor: plan.trainer,
        hours: plan.hours,
        budget: plan.budget,
      }));

    setCourses(nextCourses);
  }, [rollingPlans]);
  const availableCourses = useMemo(
    () =>
      isFactoryUser
        ? courses.filter(
            (course) =>
              course.owner === "FACTORY" &&
              (course.ownerCompany ?? course.company) === userCompanyCode,
          )
        : courses,
    [courses, isFactoryUser, userCompanyCode],
  );

  useEffect(() => {
    if (isFactoryUser && courseOwnerFilter !== "FACTORY") {
      setCourseOwnerFilter("FACTORY");
    }
  }, [isFactoryUser, courseOwnerFilter]);
  const selectedCourseOwner: CourseOwnerFilter = courseOwnerFilter;
  const ownerFilteredCourses = useMemo(
    () =>
      selectedCourseOwner
        ? availableCourses.filter((course) => course.owner === selectedCourseOwner)
        : [],
    [availableCourses, selectedCourseOwner],
  );
  const availableCourseGroups = useMemo<ActualCourseGroup[]>(() => {
    const groups = new Map<string, ActualCourse[]>();

    ownerFilteredCourses.forEach((course) => {
      groups.set(course.groupId, [...(groups.get(course.groupId) ?? []), course]);
    });

    return [...groups.entries()].map(([id, sessions]) => {
      const sortedSessions = [...sessions].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      );
      const firstSession = sortedSessions[0];

      return {
        id,
        code: firstSession.code,
        title: firstSession.title,
        owner: firstSession.owner,
        sessions: sortedSessions,
      };
    });
  }, [ownerFilteredCourses]);
  const selectedCourseGroup =
    availableCourseGroups.find((group) => group.id === selectedCourseGroupId) ??
    null;
  const availableSessions = selectedCourseGroup?.sessions ?? [];
  const selectedCourse =
    availableSessions.find((course) => course.id === selectedCourseId) ?? null;
  const isSelectedCourseCenter = selectedCourse ? isCenterCourse(selectedCourse) : false;
  const isSelectedCourseReadOnlyForFactory = isFactoryUser && isSelectedCourseCenter;

  useEffect(() => {
    if (!selectedCourse) {
      setEnrollments([]);
      return;
    }
    let active = true;
    listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null })
      .then((result) => {
        if (!active) return;
        const loaded = result.enrollments || [];
        setEnrollments(loaded);
        // Switching course starts a fresh form, seeded from whatever is already recorded.
        setResultDrafts(draftsFromEnrollments(loaded));
      })
      .catch((error) => {
        console.error("Failed to load attendees", error);
        if (active) setEnrollments([]);
      });
    return () => {
      active = false;
    };
  }, [selectedCourse?.id]);

  useEffect(() => {
    setExpenses(emptyExpenses);
    setSavedMessage("");
  }, [selectedCourse?.id]);

  // Returns what it fetched. The save handler needs the fresh numbers in the same tick, and
  // reading them back from state would show whatever was on screen before the save.
  // `isStale` lets the effect below discard a response for a course the user has already moved off,
  // while the save handler — which calls this for the value, not the render — always keeps it.
  const reloadCostBreakdown = async (planId: string, isStale: () => boolean = () => false) => {
    try {
      const result = await getCostBreakdown(planId);
      if (!isStale()) setCostBreakdown(result.costBreakdown);
      return result.costBreakdown;
    } catch (error) {
      console.error("Failed to load cost breakdown", error);
      if (!isStale()) setCostBreakdown(null);
      return null;
    }
  };

  useEffect(() => {
    if (!selectedCourse) {
      setCostBreakdown(null);
      return;
    }
    // Without this, a slow response for course A could land after course B's and paint A's budget
    // and actual expenses next to B's title and attendees — and a save from that screen would write
    // B's plan with A's numbers. The attendee effect above already guards itself the same way.
    let active = true;
    void reloadCostBreakdown(selectedCourse.id, () => !active);
    return () => {
      active = false;
    };
  }, [selectedCourse?.id]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCourse?.id]);

  const attendees: Attendee[] = selectedCourse
    ? enrollments
        .filter((candidate) =>
          selectedCourse.owner === "CENTER"
            ? candidate.status === "Center Approved"
            : candidate.status === "Factory Approved",
        )
        .map((candidate) => {
          const nameParts = parseNameParts(candidate.employeeName);
          return {
            id: candidate.id,
            employeeCode: candidate.employeeCode,
            name: candidate.employeeName,
            prefix: (candidate as any).prefix || nameParts.prefix,
            firstName: (candidate as any).firstName || nameParts.firstName,
            lastName: (candidate as any).lastName || nameParts.lastName,
            company: candidate.company,
            section: (candidate as any).section || "-",
            division: (candidate as any).division || "-",
            department: candidate.department || "-",
            position: candidate.position || "-",
            level: candidate.level || "-",
            registered: true,
            // Present-only, matching the server's cost-breakdown counting rule
            attended: candidate.attendance?.status === "PRESENT",
          };
        })
    : [];

  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [attendanceCompanyFilter, setAttendanceCompanyFilter] = useState("ALL");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

  const filteredAttendees = useMemo(() => {
    return attendees.filter((attendee) => {
      if (
        attendanceCompanyFilter !== "ALL" &&
        attendee.company !== attendanceCompanyFilter
      ) {
        return false;
      }
      if (attendanceStatusFilter === "PRESENT" && !attendee.attended) {
        return false;
      }
      if (attendanceStatusFilter === "ABSENT" && attendee.attended) {
        return false;
      }
      if (attendanceSearchQuery.trim()) {
        const query = attendanceSearchQuery.toLowerCase().trim();
        const matchesCode = (attendee.employeeCode || "").toLowerCase().includes(query);
        const matchesName = (attendee.name || `${attendee.firstName} ${attendee.lastName}`).toLowerCase().includes(query);
        const matchesDept = (attendee.department || "").toLowerCase().includes(query);
        const matchesPos = (attendee.position || "").toLowerCase().includes(query);
        return matchesCode || matchesName || matchesDept || matchesPos;
      }
      return true;
    });
  }, [attendees, attendanceCompanyFilter, attendanceStatusFilter, attendanceSearchQuery]);

  const attendeeCompanyList = useMemo(() => {
    const companies = new Set<string>();
    attendees.forEach((att) => {
      if (att.company) companies.add(att.company);
    });
    return Array.from(companies).sort();
  }, [attendees]);

  const totalPages = Math.ceil(filteredAttendees.length / PAGE_SIZE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PAGE_SIZE;
  const pagedAttendees = useMemo(
    () => filteredAttendees.slice(startIndex, startIndex + PAGE_SIZE),
    [filteredAttendees, startIndex],
  );

  const actualCount = attendees.filter((attendee) => attendee.attended).length;
  const walkInCount = attendees.filter((attendee) => attendee.attended && !attendee.registered).length;
  const registeredCount = attendees.filter((attendee) => attendee.registered).length;
  const absentCount = attendees.length - actualCount;
  const expenseTotal = expenseFields.reduce(
    (total, field) => total + Number(expenses[field.key] || 0),
    0,
  );
  // Cost-per-person, planned/actual totals, and the company breakdown all come from the server
  // (app/lib/trainingRecord/repository.ts getCostBreakdown) rather than being derived from the
  // locally-fetched enrollments list: a HRD_FACTORY user viewing a HRD_CENTER-owned course only
  // ever gets their own employees back from listEnrollments, so a client-side sum can't produce
  // a correct course-wide total — the server computes it once with full visibility instead.
  const actualCostPerPerson = costBreakdown?.costPerPerson ?? 0;
  const savedActualTotal = costBreakdown?.actualGrandTotal ?? 0;
  const plannedBudget = costBreakdown?.plannedGrandTotal ?? (selectedCourse ? parseMoney(selectedCourse.budget) : 0);
  const remainingBudget = plannedBudget - savedActualTotal;
  const budgetStatus =
    plannedBudget > 0 && remainingBudget < 0 ? "Over budget" : "Within budget";
  const allAttended = Boolean(
    attendees.length && attendees.every((attendee) => attendee.attended),
  );
  const allPassed = Boolean(
    attendees.length &&
      attendees.every((attendee) => (resultDrafts[attendee.id] ?? emptyResultDraft).completionStatus === "COMPLETED"),
  );
  const companyCostBreakdown = costBreakdown?.companyBreakdown ?? [];

  const reloadEnrollments = async () => {
    if (!selectedCourse) return;
    try {
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null });
      const loaded = result.enrollments || [];
      setEnrollments(loaded);
      // Keep whatever is being typed; only fill in rows that have no draft yet.
      setResultDrafts((current) => ({ ...draftsFromEnrollments(loaded), ...current }));
    } catch (error) {
      console.error("Failed to reload attendees", error);
    }
  };

  // The general reload above deliberately keeps whatever HRD already has open in a draft, which
  // is right for protecting mid-typing edits but wrong here: HRD just graded a written answer and
  // the score that grading produced would otherwise be masked by whatever training_result held at
  // the last page load. Overwrite only the one row that changed.
  const handleGraded = async (enrollmentId: string) => {
    if (!selectedCourse) return;
    try {
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null });
      const loaded = result.enrollments || [];
      setEnrollments(loaded);
      const fresh = draftsFromEnrollments(loaded);
      setResultDrafts((current) => ({ ...current, ...(fresh[enrollmentId] ? { [enrollmentId]: fresh[enrollmentId] } : {}) }));
    } catch (error) {
      console.error("Failed to refresh the graded attendee", error);
    }
  };

  const toggleAttendance = async (enrollmentId: string, attended: boolean) => {
    if (isSelectedCourseReadOnlyForFactory) return;
    try {
      await setEnrollmentAttendance(enrollmentId, { attended: !attended });
      await reloadEnrollments();
      if (selectedCourse) await reloadCostBreakdown(selectedCourse.id);
    } catch (error) {
      console.error("Failed to update attendance", error);
      toast.error("บันทึกการเช็คชื่อไม่สำเร็จ / Failed to update attendance");
    }
  };

  const setAllAttendance = async (attended: boolean) => {
    if (isSelectedCourseReadOnlyForFactory) return;
    try {
      await Promise.all(
        attendees
          .filter((attendee) => attendee.attended !== attended)
          .map((attendee) => setEnrollmentAttendance(attendee.id, { attended })),
      );
      await reloadEnrollments();
      if (selectedCourse) await reloadCostBreakdown(selectedCourse.id);
    } catch (error) {
      console.error("Failed to update attendance", error);
      toast.error("บันทึกการเช็คชื่อไม่สำเร็จ / Failed to update attendance");
    }
  };

  /** Picking a search result adds them to the draft basket instead of saving immediately, so HRD
   *  can gather several people before committing them all at once. */
  const addEmployeeToDraft = (employeeId: string) => {
    const master = masterEmployees.find((employee) => employee.employeeId === employeeId);
    if (!master) return;
    setDraftAttendees((current) =>
      current.some((employee) => employee.employeeId === master.employeeId)
        ? current
        : [...current, master],
    );
  };

  const removeDraftAttendee = (employeeId: string) => {
    setDraftAttendees((current) => current.filter((employee) => employee.employeeId !== employeeId));
  };

  /** Enrols one employee for real; if the plan has a prerequisite they have not completed, asks
   *  HRD to confirm by name before overriding it. Mirrors TrainingAcceptSurvey's own version of
   *  this same override flow. Returns null only when HRD cancels that override prompt. */
  const enrollAttendeeWithPrerequisiteCheck = async (employee: EmployeeRecord, planId: string, source: "HRD_CENTER" | "HRD_FACTORY") => {
    const employeeLabel = `${employee.firstNameTh} ${employee.lastNameTh} (${employee.employeeCode})`;
    try {
      return await createEnrollment({ planId, employeeId: employee.employeeId, employeeUserId: employee.userId, source });
    } catch (error) {
      if (!(error instanceof EnrollmentApiError) || error.code !== "PREREQUISITE_NOT_MET") throw error;
      const details = error.details as { missingCourseNames?: string } | undefined;
      const missingNames = (details?.missingCourseNames || "").split(",").filter(Boolean).join(", ");
      const ok = await confirm({
        title: { th: "ยังไม่ผ่านหลักสูตรก่อนหน้า", en: "Prerequisite not completed" },
        message: {
          th: `${employeeLabel} ยังไม่ผ่านการอบรมหลักสูตร ${missingNames}\nยืนยันที่จะเพิ่มเข้าหลักสูตรนี้หรือไม่?`,
          en: `${employeeLabel} has not completed ${missingNames}. Add them anyway?`,
        },
        confirmLabel: { th: "ยืนยันให้เพิ่ม", en: "Add anyway" },
        cancelLabel: { th: "ข้ามคนนี้", en: "Skip" },
        danger: true,
      });
      if (!ok) return null;
      return createEnrollment({ planId, employeeId: employee.employeeId, employeeUserId: employee.userId, source, acknowledgePrerequisite: true });
    }
  };

  /** Commits the draft basket for real: creates (and auto-approves, since HRD is adding them
   *  directly) an enrollment per person, then reloads the attendance checklist so they land in it
   *  like anyone else - HRD checks them present and grades them from there, same as usual. Once
   *  saved there is no undo from this screen, which is why the confirm prompt says so up front. */
  const saveDraftAttendees = async () => {
    if (!selectedCourse) return;
    if (draftAttendees.length === 0) {
      toast.error("กรุณาค้นหาและเลือกพนักงานอย่างน้อย 1 คน / Search and select at least one employee");
      return;
    }

    const ok = await confirm({
      title: { th: "ยืนยันการเพิ่มผู้เข้าอบรม", en: "Confirm adding attendees" },
      message: {
        th: `เมื่อบันทึกแล้วจะแก้ไขไม่ได้ ยืนยันที่จะเพิ่ม ${draftAttendees.length} คนเข้า ${selectedCourse.code} หรือไม่?`,
        en: `Once saved this cannot be edited. Add ${draftAttendees.length} attendee(s) to ${selectedCourse.code}?`,
      },
      confirmLabel: { th: "ยืนยันบันทึก", en: "Confirm & Save" },
      cancelLabel: { th: "ยกเลิก", en: "Cancel" },
      danger: true,
    });
    if (!ok) return;

    setIsSavingDraftAttendees(true);
    const source = isFactoryUser ? "HRD_FACTORY" : "HRD_CENTER";
    const added: string[] = [];
    const skipped: string[] = [];
    try {
      for (const employee of draftAttendees) {
        const employeeLabel = `${employee.firstNameTh} ${employee.lastNameTh}`;
        const enrollment = await enrollAttendeeWithPrerequisiteCheck(employee, selectedCourse.id, source);
        if (!enrollment) {
          skipped.push(employeeLabel);
          continue;
        }
        added.push(employeeLabel);
      }
      await reloadEnrollments();
      setDraftAttendees([]);
      setIsAddingAttendee(false);
      toast.success(`เพิ่มผู้เข้าอบรม ${added.length} คน เข้า ${selectedCourse.code} แล้ว / Added ${added.length} attendee(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save attendees");
    } finally {
      setIsSavingDraftAttendees(false);
    }
  };

  const updateExpense = (key: ExpenseKey, value: string) => {
    setExpenses((current) => ({ ...current, [key]: value }));
  };

  // Results are edited per attendee and saved as one payload, because training_result has one row
  // per enrollment and a partial save would leave the roster half-graded with no sign of it.
  const setResultField = (
    enrollmentId: string,
    field: keyof ResultDraft,
    value: string,
  ) => {
    setResultDrafts((current) => ({
      ...current,
      [enrollmentId]: { ...(current[enrollmentId] ?? emptyResultDraft), [field]: value },
    }));
  };

  const setAllCompletion = (status: CompletionStatus) => {
    setResultDrafts((current) => {
      const next = { ...current };
      attendees.forEach((attendee) => {
        next[attendee.id] = { ...(next[attendee.id] ?? emptyResultDraft), completionStatus: status };
      });
      return next;
    });
  };

  // Every enrollment on one plan shares the same course, so the configuration is the plan's.
  const assessment = enrollments[0]?.plan.assessment ?? noAssessment;
  const validityMonths = enrollments[0]?.plan.validityMonths ?? null;

  const handleSave = async () => {
    if (!selectedCourse || isSelectedCourseReadOnlyForFactory) {
      return;
    }

    const now = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

    setIsSavingResults(true);
    try {
      await saveTrainingRecordExpenses(selectedCourse.id, {
        accommodation: Number(expenses.accommodation || 0),
        foodBeverage: Number(expenses.foodBeverage || 0),
        instructor: Number(expenses.instructor || 0),
        material: Number(expenses.material || 0),
        seminarRoom: Number(expenses.seminarRoom || 0),
        traveling: Number(expenses.traveling || 0),
      });

      // Results ride along with the same button. Two save buttons on one screen left it unclear
      // which one committed what, and it was possible to fill in results and leave without them.
      const edited = attendees
        .map((attendee) => ({ attendee, draft: resultDrafts[attendee.id] }))
        .filter(({ draft }) => draft !== undefined);

      if (edited.length > 0) {
        await saveTrainingResults(selectedCourse.id, {
          results: edited.map(({ attendee, draft }) => ({
            enrollmentId: attendee.id,
            // An empty box means "not graded", which is not the same as a score of zero on a
            // record the employee downloads as evidence.
            preScore: draft.preScore.trim() === "" ? null : Number(draft.preScore),
            postScore: draft.postScore.trim() === "" ? null : Number(draft.postScore),
            completionStatus: draft.completionStatus,
            validUntil: draft.validUntil.trim() === "" ? null : draft.validUntil,
            certificateNo: draft.certificateNo.trim() === "" ? null : draft.certificateNo.trim(),
          })),
        });

        const refreshed = await listEnrollments({
          planId: selectedCourse.id,
          employeeId: null,
          employeeUserId: null,
        });
        const saved = refreshed.enrollments || [];
        setEnrollments(saved);
        // After a save the stored values are the truth, so the form is rebuilt from them.
        setResultDrafts(draftsFromEnrollments(saved));
      }

      // Read the figures from what the server just returned. Reading them from state here showed
      // the values from before the save, so the very first save always reported 0 per person.
      const fresh = await reloadCostBreakdown(selectedCourse.id);
      const freshPerPerson = fresh?.costPerPerson ?? 0;
      const freshPresent = fresh?.presentCount ?? 0;

      setSavedSummaryData({
        courseCode: selectedCourse.code,
        courseTitle: selectedCourse.title,
        batch: selectedCourse.batch ?? "1",
        date: selectedCourse.date,
        actualCount: freshPresent || actualCount,
        totalCost: expenseTotal,
        costPerPerson: freshPerPerson,
        savedTime: now,
      });
      setShowSaveSuccessModal(true);

      setSavedMessage(
        `Saved ${selectedCourse.code} with ${freshPresent} present attendees, total THB ${formatCurrency(expenseTotal)} (THB ${formatCurrency(freshPerPerson)}/person) at ${now}.`,
      );
      toast.success("บันทึกข้อมูลการอบรมจริงแล้ว / Training actual saved");
    } catch (error) {
      console.error("Failed to save training actual", error);
      // Surface what the server said. A certificate clash or a completion without attendance is
      // something HRD can fix, but only if they are told which one it was.
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ / Could not save");
    } finally {
      setIsSavingResults(false);
    }
  };

  return (
    <section className={styles.page} aria-label="Training Actual module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingActualModule.subtitle}</p>
          <h2>{trainingActualModule.title}</h2>
          <p>{trainingActualModule.description}</p>
        </div>
        <div className={styles.heroMeta}>
          <span>{actualCount} Actual</span>
          <span>
            {selectedCourseOwner
              ? selectedCourseOwner === "CENTER"
                ? "Center owner"
                : "Factory owner"
              : "Select owner"}
          </span>
          <span>THB {formatCurrency(expenseTotal)}</span>
          {selectedCourse && actualCount > 0 ? (
            <span className={styles.costPerPersonHeroBadge}>
              THB {formatCurrency(actualCostPerPerson)} / person
            </span>
          ) : null}
        </div>
      </section>

      {/* Course Picker Panel */}
      <section
        className={`${styles.actualCoursePickerPanel} ${styles.actualSelectorFirstPanel}`}
        aria-label="Select training actual course"
      >
        <div className={styles.courseSelectorControls}>
          <label className={styles.actualCourseSelect}>
            <span>Step 1 — สิทธิ์หลักสูตร (Owner)</span>
            <select
              value={selectedCourseOwner}
              onChange={(event) => {
                setCourseOwnerFilter(event.target.value as CourseOwnerFilter);
                setSelectedCourseGroupId("");
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              {!isFactoryUser && <option value="">เลือกสิทธิ์ผู้จัด (Center / Factory)</option>}
              {!isFactoryUser && <option value="CENTER">🏢 Center Standard (ส่วนกลาง)</option>}
              <option value="FACTORY">🏭 Factory (โรงงาน {userCompanyCode || ""})</option>
            </select>
          </label>

          <label className={styles.actualCourseSelect}>
            <span>Step 2 — เลือกหลักสูตร (Course)</span>
            <select
              disabled={!selectedCourseOwner}
              value={selectedCourseGroupId}
              onChange={(event) => {
                setSelectedCourseGroupId(event.target.value);
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              <option value="">
                {!selectedCourseOwner
                  ? "กรุณาเลือกผู้จัดหลักสูตรก่อน"
                  : availableCourseGroups.length > 0
                    ? "เลือกหลักสูตรที่ต้องการเช็คชื่อและคำนวณเงิน"
                    : `ไม่พบหลักสูตรในสิทธิ์ ${selectedCourseOwner}`}
              </option>
              {availableCourseGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  [{group.code}] {group.title} — งบประมาณ THB {formatCurrency(parseMoney(group.sessions[0]?.budget))} ({group.sessions.length} รอบอบรม)
                </option>
              ))}
            </select>
          </label>

          <label className={styles.actualCourseSelect}>
            <span>Step 3 — รอบการอบรม (Training Session)</span>
            <select
              disabled={!selectedCourseGroup}
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSavedMessage("");
              }}
            >
              <option value="">
                {selectedCourseGroup ? "เลือกรอบการอบรมที่ดำเนินการแล้ว" : "กรุณาเลือกหลักสูตรก่อน"}
              </option>
              {availableSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  Batch {session.batch ?? "1"} / วันที่ {session.date} ({session.time}) / ห้อง {session.room}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selectedCourse ? (
        <section className={styles.actualWorkspace}>
          <div className={styles.actualMainPanel}>
            {/* Executive Course Detail Header Banner */}
            <div className={styles.actualCompactHeader}>
              <div>
                <div className={styles.heroBadgeRow}>
                  <b className={selectedCourse.owner === "CENTER" ? styles.systemSourceBadge : styles.uploadSourceBadge}>
                    {selectedCourse.owner === "CENTER" ? "🏢 Center Standard" : `🏭 ${selectedCourse.ownerCompany ?? selectedCourse.company} Scope`}
                  </b>
                  <span className={styles.totalBadge}>
                    Batch <strong>{selectedCourse.batch ?? "1"}</strong>
                  </span>
                </div>
                <h3>{selectedCourse.title}</h3>
                <span className={styles.courseMetaSubtext}>
                  📌 รหัสหลักสูตร: <strong>{selectedCourse.code}</strong> | 🏢 บริษัท: <strong>{selectedCourse.company}</strong> | 📅 วันที่: <strong>{selectedCourse.date}</strong> ({selectedCourse.time})
                </span>
              </div>

              <div className={styles.actualMiniStats}>
                <article>
                  <span>📍 สถานที่ / ห้อง</span>
                  <strong>{selectedCourse.room}</strong>
                </article>
                <article>
                  <span>👨‍🏫 วิทยากร</span>
                  <strong>{selectedCourse.instructor}</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>💰 Planned Budget</span>
                  <strong>THB {formatCurrency(plannedBudget)}</strong>
                </article>
                <article>
                  <span>👥 ลงทะเบียน</span>
                  <strong>{registeredCount} คน</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>🟢 เข้าเรียนจริง</span>
                  <strong>{actualCount} คน</strong>
                </article>
                <article>
                  <span>🔴 ขาดเรียน</span>
                  <strong>{absentCount} คน</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>📊 Cost / Person (Actual)</span>
                  <strong>THB {formatCurrency(actualCostPerPerson)}</strong>
                </article>
              </div>
            </div>

            {isSelectedCourseReadOnlyForFactory ? (
              <div className={styles.actualPermissionNote}>
                แผนจัดอบรมของส่วนกลาง (HRD Center) — โรงงานดูรายงานได้แต่ไม่สามารถบันทึกการเข้าอบรมหรือค่าใช้จ่ายได้
              </div>
            ) : isFactoryUser ? (
              <div className={styles.actualPermissionNote}>
                Factory permission: courses owned by {userCompanyCode}, plus HRD Center courses (view-only).
              </div>
            ) : null}

            {/* Executive Attendance Checklist Workspace */}
            <div className={styles.attendanceChecklistWorkspace}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>Attendance Checklist</p>
                  <h3>รายการเช็คชื่อเข้าร่วมอบรม</h3>
                </div>
                <div className={styles.attendanceHeaderActions}>
                  <span className={styles.attendanceProgressBadge}>
                    <span className={styles.glowingDotGreen} /> เข้าเรียน {actualCount} / {attendees.length} คน ({attendees.length ? Math.round((actualCount / attendees.length) * 100) : 0}%)
                  </span>
                  <button
                    type="button"
                    className={allAttended ? styles.activeActionButton : styles.actionButton}
                    disabled={attendees.length === 0 || isSelectedCourseReadOnlyForFactory}
                    onClick={() => void setAllAttendance(!allAttended)}
                  >
                    {allAttended ? "✕ ยกเลิกเช็คชื่อทั้งหมด" : "✓ เลือกเช็คชื่อทั้งหมด"}
                  </button>
                  <button
                    type="button"
                    className={isAddingAttendee ? styles.activeActionButton : styles.actionButton}
                    disabled={isSelectedCourseReadOnlyForFactory}
                    onClick={() => setIsAddingAttendee(!isAddingAttendee)}
                  >
                    {isAddingAttendee ? "✕ ยกเลิก" : "+ เพิ่มรายชื่อผู้เข้าอบรมเพิ่มเติม"}
                  </button>
                </div>
              </div>

              {isAddingAttendee ? (
                <div className={styles.addAttendeeWorkspace}>
                  <div className={styles.addAttendeeControls}>
                    <label style={{ gridColumn: "1 / -1" }}>
                      ค้นหารายชื่อพนักงาน (Search Employee)
                      <SearchableSelect
                        options={masterEmployees.map(employeeSelectOption)}
                        value=""
                        onChange={addEmployeeToDraft}
                        placeholder="🔍 พิมพ์ชื่อ รหัสพนักงาน หรือบริษัท / Type name, code, or company..."
                        emptyText="ไม่พบพนักงานที่ตรงกัน / No matching employee"
                      />
                    </label>
                  </div>

                  {draftAttendees.length > 0 ? (
                    <div className={styles.tableWrap} style={{ marginTop: 14 }}>
                      <table className={styles.recordTable}>
                        <thead>
                          <tr>
                            <th>พนักงาน</th>
                            <th>บริษัท / สำนักงาน</th>
                            <th>หน่วยงาน</th>
                            <th>เลเวล</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftAttendees.map((employee) => (
                            <tr key={employee.employeeId}>
                              <td>
                                <div>
                                  <strong className={styles.attendeeFirstName}>
                                    {`${employee.firstNameTh} ${employee.lastNameTh}`.trim()}
                                  </strong>
                                  <span className={styles.attendeeCodeTag}>{employee.employeeCode}</span>
                                </div>
                              </td>
                              <td>
                                <div className={styles.deptCell}>
                                  <span className={styles.companyPillBadge}>{employee.companyCode}</span>
                                  <span className={styles.attendeeDeptText}>{employee.functionName || "-"}</span>
                                </div>
                              </td>
                              <td>
                                <div className={styles.orgCell}>
                                  <span className={styles.orgText}>{employee.divisionName || "-"}</span>
                                  <span className={styles.orgSubText}>
                                    {[employee.departmentName, employee.sectionName].filter(Boolean).join(" • ") || "-"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={styles.levelBadge}>{employee.levelCode || employee.levelKey || "-"}</span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.removeDraftAttendeeButton}
                                  title="เอาออกจากรายชื่อ / Remove"
                                  onClick={() => removeDraftAttendee(employee.employeeId)}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div className={styles.addAttendeeActions}>
                    <button
                      type="button"
                      disabled={draftAttendees.length === 0 || isSavingDraftAttendees}
                      onClick={() => void saveDraftAttendees()}
                    >
                      {isSavingDraftAttendees ? "กำลังบันทึก..." : `บันทึก (${draftAttendees.length})`}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Attendance Toolbar: Company Filters, Status Filters, & Real-Time Search */}
              <div className={styles.attendeeFilterToolbar}>
                <div className={styles.companyFilterChips}>
                  <button
                    type="button"
                    className={attendanceCompanyFilter === "ALL" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceCompanyFilter("ALL")}
                  >
                    ทุกบริษัท ({attendees.length})
                  </button>
                  {attendeeCompanyList.map((comp) => {
                    const count = attendees.filter((a) => a.company === comp).length;
                    return (
                      <button
                        key={comp}
                        type="button"
                        className={attendanceCompanyFilter === comp ? styles.activeFilterChip : styles.filterChip}
                        onClick={() => setAttendanceCompanyFilter(comp)}
                      >
                        {comp} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className={styles.companyFilterChips}>
                  <button
                    type="button"
                    className={attendanceStatusFilter === "ALL" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceStatusFilter("ALL")}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    className={attendanceStatusFilter === "PRESENT" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceStatusFilter("PRESENT")}
                  >
                    🟢 มาเรียน ({actualCount})
                  </button>
                  <button
                    type="button"
                    className={attendanceStatusFilter === "ABSENT" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceStatusFilter("ABSENT")}
                  >
                    🔴 ขาดเรียน ({absentCount})
                  </button>
                </div>

                <div className={styles.attendeeSearchBox}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ, รหัสพนักงาน, แผนก..."
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                  />
                  {attendanceSearchQuery ? (
                    <button
                      type="button"
                      className={styles.clearSearchBtn}
                      onClick={() => setAttendanceSearchQuery("")}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Attendance Table */}
              <div className={`${styles.tableWrap} ${styles.attendanceTableWrap}`}>
                <table className={styles.recordTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "135px" }}>เข้าร่วม</th>
                      <th>ข้อมูลพนักงาน</th>
                      <th>บริษัท / แผนก</th>
                      <th>ส่วน / ฝ่าย</th>
                      <th>ตำแหน่ง / ระดับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAttendees.map((attendee) => (
                      <tr
                        key={attendee.id}
                        className={attendee.attended ? styles.attendedRow : undefined}
                      >
                        <td className={styles.checkCell}>
                          <label className={styles.attendanceCheckLabel}>
                            <input
                              type="checkbox"
                              checked={attendee.attended}
                              disabled={isSelectedCourseReadOnlyForFactory}
                              onChange={() => void toggleAttendance(attendee.id, attendee.attended)}
                            />
                            <span
                              className={
                                attendee.attended
                                  ? styles.passBadge
                                  : styles.failBadge
                              }
                            >
                              {attendee.attended ? (
                                <>
                                  <span className={styles.glowingDotGreen} /> มาเรียน
                                </>
                              ) : (
                                <>
                                  <span className={styles.glowingDotRed} /> ขาดเรียน
                                </>
                              )}
                            </span>
                          </label>
                        </td>
                        <td>
                          <div>
                            <strong className={styles.attendeeFirstName}>
                              {attendee.prefix !== "-" ? `${attendee.prefix} ` : ""}
                              {attendee.firstName} {attendee.lastName}
                            </strong>
                            <span className={styles.attendeeCodeTag}>{attendee.employeeCode}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.deptCell}>
                            <span className={styles.companyPillBadge}>{attendee.company || "-"}</span>
                            <span className={styles.attendeeDeptText}>{attendee.department || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.orgCell}>
                            <span className={styles.orgText}>{attendee.section || "-"}</span>
                            <span className={styles.orgSubText}>{attendee.division || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.posCell}>
                            <span className={styles.positionText}>{attendee.position || "-"}</span>
                            <span className={styles.levelBadge}>{attendee.level || "-"}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pagedAttendees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyTableMessage}>
                          🔍 ไม่พบรายชื่อพนักงานในการอบรมตามเงื่อนไขค้นหา
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 ? (
              <div className={styles.actualPaginationBar}>
                <span className={styles.paginationInfo}>
                  แสดง {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, attendees.length)} จากทั้งหมด {attendees.length} คน (หน้า {activePage} จาก {totalPages})
                </span>
                <div className={styles.paginationNav}>
                  <button
                    className={styles.pageBtn}
                    type="button"
                    disabled={activePage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title="หน้าก่อนหน้า"
                  >
                    ‹
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      className={`${styles.pageBtn} ${p === activePage ? styles.pageBtnActive : ""}`}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className={styles.pageBtn}
                    type="button"
                    disabled={activePage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="หน้าถัดไป"
                  >
                    ›
                  </button>
                </div>
              </div>
            ) : null}
            {selectedCourse ? <PendingGradingPanel planId={selectedCourse.id} onGraded={(id) => void handleGraded(id)} /> : null}
            <section className={styles.actualResultsPanel} aria-label="Training results">
              <div className={styles.actualResultsHeader}>
                <div>
                  <span>ผลการอบรม</span>
                  <strong>Training Result</strong>
                </div>
                <div className={styles.attendanceHeaderActions}>
                  <small>{attendees.filter((a) => a.attended).length} attended</small>
                  <button
                    type="button"
                    className={allPassed ? styles.activeActionButton : styles.actionButton}
                    disabled={attendees.length === 0 || isSelectedCourseReadOnlyForFactory}
                    onClick={() => setAllCompletion(allPassed ? "NOT_COMPLETED" : "COMPLETED")}
                  >
                    {allPassed ? "✕ ยกเลิกผ่านทั้งหมด" : "✓ เลือกผ่านทั้งหมด"}
                  </button>
                </div>
              </div>

              {assessment.preTest.mode === "NONE" && assessment.postTest.mode === "NONE" ? (
                <p className={styles.actualResultsNote}>
                  หลักสูตรนี้ไม่ได้กำหนดแบบทดสอบ จึงไม่มีคะแนนให้บันทึก / This course has no test
                  configured, so there is no score to record
                </p>
              ) : null}
              {assessment.preTest.mode === "LINK" || assessment.postTest.mode === "LINK" ? (
                <p className={styles.actualResultsNote}>
                  แบบทดสอบใช้ลิงก์ภายนอก ระบบมองไม่เห็นคะแนน กรุณากรอกเอง / The test is an external
                  link, so this system cannot read the score - enter it manually
                </p>
              ) : null}

              {attendees.length === 0 ? (
                <p className={styles.actualResultsEmpty}>
                  ยังไม่มีผู้เข้าอบรมที่อนุมัติแล้ว / No approved attendee yet
                </p>
              ) : (
                <div className={styles.actualResultsRows}>
                  {attendees.map((attendee) => {
                    const saved = enrollments.find((e) => e.id === attendee.id);
                    const draft = resultDrafts[attendee.id] ?? emptyResultDraft;
                    return (
                      <article key={attendee.id} className={styles.actualResultRow}>
                        <div className={styles.actualResultWho}>
                          <strong>{attendee.name}</strong>
                          <small>
                            {attendee.employeeCode || "-"} · {attendee.company}
                            {attendee.attended ? "" : " · ไม่ได้เข้าอบรม / absent"}
                          </small>
                        </div>

                        {/* A course with no test at this stage has no score to record. Leaving the
                            box on screen invites a mark for an exam that never happened onto a
                            document the employee hands to an employer. */}
                        {assessment.preTest.mode === "NONE" ? null : (
                          <label>
                            Pre
                            <input
                              type="number"
                              min={0}
                              value={draft.preScore}
                              onChange={(event) =>
                                setResultField(attendee.id, "preScore", event.target.value)
                              }
                            />
                          </label>
                        )}
                        {assessment.postTest.mode === "NONE" ? null : (
                          <label>
                            Post
                            <input
                              type="number"
                              min={0}
                              value={draft.postScore}
                              onChange={(event) =>
                                setResultField(attendee.id, "postScore", event.target.value)
                              }
                            />
                          </label>
                        )}
                        <label className={styles.attendanceCheckLabel}>
                          <input
                            type="checkbox"
                            checked={draft.completionStatus === "COMPLETED"}
                            disabled={isSelectedCourseReadOnlyForFactory}
                            onChange={() =>
                              setResultField(
                                attendee.id,
                                "completionStatus",
                                draft.completionStatus === "COMPLETED" ? "NOT_COMPLETED" : "COMPLETED",
                              )
                            }
                          />
                          <span className={draft.completionStatus === "COMPLETED" ? styles.passBadge : styles.failBadge}>
                            {draft.completionStatus === "COMPLETED" ? (
                              <>
                                <span className={styles.glowingDotGreen} /> ผ่าน
                              </>
                            ) : (
                              <>
                                <span className={styles.glowingDotRed} />{" "}
                                {draft.completionStatus === "PENDING" ? "ยังไม่ระบุ" : "ไม่ผ่าน"}
                              </>
                            )}
                          </span>
                        </label>
                        {/* The certificate number is not entered here for now. The draft still
                            carries whatever is stored, so a save leaves an existing number
                            untouched rather than clearing it. */}
                        {/* A course with no validity period has no expiry to record. The box used
                            to appear for every course, inviting a date that means nothing. */}
                        {validityMonths === null ? null : (
                          <label>
                            หมดอายุ
                            <input
                              type="date"
                              value={draft.validUntil}
                              onChange={(event) =>
                                setResultField(attendee.id, "validUntil", event.target.value)
                              }
                            />
                          </label>
                        )}

                        {saved?.result ? (
                          <small className={styles.actualResultSaved}>
                            บันทึกแล้ว: {completionStatusLabel(saved.result.completionStatus, language)}
                          </small>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}

              <p className={styles.actualResultsNote}>
                กรอกแล้วกดปุ่มบันทึกด้านขวาครั้งเดียว บันทึกทั้งค่าใช้จ่ายและผลการอบรมพร้อมกัน / Fill
                these in and use the single save button on the right - it saves the expenses and
                the results together
              </p>
            </section>

          </div>

          {/* Executive Expense Calculation Sidebar */}
          <aside className={styles.actualCostPanel} aria-label="Actual training expenses">
            <div className={styles.actualCostHeader}>
              <div>
                <p className={styles.kicker}>Expense Calculation</p>
                <h3>บันทึกค่าใช้จ่ายจริง</h3>
                <span>บันทึกค่าใช้จ่ายจริงที่เกิดขึ้นในการอบรม</span>
              </div>
            </div>

            <div className={styles.actualCostGrid}>
              {expenseFields.map((field) => (
                <label key={field.key} className={styles.expenseInputCard}>
                  <div className={styles.expenseLabelHeader}>
                    <span>{field.icon} {field.label}</span>
                  </div>
                  <div className={styles.expenseInputWrap}>
                    <span className={styles.currencyPrefix}>THB</span>
                    <input
                      inputMode="decimal"
                      disabled={isSelectedCourseReadOnlyForFactory}
                      placeholder="0"
                      value={expenses[field.key]}
                      onChange={(event) => updateExpense(field.key, event.target.value)}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className={styles.actualTotalBox}>
              <span>รวมค่าใช้จ่ายจริง (Draft Unsaved)</span>
              <strong>THB {formatCurrency(expenseTotal)}</strong>
            </div>

            {/* Variance Analysis Table */}
            <div className={`${styles.tableWrap}`}>
              <table className={styles.recordTable}>
                <thead>
                  <tr>
                    <th>หมวดหมู่</th>
                    <th>งบประมาณ (Planned)</th>
                    <th>จ่ายจริง (Saved)</th>
                    <th>ส่วนต่าง (Variance)</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseFields.map((field) => {
                    const planned = costBreakdown?.plannedTotals[field.key] ?? 0;
                    const actual = costBreakdown?.actualTotals[field.key] ?? 0;
                    const variance = planned - actual;
                    return (
                      <tr key={field.key}>
                        <td>{field.icon} {field.label}</td>
                        <td>THB {formatCurrency(planned)}</td>
                        <td>THB {formatCurrency(actual)}</td>
                        <td className={variance < 0 ? styles.actualBudgetOverrun : undefined}>
                          {variance >= 0 ? `+THB ${formatCurrency(variance)}` : `-THB ${formatCurrency(Math.abs(variance))}`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td><strong>รวมทั้งหมด (Total)</strong></td>
                    <td><strong>THB {formatCurrency(plannedBudget)}</strong></td>
                    <td><strong>THB {formatCurrency(savedActualTotal)}</strong></td>
                    <td className={remainingBudget < 0 ? styles.actualBudgetOverrun : undefined}>
                      <strong>{remainingBudget >= 0 ? `+THB ${formatCurrency(remainingBudget)}` : `-THB ${formatCurrency(Math.abs(remainingBudget))}`}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.actualCostPerPersonSummary}>
              <div>
                <span>เฉลี่ยงบ/คน (Cost / Person)</span>
                <strong>THB {formatCurrency(actualCostPerPerson)}</strong>
              </div>
              <small>
                {(() => {
                  // Built at call time with the totals in it, so the DOM localizer can never
                  // match it against a dictionary key — pick the language here instead.
                  const present = costBreakdown?.presentCount ?? 0;
                  const total = formatCurrency(savedActualTotal);
                  return language === "th"
                    ? `คำนวณจาก THB ${total} ÷ ผู้เข้าอบรมจริง ${present} คน`
                    : `Calculated from THB ${total} ÷ ${present} present attendee${present === 1 ? "" : "s"}`;
                })()}
              </small>
            </div>

            {/* The per-person figure is the total divided by who was marked PRESENT. With nobody
                marked, there is nothing to divide by, and rendering nothing at all made the save
                look like it had failed. */}
            {(costBreakdown?.presentCount ?? 0) === 0 ? (
              <p className={styles.actualResultsNote}>
                {language === "th"
                  ? "ยังไม่มีใครถูกเช็กชื่อว่าเข้าอบรม จึงยังจำแนกค่าใช้จ่ายต่อคนไม่ได้ — เช็กชื่อในตารางด้านซ้ายก่อน"
                  : "Nobody is marked as present yet, so the cost cannot be split per person - check attendance in the table on the left first"}
              </p>
            ) : null}

            {companyCostBreakdown.length > 0 ? (
              <div className={styles.actualCompanyBreakdownBox}>
                <div className={styles.companyBreakdownHeader}>
                  <p className={styles.kicker}>Company Cost Share</p>
                  <h4>
                    {isSelectedCourseReadOnlyForFactory || (isFactoryUser && isSelectedCourseCenter)
                      ? "งบปันส่วนบริษัทของคุณ (Your Company Allocation)"
                      : "การปันส่วนงบประมาณตามบริษัท"}
                  </h4>
                </div>

                <div className={styles.companyCostTableWrap}>
                  <table className={styles.companyCostTable}>
                    <thead>
                      <tr>
                        <th>บริษัท</th>
                        <th>ผู้เข้าเรียน</th>
                        <th>สัดส่วน %</th>
                        <th style={{ textAlign: "right" }}>งบปันส่วน (THB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyCostBreakdown.map((item) => {
                        const totalPresent = costBreakdown?.presentCount || actualCount || 1;
                        const pct = Math.round((item.presentCount / totalPresent) * 100);
                        return (
                          <tr key={item.companyCode}>
                            <td>
                              <span className={styles.companyBadgePill}>{item.companyCode}</span>
                            </td>
                            <td>
                              <span className={styles.companyPresentCount}>🟢 {item.presentCount} คน</span>
                            </td>
                            <td>
                              <div className={styles.sharePercentCell}>
                                <div className={styles.sharePercentBarWrap}>
                                  <div
                                    className={styles.sharePercentBar}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={styles.sharePercentText}>{pct}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <strong className={styles.allocatedCostText}>
                                THB {formatCurrency(item.allocatedCost)}
                              </strong>
                            </td>
                          </tr>
                        );
                      })}
                      {isFactoryUser && isSelectedCourseCenter ? (
                        <tr className={styles.companyTotalRow}>
                          <td colSpan={3}>
                            <strong>รวมทุกบริษัท (All Companies Total)</strong>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <strong className={styles.allocatedCostText}>
                              THB {formatCurrency(savedActualTotal)}
                            </strong>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className={styles.actualBudgetSummary}>
              <div>
                <span>งบประมาณที่วางแผนไว้</span>
                <strong>THB {formatCurrency(plannedBudget)}</strong>
              </div>
              <div
                className={
                  remainingBudget < 0 ? styles.actualBudgetOverrun : undefined
                }
              >
                <span>งบประมาณคงเหลือ</span>
                <strong>THB {formatCurrency(remainingBudget)}</strong>
              </div>
              <p
                className={
                  remainingBudget < 0 ? styles.actualBudgetOverrun : undefined
                }
              >
                {remainingBudget >= 0 ? "🟢 อยู่ในงบประมาณ (Within budget)" : "🔴 เกินงบประมาณ (Over budget)"}
              </p>
            </div>

            <button
              className={styles.actualSaveButton}
              type="button"
              disabled={isSelectedCourseReadOnlyForFactory || isSavingResults}
              title={
                isSelectedCourseReadOnlyForFactory
                  ? "หลักสูตรของส่วนกลาง โรงงานดูได้อย่างเดียว แก้ไขไม่ได้ (Center course — read-only for factory users)"
                  : undefined
              }
              onClick={() => void handleSave()}
            >
              {isSavingResults ? "กำลังบันทึก..." : "💾 บันทึกค่าใช้จ่าย & ผลการอบรม"}
            </button>

            {savedMessage ? <p className={styles.actualSavedMessage}>{savedMessage}</p> : null}
          </aside>
        </section>
      ) : (
        <section className={styles.emptyState} aria-label="No selected actual course">
          กรุณาเลือกหลักสูตรก่อนเพื่อบันทึกและแสดงข้อมูลการอบรมจริง (Select a course first to show training actual details)
        </section>
      )}

      {/* Save Success Dialog Modal */}
      {showSaveSuccessModal && savedSummaryData ? (
        <div className={styles.successModalBackdrop} onClick={() => setShowSaveSuccessModal(false)}>
          <div
            className={styles.successModalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.successIconRing}>
              <span className={styles.checkIconEmoji}>✓</span>
            </div>

            <div className={styles.successModalHeader}>
              <h3>บันทึกข้อมูลการอบรมจริงสำเร็จ!</h3>
              <p>ระบบทำการบันทึกยอดผู้เข้าอบรมจริงและค่าใช้จ่ายเรียบร้อยแล้ว</p>
            </div>

            <div className={styles.successCourseCard}>
              <div className={styles.successCourseCodeBadge}>[{savedSummaryData.courseCode}]</div>
              <div className={styles.successCourseTitle}>{savedSummaryData.courseTitle}</div>
              <div className={styles.successCourseMeta}>
                Batch <strong>{savedSummaryData.batch}</strong> • วันที่ <strong>{savedSummaryData.date}</strong>
              </div>
            </div>

            <div className={styles.savedMetricGrid}>
              <div className={styles.savedMetricCard}>
                <span>🟢 ผู้เข้าเรียนจริง</span>
                <strong>{savedSummaryData.actualCount} คน</strong>
              </div>
              <div className={styles.savedMetricCard}>
                <span>💰 รวมค่าใช้จ่ายจริง</span>
                <strong>THB {formatCurrency(savedSummaryData.totalCost)}</strong>
              </div>
              <div className={styles.savedMetricCard}>
                <span>📊 เฉลี่ยงบ / คน</span>
                <strong>THB {formatCurrency(savedSummaryData.costPerPerson)}</strong>
              </div>
            </div>

            <div className={styles.savedTimestamp}>
              ⏰ บันทึกเมื่อ: {savedSummaryData.savedTime}
            </div>

            <div className={styles.successModalActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setShowSaveSuccessModal(false)}
              >
                ✓ ตกลง (Done)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
