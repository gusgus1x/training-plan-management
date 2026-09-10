"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { saveTrainingReviewers, searchReviewerCandidates } from "../../../../lib/trainingRecord/client";
import type { AssessmentStageInfo } from "../../../../lib/trainingEnrollment/types";
import type {
  ReviewerAssignment,
  ReviewerCandidate,
  TrainingRecordSummary,
} from "../../../../lib/trainingRecord/types";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { Check, X, Lock } from "../../../icons/LucideIcons";
import styles from "./ReviewerAssignmentPanel.module.css";

/** Two characters, matching parseReviewerSearch on the server. Searching for less is refused
 *  there, so the box does not send it. */
const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

export type ReviewerAttendee = {
  enrollmentId: string;
  name: string;
  employeeCode: string;
  /** Department and section in both languages. The Thai name is the one on file for most people, so
   *  showing the English one alone left the column reading as a code nobody uses. */
  orgUnit: {
    departmentTh: string;
    departmentEn: string;
    sectionTh: string;
    sectionEn: string;
  };
  reviewer: ReviewerAssignment | null;
};

type Props = {
  planId: string;
  attendees: ReviewerAttendee[];
  /** The 30-day follow-up stage, the only one a supervisor is ever asked to fill in. A course
   *  without one has nothing to hand to anyone. */
  evaluation: AssessmentStageInfo;
  onSaved: (record: TrainingRecordSummary) => void;
};

const orgUnitLine = (candidate: ReviewerCandidate) =>
  [candidate.division, candidate.department, candidate.section].filter(Boolean).join(" / ");

/** Enough of a supervisor's identity to show a chip. The saved assignment carries the same fields
 *  plus its own status, so an already-assigned supervisor becomes a chip without a second lookup. */
const asCandidate = (assignment: ReviewerAssignment): ReviewerCandidate => ({
  reviewerUserId: assignment.reviewerUserId,
  employeeCode: assignment.employeeCode,
  name: assignment.name,
  position: assignment.position,
  company: assignment.company,
  division: assignment.division,
  department: assignment.department,
  section: assignment.section,
});

/**
 * Hands each attendee's 30-day follow-up evaluation to one supervisor. Only that stage: it asks
 * what changed in the person since the course, which is the supervisor's to answer. The
 * after-training evaluation is the attendee's own verdict on the course and is never assigned.
 *
 * The screen is two steps, in the order HRD actually thinks: collect the supervisors this course
 * involves, then say who reports to whom. Pick supervisors into the tray, click one to hold it,
 * then click the attendees who report to them. Clicking a held supervisor's own attendee again
 * takes it back off.
 *
 * The search exists because this system holds no reporting line: no table says who anybody's
 * supervisor is, so the only reliable answer comes from the HRD user who knows. The dropdown lists
 * everyone whose position says section head; the search box reaches wider, and both show
 * division/department/section, since two people easily share a name.
 *
 * Nothing is written until Save. The caller keys this component by planId, so switching batch
 * remounts it and an unsaved mapping goes with the batch it belonged to.
 */
