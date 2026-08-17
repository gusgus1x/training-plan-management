 "use client";

import { useEffect, useRef, useState } from "react";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const contextItemsRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage } = useUiLanguage();
  const user = useAuthenticatedUser();
  const displayUsername = user?.username ?? username;
  const displayLevelRaw = user?.roleCode ?? userLevel;
  const displayLevel =
    displayLevelRaw === "HRD_CENTER"
      ? "HRD Center"
      : displayLevelRaw === "HRD_FACTORY"
        ? "HRD Factory"
        : displayLevelRaw === "EMPLOYEE"
          ? "Employee"
          : displayLevelRaw.replace(/_/g, " ");
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

  const contextKey = contextTitle?.split("/")[0]?.trim() || "default";

  // Auto-scroll active item into view & preserve horizontal scroll position
  useEffect(() => {
    if (!contextItemsRef.current) return;
    const container = contextItemsRef.current;

    const savedScroll = sessionStorage.getItem(`navbar-scroll-${contextKey}`);
    if (savedScroll !== null) {
      container.scrollLeft = Number(savedScroll);
    }

    const activeItem = container.querySelector<HTMLElement>(`.${styles.activeContextItem}`);
    if (activeItem) {
      activeItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [contextTitle, contextItems, contextKey]);

  const handleContextScroll = () => {
    if (contextItemsRef.current) {
      sessionStorage.setItem(`navbar-scroll-${contextKey}`, String(contextItemsRef.current.scrollLeft));
    }
  };

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

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("theme", newTheme);
  };

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
              </div>
            ) : null}

            {/* Central Unified Settings Dropdown Menu */}
            <div className={styles.settingsMenuWrapper} ref={settingsRef}>
              <button
                className={`${styles.settingsButton} ${isSettingsOpen ? styles.activeSettingsButton : ""}`}
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                aria-label="Settings"
                aria-expanded={isSettingsOpen}
              >
                <svg className={styles.gearIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className={styles.settingsBtnText}>Settings</span>
                <svg className={`${styles.chevronIcon} ${isSettingsOpen ? styles.rotatedChevron : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isSettingsOpen && (
                <div className={`${styles.settingsDropdown} animate-fade-in`}>
                  <div className={styles.settingsHeader}>
                    <strong>Settings</strong>
                    <span>Preferences</span>
                  </div>

                  {/* 1. Language Option */}
                  <div className={styles.settingsGroup}>
                    <div className={styles.settingsGroupHeader}>
                      <svg className={styles.groupSvgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <span>Language</span>
                    </div>
                    <div className={styles.segmentControl} role="group" aria-label="Language">
                      <button
                        aria-pressed={language === "en"}
                        className={language === "en" ? styles.activeSegment : styles.segmentBtn}
                        onClick={() => setLanguage("en")}
                        type="button"
                      >
                        English
                      </button>
                      <button
                        aria-pressed={language === "th"}
                        className={language === "th" ? styles.activeSegment : styles.segmentBtn}
                        onClick={() => setLanguage("th")}
                        type="button"
                      >
                        ไทย
                      </button>
                    </div>
                  </div>

                  {/* 2. Theme Option */}
                  <div className={styles.settingsGroup}>
                    <div className={styles.settingsGroupHeader}>
                      <svg className={styles.groupSvgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2" />
                        <path d="M12 20v2" />
                        <path d="m4.93 4.93 1.41 1.41" />
                        <path d="m17.66 17.66 1.41 1.41" />
                        <path d="M2 12h2" />
                        <path d="M20 12h2" />
                        <path d="m6.34 17.66-1.41 1.41" />
                        <path d="m19.07 4.93-1.41 1.41" />
                      </svg>
                      <span>Appearance</span>
                    </div>
                    <div className={styles.segmentControl}>
                      <button
                        className={theme === "light" ? styles.activeSegment : styles.segmentBtn}
                        onClick={() => handleThemeChange("light")}
                        type="button"
                      >
                        <svg className={styles.optionSvgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v2" />
                          <path d="M12 20v2" />
                          <path d="m4.93 4.93 1.41 1.41" />
                          <path d="m17.66 17.66 1.41 1.41" />
                          <path d="M2 12h2" />
                          <path d="M20 12h2" />
                          <path d="m6.34 17.66-1.41 1.41" />
                          <path d="m19.07 4.93-1.41 1.41" />
                        </svg>
                        <span>Light</span>
                      </button>
                      <button
                        className={theme === "dark" ? styles.activeSegment : styles.segmentBtn}
                        onClick={() => handleThemeChange("dark")}
                        type="button"
                      >
                        <svg className={styles.optionSvgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                        </svg>
                        <span>Dark</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Logout Option */}
                  {onLogout && (
                    <>
                      <div className={styles.dropdownDivider} />
                      <button
                        className={styles.dropdownLogoutBtn}
                        onClick={() => {
                          setIsSettingsOpen(false);
                          onLogout();
                        }}
                        type="button"
                      >
                        <svg className={styles.logoutIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Sign out</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
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
              <strong translate="no">{contextTitle}</strong>
            </div>
            {contextItems.length > 0 ? (
              <div
                className={styles.contextItems}
                ref={contextItemsRef}
                onScroll={handleContextScroll}
              >
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
                    <span translate="no">{item.title}</span>
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
