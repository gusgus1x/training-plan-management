"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./LoginActivitiesWidget.module.css";
import { useUiLanguage } from "../ThaiUiLocalization";

export interface LoginActivityItem {
  id: string;
  title: string;
  date?: string | null;
  formattedDate?: string | null;
  year?: string | null;
  location?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  images?: string[];
  isCourseLinked?: boolean;
  linkedCourseCode?: string | null;
  linkedCourseName?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  status?: string;
  isVisibleOnDashboard?: boolean;
}

export type LoginActivitiesWidgetProps = {
  className?: string;
};

export default function LoginActivitiesWidget({ className }: LoginActivitiesWidgetProps) {
  const { language } = useUiLanguage();
  const isThai = language === "th";

  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<LoginActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<LoginActivityItem | null>(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedActivity) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [selectedActivity]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch published activities on mount
  useEffect(() => {
    const controller = new AbortController();

    async function loadActivities() {
      try {
        const response = await fetch("/api/course-activities", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.status}`);
        }
        const data = await response.json();
        const list: LoginActivityItem[] = Array.isArray(data?.activities)
          ? data.activities
          : [];

        // Filter activities that are published and visible
        const publishedList = list.filter(
          (item) => item.status === "PUBLISHED" && item.isVisibleOnDashboard !== false
        );

        setActivities(publishedList);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Graceful fallback: empty list
          setActivities([]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadActivities();

    return () => {
      controller.abort();
    };
  }, []);

  const total = activities.length;

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto slide every 5 seconds unless hovered or modal open
  useEffect(() => {
    if (total <= 1 || isHovered || selectedActivity !== null) {
      return;
    }

    const timer = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(timer);
  }, [total, isHovered, selectedActivity, handleNext]);

  // Close modal on Escape key
  useEffect(() => {
    if (!selectedActivity) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedActivity(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedActivity]);

  // Reset active gallery image when opening modal
  const openDetailModal = (activity: LoginActivityItem) => {
    setSelectedActivity(activity);
    setActiveGalleryIndex(0);
  };

  const closeDetailModal = () => {
    setSelectedActivity(null);
  };

  if (isLoading) {
    return (
      <section
        className={`${styles.container} ${className || ""}`}
        aria-label={isThai ? "กำลังโหลดข่าวสาร" : "Loading announcements"}
      >
        <div className={styles.skeletonCard}>
          <div className={styles.skeletonThumb} />
          <div className={styles.skeletonContent}>
            <div className={styles.skeletonLine} style={{ width: "35%" }} />
            <div className={styles.skeletonLine} style={{ width: "80%" }} />
            <div className={styles.skeletonLine} style={{ width: "60%" }} />
          </div>
        </div>
      </section>
    );
  }

  // If no published activities, hide widget gracefully
  if (total === 0) {
    return null;
  }

  const currentItem = activities[currentIndex] || activities[0];
  const allImages = currentItem.images && currentItem.images.length > 0
    ? currentItem.images
    : currentItem.imageUrl
    ? [currentItem.imageUrl]
    : [];
  const coverImage = allImages[0] || null;

  return (
    <>
      <section
        ref={containerRef}
        className={`${styles.container} ${className || ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={isThai ? "ข่าวสารและกิจกรรมประชาสัมพันธ์" : "Announcements and activities"}
      >
        {/* Top Header Bar */}
        <div className={styles.headerBar}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.liveDotPulse} aria-hidden="true">
              <span className={styles.liveDotRing} />
              <span className={styles.liveDotCore} />
            </span>
            <span className={styles.headerCategory}>
              {isThai ? "ข่าวสารและกิจกรรม" : "ATTG News"}
            </span>
            <span className={styles.headerSubtitle}>
              {isThai ? "ประชาสัมพันธ์ล่าสุด" : "Latest Updates"}
            </span>
          </div>

          <div className={styles.headerControls}>
            <span className={styles.counter} aria-live="polite">
              {String(currentIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>

            {total > 1 && (
              <div className={styles.navButtonGroup}>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={handlePrev}
                  aria-label={isThai ? "ก่อนหน้า" : "Previous announcement"}
                  title={isThai ? "ก่อนหน้า" : "Previous"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={handleNext}
                  aria-label={isThai ? "ถัดไป" : "Next announcement"}
                  title={isThai ? "ถัดไป" : "Next"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Announcement Card */}
        <button
          type="button"
          className={styles.slideCard}
          onClick={() => openDetailModal(currentItem)}
          aria-label={`${isThai ? "คลิกดูรายละเอียด" : "View details"}: ${currentItem.title}`}
        >
          {/* Thumbnail */}
          <div className={styles.thumbnailWrapper}>
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt={currentItem.title}
                className={styles.thumbnailImage}
                loading="lazy"
              />
            ) : (
              <div className={styles.thumbnailPlaceholder} aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}

            {currentItem.companyCode && (
              <span className={styles.companyBadgeOnThumb}>
                {currentItem.companyCode}
              </span>
            )}

            {allImages.length > 1 && (
              <span className={styles.photoCountBadge} aria-label={`${allImages.length} photos`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {allImages.length}
              </span>
            )}
          </div>

          {/* Text Content */}
          <div className={styles.contentColumn}>
            <div className={styles.metaRow}>
              {currentItem.formattedDate && (
                <span className={styles.metaItem}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {currentItem.formattedDate}
                </span>
              )}
              {currentItem.location && (
                <span className={styles.metaItem}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {currentItem.location}
                </span>
              )}
            </div>

            <h3 className={styles.title}>{currentItem.title}</h3>

            {currentItem.description && (
              <p className={styles.snippet}>{currentItem.description}</p>
            )}

            <div className={styles.actionRow}>
              <span>{isThai ? "อ่านรายละเอียด" : "Read details"}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        </button>

        {/* Footer Pagination Dots */}
        {total > 1 && (
          <div className={styles.footerBar} role="tablist" aria-label={isThai ? "ตัวเลือกข่าวสาร" : "Announcement dots"}>
            {activities.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={idx === currentIndex}
                className={`${styles.dotButton} ${idx === currentIndex ? styles.dotButtonActive : ""}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`${isThai ? "ข่าวสารที่" : "Announcement"} ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Read-Only Detail Modal (Portaled directly to document.body to avoid stacking context traps) */}
      {mounted && selectedActivity && createPortal(
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDetailModal();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-detail-title"
        >
          <div className={styles.modalDialog}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalBadgeGroup}>
                {selectedActivity.companyCode && (
                  <span
                    className={styles.companyBadge}
                    title={selectedActivity.companyName || selectedActivity.companyCode || undefined}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                    </svg>
                    {selectedActivity.companyCode}
                  </span>
                )}
                {selectedActivity.formattedDate && (
                  <span className={styles.dateBadge}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {selectedActivity.formattedDate}
                  </span>
                )}
              </div>

              <button
                type="button"
                className={styles.closeButton}
                onClick={closeDetailModal}
                aria-label={isThai ? "ปิด" : "Close"}
                title={isThai ? "ปิด" : "Close"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              <h2 id="activity-detail-title" className={styles.modalTitle}>
                {selectedActivity.title}
              </h2>

              {/* Gallery */}
              {(() => {
                const modalImages = selectedActivity.images && selectedActivity.images.length > 0
                  ? selectedActivity.images
                  : selectedActivity.imageUrl
                  ? [selectedActivity.imageUrl]
                  : [];

                if (modalImages.length === 0) return null;

                const activeImage = modalImages[activeGalleryIndex] || modalImages[0];

                return (
                  <div className={styles.gallerySection}>
                    <div className={styles.modalMainImageWrapper}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeImage}
                        alt={selectedActivity.title}
                        className={styles.modalMainImage}
                      />
                    </div>

                    {modalImages.length > 1 && (
                      <div className={styles.thumbnailStrip} role="tablist" aria-label={isThai ? "ภาพประกอบ" : "Gallery photos"}>
                        {modalImages.map((imgUrl, idx) => (
                          <button
                            key={imgUrl}
                            type="button"
                            role="tab"
                            aria-selected={idx === activeGalleryIndex}
                            className={`${styles.thumbStripButton} ${idx === activeGalleryIndex ? styles.thumbStripButtonActive : ""}`}
                            onClick={() => setActiveGalleryIndex(idx)}
                            aria-label={`${isThai ? "รูปที่" : "Photo"} ${idx + 1}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt=""
                              className={styles.thumbStripImage}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Meta Card */}
              <div className={styles.modalMetaCard}>
                {selectedActivity.location && (
                  <div className={styles.modalMetaItem}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{isThai ? "สถานที่" : "Location"}: <strong>{selectedActivity.location}</strong></span>
                  </div>
                )}
                {selectedActivity.isCourseLinked && selectedActivity.linkedCourseName && (
                  <div className={styles.modalMetaItem}>
                    <span className={styles.courseTag}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      {isThai ? "หลักสูตร" : "Course"}: {selectedActivity.linkedCourseName}
                    </span>
                  </div>
                )}
              </div>

              {/* Full Description */}
              {selectedActivity.description && (
                <div className={styles.modalDescription}>
                  {selectedActivity.description}
                </div>
              )}
            </div>

            {/* Modal Footer (Read-Only Close Button Only) */}
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeDetailModal}
              >
                {isThai ? "ปิด" : "Close"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
