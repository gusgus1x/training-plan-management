"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createEnrollment, EnrollmentApiError } from "../../../../lib/trainingEnrollment/client";
import { listNeedRequests, updateNeedRequest } from "../../../../lib/trainingNeedRequests/client";
import type { NeedRequestRecord } from "../../../../lib/trainingNeedRequests/types";
import type { useConfirm } from "../../../ConfirmDialog";
import styles from "./TrainingRolling.module.css";

/**
 * Approved training need requests travelling from Request Training Need to Training Rolling (and
 * through Training OAP when the course has no plan yet). The ids ride in the address -
 * `?needRequestIds=1,2,3` - so the hand-off survives a reload and works in any browser.
 */

const parseIds = (raw: string | null) =>
  (raw ?? "").split(",").map((id) => id.trim()).filter((id) => /^\d+$/.test(id));

/**
 * The ids this screen was opened with.
 *
 * `useSearchParams` rather than `window.location.search`: on a client-side navigation React renders
 * the new screen before the address bar is updated, so a mount-time read of window.location saw the
 * PREVIOUS page's query and the hand-off arrived empty. The hook re-renders with the new query.
 */
export const useNeedRequestIds = () => {
  const params = useSearchParams();
  const raw = params.get("needRequestIds");
  return useMemo(() => parseIds(raw), [raw]);
};

export const needRequestQuery = (ids: string[]) => (ids.length ? `?needRequestIds=${ids.join(",")}` : "");

/** Loads the named requests that are still approved and waiting for a batch. */
export const loadHandoffRequests = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const { needRequests } = await listNeedRequests({ status: "APPROVED" });
  return needRequests.filter((request) => ids.includes(request.id));
};

/** "[SY-000002] Excel (Refresher)" names its course by code; a typed topic usually does not. */
export const courseCodeInRequest = (name: string) => name.match(/\[([A-Za-z0-9_-]+)\]/)?.[1] ?? null;

/** The course name without the code and the "(ขออบรมทบทวน / Refresher)" tail the employee screen adds. */
export const requestedCourseTitle = (name: string) =>
  name
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const bareCourseName = (name: string) => requestedCourseTitle(name).toLowerCase();

/**
 * What to call the course on screen. The employee's own wording carries the code in brackets and a
 * "(ขออบรมทบทวน / Refresher)" tail, which is noise once the same line repeats down a list, so the
 * course's own name wins when the request names a real course.
 */
export const courseLabel = (request: Pick<NeedRequestRecord, "courseNameSnapshot" | "requestedCourseName">) =>
  request.courseNameSnapshot?.trim() ||
  requestedCourseTitle(request.requestedCourseName) ||
  request.requestedCourseName;

/** Two requests are for the same course when they name the same course, not the same text. */
export const demandKey = (request: Pick<NeedRequestRecord, "courseId" | "courseNameSnapshot" | "requestedCourseName">) =>
  request.courseId ? `id:${request.courseId}` : `name:${courseLabel(request).toLowerCase()}`;

type PlanLike = { id: string; status: string; course: { courseCode: string; courseNameTh: string; courseNameEn: string } };

/**
 * The OAP plan these requests are asking for: by course code when the request carries one, else by
 * the course name the employee typed. Returns null when nothing matches - HRD then picks the plan,
 * which is also what happens when the course has no plan for this year yet.
 */
export const matchOapForRequests = <T extends PlanLike>(requests: NeedRequestRecord[], plans: T[]): T | null => {
  const open = plans.filter((plan) => plan.status !== "Cancel");
  const code = requests.map((request) => courseCodeInRequest(request.requestedCourseName)).find(Boolean);
  const byCode = code ? open.find((plan) => plan.course.courseCode.toLowerCase() === code.toLowerCase()) : undefined;
  if (byCode) return byCode;

  for (const request of requests) {
    const typed = bareCourseName(request.requestedCourseName);
    if (typed.length < 3) continue;
    const byName = open.find((plan) => {
      const names = [plan.course.courseNameTh, plan.course.courseNameEn].map((name) => (name || "").trim().toLowerCase()).filter(Boolean);
      return names.some((name) => name === typed || name.includes(typed) || typed.includes(name));
    });
    if (byName) return byName;
  }
  return null;
};

