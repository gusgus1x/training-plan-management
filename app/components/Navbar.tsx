import Image from "next/image";
import logoImage from "../photo/logo.png";
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
  const displayLevel = userLevel === "Admin" ? "เจ้าหน้าที่จัดอบรมกลาง" : userLevel;
  const displayCompany =
    company ?? (userLevel === "Admin" ? "ALL" : "ATTG Training plan management");

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

        {username ? (
          <div className={styles.userArea}>
            <div className={styles.statusPill}>
              <span className={styles.statusDot} aria-hidden="true" />
              Active session
            </div>
            <div className={styles.userInfo}>
              <div className={styles.avatar} aria-hidden="true">
                {userLevel === "Admin" ? "HA" : "EU"}
              </div>
              <div className={styles.userDetails}>
                <div className={styles.userRow}>
                  <span className={styles.userLabel}>Name :</span>
                  <span className={styles.userValue}>{username}</span>
                </div>
                <div className={styles.userRow}>
                  <span className={styles.userLabel}>Level :</span>
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
