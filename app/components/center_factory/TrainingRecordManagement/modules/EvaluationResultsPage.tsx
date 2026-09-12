"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readEvaluationResponses, readEvaluationSummary } from "../../../../lib/trainingForms/client";
import {
  FREE_TEXT_MIN_RESPONDENTS,
  type EvaluationRespondentGroup,
  type EvaluationResponse,
  type EvaluationResponseList,
  type EvaluationSummary,
  type EvaluationSummaryQuestion,
  type EvaluationTimingStage,
} from "../../../../lib/trainingForms/types";
import { isFormBlockType } from "../../../../lib/formBlocks";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { Clock, FileSpreadsheet, FileText, Lock, Printer, Star, Target, Users, X } from "../../../icons/LucideIcons";
import styles from "./EvaluationResultsPage.module.css";

/**
 * Everything one course's evaluation was answered with, on a page of its own.
 *
 * It used to be a panel inside the record workspace, where it pushed the rest of the screen far
 * enough down that HRD scrolled past their own work to reach it. The workspace now carries a
 * button, and the reading happens here, where a chart has room to be a chart.
 *
 * Every number on this page is counted per PERSON, not per answer row - that is the summary's own
 * contract, and it is what makes "50%" mean half the people rather than half the ticks.
 */

/** The one palette used by every chart here, so a colour means the same thing on all of them. */
const SERIES_COLOURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const colourAt = (index: number) => SERIES_COLOURS[index % SERIES_COLOURS.length];

/**
 * The grid's own ramp, which is a different job from the categorical palette above.
 *
 * A Likert scale is ordered, so its colours have to be: warm at the unhappy end, cool at the happy
 * one, neutral in the middle. Six unrelated hues said nothing about direction and left the chart
 * needing its legend read before any of it meant anything.
 */
const SCALE_STOPS = ["#dc2626", "#f97316", "#eab308", "#84cc16", "#16a34a"];

/**
 * Position on the scale, red at the first step and green at the last.
 *
 * Taken by ratio rather than by index, so a three-point scale still runs red to green and a
 * seven-point one still reads in the same direction - the colour means "how far along", not "which
 * option number".
 */
const scaleColourAt = (index: number, count: number) => {
  if (count <= 1) return SCALE_STOPS[SCALE_STOPS.length - 1];
  const ratio = index / (count - 1);
  return SCALE_STOPS[Math.round(ratio * (SCALE_STOPS.length - 1))];
};

/**
 * How long the average reply took, in the largest unit that still reads as a duration.
 *
 * A dash when there is nothing to average: the replies taken before the system recorded an opening
 * time cannot say how long they took, and a zero there would read as "answered instantly".
 */
