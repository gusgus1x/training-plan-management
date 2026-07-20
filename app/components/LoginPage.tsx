"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import type { ClientRoleCode } from "../lib/auth/client";
import atfbImage from "../photo/ATFB.jpg";
import nicImage from "../photo/NIC.png";
import satiImage from "../photo/SATI.jpg";
import snfImage from "../photo/SNF.jpg";
import tepImage from "../photo/TEP.jpg";
import Navbar from "./Navbar";
import styles from "./LoginPage.module.css";

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  onTestLogin: (roleCode: ClientRoleCode) => void;
  sessionMessage?: string | null;
};

const GENERIC_LOGIN_ERROR = "Unable to sign in. Check your username and password.";

export default function LoginPage({
  onLogin,
  onTestLogin,
  sessionMessage = null,
}: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
            <p className={styles.formEyebrow}>Sign in</p>
            <h2>ATTG TRAINING PLAN MANAGEMENT
            </h2>
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

          <label className={styles.field}>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              maxLength={1024}
              required
              disabled={isSubmitting}
              aria-describedby={
                errorMessage || sessionMessage ? "login-error" : undefined
              }
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {errorMessage || sessionMessage ? (
            <p
              className={styles.errorMessage}
              id="login-error"
              role="alert"
              aria-live="polite"
            >
              {errorMessage ?? sessionMessage}
            </p>
          ) : null}

          <button
            className={styles.loginButton}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Login"}
          </button>

          <div className={styles.quickLoginPanel} aria-label="Test login options">
            <p>Test access</p>
            <button
              className={styles.quickLoginButton}
              type="button"
              disabled={isSubmitting}
              onClick={() => onTestLogin("EMPLOYEE")}
            >
              Employee
              <span>Open user dashboard without password</span>
            </button>
            <button
              className={styles.quickLoginButton}
              type="button"
              disabled={isSubmitting}
              onClick={() => onTestLogin("HRD_CENTER")}
            >
              HRD Center
              <span>Open center management workspace</span>
            </button>
            <button
              className={styles.quickLoginButton}
              type="button"
              disabled={isSubmitting}
              onClick={() => onTestLogin("HRD_FACTORY")}
            >
              HRD Factory
              <span>Open factory management workspace</span>
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
