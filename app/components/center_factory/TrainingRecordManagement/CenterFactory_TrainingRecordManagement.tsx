"use client";

import { useState } from "react";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_TrainingRecordManagement.module.css";
import { recordItems } from "./modules";

type TrainingRecordManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function TrainingRecordManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: TrainingRecordManagementProps) {
  const [selectedItem, setSelectedItem] = useState<(typeof recordItems)[number] | null>(null);
  const SelectedModule = selectedItem?.Component;

  const handleBack = () => {
    if (selectedItem) {
      setSelectedItem(null);
      return;
    }

    onBack();
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
          onClick: () => setSelectedItem(item),
        }))}
        onBack={handleBack}
        onHome={onHome}
        onLogout={onLogout}
      />

      <section className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.sectionBadge}>Record Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker}>Training Record</p>
            <h1>{selectedItem ? selectedItem.title : "Training Record Management"}</h1>
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
              <h2>Select a workspace</h2>
            </div>
            <p>{recordItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {recordItems.map((item, index) => (
              <button
                className={styles.moduleCard}
                key={item.title}
                type="button"
                onClick={() => setSelectedItem(item)}
              >
                <span className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
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