type CourseLike = { id: string; courseCode: string; courseNameTh: string; courseNameEn: string };

/** The Course Master course a request names: by the code it carries, else by the name typed. */
export const matchCourseForRequest = <T extends CourseLike>(requestName: string, courseList: T[]): T | null => {
  if (!requestName || !courseList.length) return null;
  const trimmed = requestName.trim();

  const code = courseCodeInRequest(trimmed)?.toLowerCase();
  const byCode = code ? courseList.find((course) => course.courseCode.toLowerCase() === code) : undefined;
  if (byCode) return byCode;

  const startsWithCode = courseList.find((course) => trimmed.toLowerCase().startsWith(course.courseCode.toLowerCase()));
  if (startsWithCode) return startsWithCode;

  return (
    courseList.find(
      (course) => trimmed.includes(course.courseNameTh) || (course.courseNameEn && trimmed.includes(course.courseNameEn)),
    ) ?? null
  );
};

export type PlanningTarget =
  | { kind: "rolling"; url: string; courseName: string }
  | { kind: "oap"; url: string; courseName: string }
  | { kind: "course"; url: string; courseName: string };

/**
 * Where HRD has to go to turn these requests into a batch: straight to Training Rolling when the
 * course already has an OAP plan, to Training OAP when the course exists but has no plan, and to
 * Course Master when the course itself does not exist yet. Worked out before HRD leaves the inbox
 * so they confirm one card instead of discovering the next missing piece one screen at a time.
 */
export const planningTarget = <P extends PlanLike, C extends CourseLike>(
  requests: NeedRequestRecord[],
  plans: P[],
  courses: C[],
): PlanningTarget => {
  const ids = requests.map((request) => request.id);
  const query = needRequestQuery(ids);
  const courseName = requests.map((request) => requestedCourseTitle(request.requestedCourseName)).find(Boolean) ?? "";

  if (matchOapForRequests(requests, plans)) {
    return { kind: "rolling", url: `/training-plan/training-rolling${query}`, courseName };
  }
  const course = requests.map((request) => matchCourseForRequest(request.requestedCourseName, courses)).find(Boolean);
  if (course) {
    return { kind: "oap", url: `/training-plan/training-oap${query}${query ? "&" : "?"}courseId=${course.id}`, courseName };
  }
  return {
    kind: "course",
    url: `/training-course/course-master-standard?newCourseName=${encodeURIComponent(courseName)}&needRequestIds=${ids.join(",")}`,
    courseName,
  };
};

type Confirm = ReturnType<typeof useConfirm>;

export type HandoffOutcome = {
  linked: number;
  skipped: string[];
  failed: Array<{ name: string; message: string }>;
};

/**
 * Puts each requester into the batch, then marks their request planned against it. Uses the
 * ordinary enrollment rules - target match, company scope, and the prerequisite prompt HRD
 * already sees on the other screens - one person at a time, so one refusal does not stop the rest.
 * Someone already enrolled in the batch is only linked.
 */
