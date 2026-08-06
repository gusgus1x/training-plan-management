 "use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import logoImage from "../photo/logo.png";
import { profileValue, useAuthenticatedUser } from "./AuthenticatedUserContext";
import { useUiLanguage } from "./ThaiUiLocalization";
import styles from "./Navbar.module.css";

type NavbarProps = {
  username?: string;
  userLevel?: "Admin" | "User";
  company?: string;
  contextTitle?: string;
  contextItems?: Array<{
    title: string;
    active: boolean;
    locked?: boolean;
    onClick: () => void;
  }>;
  onBack?: () => void;
  onHome?: () => void;
  onLogout?: () => void;
};

export default function Navbar({
  username,
  userLevel = "Admin",
  company,
  contextTitle,
  contextItems = [],
  onBack,
  onHome,
  onLogout,
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const { language, setLanguage } = useUiLanguage();
  const user = useAuthenticatedUser();
  const displayUsername = user?.username ?? username;
  const displayLevel = user?.roleCode ?? userLevel;
  const displayCompany =
    user?.roleCode === "HRD_CENTER"
      ? "All Companies"
      : profileValue(user?.companyName ?? user?.companyCode ?? company);
  const avatar =
    user?.roleCode === "EMPLOYEE"
      ? "EU"
      : user?.roleCode === "HRD_FACTORY"
        ? "HF"
        : "HC";

  const BrandContent = (
    <>
      <Image
        className={styles.brandLogo}
        src={logoImage}
        alt="AISIN TAKAOKA THAILAND GROUP"
        priority
      />
      <span className={styles.groupName}>AISIN TAKAOKA THAILAND GROUP</span>
    </>
  );

  useEffect(() => {
    const updateNavbarState = () => setIsScrolled(window.scrollY > 18);

    updateNavbarState();
    window.addEventListener("scroll", updateNavbarState, { passive: true });

    return () => window.removeEventListener("scroll", updateNavbarState);
  }, []);

  return (
    <header className={`${styles.navbar} ${isScrolled ? styles.scrolledNavbar : ""}`}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          {onHome ? (
            <button
              className={styles.brandButton}
              type="button"
              onClick={onHome}
              aria-label="Back to main dashboard"
            >
              {BrandContent}
            </button>
          ) : (
            <div className={styles.brand}>{BrandContent}</div>
          )}

          <div className={styles.topActions}>
            <div
              className={styles.languageSwitcher}
              aria-label="Language selector"
              data-language={language}
              role="group"
            >
              <button
                className={
                  language === "en"
                    ? styles.activeLanguage
                    : styles.languageButton
                }
                type="button"
                aria-label="Switch to English"
                aria-pressed={language === "en"}
                lang="en"
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
              <span className={styles.languageDivider} aria-hidden="true">|</span>
              <button
                className={
                  language === "th"
                    ? styles.activeLanguage
                    : styles.languageButton
                }
                type="button"
                aria-label="Switch to Thai"
                aria-pressed={language === "th"}
                lang="th"
                onClick={() => setLanguage("th")}
              >
                TH
              </button>
            </div>

            {displayUsername ? (
              <div className={styles.userArea}>
                <div className={styles.userInfo}>
                  <div className={styles.avatarWrapper}>
                    <div className={styles.avatar} aria-hidden="true">{avatar}</div>
                    <span className={styles.onlineBadge} title="Active Session" />
                  </div>
                  <div className={styles.userDetails}>
                    <div className={styles.userRow}>
                      <span className={styles.userValue}>{displayUsername}</span>
                      <span className={styles.roleBadge}>{displayLevel}</span>
                    </div>
                    <div className={styles.userSubRow}>
                      <span className={styles.companyValue}>{displayCompany}</span>
                    </div>
                  </div>
                </div>
                <button className={styles.logoutButton} type="button" onClick={onLogout}>
                  <svg className={styles.logoutIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {contextTitle ? (
          <nav className={styles.contextNav} aria-label="Current module navigation">
            {onBack ? (
              <button className={styles.backButton} type="button" onClick={onBack}>
                Back to Dashboard
              </button>
            ) : null}
            <div className={styles.contextTitle}>
              <span>Current workspace</span>
              <strong>{contextTitle}</strong>
            </div>
            {contextItems.length > 0 ? (
              <div className={styles.contextItems}>
                {contextItems.map((item) => (
                  <button
                    aria-label={
                      item.locked ? `${item.title} - Locked` : item.title
                    }
                    className={
                      item.locked
                        ? styles.lockedContextItem
                        : item.active
                          ? styles.activeContextItem
                          : styles.contextItem
                    }
                    disabled={item.locked}
                    key={item.title}
                    type="button"
                    onClick={item.onClick}
                  >
                    {item.locked ? (
                      <span className={styles.contextLock} aria-hidden="true">
                        🔒
                      </span>
                    ) : null}
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
