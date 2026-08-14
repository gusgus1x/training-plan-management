"use client";

import { useRouter } from "next/navigation";
import { useAuthActions } from "../../AuthActionsContext";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useSectionNavigation } from "../../../lib/useSectionNavigation";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_TrainingCourseManagement.module.css";
import { centerCourseItems } from "./modules";

type TrainingCourseManagementProps = {
  selectedSlug?: string | null;
};

export default function TrainingCourseManagement({
  selectedSlug = null,
}: TrainingCourseManagementProps) {
  const router = useRouter();
  const { logout } = useAuthActions();
  const username = useAuthenticatedUser()?.username ?? "";
  const { selectedItem, openSection, goToGrid } = useSectionNavigation(
    "/training-course",
    centerCourseItems,
    selectedSlug,
  );
  const SelectedModule = selectedItem?.Component;

  const handleBack = () => {
    if (selectedItem) {
      goToGrid();
      return;
    }

    router.push("/");
  };

  return (
    <main className={styles.page}>
      <Navbar
        username={username}
        contextTitle={
          selectedItem
            ? `Training Course Management / ${selectedItem.title}`
            : "Training Course Management"
        }
        contextItems={centerCourseItems.map((item) => ({
          title: item.title,
          active: item.title === selectedItem?.title,
          locked: item.locked,
          onClick: () => openSection(item),
        }))}
        onBack={handleBack}
        onHome={() => router.push("/")}
        onLogout={logout}
      />

      <section className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.sectionBadge}>Center Factory</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker}>Training Course</p>
            <h1>{selectedItem ? selectedItem.title : "Training Course Management"}</h1>
            <p>
              Build and maintain courses, standards, assessments, and evaluation forms from one place.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleSection} aria-label="Training Course Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Course Setup</span>
              <h2>Select a workspace</h2>
            </div>
            <p>{centerCourseItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {centerCourseItems.map((item, index) => (
              <button
                className={styles.moduleCard}
                key={item.title}
                type="button"
                onClick={() => openSection(item)}
              >
                <span className={styles.moduleIcon} aria-hidden="true">
                  <span>{item.icon}</span>
                </span>
                <span className={styles.cardIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className={styles.cardSubtitle}>{item.subtitle}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <strong>Open</strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
