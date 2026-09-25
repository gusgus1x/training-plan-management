"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createEnrollment, listNominees } from "../../lib/trainingEnrollment/client";
import type { Nominee, NomineeField } from "../../lib/trainingEnrollment/types";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import { XCircle } from "../icons/LucideIcons";
import FilterSelect, { matchesFilter, type FilterOption } from "../FilterSelect";
import { useRealtime } from "../useRealtime";
import registerStyles from "./RegisterTrainingModule.module.css";
import styles from "./NominateEmployeesDialog.module.css";

type FilterKey = "company" | "division" | "section" | "department" | "person";

// Thai names checked against the database: department rows are named ส่วน… and section rows แผนก…,
// with every section under one department.
const FILTERS: Array<{ key: FilterKey; th: string; en: string }> = [
  { key: "company", th: "บริษัท", en: "Company" },
  { key: "division", th: "ฝ่าย", en: "Division" },
  { key: "section", th: "แผนก", en: "Section" },
  { key: "department", th: "ส่วน", en: "Department" },
  { key: "person", th: "ชื่อ", en: "Name" },
];

const EMPTY_FILTERS: Record<FilterKey, string> = { company: "", division: "", section: "", department: "", person: "" };

type Known = Record<FilterKey, Set<string>>;

type Label = (field: NomineeField) => string;

const matches = (nominee: Nominee, filters: Record<FilterKey, string>, known: Known, skip?: FilterKey) =>
  FILTERS.every(({ key }) => key === skip || matchesFilter(filters[key], known[key], nominee[key].values));

type Props = {
  course: { rollingId: string; id: string; title: string; batchRoundLabel?: string; batch?: string };
  onClose: () => void;
};

