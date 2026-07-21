 "use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import logoImage from "../photo/logo.png";
import { profileValue, useAuthenticatedUser } from "./AuthenticatedUserContext";
import styles from "./Navbar.module.css";

type NavbarProps = {
  username?: string;
  userLevel?: "Admin" | "User";
  company?: string;
  contextTitle?: string;
  contextItems?: Array<{
    title: string;
    active: boolean;
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

          {displayUsername ? (
            <div className={styles.userArea}>
              <div className={styles.userInfo}>
                <div className={styles.avatar} aria-hidden="true">{avatar}</div>
                <div className={styles.userDetails}>
                  <div className={styles.userRow}>
                    <span className={styles.userLabel}>Name :</span>
                    <span className={styles.userValue}>{displayUsername}</span>
                  </div>
                  <div className={styles.userRow}>
                    <span className={styles.userLabel}>Role :</span>
                    <span className={styles.userValue}>{displayLevel}</span>
                  </div>
                  <div className={styles.userRow}>
                    <span className={styles.userLabel}>Company :</span>
                    <span className={styles.userValue}>{displayCompany}</span>
                  </div>
                </div>
              </div>
              <button className={styles.logoutButton} type="button" onClick={onLogout}>
                Logout
              </button>
            </div>
          ) : null}
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
                    className={item.active ? styles.activeContextItem : styles.contextItem}
                    key={item.title}
                    type="button"
                    onClick={item.onClick}
                  >
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
