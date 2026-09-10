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
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" className={styles.donut} role="img" aria-hidden="true">
      <circle cx="60" cy="60" r={radius} className={styles.donutTrack} />
      {total === 0
        ? null
        : slices.map((slice, index) => {
            if (slice.count === 0) return null;
            const length = (slice.count / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const element = (
              <circle
                key={slice.label + index}
                cx="60"
                cy="60"
                r={radius}
                className={styles.donutSlice}
                stroke={colourAt(index)}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
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

/** Five stars with the average filled in, the way a rating question is read at a glance. */
const Stars = ({ average }: { average: number }) => (
  <span className={styles.stars} aria-hidden="true">
    {[1, 2, 3, 4, 5].map((star) => (
      <span key={star} className={star <= Math.round(average) ? styles.starOn : styles.starOff}>
        ★
      </span>
    ))}
  </span>
);

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
          colour={colourAt(0)}
        />
      ))}
    </div>
  </div>
);

const GridChart = ({ question }: { question: EvaluationSummaryQuestion }) => (
  <div className={styles.gridRows}>
    {question.gridRows.map((row) => (
      <div key={row.rowId}>
        <p className={styles.gridRowTitle}>
          {row.rowText} <span>({row.answeredBy} ผู้ตอบ)</span>
        </p>
        <div className={styles.bars}>
          {row.cells.map((cell, index) => (
            <Bar
              key={cell.columnId}
              label={cell.columnText}
              count={cell.count}
              total={row.answeredBy}
              colour={colourAt(index)}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);

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
  const [loaded, setLoaded] = useState<{
    respondents: EvaluationRespondentGroup;
    byTiming: Record<EvaluationTimingStage, EvaluationSummary | null>;
  } | null>(null);
  const [detail, setDetail] = useState<EvaluationSummaryQuestion | null>(null);
  // The individual replies are a second, heavier read, so they are fetched only once somebody asks
  // to see a person rather than a count.
  const [responses, setResponses] = useState<EvaluationResponseList | null>(null);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [individualIndex, setIndividualIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readEvaluationSummary(planId, "EVALUATION", respondents).catch(() => ({ summary: null })),
      readEvaluationSummary(planId, "EVALUATION_30DAY", respondents).catch(() => ({ summary: null })),
    ]).then(([afterTraining, followUp]) => {
      if (cancelled) return;
      setLoaded({
        respondents,
        byTiming: { EVALUATION: afterTraining.summary, EVALUATION_30DAY: followUp.summary },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [planId, respondents]);

  // A supervisor is only ever asked for the 30-day follow-up, so that is the only stage of theirs
  // that can carry answers. Reading an empty "after training" tab as "no supervisor replied" would
  // be wrong: none was ever asked.
  const shownTiming = respondents === "SUPERVISOR" ? "EVALUATION_30DAY" : timing;
  const summary = loaded?.byTiming[shownTiming] ?? null;

  const questions = useMemo(
    () => (summary?.questions ?? []).filter((question) => !isFormBlockType(question.questionType)),
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
              <span className={styles.anonymousTag}>🔒 {t("ไม่ระบุตัวตน", "Anonymous")}</span>
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
              <div className={styles.tiles}>
                <article className={styles.tile}>
                  <span>{t("การตอบกลับ", "Responses")}</span>
                  <strong>{summary.submittedCount}</strong>
                </article>
                <article className={styles.tile}>
                  <span>{t("ผู้ถูกถาม", "Asked")}</span>
                  <strong>{summary.expectedCount}</strong>
                </article>
                <article className={styles.tile}>
                  <span>{t("อัตราการตอบกลับ", "Response rate")}</span>
                  <strong>{summary.responseRatePercent}%</strong>
                </article>
              </div>

              {summary.submittedCount === 0 ? (
                <p className={styles.note}>{t("ยังไม่มีผู้ตอบแบบประเมินนี้", "Nobody has answered this yet")}</p>
              ) : (
                <div className={styles.questions}>
                  {questions.map((question, index) => {
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
            <button type="button" className={styles.insightAction} disabled>
              📊 {t("ดาวน์โหลดเป็น Excel", "Download as Excel")}
              <em>{t("กำลังทำ", "Not built yet")}</em>
            </button>
          </div>

          <div className={styles.insightBlock}>
            <button
              type="button"
              className={styles.insightAction}
              disabled={!summary || summary.submittedCount === 0 || isLoadingResponses}
              onClick={() => void openIndividual()}
            >
              🧾 {t("ตรวจสอบผลแต่ละรายการ", "Review individual responses")}
              {isLoadingResponses ? <em>{t("กำลังโหลด...", "Loading...")}</em> : null}
            </button>
          </div>
        </aside>
      </div>

      {detail ? (
        <div className={styles.overlay} onClick={() => setDetail(null)}>
          <div className={styles.detailCard} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.detailClose} onClick={() => setDetail(null)}>
              ✕
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
                    <th>{t("การตอบกลับ", "Response")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shownResponses.responses.map((response) => (
                    <tr key={response.responseNo}>
                      <td>{response.responseNo}</td>
                      <td>{response.respondentName ?? t("ไม่ระบุตัวตน", "anonymous")}</td>
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
                  🖨️ {t("บันทึกเป็น PDF", "Save as PDF")}
                </button>
                <button type="button" className={styles.detailClose} onClick={() => setIndividualIndex(null)}>
                  ✕
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

            {/* The paper says who it belongs to. The picker above is a control and prints as one
                line of nothing useful, so the printed copy gets this instead. */}
            <p className={styles.individualPrintedWho}>
              {t("ผู้ตอบ", "Respondent")} {individual.responseNo} ·{" "}
              {individual.respondentName ?? t("ไม่ระบุตัวตน", "anonymous")}
            </p>

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
