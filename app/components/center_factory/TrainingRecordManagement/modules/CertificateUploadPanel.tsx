"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  certificateFileUrl,
  confirmPlanCertificates,
  discardPlanCertificates,
  loadPlanCertificates,
  removePlanCertificateFile,
  uploadPlanCertificates,
} from "../../../../lib/certificates/client";
import {
  certificateBatchSummary,
  withDuplicatesMarked,
  type CertificateCandidate,
  type CertificateCard,
  type CertificatePlanView,
  type IssuedCertificate,
} from "../../../../lib/certificates/types";
import { Check, X, Eye, Trash2 } from "../../../icons/LucideIcons";
import styles from "./TrainingRecord.module.css";

/**
 * HRD uploads the certificate PDFs for one training batch here, checks how each file was matched,
 * fixes anything wrong, and saves. Nothing reaches the employee until Save: everything before that
 * is a draft that only HRD can open.
 */
export default function CertificateUploadPanel({ planId }: { planId: string }) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const confirm = useConfirm();
  const toast = useToast();

  const [roster, setRoster] = useState<CertificateCandidate[]>([]);
  const [cards, setCards] = useState<CertificateCard[]>([]);
  const [issued, setIssued] = useState<IssuedCertificate[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const applyView = useCallback((view: CertificatePlanView) => {
    setRoster(view.roster);
    setCards(view.draft?.cards ?? []);
    setIssued(view.issued);
  }, []);

  // Every setState happens in a callback, never synchronously in the effect body: doing the latter
  // is what cascading-render lint flags, and it is the same shape as the AuthGate redirect bug.
  // `cancelled` guards the real race - switching batches while a slower response is still in
  // flight would otherwise show one batch's certificates under another's heading.
  useEffect(() => {
    let cancelled = false;

    loadPlanCertificates(planId)
      .then((view) => {
        if (cancelled) return;
        applyView(view);
        setPreviewId(null);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [planId, applyView]);

  const summary = useMemo(() => certificateBatchSummary(cards), [cards]);

  /** Everyone on the batch, each paired with their certificate when one exists. Listing the whole
   *  roster is what turns "who is still missing" into a column to scan rather than a sentence that
   *  grows with the class size. */
  const rosterRows = useMemo(
    () =>
      roster.map((candidate) => ({
        candidate,
        certificate: issued.find((entry) => entry.employeeUserId === candidate.employeeUserId) ?? null,
      })),
    [roster, issued],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const result = await uploadPlanCertificates(planId, Array.from(files));
      setCards(result.draft.cards);
      for (const rejection of result.rejected) {
        toast.error(`${rejection.fileName}: ${rejection.reason}`);
      }
      if (result.rejected.length === 0) {
        toast.success(t("อัปโหลดไฟล์เรียบร้อย", "Files uploaded"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("อัปโหลดไม่สำเร็จ", "Upload failed"));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  /** Re-picking is local until Save; the confirm payload is what actually commits it. */
  const assignEmployee = (certificateFileId: string, employeeUserId: string) => {
    setCards((current) =>
      withDuplicatesMarked(
        current.map((card) => {
          if (card.certificateFileId !== certificateFileId) return card;
          const owner = roster.find((candidate) => candidate.employeeUserId === employeeUserId);
          if (!owner) {
            return { ...card, employeeUserId: null, employeeCode: null, employeeName: null, state: "NOT_ON_PLAN" };
          }
          return {
            ...card,
            employeeUserId: owner.employeeUserId,
            employeeCode: owner.employeeCode,
            employeeName: owner.employeeName,
            state: "MANUAL",
          };
        }),
      ),
    );
  };

  /**
   * Removes the file for real, on the server. It used to drop the card from local state only, which
   * looked right until the next upload: that answers with the whole draft as the database still has
   * it, so the removed file came straight back and only Discard-all could clear it.
   */
  const removeCard = async (certificateFileId: string) => {
    const ok = await confirm({
      message: {
        th: "เอาไฟล์นี้ออกจากรายการหรือไม่? ไฟล์จะถูกลบทิ้ง",
        en: "Remove this file? It will be deleted.",
      },
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      applyView(await removePlanCertificateFile(planId, certificateFileId));
      setPreviewId((current) => (current === certificateFileId ? null : current));
      toast.success(t("เอาไฟล์ออกแล้ว", "File removed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ลบไฟล์ไม่สำเร็จ", "Could not remove the file"));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const assignments = cards
      .filter((card) => card.employeeUserId !== null)
      .map((card) => ({ certificateFileId: card.certificateFileId, employeeUserId: card.employeeUserId! }));

    const ok = await confirm({
      message: {
        th: `ยืนยันบันทึกใบเกียรติบัตร ${assignments.length} ไฟล์ให้พนักงานหรือไม่? พนักงานจะเห็นใบของตัวเองทันที`,
        en: `Save ${assignments.length} certificate(s)? Each employee will see their own immediately.`,
      },
    });
    if (!ok) return;

    setBusy(true);
    try {
      applyView(await confirmPlanCertificates(planId, { assignments }));
      setPreviewId(null);
      toast.success(t("บันทึกใบเกียรติบัตรเรียบร้อย", "Certificates saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("บันทึกไม่สำเร็จ", "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    const ok = await confirm({
      message: {
        th: `ยกเลิกและลบไฟล์ที่อัปโหลดไว้ทั้ง ${cards.length} ไฟล์หรือไม่?`,
        en: `Discard all ${cards.length} uploaded file(s)?`,
      },
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      applyView(await discardPlanCertificates(planId));
      setPreviewId(null);
      toast.success(t("ยกเลิกชุดอัปโหลดแล้ว", "Upload discarded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ยกเลิกไม่สำเร็จ", "Discard failed"));
    } finally {
      setBusy(false);
    }
  };

  const stateBadge = (state: CertificateCard["state"]) => {
    switch (state) {
      case "MATCHED":
        return { text: t("จับคู่แล้ว", "Matched"), tone: styles.certificateStateOk };
      case "MANUAL":
        return { text: t("เลือกเอง", "Chosen by hand"), tone: styles.certificateStateInfo };
      case "REPLACE":
        return { text: t("แทนที่ใบเดิม", "Replaces existing"), tone: styles.certificateStateWarn };
      case "DUPLICATE":
        return { text: t("ซ้ำกับอีกไฟล์", "Duplicate employee"), tone: styles.certificateStateBad };
      default:
        return { text: t("ไม่พบพนักงานในรุ่นนี้", "Not on this batch"), tone: styles.certificateStateBad };
    }
  };

  const issuedPercent = roster.length === 0 ? 0 : Math.round((issued.length / roster.length) * 100);

  return (
    <section className={styles.certificatePanel} aria-label="Certificate upload">
      <header className={styles.certificateHeader}>
        <div>
          <span className={styles.certificateKicker}>{t("ใบเกียรติบัตร", "Certificates")}</span>
          <h4 className={styles.certificateTitle}>
            {t("ออกใบเกียรติบัตรให้ผู้เข้าอบรมรุ่นนี้", "Issue certificates to this batch")}
          </h4>
          <p className={styles.certificateHint}>
            <em className={styles.certificateRequiredMark} aria-hidden="true">
              *
            </em>{" "}
            {t(
              "ตั้งชื่อไฟล์เป็น SAP UserID ตามด้วย _ และชื่อพนักงาน เช่น ",
              "Name each file with the SAP UserID first, then _ and the name, e.g. ",
            )}
            <code>12345678_สมชาย ใจดี.pdf</code>
          </p>
        </div>
        <label
          className={`${styles.certificateUploadButton} ${busy ? styles.certificateUploadButtonDisabled : ""}`}
        >
          {t("เลือกไฟล์ PDF", "Choose PDF files")}
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            multiple
            disabled={busy}
            onChange={(event) => void handleFiles(event.target.files)}
            hidden
          />
        </label>
      </header>

      {/* The whole batch, issued or not. Without it the panel goes blank after Save and HRD has no
          way to tell who already has one - and a plain "still waiting: ..." sentence becomes
          unreadable the moment a batch has twenty people in it. */}
      {loaded && roster.length > 0 ? (
        <div className={styles.certificateIssuedBlock}>
          <div className={styles.certificateIssuedHead}>
            <span className={styles.certificateIssuedCount}>
              {t(
                `ออกใบแล้ว ${issued.length} จาก ${roster.length} คน`,
                `${issued.length} of ${roster.length} issued`,
              )}
            </span>
            <span
              className={styles.certificateProgressTrack}
              role="progressbar"
              aria-valuenow={issuedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span className={styles.certificateProgressFill} style={{ width: `${issuedPercent}%` }} />
            </span>
          </div>

          <table className={styles.certificateTable}>
            <thead>
              <tr>
                <th className={styles.certificateCheckCell} aria-label={t("สถานะ", "Status")} />
                <th>{t("รหัสพนักงาน", "Code")}</th>
                <th>{t("ชื่อพนักงาน", "Employee")}</th>
                <th>{t("ไฟล์", "File")}</th>
                <th>{t("วันที่ออก", "Issued")}</th>
                <th aria-label={t("ดู", "View")} />
              </tr>
            </thead>
            <tbody>
              {rosterRows.map(({ candidate, certificate }) => {
                const isOpen = certificate !== null && previewId === certificate.certificateFileId;

                return (
                  <Fragment key={candidate.employeeUserId}>
                    <tr className={certificate ? undefined : styles.certificateRowPending}>
                      <td className={styles.certificateCheckCell}>
                        {certificate ? (
                          <span
                            className={styles.certificateCheckMark}
                            role="img"
                            aria-label={t("ได้รับแล้ว", "Issued")}
                          >
                            <Check size={14} />
                          </span>
                        ) : (
                          <span
                            className={styles.certificateCheckEmpty}
                            role="img"
                            aria-label={t("ยังไม่ได้รับ", "Not issued yet")}
                          />
                        )}
                      </td>
                      <td className={styles.certificateCodeCell}>{candidate.employeeCode || "—"}</td>
                      <td className={styles.certificateNameCell}>{candidate.employeeName}</td>
                      <td className={styles.certificateFileCell}>
                        {certificate ? certificate.fileName : <span className={styles.certificateDash}>—</span>}
                      </td>
                      <td className={styles.certificateDateCell}>
                        {certificate ? (
                          certificate.issuedAt.slice(0, 10)
                        ) : (
                          <span className={styles.certificateDash}>—</span>
                        )}
                      </td>
                      <td>
                        {certificate ? (
                          <button
                            type="button"
                            className={styles.certificateIconButton}
                            onClick={() => setPreviewId(isOpen ? null : certificate.certificateFileId)}
                            aria-expanded={isOpen}
                            aria-label={
                              isOpen
                                ? t("ปิดตัวอย่าง", "Close preview")
                                : t("ดูใบเกียรติบัตร", "Preview certificate")
                            }
                            title={
                              isOpen
                                ? t("ปิดตัวอย่าง", "Close preview")
                                : t("ดูใบเกียรติบัตร", "Preview certificate")
                            }
                          >
                            {isOpen ? <X size={14} /> : <Eye size={14} />}
                          </button>
                        ) : null}
                      </td>
                    </tr>

                    {/* Opens directly under this person and pushes the rest down, so the file is
                        always beside the name instead of below the entire roster. */}
                    {isOpen ? (
                      <tr className={styles.certificatePreviewRow}>
                        <td colSpan={6}>
                          <iframe
                            src={certificateFileUrl(certificate!.certificateFileId)}
                            title={`${t("ใบเกียรติบัตร", "Certificate")} ${candidate.employeeName}`}
                            className={styles.certificatePreviewFrame}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loaded ? (
        <p className={styles.certificateEmpty}>{t("กำลังโหลด...", "Loading...")}</p>
      ) : cards.length === 0 ? (
        <p className={styles.certificateEmpty}>
          {issued.length > 0
            ? t("อัปโหลดไฟล์เพิ่มได้จากปุ่มด้านบน", "Upload more files with the button above")
            : t("ยังไม่มีไฟล์ที่อัปโหลดไว้", "No certificates uploaded yet")}
        </p>
      ) : (
        <>
          <div className={styles.certificateCardList}>
            {cards.map((card) => {
              const badge = stateBadge(card.state);
              const isOpen = previewId === card.certificateFileId;
              const needsFix = card.state === "NOT_ON_PLAN" || card.state === "DUPLICATE";

              return (
                <article
                  key={card.certificateFileId}
                  className={`${styles.certificateCard} ${needsFix ? styles.certificateCardNeedsFix : ""}`}
                >
                  <div className={styles.certificateCardMain}>
                    <span className={styles.certificateCodeCell}>{card.employeeCode || "—"}</span>
                    <span className={styles.certificateNameCell}>{card.employeeName || "—"}</span>
                    <span className={styles.certificateFileCell}>{card.fileName}</span>
                    <span className={`${styles.certificateStatePill} ${badge.tone}`}>{badge.text}</span>
                  </div>

                  <div className={styles.certificateCardActions}>
                    <button
                      type="button"
                      className={styles.certificateIconButton}
                      onClick={() => setPreviewId(isOpen ? null : card.certificateFileId)}
                      aria-label={isOpen ? t("ปิดตัวอย่าง", "Close preview") : t("ดูใบเกียรติบัตร", "Preview certificate")}
                      title={isOpen ? t("ปิดตัวอย่าง", "Close preview") : t("ดูใบเกียรติบัตร", "Preview certificate")}
                    >
                      {isOpen ? <X size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      className={`${styles.certificateIconButton} ${styles.certificateIconDanger}`}
                      onClick={() => void removeCard(card.certificateFileId)}
                      aria-label={t("เอาไฟล์นี้ออก", "Remove this file")}
                      title={t("เอาไฟล์นี้ออก", "Remove this file")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className={styles.certificateAssignRow}>
                    <span className={styles.certificateAssignLabel}>{t("พนักงาน", "Employee")}</span>
                    <select
                      className={styles.certificateAssignSelect}
                      value={card.employeeUserId ?? ""}
                      onChange={(event) => assignEmployee(card.certificateFileId, event.target.value)}
                      aria-label={t("เลือกพนักงานสำหรับไฟล์นี้", "Choose the employee for this file")}
                    >
                      <option value="">{t("— เลือกพนักงาน —", "— choose an employee —")}</option>
                      {roster.map((candidate) => (
                        <option key={candidate.employeeUserId} value={candidate.employeeUserId}>
                          {candidate.employeeCode} {candidate.employeeName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isOpen ? (
                    <iframe
                      src={certificateFileUrl(card.certificateFileId)}
                      title={card.fileName}
                      className={styles.certificatePreview}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className={styles.certificateFooter}>
            <div className={styles.certificateSummaryChips}>
              <span className={`${styles.certificateStatePill} ${styles.certificateStateOk}`}>
                {t(`พร้อมบันทึก ${summary.matched}`, `${summary.matched} ready`)}
              </span>
              {summary.notOnPlan + summary.duplicate > 0 ? (
                <span className={`${styles.certificateStatePill} ${styles.certificateStateBad}`}>
                  {t(
                    `ต้องแก้ ${summary.notOnPlan + summary.duplicate}`,
                    `${summary.notOnPlan + summary.duplicate} need attention`,
                  )}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.certificatePrimaryButton}
              disabled={busy || !summary.canConfirm}
              onClick={() => void handleSave()}
            >
              {t("บันทึก", "Save")}
            </button>
            <button
              type="button"
              className={styles.certificateGhostButton}
              disabled={busy}
              onClick={() => void handleDiscard()}
            >
              {t("ยกเลิกทั้งชุด", "Discard all")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
