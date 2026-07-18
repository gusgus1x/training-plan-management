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
        <p className={styles.kicker}>Training Plan</p>
        <h1>{selectedItem ? selectedItem.title : "Training Plan Management"}</h1>
      </section>

      {SelectedModule ? (
        <SelectedModule username={username} />
      ) : (
        <section className={styles.moduleGrid} aria-label="Training Plan Management modules">
          {planItems.map((item) => (
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
