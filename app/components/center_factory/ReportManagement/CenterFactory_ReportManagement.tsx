"use client";

import { useState } from "react";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_ReportManagement.module.css";
import { centerReportItems } from "./modules";

type ReportManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function ReportManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: ReportManagementProps) {
  const [selectedItem, setSelectedItem] = useState<(typeof centerReportItems)[number] | null>(null);
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
        <p className={styles.kicker}>Report</p>
        <h1>{selectedItem ? selectedItem.title : "Report Management"}</h1>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleGrid} aria-label="Report Management modules">
          {centerReportItems.map((item) => (
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
