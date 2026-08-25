"use client";

import React from "react";
import styles from "./TypewriterLoader.module.css";

interface TypewriterLoaderProps {
  label?: string;
  fullScreen?: boolean;
}

export default function TypewriterLoader({
  label = "กำลังโหลดข้อมูล...",
  fullScreen = false,
}: TypewriterLoaderProps) {
  const containerClass = fullScreen
    ? `${styles.wrapper} ${styles.fullScreen}`
    : styles.wrapper;

  return (
    <div className={containerClass} aria-label="Loading">
      <div className={styles.typewriter}>
        <div className={styles.slide}>
          <i className={styles.slideHandle} />
        </div>
        <div className={styles.paper} />
        <div className={styles.keyboard} />
      </div>
      {label ? <p className={styles.label}>{label}</p> : null}
    </div>
  );
}
