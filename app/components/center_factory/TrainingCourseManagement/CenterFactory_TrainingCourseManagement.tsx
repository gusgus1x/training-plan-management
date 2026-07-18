"use client";

import { useState } from "react";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_TrainingCourseManagement.module.css";
import { centerCourseItems } from "./modules";

type TrainingCourseManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function TrainingCourseManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: TrainingCourseManagementProps) {
  const [selectedItem, setSelectedItem] = useState<(typeof centerCourseItems)[number] | null>(null);
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
      <Navbar username={username} onHome={onHome} onLogout={onLogout} />

      <section className={styles.header}>
        <button className={styles.backButton} type="button" onClick={handleBack}>
          Back
        </button>
        <p className={styles.kicker}>Training Course</p>
        <h1>{selectedItem ? selectedItem.title : "Training Course Management"}</h1>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleGrid} aria-label="Training Course Management modules">
          {centerCourseItems.map((item) => (
            <button
              className={styles.moduleCard}
              key={item.title}
              type="button"
              onClick={() => setSelectedItem(item)}
            >
              <h3>{item.title}</h3>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