/** A head sending people ranked below them to one batch; HRD approves what arrives. */
export default function NominateEmployeesDialog({ course, onClose }: Props) {
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const toast = useToast();
  const [nominees, setNominees] = useState<Nominee[] | null>(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  const load = () =>
    listNominees(course.rollingId)
      .then((result) => setNominees(result.nominees))
      .catch(() => setNominees([]));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.rollingId]);

  // Someone else sending the same person marks them "registered" here too.
  useRealtime(["enrollment.changed"], () => void load(), { planId: course.rollingId, debounceMs: 800 });

  const labelOf: Label = (field) => (language === "th" ? field.label : field.labelEn);

  const known = useMemo(() => {
    const sets = Object.fromEntries(FILTERS.map(({ key }) => [key, new Set<string>()])) as Known;
    for (const nominee of nominees ?? []) {
      for (const { key } of FILTERS) sets[key].add((language === "th" ? nominee[key].label : nominee[key].labelEn).toLowerCase());
    }
    return sets;
  }, [nominees, language]);

  const visible = (nominees ?? []).filter((nominee) => matches(nominee, filters, known));
  const selectable = visible.filter((nominee) => !nominee.alreadyEnrolled);
  const allVisibleSelected = selectable.length > 0 && selectable.every((nominee) => selected.has(nominee.employeeUserId));

  // Each dropdown lists only what the other filters still allow, so picking a company narrows the
  // division, section and department lists to that company - and the same the other way round.
  // Typing "IT" finds "แผนกบริหารโครงการด้านเทคโนโลยีสารสนเทศ" through its English name.
  const optionsFor = (key: FilterKey): FilterOption[] => {
    const byLabel = new Map<string, Set<string>>();
    for (const nominee of nominees ?? []) {
      if (!matches(nominee, filters, known, key)) continue;
      const label = labelOf(nominee[key]);
      if (!label) continue;
      const search = byLabel.get(label) ?? new Set<string>();
      for (const value of nominee[key].values) search.add(value.toLowerCase());
      byLabel.set(label, search);
    }
    return [...byLabel]
      .map(([label, search]) => ({ label, search: [...search] }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"));
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const nominee of selectable) {
        if (allVisibleSelected) next.delete(nominee.employeeUserId);
        else next.add(nominee.employeeUserId);
      }
      return next;
    });

  const send = async () => {
    if (!selected.size) return;
    setIsSending(true);
    const failures: string[] = [];
    for (const employeeUserId of selected) {
      try {
        await createEnrollment({ planId: course.rollingId, employeeId: "0", employeeUserId, source: "EMPLOYEE" });
      } catch (error) {
        const who = nominees?.find((nominee) => nominee.employeeUserId === employeeUserId)?.name ?? employeeUserId;
        failures.push(`${who}: ${error instanceof Error ? error.message : "-"}`);
      }
    }
    const sent = selected.size - failures.length;
    setIsSending(false);
    setSelected(new Set());
    await load();
    if (sent) toast.success(t(`ส่ง ${sent} คนให้ HRD พิจารณาแล้ว`, `Sent ${sent} to HRD for approval`));
    if (failures.length) toast.error(t(`ส่งไม่สำเร็จ ${failures.length} คน — ${failures.join(" · ")}`, `${failures.length} not sent — ${failures.join(" · ")}`));
    else onClose();
  };

  const detailOf = (nominee: Nominee) =>
    [nominee.position, nominee.company, nominee.division, nominee.department, nominee.section]
      .map(labelOf)
      .filter(Boolean)
      .join(" · ");

  return createPortal(
    <div className={registerStyles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="nominate-title">
      <div className={`${registerStyles.modalDialog} ${styles.dialog}`}>
        <div className={registerStyles.modalHeader}>
          <div>
            <h3 className={registerStyles.modalTitle} id="nominate-title">{t("ส่งพนักงานเข้าอบรม", "Send employees to training")}</h3>
            <p className={styles.subtitle}>
              {course.id} · {course.title}
              {course.batchRoundLabel ? ` (${course.batchRoundLabel})` : course.batch ? ` (${course.batch})` : ""}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t("ปิด", "Close")}>
            <XCircle size={20} />
          </button>
        </div>

        <div className={registerStyles.modalBody}>
          <div className={styles.filters}>
            {FILTERS.map(({ key, th, en }) => (
              <FilterSelect
                key={key}
                label={t(th, en)}
                placeholder={t("ทั้งหมด", "All")}
                value={filters[key]}
                options={optionsFor(key)}
                onChange={(value) => setFilters((current) => ({ ...current, [key]: value }))}
              />
            ))}
          </div>

          {nominees === null ? (
            <p className={styles.note}>{t("กำลังโหลดรายชื่อ...", "Loading employees...")}</p>
          ) : visible.length === 0 ? (
            <p className={styles.note}>{t("ไม่พบพนักงานที่ส่งได้", "No employees you can send")}</p>
          ) : (
            <div className={styles.list}>
              <label className={`${styles.row} ${styles.headRow}`}>
                <input type="checkbox" checked={allVisibleSelected} disabled={!selectable.length} onChange={toggleAllVisible} />
                <span>{t(`เลือกทั้งหมดที่แสดง (${selectable.length})`, `Select all shown (${selectable.length})`)}</span>
              </label>
              {visible.map((nominee) => (
                <label key={nominee.employeeUserId} className={styles.row} data-disabled={nominee.alreadyEnrolled || undefined}>
                  <input
                    type="checkbox"
                    checked={selected.has(nominee.employeeUserId)}
                    disabled={nominee.alreadyEnrolled}
                    onChange={() => toggle(nominee.employeeUserId)}
                  />
                  <span className={styles.person}>
                    <strong>{labelOf(nominee.person)}</strong>
                    <small>{detailOf(nominee)}</small>
                  </span>
                  {nominee.alreadyEnrolled ? (
                    <span className={styles.tagMuted}>{t("ลงทะเบียนแล้ว", "Registered")}</span>
                  ) : nominee.outOfTarget ? (
                    <span className={styles.tagWarn}>{t("นอกเป้าหมาย", "Out of target")}</span>
                  ) : null}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={registerStyles.modalFooter}>
          <span className={styles.count}>{t(`เลือกแล้ว ${selected.size} คน`, `${selected.size} selected`)}</span>
          <button type="button" className={registerStyles.cancelRegisterBtn} onClick={onClose} disabled={isSending}>
            {t("ยกเลิก", "Cancel")}
          </button>
          <button type="button" className={registerStyles.confirmRegisterBtn} onClick={() => void send()} disabled={isSending || !selected.size}>
            {isSending ? t("กำลังส่ง...", "Sending...") : t("ส่งเข้าอบรม", "Send to training")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
