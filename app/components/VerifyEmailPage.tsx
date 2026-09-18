"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  LoginOtpClientError,
  requestLoginOtp,
  verifyLoginOtp,
  type ClientSessionUser,
} from "../lib/auth/client";
import { useUiLanguage } from "./ThaiUiLocalization";
import styles from "./VerifyEmailPage.module.css";

const OTP_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Second login step for an EMPLOYEE: the password was right, now a code sent to their own email.
 * Shown by AuthGate in place of the login form; there is no session until the code is confirmed.
 * With an address already bound (maskedEmail) the code can only go there; otherwise the employee
 * types one, and it is bound once the code sent to it is confirmed.
 */
export default function VerifyEmailPage({
  maskedEmail,
  onVerified,
  onCancel,
}: {
  maskedEmail: string | null;
  onVerified: (user: ClientSessionUser) => void;
  onCancel: () => void;
}) {
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);

  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const describe = (caught: unknown) => {
    const failure = caught instanceof LoginOtpClientError ? caught : null;
    switch (failure?.code) {
      case "OTP_SESSION_EXPIRED":
        return t("หมดเวลายืนยัน กรุณาเข้าสู่ระบบใหม่", "This step timed out. Please sign in again.");
      case "EMAIL_REQUIRED":
      case "INVALID_EMAIL":
        return t("กรุณากรอกอีเมลให้ถูกต้อง", "Please enter a valid email address.");
      case "EMAIL_TAKEN":
        return t("อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว", "This email is already used by another account.");
      case "OTP_RESEND_TOO_SOON":
        return t(
          `กรุณารอ ${failure.details.retryAfterSeconds ?? 60} วินาทีก่อนขอรหัสใหม่`,
          `Please wait ${failure.details.retryAfterSeconds ?? 60} seconds before asking again.`,
        );
      case "OTP_RATE_LIMITED":
        return t("ขอรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง", "Too many codes requested. Please try again later.");
      case "OTP_INVALID":
        return typeof failure.details.attemptsLeft === "number"
          ? t(
              `รหัสไม่ถูกต้อง เหลืออีก ${failure.details.attemptsLeft} ครั้ง`,
              `That code is not correct. ${failure.details.attemptsLeft} tries left.`,
            )
          : t("กรุณากรอกรหัส 6 หลัก", "Enter the 6-digit code.");
      case "OTP_EXPIRED":
        return t("รหัสหมดอายุหรือใช้ไม่ได้แล้ว กรุณาขอรหัสใหม่", "The code has expired. Please request a new one.");
      case "MAIL_NOT_CONFIGURED":
      case "MAIL_SEND_FAILED":
        return t("ส่งอีเมลไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ", "The email could not be sent. Please contact the administrator.");
      default:
        return t("เกิดข้อผิดพลาด กรุณาลองใหม่", "Something went wrong. Please try again.");
    }
  };

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!maskedEmail && !EMAIL_PATTERN.test(email.trim())) {
      setError(t("กรุณากรอกอีเมลให้ถูกต้อง", "Please enter a valid email address."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await requestLoginOtp(maskedEmail ? null : email.trim());
      setSentTo(result.maskedEmail);
      setResendIn(result.resendAfterSeconds);
      setCode("");
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onVerified(await verifyLoginOtp(code));
    } catch (caught) {
      setError(describe(caught));
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="verify-title">
        <p className={styles.kicker}>{t("ยืนยันตัวตน", "Verify your identity")}</p>
        <h1 id="verify-title" className={styles.title}>
          {t("ยืนยันรหัสทางอีเมล", "Confirm the code sent to your email")}
        </h1>
        <p className={styles.lead}>
          {t(
            "ต้องยืนยันเมื่อเข้าใช้งานครั้งแรก และทุก 2 วัน",
            "Needed on your first sign-in and every 2 days after.",
          )}
        </p>

        {!sentTo ? (
          <form className={styles.form} onSubmit={sendCode} noValidate>
            {maskedEmail ? (
              <p className={styles.sentTo}>
                {t("ระบบจะส่งรหัสไปที่", "The code will be sent to")} <strong>{maskedEmail}</strong>
              </p>
            ) : (
              <>
                <label className={styles.label} htmlFor="verify-email">
                  {t("อีเมลส่วนตัว", "Personal email")}
                </label>
                <input
                  id="verify-email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@gmail.com"
                  autoFocus
                />
                <p className={styles.hint}>
                  {t(
                    "ใช้ได้ทุกเจ้า เช่น Gmail, Outlook, Yahoo · ยืนยันแล้วจะผูกกับบัญชี เปลี่ยนได้ผ่านผู้ดูแลระบบเท่านั้น",
                    "Any provider works (Gmail, Outlook, Yahoo). Once confirmed it is bound to your account; only an administrator can change it.",
                  )}
                </p>
              </>
            )}
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <button className={styles.primary} type="submit" disabled={busy}>
              {t("ส่งรหัส OTP", "Send code")}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={confirmCode} noValidate>
            <p className={styles.sentTo}>
              {t("ส่งรหัสไปที่", "Code sent to")} <strong>{sentTo}</strong>
              {!maskedEmail ? (
                <>
                  {" "}
                  <button className={styles.link} type="button" onClick={() => setSentTo(null)} disabled={busy}>
                    {t("เปลี่ยนอีเมล", "Change")}
                  </button>
                </>
              ) : null}
            </p>

            <label className={styles.label} htmlFor="verify-code">
              {t(`รหัส OTP ${OTP_LENGTH} หลัก`, `${OTP_LENGTH}-digit code`)}
            </label>
            <input
              id="verify-code"
              className={`${styles.input} ${styles.codeInput}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <p className={styles.hint}>
              {t("รหัสมีอายุ 5 นาที ถ้าไม่พบ ให้ดูในกล่อง Spam", "The code is valid for 5 minutes. Check Spam if you cannot find it.")}
            </p>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <button className={styles.primary} type="submit" disabled={busy || code.length !== OTP_LENGTH}>
              {t("ยืนยันและเข้าสู่ระบบ", "Verify and continue")}
            </button>
            <button className={styles.secondary} type="button" onClick={() => void sendCode()} disabled={busy || resendIn > 0}>
              {resendIn > 0
                ? t(`ส่งรหัสใหม่ได้ใน ${resendIn} วินาที`, `Send a new code in ${resendIn}s`)
                : t("ส่งรหัสใหม่", "Send a new code")}
            </button>
          </form>
        )}

        <button className={styles.logout} type="button" onClick={onCancel}>
          {t("กลับไปหน้าเข้าสู่ระบบ", "Back to sign in")}
        </button>
      </section>
    </main>
  );
}
