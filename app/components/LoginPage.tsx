"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import ataLogo from "../photo/LOGO ATTG/ATA.png";
import atfbLogo from "../photo/LOGO ATTG/ATFB.png";
import logoImage from "../photo/logo.png";
import nicLogo from "../photo/LOGO ATTG/NIC.png";
import satiLogo from "../photo/LOGO ATTG/SATI.png";
import snfLogo from "../photo/LOGO ATTG/SNF.png";
import tepLogo from "../photo/LOGO ATTG/TEP.png";
import atfbImage from "../photo/ATFB.jpg";
import nicImage from "../photo/NIC.png";
import satiImage from "../photo/SATI.jpg";
import snfImage from "../photo/SNF.jpg";
import tepImage from "../photo/TEP.jpg";
import Navbar from "./Navbar";
import styles from "./LoginPage.module.css";
import type { ClientRoleCode } from "../lib/auth/client";
import { useUiLanguage } from "./ThaiUiLocalization";
import { UNDER_DEVELOPMENT } from "../lib/underDevelopment";

import LoginActivitiesWidget from "./LoginActivitiesWidget/LoginActivitiesWidget";

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  onPreviewLogin?: (
    roleCode: ClientRoleCode,
    companyCode?: PreviewCompanyCode,
  ) => void;
};

export type PreviewCompanyCode = "ATA" | "ATFB" | "SATI" | "NIC" | "SNF" | "TEP";

const previewCompanyCodes: readonly PreviewCompanyCode[] = [
  "ATA",
  "ATFB",
  "SATI",
  "NIC",
  "SNF",
  "TEP",
];

const affiliatedCompanyLogos = [
  {
    code: "ATA" as const,
    name: "ATA",
    fullName: "Aisin Takaoka Asia Co., Ltd.",
    thaiName: "บริษัท ไอชิน ทากาโอกะ เอเชีย จำกัด",
    src: ataLogo,
  },
  {
    code: "ATFB" as const,
    name: "ATFB",
    fullName: "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
    thaiName: "บริษัท ไอชิน ทากาโอกะ ฟาวน์ดริ บางปะกง จำกัด",
    src: atfbLogo,
  },
  {
    code: "SATI" as const,
    name: "SATI",
    fullName: "Siam AT Industry Co., Ltd.",
    thaiName: "บริษัท สยาม เอที อินดัสตรี้ จำกัด",
    src: satiLogo,
  },
  {
    code: "NIC" as const,
    name: "NIC",
    fullName: "The Nawaloha Industry Co., Ltd.",
    thaiName: "บริษัท นวโลหะอุตสาหกรรม จำกัด",
    src: nicLogo,
  },
  {
    code: "SNF" as const,
    name: "SNF",
    fullName: "The Siam Nawaloha Foundry Co., Ltd.",
    thaiName: "บริษัท สยามนวโลหะฟาวน์ดรี จำกัด",
    src: snfLogo,
  },
  {
    code: "TEP" as const,
    name: "TEP",
    fullName: "Thai Engineering Products Co., Ltd.",
    thaiName: "บริษัท ผลิตภัณฑ์วิศวกรรมไทย จำกัด",
    src: tepLogo,
  },
];

export const COMPANY_PREFIX_MAP: Record<PreviewCompanyCode, string> = {
  ATA: "1290",
  TEP: "0450",
  ATFB: "1510",
  NIC: "0420",
  SATI: "1120",
  SNF: "0430",
};

const GENERIC_LOGIN_ERROR = "ไม่สามารถเข้าสู่ระบบได้ โปรดตรวจสอบชื่อผู้ใช้และรหัสผ่าน";

