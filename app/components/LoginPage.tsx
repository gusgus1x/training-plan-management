"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import atfbImage from "../photo/ATFB.jpg";
import logoImage from "../photo/logo.png";
import nicImage from "../photo/NIC.png";
import satiImage from "../photo/SATI.jpg";
import snfImage from "../photo/SNF.jpg";
import tepImage from "../photo/TEP.jpg";
import Navbar from "./Navbar";
import styles from "./LoginPage.module.css";
import type { ClientRoleCode } from "../lib/auth/client";
import { useUiLanguage } from "./ThaiUiLocalization";
import { useToast } from "./ToastHost";

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  onPreviewLogin?: (
    roleCode: ClientRoleCode,
    companyCode?: PreviewCompanyCode,
  ) => void;
};

export type PreviewCompanyCode = "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

const previewCompanyCodes: readonly PreviewCompanyCode[] = [
  "ATA",
  "TEP",
  "ATFB",
  "NIC",
  "SATI",
  "SNF",
];

const GENERIC_LOGIN_ERROR = "ไม่สามารถเข้าสู่ระบบได้ โปรดตรวจสอบชื่อผู้ใช้และรหัสผ่าน";

export default function LoginPage({
  onLogin,
  onPreviewLogin,
}: LoginPageProps) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onLogin(username, password);
    } catch {
      setErrorMessage(
        isThai
          ? GENERIC_LOGIN_ERROR
          : "Unable to sign in. Check your username and password.",
      );
    } finally {
      setPassword("");
      setIsPasswordVisible(false);
      setIsSubmitting(false);
    }
  };

  const handleLineLogin = () => {
    const lineMessage = t(
      "ระบบเตรียมการเชื่อมต่อ LINE Official Account (LINE Login) พร้อมเปิดใช้งานเร็วๆ นี้",
      "LINE Official Account (LINE Login) integration ready for service deployment soon.",
    );
    toast.info(lineMessage);
  };

  return (
    <main className={styles.page}>
      <Navbar />

      <section className={styles.loginSection}>
        <div className={styles.visualPanel} aria-hidden="true">
          <div className={styles.slideTrack}>
            <Image
              className={`${styles.slideImage} ${styles.slideOne}`}
              src={snfImage}
              alt=""
              fill
              sizes="100vw"
              priority
            />
            <Image
              className={`${styles.slideImage} ${styles.slideTwo}`}
              src={nicImage}
              alt=""
              fill
              sizes="100vw"
            />
            <Image
              className={`${styles.slideImage} ${styles.slideThree}`}
              src={atfbImage}
              alt=""
              fill
              sizes="100vw"
            />
            <Image
              className={`${styles.slideImage} ${styles.slideFour}`}
              src={satiImage}
              alt=""
              fill
              sizes="100vw"
            />
            <Image
              className={`${styles.slideImage} ${styles.slideFive}`}
              src={tepImage}
              alt=""
              fill
              sizes="100vw"
            />
          </div>

          <div className={styles.heroCopy}>
            <div className={`${styles.companySlide} ${styles.companyOne}`}>
              <p className={styles.companyEyebrow}>AISIN TAKAOKA THAILAND GROUP</p>
              <h1>The Siam Nawaloha Foundry Co.,Ltd (SNF)</h1>
              <span>A leading Iron casting partner of global OEMs in Thailand and ASEAN.</span>
            </div>
            <div className={`${styles.companySlide} ${styles.companyTwo}`}>
              <p className={styles.companyEyebrow}>AISIN TAKAOKA THAILAND GROUP</p>
              <h1>The Nawaloha Industry Co.,Ltd (NIC)</h1>
              <span>A leading Iron casting partner of global OEMs in Thailand and ASEAN.</span>
            </div>
            <div className={`${styles.companySlide} ${styles.companyThree}`}>
              <p className={styles.companyEyebrow}>AISIN TAKAOKA THAILAND GROUP</p>
              <h1>Aisin Takaoka Foundry Bangpakong Co.,Ltd (ATFB)</h1>
              <span>A leading Iron casting partner of global OEMs in Thailand and ASEAN.</span>
            </div>
            <div className={`${styles.companySlide} ${styles.companyFour}`}>
              <p className={styles.companyEyebrow}>AISIN TAKAOKA THAILAND GROUP</p>
              <h1>Siam AT Industry Co.,Ltd (SATI)</h1>
              <span>A leading Iron casting partner of global OEMs in Thailand and ASEAN.</span>
            </div>
            <div className={`${styles.companySlide} ${styles.companyFive}`}>
              <p className={styles.companyEyebrow}>AISIN TAKAOKA THAILAND GROUP</p>
              <h1>Thai Engineering Products Co.,Ltd (TEP)</h1>
              <span>A leading Aluminium casting partner of global OEMs in Thailand and ASEAN.</span>
            </div>
          </div>
        </div>

        <form className={styles.loginCard} onSubmit={handleSubmit}>
          {/* Logo on Left, Text on Right */}
          <div className={styles.formHeaderRow}>
            <Image
              className={styles.cardHeaderLogo}
              src={logoImage}
              alt="AISIN TAKAOKA THAILAND GROUP"
              height={48}
              style={{ width: "auto", height: "48px" }}
              priority
            />

            <div className={styles.cardHeaderTitleBox}>
              <span className={styles.groupEyebrow}>AISIN TAKAOKA THAILAND GROUP</span>
              <h2 className={styles.cardHeaderTitle}>
                ATTG Training
                <br />
                Plan Management
              </h2>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="login-username">
                {t("ชื่อผู้ใช้", "Username")}
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.fieldIcon} aria-hidden="true">👤</span>
                <input
                  id="login-username"
                  className={styles.fieldInput}
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder={t("ชื่อผู้ใช้ / รหัสพนักงาน", "Username / Employee Code")}
                  value={username}
                  maxLength={100}
                  required
                  disabled={isSubmitting}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="login-password">
                {t("รหัสผ่าน", "Password")}
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.fieldIcon} aria-hidden="true">🔒</span>
                <input
                  id="login-password"
                  className={styles.fieldInput}
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("ระบุรหัสผ่าน", "Enter Password")}
                  value={password}
                  maxLength={1024}
                  required
                  disabled={isSubmitting}
                  aria-describedby={errorMessage ? "login-error" : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className={styles.passwordToggle}
                  type="button"
                  disabled={isSubmitting}
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  aria-pressed={isPasswordVisible}
                  title={isPasswordVisible ? "Hide password" : "Show password"}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                >
                  {isPasswordVisible ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="m3 3 18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.6 10.6 0 0 1 12 4c5.5 0 9 8 9 8a16.3 16.3 0 0 1-2.1 3.2M6.6 6.6C4.3 8.2 3 12 3 12s3.5 8 9 8a9.8 9.8 0 0 0 4-.9" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <p
              className={styles.errorMessage}
              id="login-error"
              role="alert"
              aria-live="polite"
            >
              ⚠️ {errorMessage}
            </p>
          ) : null}

          <button
            className={styles.loginButton}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("กำลังเข้าสู่ระบบ...", "Signing in...")
              : t("เข้าสู่ระบบ", "Sign in")}
            {!isSubmitting && (
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>

          {/* LINE Official Account Login Integration Section */}
          <div className={styles.dividerRow}>
            <span>{t("หรือเข้าสู่ระบบด้วย", "Or sign in with")}</span>
          </div>

          <button
            className={styles.lineLoginButton}
            type="button"
            disabled={isSubmitting}
            onClick={handleLineLogin}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 5.925 2 10.767c0 4.335 3.528 7.95 8.283 8.66.323.07.763.213.875.489.1.248.065.636.032.887-.047.368-.217 1.437-.24 1.744-.036.462.214.503.447.332.234-.17 3.618-2.129 4.936-3.63C19.014 17.514 22 14.477 22 10.767 22 5.925 17.523 2 12 2zm-5.068 11.233H4.432a.5.5 0 0 1-.5-.5V7.267a.5.5 0 0 1 .5-.5h.733a.5.5 0 0 1 .5.5v4.733h1.767a.5.5 0 0 1 .5.5v.733a.5.5 0 0 1-.5.5zm2.868 0h-.733a.5.5 0 0 1-.5-.5V7.267a.5.5 0 0 1 .5-.5h.733a.5.5 0 0 1 .5.5v5.466a.5.5 0 0 1-.5.5zm5.733 0h-.733a.5.5 0 0 1-.4-.2l-2.133-2.933v2.633a.5.5 0 0 1-.5.5h-.734a.5.5 0 0 1-.5-.5V7.267a.5.5 0 0 1 .5-.5h.734a.5.5 0 0 1 .4.2l2.133 2.933V7.267a.5.5 0 0 1 .5-.5h.733a.5.5 0 0 1 .5.5v5.466a.5.5 0 0 1-.5.5zm4.8 0h-2.5a.5.5 0 0 1-.5-.5V7.267a.5.5 0 0 1 .5-.5h2.5a.5.5 0 0 1 .5.5v.733a.5.5 0 0 1-.5.5h-1.767v1.1h1.767a.5.5 0 0 1 .5.5v.733a.5.5 0 0 1-.5.5h-1.767v1.1h1.767a.5.5 0 0 1 .5.5v.733a.5.5 0 0 1-.5.5z"
                fill="#06C755"
              />
            </svg>
            <span>{t("เข้าสู่ระบบผ่าน LINE Official Account", "Sign in with LINE OA")}</span>
            <span className={styles.lineTagBadge}>LINE OA</span>
          </button>
        </form>

        {onPreviewLogin ? (
          <section
            className={styles.previewAccess}
            aria-labelledby="preview-access-title"
          >
            <div className={styles.previewDivider}>
              <span className={styles.previewStatusDot} aria-hidden="true" />
              <span>Development only</span>
            </div>
            <div className={styles.previewHeader}>
              <div>
                <h3 id="preview-access-title">Mock UI Preview</h3>
                <p>{t("เปิดหน้าทดสอบโดยไม่สร้าง authenticated session", "Open preview without auth session")}</p>
              </div>
              <div className={styles.previewRoleButtons}>
                <button
                  className={styles.previewButton}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onPreviewLogin("HRD_CENTER")}
                >
                  <span className={styles.previewRoleIcon} aria-hidden="true">🏢</span>
                  <span>HRD CENTER</span>
                </button>
                <button
                  className={`${styles.previewButton} ${styles.lockedPreviewButton}`}
                  type="button"
                  disabled
                  aria-label="EMPLOYEE - Locked"
                  title="Employee preview is locked"
                >
                  <span className={styles.previewRoleIcon} aria-hidden="true">👤</span>
                  <span>EMPLOYEE</span>
                  <span className={styles.previewLock} aria-hidden="true">🔒</span>
                </button>
              </div>
            </div>
            <div className={styles.previewCompanyHeader}>
              <span>Mock Factory Users · 6 Companies</span>
              <b>HRD FACTORY</b>
            </div>
            <div className={styles.previewCompanyButtons}>
              {previewCompanyCodes.map((companyCode) => (
                <button
                  key={companyCode}
                  className={styles.previewCompanyButton}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onPreviewLogin("HRD_FACTORY", companyCode)}
                >
                  <span className={styles.previewCompanyIcon} aria-hidden="true">🏭</span>
                  <span className={styles.previewCompanyCopy}>
                    <strong>{companyCode}</strong>
                    <small>Mock Factory User</small>
                  </span>
                  <span className={styles.previewCompanyArrow} aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