const formatAnswerTime = (seconds: number | null, t: (th: string, en: string) => string) => {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds} ${t("วินาที", "sec")}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${t("นาที", "min")}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} ${t("ชม.", "hr")}`
    : `${hours} ${t("ชม.", "hr")} ${rest} ${t("นาที", "min")}`;
};

/**
 * What one person said to one question, as a single readable string.
 *
 * An empty string rather than a dash for "did not answer", because the cell is already blank on the
 * page and a dash reads like a deliberate "none of these".
 */
const answerText = (response: EvaluationResponse, questionId: string) => {
  const answer = response.answers.find((entry) => entry.questionId === questionId);
  if (!answer) return "";
  if (answer.text !== null) return answer.text;
  if (answer.ratingValue !== null) return String(answer.ratingValue);
  return answer.choices.join(", ");
};

/**
 * A donut, drawn with one circle per slice and `stroke-dasharray`. No chart library: this is the
 * only shape on the page that a library would draw, and it is eleven lines of SVG.
 *
 * Slices of zero are skipped rather than drawn with zero length, because a zero-length dash still
 * paints its round line cap and leaves a dot on the ring.
 */
const Donut = ({ slices }: { slices: { label: string; count: number }[] }) => {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const centre = 80;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // The ring sits inside a wider box so the percentages have room outside it. Without the margin
  // they were clipped by the viewBox on the slices nearest three and nine o'clock.
  const labelRadius = radius + 20;
  let offset = 0;

  return (
    <svg viewBox="0 0 160 160" className={styles.donut} role="img" aria-hidden="true">
      <circle cx={centre} cy={centre} r={radius} className={styles.donutTrack} />
      {total === 0
        ? null
        : slices.map((slice, index) => {
            if (slice.count === 0) return null;
            const length = (slice.count / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            // The label goes at the slice's midpoint, measured from twelve o'clock the same way
            // the ring is rotated, so the text lands on the wedge it describes.
            const midAngle = ((offset + length / 2) / circumference) * 2 * Math.PI - Math.PI / 2;
            const element = (
              <g key={slice.label + index}>
                <circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  className={styles.donutSlice}
                  stroke={colourAt(index)}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
                <text
                  x={centre + Math.cos(midAngle) * labelRadius}
                  y={centre + Math.sin(midAngle) * labelRadius}
                  className={styles.donutLabel}
                >
                  {Math.round((slice.count / total) * 100)}%
                </text>
              </g>
            );
            offset += length;
            return element;
          })}
    </svg>
  );
};

/** A count and its share of the people who answered, as one horizontal bar. */
const Bar = ({
  label,
  count,
  total,
  colour,
}: {
  label: string;
  count: number;
  total: number;
  colour: string;
}) => {
  const percent = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.barTrack}>
        <span className={styles.barFill} style={{ width: `${percent}%`, background: colour }} />
      </span>
      <span className={styles.barValue}>
        {count} ({percent}%)
      </span>
    </div>
  );
};

/**
 * Five stars with the average filled in, the way a rating question is read at a glance. The filled
 * ones take the colour of where the average sits on the scale, so a 1.4 reads red and a 4.8 green
 * without anybody counting the stars.
 */
const Stars = ({ average }: { average: number }) => {
  const filled = Math.round(average);
  return (
    <span className={styles.stars} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={styles.star}
          style={{ color: star <= filled ? scaleColourAt(filled - 1, 5) : undefined }}
        >
          <Star size={14} />
        </span>
      ))}
    </span>
  );
};

const ChoiceChart = ({ question }: { question: EvaluationSummaryQuestion }) => (
  <div className={styles.chartSplit}>
    <ul className={styles.legend}>
      {question.options.map((option, index) => (
        <li key={option.optionId}>
          <span className={styles.legendDot} style={{ background: colourAt(index) }} />
          <span className={styles.legendLabel}>{option.optionText}</span>
          <span className={styles.legendCount}>{option.count}</span>
        </li>
      ))}
    </ul>
    <Donut slices={question.options.map((option) => ({ label: option.optionText, count: option.count }))} />
  </div>
);

const RatingChart = ({ question }: { question: EvaluationSummaryQuestion }) => (
  <div className={styles.chartSplit}>
    <div className={styles.average}>
      <strong>{(question.averageRating ?? 0).toFixed(2)}</strong>
      <span>คะแนนเฉลี่ย</span>
      <Stars average={question.averageRating ?? 0} />
    </div>
    <div className={styles.bars}>
      {/* Highest value first: a rating scale reads top-down from best, and the stored buckets
          arrive in ascending order. */}
      {[...question.ratingDistribution].reverse().map((bucket) => (
        <Bar
          key={bucket.value}
          label={question.options[bucket.value - 1]?.optionText ?? `ระดับ ${bucket.value}`}
          count={bucket.count}
          total={question.answeredBy}
          // Same ramp as the grid, and for the same reason: the bar's colour says where on the
          // scale it sits, so a row of red at the top is legible before the labels are.
          colour={scaleColourAt(bucket.value - 1, question.ratingDistribution.length)}
        />
      ))}
    </div>
  </div>
);

/**
 * A grid, as the diverging stacked bar a Likert scale is normally read with: the columns run in
 * their own order from worst to best, the axis is pinned at the middle of the scale, and each row's
 * answers push left or right of it.
 *
 * The first version drew each row as its own little bar chart. It was the rating chart reused, and
 * it answers a different question: it says how a row was answered, but not which rows the group
 * leaned unhappy about, which is the only reason a grid is on a report at all. Reading that off
 * separate charts means comparing four bars in four places.
 *
 */
const GridChart = ({ question }: { question: EvaluationSummaryQuestion }) => {
  const columns = question.gridRows[0]?.cells ?? [];
  // The first half of the scale reads as the unhappy end. An odd middle column goes with the
  // positive side rather than being split down the axis: splitting is the statistician's habit, and
  // on a small batch it draws one person's single answer as two bars either side of the line, which
  // reads as a fault rather than as a neutral answer.
  const leftCount = Math.floor(columns.length / 2);
  const leftOf = (index: number) => index < leftCount;

  // Every bar would be zero wide, which draws as nothing at all and reads as a broken chart rather
  // than as an unanswered question.
  if (question.answeredBy === 0) {
    return <p className={styles.withheld}>ยังไม่มีใครตอบข้อนี้</p>;
  }

  return (
    <div className={styles.gridChart}>
      <ul className={styles.legend}>
        {columns.map((column, index) => (
          <li key={column.columnId}>
            <span
              className={styles.legendDot}
              style={{ background: scaleColourAt(index, columns.length) }}
            />
            <span className={styles.legendLabel}>{column.columnText}</span>
          </li>
        ))}
      </ul>

      <div className={styles.gridRows}>
        {question.gridRows.map((row) => (
          <div key={row.rowId} className={styles.gridRow}>
            <span className={styles.gridRowLabel} title={`${row.answeredBy} ผู้ตอบ`}>
              {row.rowText}
            </span>
            <span className={styles.gridTrack}>
              {/* Two halves meeting at the axis. The left one is laid out in reverse so the first
                  column ends up furthest from the centre, which is what makes the scale read
                  outward in both directions. */}
              <span className={`${styles.gridHalf} ${styles.gridHalfLeft}`}>
                {row.cells.map((cell, index) =>
                  !leftOf(index) ? null : (
                    <span
                      key={cell.columnId}
                      className={styles.gridSegment}
                      style={{
                        width: `${cell.percent}%`,
                        background: scaleColourAt(index, columns.length),
                      }}
                      title={`${cell.columnText}: ${cell.count} (${cell.percent}%)`}
                    />
                  ),
                )}
              </span>
              <span className={styles.gridAxis} />
              <span className={styles.gridHalf}>
                {row.cells.map((cell, index) =>
                  leftOf(index) ? null : (
                    <span
                      key={cell.columnId}
                      className={styles.gridSegment}
                      style={{
                        width: `${cell.percent}%`,
                        background: scaleColourAt(index, columns.length),
                      }}
                      title={`${cell.columnText}: ${cell.count} (${cell.percent}%)`}
                    />
                  ),
                )}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* The first cell is empty on purpose: it lines the marks up under the track rather than
          under the row labels. */}
      <div className={styles.gridScale}>
        <span />
        <span className={styles.gridScaleMarks}>
          <span>100%</span>
          <span>0%</span>
          <span>100%</span>
        </span>
      </div>
    </div>
  );
};

/** The first few written answers, with the rest behind "รายละเอียดเพิ่มเติม". */
const TextAnswers = ({
  question,
  onOpen,
}: {
  question: EvaluationSummaryQuestion;
  onOpen: () => void;
}) => {
  if (question.textAnswersWithheld) {
    return (
      <p className={styles.withheld}>
        ซ่อนข้อความไว้จนกว่าจะมีผู้ตอบครบ {FREE_TEXT_MIN_RESPONDENTS} คน — จำนวนผู้ตอบน้อยเกินกว่าจะรักษาการไม่ระบุตัวตนได้
      </p>
    );
  }
  if (question.textAnswers.length === 0) return null;
  return (
    <div className={styles.textPreview}>
      <span className={styles.textPreviewLabel}>การตอบกลับล่าสุด</span>
      {question.textAnswers.slice(0, 3).map((text, index) => (
        <p key={index}>&ldquo;{text}&rdquo;</p>
      ))}
      {question.textAnswers.length > 3 ? (
        <button type="button" className={styles.moreLink} onClick={onOpen}>
          ···
        </button>
      ) : null}
    </div>
  );
};

export default function EvaluationResultsPage({ planId }: { planId: string }) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const router = useRouter();

  const [respondents, setRespondents] = useState<EvaluationRespondentGroup>("EMPLOYEE");
  const [timing, setTiming] = useState<EvaluationTimingStage>("EVALUATION");
  const [loaded, setLoaded] = useState<Record<
    EvaluationRespondentGroup,
    Record<EvaluationTimingStage, EvaluationSummary | null>
  > | null>(null);
  const [detail, setDetail] = useState<EvaluationSummaryQuestion | null>(null);
  // The individual replies are a second, heavier read, so they are fetched only once somebody asks
  // to see a person rather than a count.
  const [responses, setResponses] = useState<EvaluationResponseList | null>(null);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [individualIndex, setIndividualIndex] = useState<number | null>(null);

  // All four combinations at once, rather than two per audience on demand. The 30-day stage is
  // mostly answered by supervisors, so an HRD who left the audience on "attendees" read zero and
  // had no way to tell that two replies were sitting behind the other button. Holding all four
  // also means switching audience redraws instead of flickering through a load.
  useEffect(() => {
    let cancelled = false;
    const read = (timing: EvaluationTimingStage, group: EvaluationRespondentGroup) =>
      readEvaluationSummary(planId, timing, group).catch(() => ({ summary: null }));

    Promise.all([
      read("EVALUATION", "EMPLOYEE"),
      read("EVALUATION_30DAY", "EMPLOYEE"),
      read("EVALUATION", "SUPERVISOR"),
      read("EVALUATION_30DAY", "SUPERVISOR"),
    ]).then(([employeeAfter, employee30, supervisorAfter, supervisor30]) => {
      if (cancelled) return;
      setLoaded({
        EMPLOYEE: { EVALUATION: employeeAfter.summary, EVALUATION_30DAY: employee30.summary },
        SUPERVISOR: { EVALUATION: supervisorAfter.summary, EVALUATION_30DAY: supervisor30.summary },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  // A supervisor is only ever asked for the 30-day follow-up, so that is the only stage of theirs
  // that can carry answers. Reading an empty "after training" tab as "no supervisor replied" would
  // be wrong: none was ever asked.
  const shownTiming = respondents === "SUPERVISOR" ? "EVALUATION_30DAY" : timing;
  const summary = loaded?.[respondents][shownTiming] ?? null;
  /** Replies of the audience that is NOT on screen, for the same stage. */
  const otherAudience = respondents === "EMPLOYEE" ? "SUPERVISOR" : "EMPLOYEE";
  const otherAudienceCount = loaded?.[otherAudience][shownTiming]?.submittedCount ?? 0;

  /**
   * The questions, with the section breaks kept as the headings they are.
   *
   * They used to be filtered out with the text blocks, which hid the one thing that explains a
   * question nobody answered: a branching form sends each respondent down one section, so the other
   * section's questions read "0 answered" for them. Without the headings that looks like data loss
   * rather than a question these people were never shown.
   */
  const questions = useMemo(
    () => (summary?.questions ?? []).filter((question) => question.questionType !== "TEXT_BLOCK"),
    [summary],
  );

  /** A form that branches. Only then is "nobody answered" ambiguous enough to need explaining. */
  const hasSections = useMemo(
    () => (summary?.questions ?? []).some((question) => question.questionType === "SECTION_BREAK"),
    [summary],
  );

  const goBack = () => {
    // Opened in its own tab from the record workspace, whose course, session and half-typed
    // results live in component state - navigating that tab away would drop HRD at Step 1.
    if (window.opener) window.close();
    else router.push("/training-record/training-record");
  };

  /**
   * Fetches the individual replies once, for whichever audience and stage is on screen. The cached
   * copy is thrown away whenever either changes, because it answers a different question then.
   */
  const loadedKey = `${shownTiming}:${respondents}`;
  const [responsesKey, setResponsesKey] = useState<string | null>(null);
  const ensureResponses = async () => {
    if (responsesKey === loadedKey && responses) return responses;
    setIsLoadingResponses(true);
    try {
      const result = await readEvaluationResponses(planId, shownTiming, respondents);
      setResponses(result.responses);
      setResponsesKey(loadedKey);
      return result.responses;
    } catch {
      setResponses(null);
      setResponsesKey(null);
      return null;
    } finally {
      setIsLoadingResponses(false);
    }
  };

  const openDetail = async (question: EvaluationSummaryQuestion) => {
    setDetail(question);
    await ensureResponses();
  };

  const openIndividual = async () => {
    const list = await ensureResponses();
    if (list && list.responses.length > 0) setIndividualIndex(0);
  };

  /**

  /** The replies on screen, or nothing while they are still on their way. */
  const shownResponses = responsesKey === loadedKey ? responses : null;
  const individual: EvaluationResponse | null =
    individualIndex === null ? null : shownResponses?.responses[individualIndex] ?? null;

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backButton} onClick={goBack}>
          ← {t("ย้อนกลับ", "Back")}
        </button>
      </div>

      <div className={styles.layout}>
        <section className={styles.main}>
          <header className={styles.header}>
            <div>
              <p className={styles.kicker}>Evaluation results</p>
              <h1>{t("ภาพรวมการตอบกลับ", "Response overview")}</h1>
              {summary ? <p className={styles.formName}>{summary.formName}</p> : null}
            </div>
            {summary?.isAnonymous ? (
              <span className={styles.anonymousTag}><Lock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{t("ไม่ระบุตัวตน", "Anonymous")}</span>
            ) : null}
          </header>

          <div className={styles.filters}>
            {(
              [
                { group: "EMPLOYEE", label: t("ผู้เข้าอบรม", "Attendees") },
                { group: "SUPERVISOR", label: t("หัวหน้า", "Supervisors") },
              ] as const
            ).map((option) => (
              <button
                key={option.group}
                type="button"
                className={respondents === option.group ? styles.pillOn : styles.pill}
                onClick={() => setRespondents(option.group)}
              >
                {option.label}
              </button>
            ))}
            <span className={styles.filterDivider} />
            {(
              [
                { stage: "EVALUATION", label: t("หลังอบรม", "After training") },
                { stage: "EVALUATION_30DAY", label: t("ติดตามผล 30 วัน", "30-day follow-up") },
              ] as const
            ).map((option) => {
              const selectable = respondents === "EMPLOYEE" || option.stage === "EVALUATION_30DAY";
              return (
                <button
                  key={option.stage}
                  type="button"
                  disabled={!selectable}
                  className={shownTiming === option.stage ? styles.pillOn : styles.pill}
                  onClick={() => setTiming(option.stage)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {!loaded ? (
            <p className={styles.note}>{t("กำลังโหลด...", "Loading...")}</p>
          ) : !summary ? (
            <p className={styles.note}>
              {t("หลักสูตรนี้ไม่ได้ตั้งแบบประเมินช่วงเวลานี้ไว้", "This course has no evaluation for this stage")}
            </p>
          ) : (
            <>
              {/* Label, then a number big enough to read across a desk, with the icon out of the
                  way on the right - the shape a reader already knows from Microsoft Forms. */}
              <div className={styles.tiles}>
                <article className={styles.tile}>
                  <div>
                    <span>{t("การตอบกลับ", "Responses")}</span>
                    <strong>{summary.submittedCount}</strong>
                  </div>
                  <Users size={26} className={styles.tileIcon} />
                </article>
                <article className={styles.tile}>
                  <div>
                    <span>{t("เวลาเฉลี่ยในการตอบ", "Average time to answer")}</span>
                    <strong>{formatAnswerTime(summary.averageAnswerSeconds, t)}</strong>
                  </div>
                  <Clock size={26} className={styles.tileIcon} />
                </article>
                <article className={styles.tile}>
                  <div>
                    <span>{t("อัตราการตอบกลับ", "Response rate")}</span>
                    <strong>{summary.responseRatePercent}%</strong>
                  </div>
                  <Target size={26} className={styles.tileIcon} />
                </article>
              </div>

              {summary.submittedCount === 0 ? (
                <p className={styles.note}>
                  {t("ยังไม่มีผู้ตอบแบบประเมินนี้", "Nobody has answered this yet")}
                  {/* The 30-day stage is mostly the supervisors', so an empty attendee tab is the
                      expected state rather than a missing one. Say where the replies are instead of
                      leaving a zero that reads like a fault. */}
                  {otherAudienceCount > 0
                    ? t(
                        ` · มีคำตอบจาก${otherAudience === "SUPERVISOR" ? "หัวหน้า" : "ผู้เข้าอบรม"} ${otherAudienceCount} คน กดปุ่มด้านบนเพื่อดู`,
                        ` · ${otherAudienceCount} reply(s) from ${otherAudience === "SUPERVISOR" ? "supervisors" : "attendees"} - switch with the buttons above`,
                      )
                    : ""}
                </p>
              ) : (
                <div className={styles.questions}>
                  {questions.map((question, index) => {
                    // A section break is a heading, not a question: it carries the name of the
                    // branch the questions under it belong to, which is the only thing that
                    // explains a question this audience was never shown.
                    if (question.questionType === "SECTION_BREAK") {
                      return (
                        <h2 key={question.questionId} className={styles.sectionName}>
                          {question.questionText}
                        </h2>
                      );
                    }
                    const previousSection = index > 0 ? questions[index - 1].sectionName : null;
                    const startsSection =
                      question.sectionName !== null && question.sectionName !== previousSection;
                    const hasDetail =
                      question.textAnswers.length > 0 || question.gridRows.length > 0 || question.options.length > 0;
                    return (
                      <Fragment key={question.questionId}>
                        {startsSection ? <h2 className={styles.sectionName}>{question.sectionName}</h2> : null}
                        <article className={styles.questionCard}>
                          <div className={styles.questionHead}>
                            <strong>
                              {question.questionOrder}. {question.questionText}
                            </strong>
                            {hasDetail ? (
                              <button type="button" className={styles.detailLink} onClick={() => void openDetail(question)}>
                                {t("รายละเอียดเพิ่มเติม", "More details")}
                              </button>
                            ) : null}
                          </div>
                          <p className={styles.answeredBy}>
                            {t(`ตอบ ${question.answeredBy} คน`, `${question.answeredBy} answered`)}
                            {/* On a branching form, zero usually means this audience was routed
                                down the other section and never saw the question at all. Saying so
                                keeps it from reading as an answer that went missing. */}
                            {question.answeredBy === 0 && hasSections
                              ? t(
                                  " · ผู้ตอบกลุ่มนี้ไม่ได้ถูกพามาที่ข้อนี้ (ฟอร์มแยกสายตามคำตอบข้อก่อนหน้า)",
                                  " - this audience was routed past it; the form branches on an earlier answer",
                                )
                              : ""}
                          </p>

                          {question.ratingDistribution.length > 0 ? <RatingChart question={question} /> : null}
                          {question.ratingDistribution.length === 0 && question.options.length > 0 ? (
                            <ChoiceChart question={question} />
                          ) : null}
                          {question.gridRows.length > 0 ? <GridChart question={question} /> : null}
                          <TextAnswers question={question} onOpen={() => void openDetail(question)} />
                        </article>
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <aside className={styles.insights}>
          <h2>{t("ข้อมูลเชิงลึกและการดำเนินการ", "Insights and actions")}</h2>

          <div className={styles.insightBlock}>
            <p className={styles.insightLabel}>
              {t("วิเคราะห์และสำรวจผลลัพธ์ล่าสุดใน Excel", "Analyse the latest results in Excel")}
            </p>
            {/* A plain link, not a fetch: the browser downloads it with the session cookie and
                names the file from the header, which is the whole job. */}
            <a
              className={styles.insightAction}
              href={`/api/training-plan/training-records/${planId}/evaluations/${shownTiming}/export?respondents=${respondents}`}
              aria-disabled={!summary || summary.submittedCount === 0}
              onClick={(event) => {
                if (!summary || summary.submittedCount === 0) event.preventDefault();
              }}
            >
              <FileSpreadsheet size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{t("ดาวน์โหลดเป็น Excel", "Download as Excel")}
            </a>
          </div>

          <div className={styles.insightBlock}>
            <button
              type="button"
              className={styles.insightAction}
              disabled={!summary || summary.submittedCount === 0 || isLoadingResponses}
              onClick={() => void openIndividual()}
            >
              <FileText size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{t("ตรวจสอบผลแต่ละรายการ", "Review individual responses")}
              {isLoadingResponses ? <em>{t("กำลังโหลด...", "Loading...")}</em> : null}
            </button>
          </div>
        </aside>
      </div>


      {detail ? (
        <div className={styles.overlay} onClick={() => setDetail(null)}>
          <div className={styles.detailCard} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.detailClose} onClick={() => setDetail(null)}>
              <X size={16} />
            </button>
            <h2>
              {detail.questionOrder}. {detail.questionText}
            </h2>
            <p className={styles.answeredBy}>
              {t(`${detail.answeredBy} การตอบกลับ`, `${detail.answeredBy} responses`)}
            </p>

            {/* One row per person, the way the answer sheet reads - not a tally, which the card
                behind this one already shows. A respondent with nothing to say for this question
                still gets a row: "nobody answered" and "these people answered" are different
                readings, and a missing row would quietly become the second. */}
            {isLoadingResponses && !shownResponses ? (
              <p className={styles.note}>{t("กำลังโหลด...", "Loading...")}</p>
            ) : !shownResponses ? (
              <p className={styles.note}>{t("อ่านคำตอบรายคนไม่ได้", "Individual replies could not be read")}</p>
            ) : (
              <table className={styles.detailTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t("ชื่อ", "Name")}</th>
                    {/* Only a supervisor's pile has a subject; an attendee answers for themselves. */}
                    {shownResponses.responses.some((response) => response.subjectName) ? (
                      <th>{t("ประเมินให้", "Evaluating")}</th>
                    ) : null}
                    <th>{t("การตอบกลับ", "Response")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shownResponses.responses.map((response) => (
                    <tr key={response.responseNo}>
                      <td>{response.responseNo}</td>
                      <td>
                        {response.respondentName ?? t("ไม่ระบุตัวตน", "anonymous")}
                        {response.respondentPosition ? (
                          <small className={styles.detailPosition}>{response.respondentPosition}</small>
                        ) : null}
                      </td>
                      {shownResponses.responses.some((entry) => entry.subjectName) ? (
                        <td>{response.subjectName ?? "-"}</td>
                      ) : null}
                      <td>{answerText(response, detail.questionId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        </div>
      ) : null}

      {/* One person's whole paper. The name is absent on an anonymous form because the server never
          sent one - not because this screen chose to hide it. */}
      {individual && shownResponses ? (
        <div className={styles.overlay} onClick={() => setIndividualIndex(null)}>
          <div
            className={styles.individualCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.individualTopBar}>
              <h2>{t("ดูผลลัพธ์", "View result")}</h2>
              <div className={styles.individualTopActions}>
                <button type="button" className={styles.printButton} onClick={() => window.print()}>
                  <Printer size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  {t("บันทึกเป็น PDF", "Save as PDF")}
                </button>
                <button type="button" className={styles.detailClose} onClick={() => setIndividualIndex(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.individualNav}>
              <button
                type="button"
                disabled={individualIndex === 0}
                onClick={() => setIndividualIndex((current) => Math.max(0, (current ?? 0) - 1))}
              >
                ‹
              </button>
              {/* Arrows walk the list one at a time; the picker jumps straight to a person, which is
                  what HRD actually wants once they know whose reply they came here for. It carries
                  the label, so the heading beside it does not repeat the name twice. */}
              <label className={styles.individualPicker}>
                <span>{t("ผู้ตอบ", "Respondent")}</span>
                <select
                  value={individualIndex ?? 0}
                  onChange={(event) => setIndividualIndex(Number(event.target.value))}
                >
                  {shownResponses.responses.map((response, index) => (
                    <option key={response.responseNo} value={index}>
                      {response.responseNo}.{" "}
                      {response.respondentName ?? t("ไม่ระบุตัวตน", "anonymous")}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={individualIndex === shownResponses.responses.length - 1}
                onClick={() =>
                  setIndividualIndex((current) =>
                    Math.min(shownResponses.responses.length - 1, (current ?? 0) + 1),
                  )
                }
              >
                ›
              </button>
            </div>

            {/* Who wrote this and, for a supervisor's reply, who it is about. On screen and on
                paper both: the picker above is a control and prints as a line of nothing useful. */}
            <div className={styles.individualWhoBlock}>
              <div>
                <span>{t("ผู้ตอบแบบประเมิน", "Respondent")}</span>
                <strong>{individual.respondentName ?? t("ไม่ระบุตัวตน", "anonymous")}</strong>
                {individual.respondentPosition ? <em>{individual.respondentPosition}</em> : null}
              </div>
              {individual.subjectName ? (
                <div>
                  <span>{t("ประเมินให้", "Evaluating")}</span>
                  <strong>{individual.subjectName}</strong>
                </div>
              ) : null}
            </div>

            <div className={styles.individualAnswers}>
              {shownResponses.questions
                .filter((question) => !isFormBlockType(question.questionType))
                .map((question) => {
                  const text = answerText(individual, question.questionId);
                  return (
                    <div key={question.questionId} className={styles.individualAnswerBlock}>
                      <p className={styles.individualQuestion}>
                        {question.questionOrder}. {question.questionText}
                      </p>
                      <p className={text === "" ? styles.individualBlank : styles.individualAnswer}>
                        {text === "" ? t("ไม่ได้ตอบ", "Not answered") : text}
                      </p>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      ) : null}
    </main>
  );
}