export default function ReviewerAssignmentPanel({ planId, attendees, evaluation, onSaved }: Props) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const toast = useToast();

  // The supervisors in play for this course. Seeded with whoever is already assigned, so a second
  // visit continues the mapping instead of starting from an empty tray.
  const [tray, setTray] = useState<ReviewerCandidate[]>(() => {
    const byUserId = new Map<string, ReviewerCandidate>();
    for (const attendee of attendees) {
      if (attendee.reviewer) byUserId.set(attendee.reviewer.reviewerUserId, asCandidate(attendee.reviewer));
    }
    return [...byUserId.values()];
  });
  // The supervisor being mapped right now. Clicking an attendee assigns this one.
  const [heldUserId, setHeldUserId] = useState<string | null>(null);
  // Rows whose saved assignment HRD has chosen to change. A saved row is read-only until then, so a
  // stray click on a roster of forty people cannot quietly reassign somebody.
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  // enrollmentId -> the supervisor picked but not yet saved. null is an explicit "remove", which is
  // why this is a Map with a nullable value rather than an object of ids.
  const [draft, setDraft] = useState<Map<string, ReviewerCandidate | null>>(new Map());
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<ReviewerCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Everyone whose position says section head, loaded once for the dropdown. An empty search is
  // what asks the server for that list.
  const [sectionHeads, setSectionHeads] = useState<ReviewerCandidate[]>([]);
  // Company code, or "" for all of them. A factory HRD user only ever sees their own company, so
  // the filter is only really doing work for a centre user.
  const [companyFilter, setCompanyFilter] = useState("");
  const requestRef = useRef(0);

  // Taken from the section-head list itself rather than the company master, so the filter can only
  // ever offer a company that has somebody in it - picking one never empties the list.
  const companies = useMemo(
    () => [...new Set(sectionHeads.map((head) => head.company).filter(Boolean))].sort(),
    [sectionHeads],
  );
  const inCompany = (candidate: ReviewerCandidate) =>
    companyFilter === "" || candidate.company === companyFilter;
  const visibleHeads = sectionHeads.filter(inCompany);
  const visibleCandidates = candidates.filter(inCompany);

  useEffect(() => {
    searchReviewerCandidates(planId, "")
      .then((result) => setSectionHeads(result.candidates))
      // The dropdown simply stays empty and says so; the search box still works.
      .catch(() => setSectionHeads([]));
  }, [planId]);

  useEffect(() => {
    const term = search.trim();
    // Each keystroke invalidates the one before it: without the token, a slow early request can
    // land after a later one and repopulate the list with results for text nobody typed.
    const token = ++requestRef.current;
    const timer = setTimeout(() => {
      if (term.length < SEARCH_MIN_LENGTH) {
        setCandidates([]);
        setSearchError("");
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      searchReviewerCandidates(planId, term)
        .then((result) => {
          if (token !== requestRef.current) return;
          setCandidates(result.candidates);
          setSearchError("");
        })
        .catch((error: Error) => {
          if (token !== requestRef.current) return;
          setCandidates([]);
          setSearchError(error.message);
        })
        .finally(() => {
          if (token === requestRef.current) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, planId]);

  /** Department and section as one line, in the screen's language, falling back to the other when a
   *  name exists in only one. An empty part is left out rather than shown as a dangling separator. */
  const orgUnitOf = (attendee: ReviewerAttendee) => {
    const { departmentTh, departmentEn, sectionTh, sectionEn } = attendee.orgUnit;
    const department = isThai ? departmentTh || departmentEn : departmentEn || departmentTh;
    const section = isThai ? sectionTh || sectionEn : sectionEn || sectionTh;
    return [department, section].filter(Boolean).join(" / ");
  };

  const reviewerOf = (attendee: ReviewerAttendee): ReviewerCandidate | null =>
    draft.has(attendee.enrollmentId) ? draft.get(attendee.enrollmentId)! : attendee.reviewer;

  const pendingCount = useMemo(() => draft.size, [draft]);
  const held = tray.find((candidate) => candidate.reviewerUserId === heldUserId) ?? null;

  const countFor = (reviewerUserId: string) =>
    attendees.filter((attendee) => reviewerOf(attendee)?.reviewerUserId === reviewerUserId).length;
  const unassignedCount = attendees.filter((attendee) => reviewerOf(attendee) === null).length;

  /**
   * Records a pick, or drops it again when it lands back on what is already saved.
   *
   * Without that second half, assigning somebody and then removing them left a draft entry saying
   * "set this to nobody" on a row that already had nobody. The row read as unsaved, the Save button
   * counted it, and saving sent a change that changed nothing.
   */
  const setReviewer = (enrollmentId: string, candidate: ReviewerCandidate | null) => {
    const saved = attendees.find((attendee) => attendee.enrollmentId === enrollmentId)?.reviewer ?? null;
    setDraft((current) => {
      const next = new Map(current);
      if ((saved?.reviewerUserId ?? null) === (candidate?.reviewerUserId ?? null)) next.delete(enrollmentId);
      else next.set(enrollmentId, candidate);
      return next;
    });
  };

  /** Adds a supervisor to the tray and holds them, ready to be mapped. Picking one already there
   *  just holds them again, so a double pick is never a duplicate chip. */
  const addToTray = (candidate: ReviewerCandidate) => {
    setTray((current) =>
      current.some((entry) => entry.reviewerUserId === candidate.reviewerUserId) ? current : [...current, candidate],
    );
    setHeldUserId(candidate.reviewerUserId);
    setSearch("");
    setCandidates([]);
  };

  /** Takes a supervisor out of the tray, and off every attendee mapped to them in this session.
   *  Assignments already saved come back rather than being deleted - removing a chip is a way to
   *  tidy the tray, not a way to unassign people by accident. */
  const removeFromTray = (reviewerUserId: string) => {
    setTray((current) => current.filter((entry) => entry.reviewerUserId !== reviewerUserId));
    if (heldUserId === reviewerUserId) setHeldUserId(null);
    setDraft((current) => {
      const next = new Map(current);
      for (const [enrollmentId, candidate] of current) {
        if (candidate?.reviewerUserId === reviewerUserId) next.delete(enrollmentId);
      }
      return next;
    });
  };

  /**
   * A row is closed once its reviewer has answered: their submission is filed against them by name,
   * so moving the assignment would leave answers credited to somebody the record no longer names.
   * The server refuses it too - this only keeps the screen honest about what it will accept.
   */
  const isLocked = (attendee: ReviewerAttendee) => attendee.reviewer?.submitted === true;

  /** Editable means the row is open to a click: never when locked, and for a row that already has a
   *  saved reviewer only after Edit has been pressed on it. */
  const isEditable = (attendee: ReviewerAttendee) =>
    !isLocked(attendee) &&
    (attendee.reviewer === null || unlocked.has(attendee.enrollmentId) || draft.has(attendee.enrollmentId));

  /** Clicking an attendee maps them to the held supervisor, or unmaps them when that supervisor is
   *  already theirs. One click does both, so nothing has to be undone through a second control. */
  const toggleAttendee = (attendee: ReviewerAttendee) => {
    if (isLocked(attendee)) {
      toast.warning(t("หัวหน้าตอบแบบประเมินไปแล้ว แก้ไขไม่ได้", "This reviewer has already answered"));
      return;
    }
    if (!isEditable(attendee)) {
      toast.warning(t("กดปุ่มแก้ไขที่แถวนี้ก่อน", "Press Edit on this row first"));
      return;
    }
    if (!held) {
      toast.warning(t("เลือกหัวหน้าจากด้านบนก่อน", "Pick a supervisor above first"));
      return;
    }
    const current = reviewerOf(attendee);
    setReviewer(attendee.enrollmentId, current?.reviewerUserId === held.reviewerUserId ? null : held);
  };

  const assignHeldToUnassigned = () => {
    if (!held) return;
    for (const attendee of attendees) {
      if (!isLocked(attendee) && reviewerOf(attendee) === null) setReviewer(attendee.enrollmentId, held);
    }
  };

  const save = () => {
    setIsSaving(true);
    saveTrainingReviewers(planId, {
      assignments: [...draft.entries()].map(([enrollmentId, candidate]) => ({
        enrollmentId,
        reviewerUserId: candidate?.reviewerUserId ?? null,
      })),
    })
      .then((result) => {
        setDraft(new Map());
        setUnlocked(new Set());
        onSaved(result.trainingRecord);
        toast.success(t("บันทึกหัวหน้าผู้ประเมินแล้ว", "Reviewers saved"));
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setIsSaving(false));
  };

  if (evaluation.mode === "NONE") {
    return (
      <section className={styles.panel} aria-label="Evaluation reviewers">
        <h3 className={styles.title}>
          {t("หัวหน้าผู้ประเมิน (แบบประเมินติดตามผล 30 วัน)", "Reviewers for the 30-day follow-up")}
        </h3>
        <p className={styles.note}>
          {t(
            "คอร์สนี้ไม่มีแบบประเมินติดตามผล 30 วัน จึงไม่มีอะไรให้มอบหมาย",
            "This course has no 30-day follow-up, so there is nothing to hand to anyone.",
          )}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="Evaluation reviewers">
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>
            {t("หัวหน้าผู้ประเมิน (แบบประเมินติดตามผล 30 วัน)", "Reviewers for the 30-day follow-up")}
          </h3>
          <p className={styles.note}>
            {t(
              "ขั้นที่ 1 เลือกหัวหน้าที่เกี่ยวข้องกับคอร์สนี้ให้ครบก่อน  ขั้นที่ 2 กดเลือกหัวหน้า 1 คน แล้วกดชื่อลูกน้องของเขา",
              "Step 1: collect the supervisors involved. Step 2: click one, then click the attendees who report to them.",
            )}
          </p>
        </div>
        <button type="button" className={styles.saveButton} disabled={pendingCount === 0 || isSaving} onClick={save}>
          {isSaving
            ? t("กำลังบันทึก...", "Saving...")
            : t(`บันทึก (${pendingCount} รายการ)`, `Save (${pendingCount})`)}
        </button>
      </div>

      {evaluation.mode === "LINK" ? (
        <p className={styles.warning}>
          {t(
            "แบบประเมิน 30 วันของคอร์สนี้เป็นลิงก์ภายนอก ระบบรู้ได้แค่ว่าหัวหน้าเปิดลิงก์แล้วหรือยัง ไม่มีทางรู้ว่าตอบเสร็จหรือไม่",
            "This course uses an external link. The system can only see whether the supervisor opened it, never whether they finished it.",
          )}
        </p>
      ) : null}

      <p className={styles.stepLabel}>{t("ขั้นที่ 1 · เลือกหัวหน้า", "Step 1 · Collect supervisors")}</p>

      <div className={styles.searchRow}>
        <select
          className={styles.companySelect}
          value={companyFilter}
          onChange={(event) => setCompanyFilter(event.target.value)}
        >
          <option value="">{t("ทุกบริษัท", "All companies")}</option>
          {companies.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>
        {/* The dropdown carries everyone whose position says section head. The box beside it
            searches wider - by level and by manager-and-above titles - for a head the position
            records do not name as one. */}
        <select
          className={styles.headSelect}
          value=""
          onChange={(event) => {
            const picked = sectionHeads.find((head) => head.reviewerUserId === event.target.value);
            if (picked) addToTray(picked);
          }}
        >
          <option value="">
            {visibleHeads.length === 0
              ? t("ไม่พบหัวหน้าแผนกในระบบ", "No section heads on file")
              : t(`เลือกหัวหน้าแผนก (${visibleHeads.length} คน)`, `Pick a section head (${visibleHeads.length})`)}
          </option>
          {visibleHeads.map((head) => (
            <option key={head.reviewerUserId} value={head.reviewerUserId}>
              {[head.company, head.name, head.position, orgUnitLine(head)].filter(Boolean).join(" · ")}
            </option>
          ))}
        </select>
        <input
          type="search"
          className={styles.searchInput}
          value={search}
          placeholder={t("หรือค้นหาด้วยชื่อ / รหัสพนักงาน", "Or search by name or employee code")}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className={styles.searchState}>
          {isSearching
            ? t("กำลังค้นหา...", "Searching...")
            : searchError ||
              (search.trim().length >= SEARCH_MIN_LENGTH
                ? t(`พบ ${visibleCandidates.length} คน`, `${visibleCandidates.length} found`)
                : "")}
        </span>
      </div>

      {visibleCandidates.length > 0 ? (
        <ul className={styles.candidateList}>
          {visibleCandidates.map((candidate) => (
            <li key={candidate.reviewerUserId}>
              <button type="button" className={styles.candidateButton} onClick={() => addToTray(candidate)}>
                <strong>{candidate.name}</strong>
                <span className={styles.candidateMeta}>
                  {[candidate.company, candidate.employeeCode, candidate.position].filter(Boolean).join(" · ")}
                </span>
                <span className={styles.candidateMeta}>{orgUnitLine(candidate) || "-"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {tray.length === 0 ? (
        <p className={styles.trayEmpty}>
          {t("ยังไม่ได้เลือกหัวหน้า เลือกจากรายการด้านบน", "No supervisors picked yet. Choose from above.")}
        </p>
      ) : (
        <ul className={styles.tray}>
          {tray.map((candidate) => {
            const isHeld = candidate.reviewerUserId === heldUserId;
            return (
              <li key={candidate.reviewerUserId}>
                <span className={isHeld ? styles.chipHeld : styles.chip}>
                  <button
                    type="button"
                    className={styles.chipButton}
                    aria-pressed={isHeld}
                    onClick={() => setHeldUserId(isHeld ? null : candidate.reviewerUserId)}
                  >
                    <strong>{candidate.name}</strong>
                    <span className={styles.chipMeta}>{orgUnitLine(candidate) || candidate.position || "-"}</span>
                    <span className={styles.chipCount}>
                      {t(`${countFor(candidate.reviewerUserId)} คน`, `${countFor(candidate.reviewerUserId)}`)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipRemove}
                    title={t("เอาออกจากรายการ", "Remove from the tray")}
                    onClick={() => removeFromTray(candidate.reviewerUserId)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.stepTwoHeader}>
        <p className={styles.stepLabel}>
          {t("ขั้นที่ 2 · กดชื่อพนักงานที่เป็นลูกน้องของหัวหน้าคนนี้", "Step 2 · Click the attendees who report to them")}
        </p>
        {held ? (
          <span className={styles.heldNote}>
            {t(`กำลังแมพให้ ${held.name}`, `Mapping to ${held.name}`)}
            {unassignedCount > 0 ? (
              <button type="button" className={styles.linkButton} onClick={assignHeldToUnassigned}>
                {t(`ใส่ให้คนที่ยังว่างทั้งหมด (${unassignedCount})`, `Assign all unassigned (${unassignedCount})`)}
              </button>
            ) : null}
          </span>
        ) : (
          <span className={styles.heldNote}>{t("ยังไม่ได้เลือกหัวหน้า", "No supervisor held")}</span>
        )}
      </div>

      <ul className={styles.attendeeList}>
        {attendees.map((attendee) => {
          const reviewer = reviewerOf(attendee);
          const isChanged = draft.has(attendee.enrollmentId);
          const isHeldsOwn = held !== null && reviewer?.reviewerUserId === held.reviewerUserId;
          const saved = attendee.reviewer;
          const locked = isLocked(attendee);
          const editable = isEditable(attendee);
          return (
            <li
              key={attendee.enrollmentId}
              className={isHeldsOwn ? styles.attendeeRowHeld : styles.attendeeRow}
            >
              <button
                type="button"
                className={styles.attendeePick}
                aria-pressed={isHeldsOwn}
                disabled={locked || !editable || !held}
                title={
                  locked
                    ? t("หัวหน้าตอบแบบประเมินไปแล้ว แก้ไขไม่ได้", "The reviewer has already answered")
                    : undefined
                }
                onClick={() => toggleAttendee(attendee)}
              >
                <span className={isHeldsOwn ? styles.tickOn : styles.tick} aria-hidden>
                  {isHeldsOwn ? <Check size={12} /> : null}
                </span>
                <span className={styles.attendeeText}>
                  <strong className={styles.ellipsis} title={attendee.name}>
                    {attendee.name}
                  </strong>
                  {/* One line, cut with an ellipsis when the unit names run long, and the full text
                      on hover - a section name can easily be longer than the column. */}
                  <span className={styles.attendeeMeta + " " + styles.ellipsis} title={orgUnitOf(attendee)}>
                    {[attendee.employeeCode, orgUnitOf(attendee)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>

              <div className={styles.reviewerCell}>
                {reviewer ? (
                  <>
                    <strong className={styles.ellipsis} title={reviewer.name}>
                      {reviewer.name}
                    </strong>
                    <span
                      className={styles.attendeeMeta + " " + styles.ellipsis}
                      title={orgUnitLine(reviewer) || reviewer.position}
                    >
                      {orgUnitLine(reviewer) || "-"}
                    </span>
                  </>
                ) : (
                  <span className={styles.attendeeMeta}>{t("ยังไม่ได้มอบหมาย", "Not assigned")}</span>
                )}
              </div>

              <div className={styles.statusCell}>
                {isChanged ? (
                  <span className={styles.draftTag}>{t("ยังไม่บันทึก", "Unsaved")}</span>
                ) : saved?.submitted ? (
                  // Only an in-system form can report this. A LINK course never sets it.
                  <span className={styles.doneTag}>{t("ตอบแล้ว", "Answered")}</span>
                ) : saved?.openedAt ? (
                  <span className={styles.openedTag}>{t("เปิดแล้ว", "Opened")}</span>
                ) : saved ? (
                  <span className={styles.waitingTag}>{t("ยังไม่เปิด", "Not opened")}</span>
                ) : null}
                {/* A saved row is read-only until Edit is pressed on it. Once the reviewer has
                    answered there is no Edit at all: the row is closed for good. */}
                {locked ? (
                  <span className={styles.lockedTag} title={t("แก้ไขไม่ได้แล้ว", "Closed")}>
                    <Lock size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("ล็อกแล้ว", "Locked")}
                  </span>
                ) : editable ? (
                  reviewer ? (
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => setReviewer(attendee.enrollmentId, null)}
                    >
                      {t("ถอดออก", "Remove")}
                    </button>
                  ) : null
                ) : (
                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={() =>
                      setUnlocked((current) => new Set(current).add(attendee.enrollmentId))
                    }
                  >
                    {t("แก้ไข", "Edit")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