export const enrollAndLink = async (
  requests: NeedRequestRecord[],
  planId: string,
  source: "HRD_CENTER" | "HRD_FACTORY",
  confirm: Confirm,
): Promise<HandoffOutcome> => {
  const outcome: HandoffOutcome = { linked: 0, skipped: [], failed: [] };
  for (const request of requests) {
    const label = `${request.employeeName} (${request.employeeCode})`;
    // employeeId is still a required field on this route; the user_id travels in both and the
    // repository resolves by employeeUserId whenever it is present.
    const input = { planId, employeeId: request.employeeUserId, employeeUserId: request.employeeUserId, source };
    try {
      try {
        await createEnrollment(input);
      } catch (error) {
        if (error instanceof EnrollmentApiError && error.code === "RESOURCE_CONFLICT") {
          // Already in this batch: nothing to add, the link still stands.
        } else if (error instanceof EnrollmentApiError && error.code === "PREREQUISITE_NOT_MET") {
          const details = error.details as { missingCourseNames?: string } | undefined;
          const missing = (details?.missingCourseNames || "").split(",").filter(Boolean).join(", ");
          const ok = await confirm({
            title: { th: "ยังไม่ผ่านหลักสูตรก่อนหน้า", en: "Prerequisite not completed" },
            message: {
              th: `${label} ยังไม่ผ่านการอบรมหลักสูตร ${missing}\nยืนยันที่จะเพิ่มเข้ารุ่นนี้หรือไม่?`,
              en: `${label} has not completed ${missing}. Add them anyway?`,
            },
            confirmLabel: { th: "ยืนยันให้เพิ่ม", en: "Add anyway" },
            cancelLabel: { th: "ข้ามคนนี้", en: "Skip" },
            danger: true,
          });
          if (!ok) {
            outcome.skipped.push(label);
            continue;
          }
          await createEnrollment({ ...input, acknowledgePrerequisite: true });
        } else {
          throw error;
        }
      }
      await updateNeedRequest(request.id, { action: "link", planId });
      outcome.linked += 1;
    } catch (error) {
      outcome.failed.push({ name: label, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcome;
};

type PanelProps = {
  requests: NeedRequestRecord[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  sessionLabels: string[];
  targetSession: number;
  onTargetSession: (index: number) => void;
  /** The chosen OAP's owning company code, or null for a central plan. */
  planCompanyCode: string | null;
  /** True once a plan is chosen: the "create an OAP" way out is only for a course that has none. */
  hasPlan: boolean;
  onCreateOap: () => void;
  isThai: boolean;
};

/** The requests attached to this batch form: who gets enrolled and linked when it is saved. */
export function NeedRequestAttachPanel({
  requests,
  checkedIds,
  onToggle,
  sessionLabels,
  targetSession,
  onTargetSession,
  planCompanyCode,
  hasPlan,
  onCreateOap,
  isThai,
}: PanelProps) {
  const t = (th: string, en: string) => (isThai ? th : en);
  return (
    <div className={`${styles.fullField} ${styles.needRequestPanel}`}>
      <div className={styles.sectionHeader}>
        <div>
          <strong>{t(`คำขออบรมที่แนบมา (${requests.length})`, `Attached training requests (${requests.length})`)}</strong>
          <span>
            {t(
              "บันทึกแล้ว คนที่ติ๊กจะถูกลงชื่อเข้ารุ่นที่เลือก และคำขอเปลี่ยนเป็น \"บรรจุในแผนแล้ว\"",
              "On save, ticked people are enrolled in the chosen session and their requests become Planned.",
            )}
          </span>
        </div>
        {hasPlan ? null : (
          <button className={styles.addSessionButton} type="button" onClick={onCreateOap}>
            {t("ยังไม่มีแผน OAP ของหลักสูตรนี้? สร้างแผน OAP", "No OAP for this course? Create one")}
          </button>
        )}
      </div>
      {sessionLabels.length > 1 ? (
        <label className={styles.needRequestTarget}>
          {t("ลงชื่อเข้ารุ่น", "Enrol into session")}
          <select value={targetSession} onChange={(event) => onTargetSession(Number(event.target.value))}>
            {sessionLabels.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {requests.length === 0 ? (
        <p className={styles.needRequestNote}>
          {t("คำขอที่แนบมาถูกจัดรุ่นไปแล้ว หรือยังไม่ได้รับอนุมัติ", "The attached requests are already planned or not approved.")}
        </p>
      ) : (
        <ul className={styles.needRequestList}>
          {requests.map((request) => {
            // A company batch only takes that company's people; the server refuses the rest anyway.
            const wrongCompany = planCompanyCode !== null && request.companyCode !== planCompanyCode;
            return (
              <li key={request.id}>
                <label title={wrongCompany ? t("แผนของบริษัทอื่น รับคนต่างบริษัทไม่ได้", "A company plan only takes its own people") : undefined}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(request.id) && !wrongCompany}
                    disabled={wrongCompany}
                    onChange={() => onToggle(request.id)}
                  />
                  <strong>{request.employeeName}</strong>
                  <span>
                    {request.employeeCode} · {request.companyCode} · {request.requestNo} · {request.requestedCourseName}
                  </span>
                  {wrongCompany ? <em>{t("ต่างบริษัท", "Other company")}</em> : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
