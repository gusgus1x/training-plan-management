"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "../../../icons/LucideIcons";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./SystemSettings.module.css";

export const systemSettingsModule = {
  title: "System",
  titleTh: "ตั้งค่าระบบ",
  subtitle: "System settings",
  subtitleTh: "ตั้งค่าการทำงานของระบบ",
  description: "Switch the employee email code (OTP) off for a company for up to 24 hours.",
  descriptionTh: "ปิดการยืนยันรหัส OTP ทางอีเมลของพนักงานชั่วคราว (สูงสุด 24 ชั่วโมง)",
} as const;

type CompanyOtpStatus = {
  companyId: string;
  companyCode: string;
  companyName: string;
  suspendedUntil: string | null;
  suspendedBy: string | null;
};

const readJson = async (response: Response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? "Request failed");
  return body.data;
};

const listStatuses = async (): Promise<CompanyOtpStatus[]> =>
  (await readJson(await fetch("/api/master-data/login-otp", { credentials: "include", cache: "no-store" })))
    .companies;

const setOtpEnabled = async (companyId: string, enabled: boolean) =>
  readJson(
    await fetch("/api/master-data/login-otp", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId, enabled }),
    }),
  );

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

export default function SystemSettings() {
  const confirm = useConfirm();
  const toast = useToast();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const [companies, setCompanies] = useState<CompanyOtpStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setCompanies(await listStatuses());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
      setCompanies((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    let current = true;
    listStatuses()
      .then((rows) => {
        if (current) setCompanies(rows);
      })
      .catch((caught: unknown) => {
        if (!current) return;
        setError(caught instanceof Error ? caught.message : "Request failed");
        setCompanies([]);
      });
    return () => {
      current = false;
    };
  }, []);

  // One tick drives every countdown; a switch-off that has run out shows as on again.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const toggle = async (company: CompanyOtpStatus, isOff: boolean) => {
    const ok = await confirm({
      message: isOff
        ? {
            th: `เปิดการยืนยัน OTP ของ ${company.companyCode} กลับทันที?`,
            en: `Switch the email code back on for ${company.companyCode} now?`,
          }
        : {
            th: `ปิดการยืนยัน OTP ของ ${company.companyCode}? พนักงานจะเข้าระบบได้ด้วยรหัสพนักงานและวันเกิดอย่างเดียว ระบบจะเปิดกลับเองใน 24 ชั่วโมง`,
            en: `Switch the email code off for ${company.companyCode}? Employees will sign in with ID and birth date only. It switches back on by itself after 24 hours.`,
          },
      danger: !isOff,
    });
    if (!ok) return;

    setBusyId(company.companyId);
    try {
      await setOtpEnabled(company.companyId, isOff);
      toast.success(
        isOff
          ? t(`เปิด OTP ของ ${company.companyCode} แล้ว`, `Email code is on for ${company.companyCode}`)
          : t(`ปิด OTP ของ ${company.companyCode} แล้ว 24 ชั่วโมง`, `Email code is off for ${company.companyCode} for 24 hours`),
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setBusyId(null);
    }
  };

  if (companies === null) {
    return (
      <div className={styles.loading}>
        <TypewriterLoader label={t("กำลังโหลดการตั้งค่า...", "Loading settings...")} />
      </div>
    );
  }

  return (
    <section className={styles.page} aria-label="System settings module">
      <section className={styles.hero}>
        <p className={styles.kicker}>{isThai ? systemSettingsModule.subtitleTh : systemSettingsModule.subtitle}</p>
        <h2>{t("การยืนยันรหัส OTP ทางอีเมลของพนักงาน", "Employee email code (OTP)")}</h2>
        <p>
          {t(
            "ปกติพนักงานต้องกรอกรหัส 6 หลักที่ส่งไปทางอีเมลเมื่อเข้าระบบครั้งแรก และทุก 2 วัน กดปุ่มสีแดงเพื่อปิดชั่วคราว เช่น ตอนระบบอีเมลมีปัญหา ระหว่างปิด พนักงานเข้าระบบได้ด้วยรหัสพนักงานและวันเกิดอย่างเดียว ระบบจะเปิดกลับเองอัตโนมัติเมื่อครบ 24 ชั่วโมง กดอีกครั้งเพื่อเปิดกลับก่อนเวลา",
            "Employees normally confirm a 6-digit code sent to their email on first sign-in and every 2 days. Press the red button to switch it off temporarily, for example while email is down. While off, employees sign in with ID and birth date only. It switches back on by itself after 24 hours; press again to switch it back on early.",
          )}
        </p>
        <p className={styles.note}>
          {t("มีผลกับพนักงานเท่านั้น HRD และผู้ดูแลระบบไม่ต้องใช้ OTP", "Affects employees only. HRD and Admin never use the code.")}
        </p>
      </section>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <div className={styles.grid}>
        {companies.map((company) => {
          const until = company.suspendedUntil ? new Date(company.suspendedUntil).getTime() : 0;
          const isOff = until > now;
          return (
            <article key={company.companyId} className={`${styles.card} ${isOff ? styles.cardOff : ""}`}>
              <header className={styles.cardHead}>
                <strong>{company.companyCode}</strong>
                <span>{company.companyName}</span>
              </header>

              <button
                type="button"
                className={styles.alarm}
                onClick={() => void toggle(company, isOff)}
                disabled={busyId === company.companyId}
                aria-label={
                  isOff
                    ? t(`เปิด OTP ของ ${company.companyCode} กลับ`, `Switch the code back on for ${company.companyCode}`)
                    : t(`ปิด OTP ของ ${company.companyCode}`, `Switch the code off for ${company.companyCode}`)
                }
              >
                <AlertTriangle size={36} aria-hidden="true" />
              </button>

              <p className={styles.state}>
                {isOff ? t("OTP ปิดอยู่", "Email code is OFF") : t("OTP เปิดอยู่", "Email code is ON")}
              </p>
              {isOff ? (
                <>
                  <p className={styles.countdown} aria-live="polite">
                    {t("เปิดกลับอัตโนมัติใน", "Back on in")} <strong>{formatRemaining(until - now)}</strong>
                  </p>
                  <p className={styles.meta}>
                    {t("ปิดโดย", "Switched off by")} {company.suspendedBy ?? "-"}
                  </p>
                  <p className={styles.hint}>{t("กดปุ่มเพื่อเปิดกลับทันที", "Press to switch back on now")}</p>
                </>
              ) : (
                <p className={styles.hint}>{t("กดปุ่มเพื่อปิดชั่วคราว 24 ชั่วโมง", "Press to switch off for 24 hours")}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
