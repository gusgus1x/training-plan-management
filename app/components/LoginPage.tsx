import Image from "next/image";
import atfbImage from "../photo/ATFB.jpg";
import nicImage from "../photo/NIC.png";
import satiImage from "../photo/SATI.jpg";
import snfImage from "../photo/SNF.jpg";
import tepImage from "../photo/TEP.jpg";
import Navbar from "./Navbar";
import styles from "./LoginPage.module.css";

type LoginPageProps = {
  onLogin: (role?: "admin" | "user") => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
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
          onSubmit={(event) => {
            event.preventDefault();
            onLogin("admin");
          }}
        >
          <div className={styles.formHeader}>
            <p className={styles.formEyebrow}>Sign in</p>
            <h2>ATTG TRAINING PLAN MANAGEMENT
            </h2>
          </div>

          <label className={styles.field}>
            <span>Username</span>
            <input type="text" defaultValue="HRD-CENTER" />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input type="password" defaultValue="training" />
          </label>

          <button className={styles.loginButton} type="submit">
            Login
          </button>

          <div className={styles.quickLoginPanel}>
            <p>Login as test account</p>
            <button className={styles.quickLoginButton} type="button" onClick={() => onLogin("user")}>
              Employee User
              <span>emp.user / training</span>
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
