"use client";

import { useRouter } from "next/navigation";
import { useAuthActions } from "../../AuthActionsContext";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useSectionNavigation } from "../../../lib/useSectionNavigation";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_TrainingPlanManagement.module.css";
import { planItems } from "./modules";

type TrainingPlanManagementProps = {
  selectedSlug?: string | null;
};

export default function TrainingPlanManagement({
  selectedSlug = null,
}: TrainingPlanManagementProps) {
  const router = useRouter();
  const { logout } = useAuthActions();
  const username = useAuthenticatedUser()?.username ?? "";
  const { selectedItem, openSection, goToGrid } = useSectionNavigation(
    "/training-plan",
    planItems,
    selectedSlug,
  );
  const SelectedModule = selectedItem?.Component;
  const trainingOapItem = planItems.find((item) => item.title === "Training OAP");

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
            ? `Training Plan Management / ${selectedItem.title}`
            : "Training Plan Management"
        }
        contextItems={planItems.map((item) => ({
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
          <span className={styles.sectionBadge}>Planning Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker}>Training Plan</p>
            <h1>{selectedItem ? selectedItem.title : "Training Plan Management"}</h1>
            <p>
              Prepare annual training plans, rolling schedules, training needs, and acceptance surveys for the HRD workflow.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule
          onOpenTrainingOap={() => {
            if (trainingOapItem) {
              openSection(trainingOapItem);
            }
          }}
          username={username}
        />
      ) : (
        <section className={styles.moduleSection} aria-label="Training Plan Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Plan Setup</span>
              <h2>Select a workspace</h2>
            </div>
            <p>{planItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {planItems.map((item, index) => (
              <button
                className={`${styles.moduleCard} ${item.locked ? styles.lockedCard : ""}`}
                key={item.title}
                type="button"
                onClick={() => {
                  if (item.locked) {
                    alert("🔒 ฟังก์ชันคำขอฝึกอบรม (Request Training Need) ถูกล็อกการใช้งานไว้ชั่วคราว");
                    return;
                  }
                  openSection(item);
                }}
              >
                <span className={styles.moduleIcon} aria-hidden="true">
                  <span>{item.icon}</span>
                </span>
                <span className={styles.cardIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className={styles.cardSubtitle}>{item.subtitle}</span>
                  <h3>
                    {item.title}
                    {item.locked ? <span className={styles.lockedTag}>🔒 ล็อกการใช้งาน</span> : null}
                  </h3>
                  <p>{item.description}</p>
                </div>
                <strong>{item.locked ? "🔒 Locked" : "Open"}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
