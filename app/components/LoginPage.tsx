"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import atfbImage from "../photo/ATFB.jpg";
import nicImage from "../photo/NIC.png";
import satiImage from "../photo/SATI.jpg";
import snfImage from "../photo/SNF.jpg";
import tepImage from "../photo/TEP.jpg";
import Navbar from "./Navbar";
import styles from "./LoginPage.module.css";
import type { ClientRoleCode } from "../lib/auth/client";

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

const GENERIC_LOGIN_ERROR = "Unable to sign in. Check your username and password.";

export default function LoginPage({
  onLogin,
  onPreviewLogin,
}: LoginPageProps) {
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
      setErrorMessage(GENERIC_LOGIN_ERROR);
    } finally {
      setPassword("");
      setIsPasswordVisible(false);
      setIsSubmitting(false);
    }
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

        <form
          className={styles.loginCard}
          onSubmit={handleSubmit}
        >
          <div className={styles.formHeader}>
            <h2>ATTG Training<br />Plan Management</h2>
          </div>

          <label className={styles.field}>
            <span>Username</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              maxLength={100}
              required
              disabled={isSubmitting}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <div className={styles.field}>
            <label htmlFor="login-password">Password</label>
            <div className={styles.passwordField}>
              <input
                id="login-password"
                name="password"
                type={isPasswordVisible ? "text" : "password"}
                autoComplete="current-password"
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

          {errorMessage ? (
            <p
              className={styles.errorMessage}
              id="login-error"
              role="alert"
              aria-live="polite"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            className={styles.loginButton}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
            {!isSubmitting && (
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
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
                <p>เปิดหน้าทดสอบโดยไม่สร้าง authenticated session</p>
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
