import Image from "next/image";
import logoImage from "../photo/logo.png";
import { profileValue, useAuthenticatedUser } from "./AuthenticatedUserContext";
import styles from "./Navbar.module.css";

type NavbarProps = {
  username?: string;
  userLevel?: "Admin" | "User";
  company?: string;
  onHome?: () => void;
  onLogout?: () => void;
};

export default function Navbar({
  username,
  userLevel = "Admin",
  company,
  onHome,
  onLogout,
}: NavbarProps) {
  const user = useAuthenticatedUser();
  const displayUsername = user?.username ?? username;
  const displayLevel = user?.roleCode ?? userLevel;
  const displayCompany =
    user?.roleCode === "HRD_CENTER"
      ? "ทุกบริษัท"
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

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
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
            <div className={styles.statusPill}>
              <span className={styles.statusDot} aria-hidden="true" />
              Active session
            </div>
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
    </header>
  );
}
