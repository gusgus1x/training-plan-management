"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import type { EnrollmentRecord, EnrollmentStageInfo } from "../../lib/trainingEnrollment/types";
import { useAuthenticatedUser } from "../AuthenticatedUserContext";
import { useUiLanguage } from "../ThaiUiLocalization";
import styles from "./TrainingFormScanLanding.module.css";

/**
 * Where a scanned QR code lands.
 *
 * An in-system form is taken at /training-form/{enrollmentId}/{stage}, which is per-person - so a
 * single QR handed to a whole room cannot encode it. The QR encodes the PLAN instead, and this
 * screen answers "who is scanning, and which of their enrollments is this?" before forwarding them
 * to their own copy of the form.
 *
 * It grants nothing: it only looks up the enrollment of whoever is already logged in. Every
 * existing gate (session, role, ownership, availability) still runs on the form itself.
 */

type ScanStage = "PRE_TEST" | "POST_TEST" | "EVALUATION" | "EVALUATION_30DAY";

const STAGE_LABEL: Record<ScanStage, { th: string; en: string }> = {
  PRE_TEST: { th: "แบบทดสอบก่อนอบรม", en: "Pre Test" },
  POST_TEST: { th: "แบบทดสอบหลังอบรม", en: "Post Test" },
  EVALUATION: { th: "แบบประเมินผลการอบรม", en: "Evaluation" },
  EVALUATION_30DAY: { th: "แบบประเมินผลหลัง 30 วัน", en: "30-Day Evaluation" },
};

export const isScanStage = (value: string): value is ScanStage => value in STAGE_LABEL;

const stageOf = (enrollment: EnrollmentRecord, stage: ScanStage): EnrollmentStageInfo => {
  const assessment = enrollment.plan.assessment;
  if (stage === "PRE_TEST") return assessment.preTest;
  if (stage === "POST_TEST") return assessment.postTest;
  if (stage === "EVALUATION") return assessment.evaluation;
  return assessment.evaluationAfter30Day;
};

export type ScanDestination =
  | { kind: "forward"; href: string }
  | { kind: "external"; href: string }
  | { kind: "message"; title: string; detail?: string };

/**
 * Pure so every branch below can be tested without a browser or a server. Returns what the screen
 * should do, never performs it.
 */
export const resolveScanDestination = (
  enrollment: EnrollmentRecord | null,
  stage: ScanStage,
  t: (th: string, en: string) => string,
  formatDate: (isoDate: string) => string,
): ScanDestination => {
  if (!enrollment) {
    return {
      kind: "message",
      title: t("คุณไม่ได้อยู่ในรุ่นอบรมนี้", "You are not enrolled in this session"),
      detail: t(
        "QR นี้เป็นของรุ่นอบรมที่คุณไม่ได้ลงทะเบียนไว้ หากคิดว่าผิดพลาด กรุณาติดต่อ HRD",
        "This QR belongs to a session you are not registered for. Contact HRD if you think this is wrong.",
      ),
    };
  }

  // Mirrors loadOwnedEnrollment's own refusal on the server, so the employee gets a sentence
  // instead of a bare error page.
  if (enrollment.status === "Pending Approval") {
    return {
      kind: "message",
      title: t("การลงทะเบียนยังไม่ได้รับอนุมัติ", "Your registration is not approved yet"),
      detail: t("รอ HRD อนุมัติก่อนจึงจะทำแบบฟอร์มนี้ได้", "HRD must approve it before you can take this form."),
    };
  }
  if (enrollment.status === "Rejected" || enrollment.status === "Cancelled") {
    return {
      kind: "message",
      title: t("การลงทะเบียนนี้ถูกยกเลิกแล้ว", "This registration is no longer active"),
    };
  }

  const stageInfo = stageOf(enrollment, stage);

  if (stageInfo.mode === "NONE") {
    return {
      kind: "message",
      title: t("หลักสูตรนี้ไม่มีแบบฟอร์มขั้นนี้", "This course has no form for this stage"),
    };
  }
  // The batch pointed this stage at an external form. Send them there rather than pretending an
  // in-system one exists.
  if (stageInfo.mode === "LINK") {
    return stageInfo.link
      ? { kind: "external", href: stageInfo.link }
      : { kind: "message", title: t("ยังไม่ได้ตั้งลิงก์แบบฟอร์มไว้", "No form link has been set") };
  }

  if (stageInfo.availability === "NOT_YET") {
    return {
      kind: "message",
      title: t("ยังไม่ถึงเวลาทำแบบฟอร์มนี้", "This form is not open yet"),
      detail: t(`เปิดให้ทำวันที่ ${formatDate(stageInfo.opensAt)}`, `Opens on ${formatDate(stageInfo.opensAt)}`),
    };
  }
  if (stageInfo.availability === "CLOSED_BY_HRD") {
    return { kind: "message", title: t("HRD ปิดรับคำตอบแล้ว", "HRD has closed this form") };
  }

  // Already-submitted is deliberately NOT stopped here: TrainingFormRunner says so itself, and for
  // an assessment a second attempt is allowed.
  return { kind: "forward", href: `/training-form/${enrollment.id}/${stage}` };
};

