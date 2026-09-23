"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "../../../ConfirmDialog";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { getCourseCoverage } from "../../../../lib/trainingEnrollment/client";
import {
  filterByView,
  summarize,
  type CoverageDepartment,
  type CoverageSummary,
  type CoverageView,
} from "../../../../lib/trainingEnrollment/coverageSummary";
import type { CourseCoverageEmployee } from "../../../../lib/trainingEnrollment/types";
import styles from "./CourseCoveragePanel.module.css";

type Props = {
  planId: string;
  courseTitle: string;
  isCenter: boolean;
  /** The factory's own company code, shown instead of a company picker. */
  ownCompany: string;
  canSend: boolean;
  /** Sends the picked employees to this batch; the panel reloads once it settles. */
  onRetrain: (employeeIds: string[]) => Promise<void>;
};

type SectionKey = { department: string; section: string };

const sameSection = (a: SectionKey | null, b: SectionKey) => a !== null && a.department === b.department && a.section === b.section;

/* ---------- 3D bar chart (hand-drawn SVG: no chart library in this project) ---------- */

const WIDTH = 960;
const DEPT_W = 150;
const LABEL_W = 210;
const PCT_W = 70;
const ROW_H = 28;
const BAR_H = 16;
const DEPTH = 6;
const GROUP_GAP = 10;
/** Room for the department name to wrap onto three or four lines, even over a single section. */
const MIN_GROUP_H = 2 * ROW_H;
const TOP = 12;
const AXIS_H = 34;

/** A round axis step giving roughly five ticks. */
const niceStep = (max: number) => {
  const rough = Math.max(1, max) / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  return ([1, 2, 5, 10].map((m) => m * power).find((step) => step >= rough) ?? 10 * power);
};

/** Where every department block and section row sits; a short block is padded and its rows centred. */
const layoutRows = (departments: CoverageDepartment[]) => {
  const groups: Array<{ department: CoverageDepartment; top: number; bottom: number }> = [];
  const rows: Array<{ department: CoverageDepartment; section: CoverageDepartment["sections"][number]; y: number }> = [];
  let y = TOP;
  for (const department of departments) {
    const height = Math.max(department.sections.length * ROW_H, MIN_GROUP_H);
    const first = y + (height - department.sections.length * ROW_H) / 2;
    department.sections.forEach((section, index) => rows.push({ department, section, y: first + index * ROW_H }));
    groups.push({ department, top: y, bottom: y + height });
    y += height + GROUP_GAP;
  }
  return { groups, rows, bottom: y - GROUP_GAP };
};

type BarProps = {
  departments: CoverageDepartment[];
  unnamed: string;
  selected: SectionKey | null;
  onSelect: (key: SectionKey) => void;
};

