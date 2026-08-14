"use client";

import { useRouter } from "next/navigation";
import { useAuthActions } from "../../AuthActionsContext";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useSectionNavigation } from "../../../lib/useSectionNavigation";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_TrainingRecordManagement.module.css";
import { recordItems } from "./modules";

type TrainingRecordManagementProps = {
  selectedSlug?: string | null;
};

export default function TrainingRecordManagement({
  selectedSlug = null,
}: TrainingRecordManagementProps) {
  const router = useRouter();
  const { logout } = useAuthActions();
  const username = useAuthenticatedUser()?.username ?? "";
  const { selectedItem, openSection, goToGrid } = useSectionNavigation(
    "/training-record",
    recordItems,
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
            ? `Training Record Management / ${selectedItem.title}`
            : "Training Record Management"
        }
        contextItems={recordItems.map((item) => ({
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
          <span className={styles.sectionBadge}>Record Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker} translate="no">Training Record</p>
            <h1 translate="no">{selectedItem ? selectedItem.title : "Training Record Management"}</h1>
            <p>
              Record actual training, verify employee history, and follow completion evidence across the HRD workflow.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleSection} aria-label="Training Record Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Record Operation</span>
              <h2 translate="no">Select a workspace</h2>
            </div>
            <p>{recordItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {recordItems.map((item, index) => (
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
                  <span className={styles.cardSubtitle} translate="no">{item.subtitle}</span>
                  <h3 translate="no">{item.title}</h3>
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