export default function TrainingFormScanLanding({ planId, stage }: { planId: string; stage: string }) {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const formatDate = (isoDate: string) =>
    new Intl.DateTimeFormat(t("th-TH", "en-GB"), { day: "2-digit", month: "short", year: "numeric" }).format(
      new Date(isoDate),
    );

  // Two refusals are decided by the props and the session alone, so they are derived during render
  // rather than written into state from an effect.
  const preflight: ScanDestination | null = !user
    ? null
    : user.roleCode !== "EMPLOYEE"
      ? {
          kind: "message",
          title: t("ลิงก์นี้สำหรับผู้เข้าอบรม", "This link is for trainees"),
          detail: t(
            "บัญชี HRD ไม่มีรายการลงทะเบียนของตัวเอง จึงเปิดแบบฟอร์มจากลิงก์นี้ไม่ได้",
            "An HRD account has no enrollment of its own, so there is no form to open here.",
          ),
        }
      : !isScanStage(stage)
        ? { kind: "message", title: t("ไม่พบแบบฟอร์มที่ต้องการ", "This form could not be found") }
        : null;

  const [loaded, setLoaded] = useState<ScanDestination | null>(null);
  const result = preflight ?? loaded;

  useEffect(() => {
    if (!user || preflight || !isScanStage(stage)) return;
    let cancelled = false;

    // The server pins the employee filters from the session, so this returns this employee's own
    // enrollment on this plan and nothing else - 0 or 1 row.
    listEnrollments({ planId, employeeId: null, employeeUserId: null })
      .then((response) => {
        if (cancelled) return;
        const decision = resolveScanDestination(response.enrollments[0] ?? null, stage, t, formatDate);
        if (decision.kind === "forward") {
          router.replace(decision.href);
          return;
        }
        if (decision.kind === "external") {
          window.location.replace(decision.href);
          return;
        }
        setLoaded(decision);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ kind: "message", title: t("เปิดแบบฟอร์มไม่สำเร็จ กรุณาลองใหม่", "Could not open the form") });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, stage, user?.roleCode]);

  const stageLabel = isScanStage(stage) ? t(STAGE_LABEL[stage].th, STAGE_LABEL[stage].en) : "";

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        {stageLabel ? <p className={styles.stage}>{stageLabel}</p> : null}
        {!result ? (
          <>
            <h2>{t("กำลังเปิดแบบฟอร์มของคุณ...", "Opening your form...")}</h2>
            <p className={styles.detail}>{t("กรุณารอสักครู่", "One moment")}</p>
          </>
        ) : (
          <>
            <h2>{result.kind === "message" ? result.title : ""}</h2>
            {result.kind === "message" && result.detail ? <p className={styles.detail}>{result.detail}</p> : null}
            <button type="button" className={styles.homeButton} onClick={() => router.replace("/")}>
              {t("กลับหน้าหลัก", "Back to home")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