function CoverageBarChart({ departments, unnamed, selected, onSelect }: BarProps) {
  const { groups, rows, bottom } = layoutRows(departments);
  const maxTotal = Math.max(1, ...rows.map((row) => row.section.total));
  const step = niceStep(maxTotal);
  const axisMax = Math.ceil(maxTotal / step) * step;
  const barX = DEPT_W + LABEL_W;
  const barW = WIDTH - barX - PCT_W - DEPTH;
  const scale = (value: number) => (value / axisMax) * barW;
  const height = bottom + AXIS_H;
  const ticks = Array.from({ length: axisMax / step + 1 }, (_, i) => i * step);

  return (
    <svg className={styles.barChart} viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Actual vs remain by section">
      {ticks.map((tick) => (
        <g key={tick}>
          <line className={styles.grid} x1={barX + scale(tick)} x2={barX + scale(tick)} y1={TOP} y2={bottom} />
          <text className={styles.axisText} x={barX + scale(tick)} y={bottom + 16} textAnchor="middle">
            {tick}
          </text>
        </g>
      ))}
      <text className={styles.axisText} x={WIDTH - PCT_W} y={bottom + 30} textAnchor="end">
        man
      </text>

      {groups.map(({ department, top, bottom: groupBottom }, index) => {
        const name = department.name || unnamed;
        return (
          <g key={`dept-${index}`}>
            <rect className={styles.groupBand} x={0} y={top} width={DEPT_W - 6} height={groupBottom - top} rx={6} />
            {/* HTML inside the SVG so a long Thai name wraps (on grapheme boundaries) instead of overlapping. */}
            <foreignObject x={4} y={top} width={DEPT_W - 14} height={groupBottom - top}>
              <div className={styles.deptLabel} title={name}>
                <span>{name}</span>
              </div>
            </foreignObject>
            {index < groups.length - 1 ? (
              <line className={styles.groupLine} x1={0} x2={WIDTH - PCT_W} y1={groupBottom + GROUP_GAP / 2} y2={groupBottom + GROUP_GAP / 2} />
            ) : null}
          </g>
        );
      })}

      {rows.map(({ department, section, y: rowY }) => {
        const key = { department: department.name, section: section.name };
        const isSelected = sameSection(selected, key);
        const barY = rowY + (ROW_H - BAR_H) / 2 + DEPTH / 2;
        const trainedW = scale(section.trained);
        const remainW = scale(section.remain);
        const end = barX + trainedW + remainW;
        const top = (x: number, w: number) => `${x},${barY} ${x + DEPTH},${barY - DEPTH} ${x + w + DEPTH},${barY - DEPTH} ${x + w},${barY}`;
        const label = section.name || unnamed;
        return (
          <g
            key={`${department.name}|${section.name}`}
            className={styles.barRow}
            onClick={() => onSelect(key)}
            role="button"
            aria-pressed={isSelected}
          >
            <title>{`${label}: ${section.trained}/${section.total} (${section.pct.toFixed(1)}%)`}</title>
            <rect className={isSelected ? styles.rowSelected : styles.rowHit} x={DEPT_W} y={rowY} width={WIDTH - DEPT_W} height={ROW_H} />
            <text className={styles.sectionText} x={barX - 8} y={rowY + ROW_H / 2 + 4} textAnchor="end">
              {label.length > 30 ? `${label.slice(0, 29)}…` : label}
            </text>
            {trainedW > 0 ? (
              <>
                <polygon className={styles.actualTop} points={top(barX, trainedW)} />
                <rect className={styles.actualFront} x={barX} y={barY} width={trainedW} height={BAR_H} />
              </>
            ) : null}
            {remainW > 0 ? (
              <>
                <polygon className={styles.remainTop} points={top(barX + trainedW, remainW)} />
                <rect className={styles.remainFront} x={barX + trainedW} y={barY} width={remainW} height={BAR_H} />
              </>
            ) : null}
            {section.total > 0 ? (
              <polygon
                className={remainW > 0 ? styles.remainSide : styles.actualSide}
                points={`${end},${barY} ${end + DEPTH},${barY - DEPTH} ${end + DEPTH},${barY + BAR_H - DEPTH} ${end},${barY + BAR_H}`}
              />
            ) : null}
            {trainedW > 22 ? (
              <text className={styles.inBarLight} x={barX + trainedW / 2} y={barY + BAR_H / 2 + 4} textAnchor="middle">
                {section.trained}
              </text>
            ) : null}
            {remainW > 22 ? (
              <text className={styles.inBarDark} x={barX + trainedW + remainW / 2} y={barY + BAR_H / 2 + 4} textAnchor="middle">
                {section.remain}
              </text>
            ) : null}
            <text className={styles.pctText} x={end + DEPTH + 8} y={barY + BAR_H / 2 + 4}>
              {section.pct.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Donut (same approach as EvaluationResultsPage's Donut) ---------- */

function CoverageDonut({ summary, isThai }: { summary: CoverageSummary; isThai: boolean }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const trainedLength = summary.total ? (summary.trained / summary.total) * circumference : 0;
  return (
    <div className={styles.donutWrap}>
      <svg className={styles.donut} viewBox="0 0 200 200" role="img" aria-label={`${summary.pct.toFixed(0)}%`}>
        <circle className={styles.donutRemain} cx="100" cy="100" r={radius} />
        {trainedLength > 0 ? (
          <circle
            className={styles.donutActual}
            cx="100"
            cy="100"
            r={radius}
            strokeDasharray={`${trainedLength} ${circumference}`}
            transform="rotate(-90 100 100)"
          />
        ) : null}
        <text className={styles.donutTotal} x="100" y="96" textAnchor="middle">
          {summary.total.toLocaleString()}
        </text>
        <text className={styles.donutUnit} x="100" y="118" textAnchor="middle">
          {isThai ? "คน" : "man"}
        </text>
      </svg>
      <ul className={styles.legendList} translate="no">
        <li>
          <span className={styles.swatchActual} /> Actual {summary.trained.toLocaleString()} ({summary.pct.toFixed(1)}%)
        </li>
        <li>
          <span className={styles.swatchRemain} /> Remain {summary.remain.toLocaleString()} (
          {summary.total ? (100 - summary.pct).toFixed(1) : "0.0"}%)
        </li>
      </ul>
    </div>
  );
}

/* ---------- Panel ---------- */

export default function CourseCoveragePanel({ planId, courseTitle, isCenter, ownCompany, canSend, onRetrain }: Props) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const confirm = useConfirm();
  const [reloadKey, setReloadKey] = useState(0);
  // Tagged with the request it answers, so a new batch shows "loading" without resetting state in the effect.
  const [loaded, setLoaded] = useState<{ key: string; rows: CourseCoverageEmployee[]; failed: boolean } | null>(null);
  const requestKey = `${planId}|${reloadKey}`;
  const rows = loaded?.key === requestKey ? loaded.rows : null;
  const failed = loaded?.key === requestKey && loaded.failed;
  const [view, setView] = useState<CoverageView>("target");
  const [company, setCompany] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState<SectionKey | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let active = true;
    const key = `${planId}|${reloadKey}`;
    getCourseCoverage(planId)
      .then((result) => active && setLoaded({ key, rows: result.employees, failed: false }))
      .catch(() => active && setLoaded({ key, rows: [], failed: true }));
    return () => {
      active = false;
    };
  }, [planId, reloadKey]);

  const companies = useMemo(() => [...new Set((rows ?? []).map((row) => row.companyCode).filter(Boolean))].sort(), [rows]);
  const visibleRows = useMemo(() => filterByView(rows ?? [], view, company), [rows, view, company]);
  const summary = useMemo(() => summarize(visibleRows), [visibleRows]);
  const unnamed = t("ไม่ระบุ", "Unspecified");

  // Trained people in view, narrowed to the section clicked on the chart.
  const trainedRows = visibleRows
    .filter((row) => row.timesTrained > 0)
    .filter((row) => !selectedSection || sameSection(selectedSection, row));
  const retrainGroups = summarize(trainedRows).departments.map((department) => ({
    name: department.name,
    sections: department.sections.map((section) => ({
      name: section.name,
      people: trainedRows
        .filter((row) => row.department === department.name && row.section === section.name)
        .sort((a, b) => (b.lastTrainedAt ?? "").localeCompare(a.lastTrainedAt ?? "")),
    })),
  }));
  const selectable = trainedRows.filter((row) => !row.seatedNow);

  const toggle = (ids: string[], on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const pickedIds = selectable.filter((row) => picked.has(row.employeeId)).map((row) => row.employeeId);

  const sendRetrain = async () => {
    if (!pickedIds.length) return;
    const ok = await confirm({
      title: { th: "ส่งอบรมซ้ำ", en: "Send to retrain" },
      message: {
        th: `ยืนยันที่จะส่งพนักงาน ${pickedIds.length} คน เข้าอบรมหลักสูตร "${courseTitle}" หรือไม่?`,
        en: `Send ${pickedIds.length} employee(s) to "${courseTitle}" again?`,
      },
      confirmLabel: { th: "ยืนยันส่งอบรม", en: "Send" },
      cancelLabel: { th: "ยกเลิก", en: "Cancel" },
    });
    if (!ok) return;
    setIsSending(true);
    try {
      await onRetrain(pickedIds);
      setPicked(new Set());
    } finally {
      setIsSending(false);
      setReloadKey((key) => key + 1);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(isThai ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Training coverage</p>
          <h3>{t("ประวัติการอบรมหลักสูตรนี้", "Who has trained on this course")}</h3>
        </div>
        <div className={styles.controls}>
          <label>
            <span>{t("แสดงผล", "Show")}</span>
            <select
              value={view}
              onChange={(event) => {
                setView(event.target.value as CoverageView);
                setSelectedSection(null);
              }}
            >
              <option value="target">{t("ตามกลุ่มเป้าหมาย", "Target group")}</option>
              <option value="company">{t("พนักงานทั้งบริษัท", "Whole company")}</option>
              {isCenter ? <option value="all">{t("พนักงานทั้งหมด (ทุกบริษัท)", "All employees (every company)")}</option> : null}
            </select>
          </label>
          {isCenter ? (
            view !== "all" ? (
              <label>
                <span>{t("บริษัท", "Company")}</span>
                <select
                  value={company}
                  onChange={(event) => {
                    setCompany(event.target.value);
                    setSelectedSection(null);
                  }}
                >
                  <option value="ALL">{t("ทุกบริษัท", "All companies")}</option>
                  {companies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            ) : null
          ) : (
            <span className={styles.companyTag}>{ownCompany}</span>
          )}
        </div>
      </div>

      {rows === null ? (
        <p className={styles.note}>{t("กำลังโหลดประวัติการอบรม...", "Loading training history...")}</p>
      ) : failed ? (
        <p className={styles.note}>{t("โหลดประวัติการอบรมไม่สำเร็จ", "Could not load training history")}</p>
      ) : summary.total === 0 ? (
        <p className={styles.note}>{t("ไม่มีพนักงานในมุมมองนี้", "No employees in this view")}</p>
      ) : (
        <>
          <div className={styles.charts}>
            <div className={styles.chartCard}>
              <div className={styles.chartHead}>
                <strong>{t("อบรมแล้ว / คงเหลือ ตามส่วนและแผนก", "Actual vs remain by department and section")}</strong>
                <span className={styles.legendInline} translate="no">
                  <span className={styles.swatchActual} /> Actual <span className={styles.swatchRemain} /> Remain
                  <span className={styles.pctKey}>% Attend</span>
                </span>
              </div>
              <div className={styles.barScroll}>
                <CoverageBarChart
                  departments={summary.departments}
                  unnamed={unnamed}
                  selected={selectedSection}
                  onSelect={(key) => setSelectedSection((current) => (sameSection(current, key) ? null : key))}
                />
              </div>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartHead}>
                <strong>% Attend</strong>
              </div>
              <CoverageDonut summary={summary} isThai={isThai} />
            </div>
          </div>

          <div className={styles.retrain}>
            <div className={styles.retrainHead}>
              <div>
                <strong>{t("ผู้ที่เคยอบรมหลักสูตรนี้แล้ว (Retrain)", "Already trained (retrain)")}</strong>
                <span className={styles.muted}>
                  {selectedSection
                    ? ` · ${selectedSection.section || unnamed}`
                    : ` · ${t("คลิกแถวในกราฟเพื่อกรองแผนก", "click a chart row to filter by section")}`}
                </span>
                {selectedSection ? (
                  <button type="button" className={styles.linkBtn} onClick={() => setSelectedSection(null)}>
                    {t("ดูทั้งหมด", "Show all")}
                  </button>
                ) : null}
              </div>
              {canSend ? (
                <button type="button" className={styles.sendBtn} disabled={!pickedIds.length || isSending} onClick={() => void sendRetrain()}>
                  {isSending ? t("กำลังส่ง...", "Sending...") : t(`ส่งอบรมซ้ำ (${pickedIds.length})`, `Send to retrain (${pickedIds.length})`)}
                </button>
              ) : null}
            </div>

            {trainedRows.length === 0 ? (
              <p className={styles.note}>{t("ยังไม่มีผู้ที่อบรมหลักสูตรนี้แล้ว", "Nobody has trained on this course yet")}</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        {canSend ? (
                          <input
                            type="checkbox"
                            aria-label={t("เลือกทั้งหมดที่แสดง", "Select all shown")}
                            checked={selectable.length > 0 && pickedIds.length === selectable.length}
                            onChange={(event) => toggle(selectable.map((row) => row.employeeId), event.target.checked)}
                          />
                        ) : null}
                      </th>
                      <th>{t("รหัส", "Code")}</th>
                      <th>{t("ชื่อ", "Name")}</th>
                      {isCenter ? <th>{t("บริษัท", "Company")}</th> : null}
                      <th>{t("อบรมล่าสุด", "Last trained")}</th>
                      <th>{t("รุ่น", "Batch")}</th>
                      <th>{t("ครั้ง", "Times")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retrainGroups.flatMap((department) =>
                      department.sections.flatMap((section) => {
                        const sectionIds = section.people.filter((row) => !row.seatedNow).map((row) => row.employeeId);
                        return [
                          <tr key={`h|${department.name}|${section.name}`} className={styles.groupRow}>
                            <td>
                              {canSend && sectionIds.length ? (
                                <input
                                  type="checkbox"
                                  aria-label={t("เลือกทั้งแผนก", "Select whole section")}
                                  checked={sectionIds.every((id) => picked.has(id))}
                                  onChange={(event) => toggle(sectionIds, event.target.checked)}
                                />
                              ) : null}
                            </td>
                            <td colSpan={isCenter ? 6 : 5}>
                              {department.name || unnamed} › {section.name || unnamed}
                              <span className={styles.muted}> ({section.people.length})</span>
                            </td>
                          </tr>,
                          ...section.people.map((row) => (
                            <tr key={row.employeeId} data-disabled={row.seatedNow || undefined}>
                              <td>
                                {canSend ? (
                                  <input
                                    type="checkbox"
                                    aria-label={row.name}
                                    disabled={row.seatedNow}
                                    checked={picked.has(row.employeeId)}
                                    onChange={(event) => toggle([row.employeeId], event.target.checked)}
                                  />
                                ) : null}
                              </td>
                              <td>{row.employeeCode}</td>
                              <td>
                                {row.name}
                                {row.seatedNow ? <span className={styles.seatTag}>{t("ลงรอบนี้แล้ว", "In this batch")}</span> : null}
                              </td>
                              {isCenter ? <td>{row.companyCode}</td> : null}
                              <td>{formatDate(row.lastTrainedAt)}</td>
                              <td>{row.lastBatchName ?? "-"}</td>
                              <td>{row.timesTrained}</td>
                            </tr>
                          )),
                        ];
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
