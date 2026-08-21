"use client";

import { useEffect, useState } from "react";
import styles from "./ScrollToTop.module.css";

// Visible once the reader is past the halfway mark of the scrollable distance —
// not half the viewport, so a short page never shows a button that has nowhere to go.
export const isPastHalfway = (scrollY: number, scrollHeight: number, viewportHeight: number) => {
  const scrollable = scrollHeight - viewportHeight;
  return scrollable > 0 && scrollY > scrollable / 2;
};

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const update = () =>
      setIsVisible(
        isPastHalfway(
          window.scrollY,
          document.documentElement.scrollHeight,
          window.innerHeight,
        ),
      );

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <button
      className={styles.scrollTopButton}
      type="button"
      aria-label="Scroll back to top"
      title="Scroll back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  );
}
