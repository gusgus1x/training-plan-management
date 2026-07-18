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
      <Navbar username={username} onHome={onHome} onLogout={onLogout} />

      <section className={styles.header}>
        <button className={styles.backButton} type="button" onClick={handleBack}>
          Back
        </button>
        <p className={styles.kicker}>Training Record</p>
        <h1>{selectedItem ? selectedItem.title : "Training Record Management"}</h1>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleGrid} aria-label="Training Record Management modules">
          {recordItems.map((item) => (
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