export default function LoginPage({
  onLogin,
  onPreviewLogin,
}: LoginPageProps) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const [selectedCompany, setSelectedCompany] = useState<PreviewCompanyCode | null>(null);
  const [employeeDigits, setEmployeeDigits] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogoClick = (companyCode: PreviewCompanyCode) => {
    if (selectedCompany === companyCode) {
      setSelectedCompany(null);
      setEmployeeDigits("");
    } else {
      setSelectedCompany(companyCode);
      setErrorMessage(null);
      if (!employeeDigits && username) {
        const cleaned = username.replace(/\D/g, "").slice(0, 6);
        if (cleaned) setEmployeeDigits(cleaned);
      }
    }
  };

  const handleResetCompany = () => {
    setSelectedCompany(null);
    setEmployeeDigits("");
    setErrorMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);

    let finalUsername = username.trim();
    if (selectedCompany) {
      const digits = employeeDigits.trim().replace(/\D/g, "");
      if (!digits) {
        setErrorMessage(
          isThai
            ? "กรุณาระบุรหัสพนักงาน 6 หลัก"
            : "Please enter your 6-digit employee ID.",
        );
        return;
      }
      const paddedDigits = digits.padStart(6, "0");
      finalUsername = `${COMPANY_PREFIX_MAP[selectedCompany]}-${paddedDigits}`;
    }

    if (!finalUsername) {
      setErrorMessage(
        isThai
          ? "กรุณาระบุชื่อผู้ใช้หรือรหัสพนักงาน"
          : "Please enter username or employee code.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await onLogin(finalUsername, password);
    } catch {
      setErrorMessage(
        selectedCompany
          ? (isThai
              ? "ไม่สามารถเข้าสู่ระบบได้ โปรดตรวจสอบรหัสพนักงานและวันเดือนปีเกิด (DDMMYYYY เช่น 11051972)"
              : "Unable to sign in. Please verify your Staff ID and Birth date (DDMMYYYY).")
          : (isThai
              ? GENERIC_LOGIN_ERROR
              : "Unable to sign in. Check your username and password.")
      );
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
        </div>

        <div className={styles.heroColumn}>
          <div className={styles.heroCopy} aria-hidden="true">
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

          <LoginActivitiesWidget />
        </div>

        <form className={styles.loginCard} onSubmit={handleSubmit}>
          {/* Logo on Left, Text on Right */}
          <div className={styles.formHeaderRow}>
            <Image
              className={styles.cardHeaderLogo}
              src={logoImage}
              alt="AISIN TAKAOKA THAILAND GROUP"
              height={46}
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
            {selectedCompany && (
              <div className={styles.selectedCompanyBanner}>
                <div className={styles.selectedCompanyBadgeGroup}>
                  <span className={styles.selectedCompanyDot} aria-hidden="true" />
                  <span className={styles.selectedCompanyText}>
                    {t("พนักงานสังกัด:", "Employee of:")}{" "}
                    <strong>{selectedCompany}</strong> ({COMPANY_PREFIX_MAP[selectedCompany]}-)
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.clearSelectedCompanyBtn}
                  onClick={handleResetCompany}
                  title={t("สลับเป็นเข้าสู่ระบบทั่วไป", "Switch to General Login")}
                >
                  {t("✕ ล็อกอินทั่วไป (Admin/HQ)", "✕ General Login (Admin/HQ)")}
                </button>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="login-username">
                {selectedCompany
                  ? t("รหัสพนักงาน (6 หลัก)", "Employee ID (6 Digits)")
                  : t("ชื่อผู้ใช้", "Username")}
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.fieldIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                {selectedCompany && (
                  <span className={styles.inputPrefixBadge} aria-hidden="true">
                    {COMPANY_PREFIX_MAP[selectedCompany]}-
                  </span>
                )}
                <input
                  id="login-username"
                  className={`${styles.fieldInput} ${selectedCompany ? styles.fieldInputWithPrefix : ""}`}
                  name="username"
                  type="text"
                  inputMode={selectedCompany ? "numeric" : "text"}
                  autoComplete="username"
                  placeholder={
                    selectedCompany
                      ? t("เลขรหัส 6 หลัก เช่น 000162", "6-digit Staff ID e.g. 000162")
                      : t("ชื่อผู้ใช้ / รหัสพนักงาน", "Username / Employee Code")
                  }
                  value={selectedCompany ? employeeDigits : username}
                  maxLength={selectedCompany ? 6 : 100}
                  required
                  disabled={isSubmitting}
                  onChange={(event) => {
                    if (selectedCompany) {
                      const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 6);
                      setEmployeeDigits(digitsOnly);
                    } else {
                      setUsername(event.target.value);
                    }
                  }}
                  onBlur={() => {
                    if (selectedCompany && employeeDigits.length > 0 && employeeDigits.length < 6) {
                      setEmployeeDigits(employeeDigits.padStart(6, "0"));
                    }
                  }}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="login-password">
                {selectedCompany
                  ? t("รหัสผ่าน (วันเกิด ddmmyyyy)", "Password (Birthdate ddmmyyyy)")
                  : t("รหัสผ่าน", "Password")}
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.fieldIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  className={styles.fieldInput}
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={
                    selectedCompany
                      ? t("วันเดือนปีเกิด ค.ศ. เช่น 11051972", "Birth date e.g. 11051972")
                      : t("ระบุรหัสผ่าน", "Enter Password")
                  }
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "text-bottom", marginRight: "6px" }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMessage}
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
            disabled
            title={`${UNDER_DEVELOPMENT.th} / ${UNDER_DEVELOPMENT.en}`}
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

          {/* ═══════════════════════════════════════
              AFFILIATED COMPANIES (6 LOGOS)
              ATA ➔ ATFB ➔ SATI ➔ NIC ➔ SNF ➔ TEP
             ═══════════════════════════════════════ */}
          <div className={styles.affiliatesSection}>
            <div className={styles.affiliatesDivider}>
              <span className={styles.affiliatesLine} />
              <div className={styles.affiliatesTitle}>
                <span className={styles.affiliatesDot} />
                <span>
                  {t(
                    "กลุ่มบริษัทในเครือ ATTG (คลิกเลือกสังกัดเพื่อล็อกอินด้วยรหัสพนักงาน)",
                    "ATTG Companies (Click to select company)",
                  )}
                </span>
              </div>
              <span className={styles.affiliatesLine} />
            </div>

            <div
              className={styles.affiliatesGrid}
              role="region"
              aria-label={t("กลุ่มบริษัทในเครือ 6 บริษัท", "6 Affiliated Companies")}
            >
              {affiliatedCompanyLogos.map((company) => {
                const isSelected = selectedCompany === company.code;
                return (
                  <button
                    key={company.code}
                    type="button"
                    className={`${styles.affiliateLogoCard} ${isSelected ? styles.affiliateLogoCardActive : ""}`}
                    title={`${company.code} · ${isThai ? company.thaiName : company.fullName} [Prefix: ${COMPANY_PREFIX_MAP[company.code]}-]`}
                    onClick={() => handleLogoClick(company.code)}
                    aria-pressed={isSelected}
                    aria-label={`${company.code} - ${isThai ? company.thaiName : company.fullName}`}
                  >
                    <div className={styles.affiliateLogoWrapper}>
                      <Image
                        src={company.src}
                        alt={company.name}
                        fill
                        sizes="(max-width: 640px) 30vw, 120px"
                        className={styles.affiliateLogoImg}
                      />
                    </div>
                    {isSelected && (
                      <span className={styles.selectedCompanyIndicator} aria-hidden="true">
                        ✓ {COMPANY_PREFIX_MAP[company.code]}-
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className={styles.affiliatesFooterNote}>
              AISIN TAKAOKA THAILAND GROUP
            </p>
          </div>
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
                  <span className={styles.previewRoleIcon} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                      <path d="M9 22v-4h6v4" />
                      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
                    </svg>
                  </span>
                  <span>HRD CENTER</span>
                </button>
                <button
                  className={`${styles.previewButton} ${styles.lockedPreviewButton}`}
                  type="button"
                  disabled
                  aria-label="EMPLOYEE - Locked"
                  title="Employee preview is locked"
                >
                  <span className={styles.previewRoleIcon} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span>EMPLOYEE</span>
                  <span className={styles.previewLock} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
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
                  <span className={styles.previewCompanyIcon} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                      <path d="M17 18h1M12 18h1M7 18h1" />
                    </svg>
                  </span>
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
