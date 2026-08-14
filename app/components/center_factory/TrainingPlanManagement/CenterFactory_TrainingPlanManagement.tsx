"use client";

import { useState } from "react";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_TrainingPlanManagement.module.css";
import { planItems } from "./modules";

type TrainingPlanManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function TrainingPlanManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: TrainingPlanManagementProps) {
  const [selectedItem, setSelectedItem] = useState<(typeof planItems)[number] | null>(null);
  const SelectedModule = selectedItem?.Component;
  const trainingOapItem = planItems.find((item) => item.title === "Training OAP");

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
            ? `Training Plan Management / ${selectedItem.title}`
            : "Training Plan Management"
        }
        contextItems={planItems.map((item) => ({
          title: item.title,
          active: item.title === selectedItem?.title,
          locked: item.locked,
          onClick: () => {
            if (item.locked) return;
            setSelectedItem(item);
          },
        }))}
        onBack={handleBack}
        onHome={onHome}
        onLogout={onLogout}
      />

      <section className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.sectionBadge}>Planning Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker} translate="no">Training Plan</p>
            <h1 translate="no">{selectedItem ? selectedItem.title : "Training Plan Management"}</h1>
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
              setSelectedItem(trainingOapItem);
            }
          }}
          username={username}
        />
      ) : (
        <section className={styles.moduleSection} aria-label="Training Plan Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Plan Setup</span>
              <h2 translate="no">Select a workspace</h2>
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
                  setSelectedItem(item);
                }}
              >
                <span className={styles.moduleIcon} aria-hidden="true">
                  <span>{item.icon}</span>
                </span>
                <span className={styles.cardIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className={styles.cardSubtitle} translate="no">{item.subtitle}</span>
                  <h3 translate="no">
                    {item.title}
                    {item.locked ? <span className={styles.lockedTag}>🔒 Locked</span> : null}
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
