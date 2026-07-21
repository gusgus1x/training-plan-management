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
      <Navbar
        username={username}
        contextTitle={selectedItem ? `Report Management / ${selectedItem.title}` : "Report Management"}
        contextItems={centerReportItems.map((item) => ({
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
          <span className={styles.sectionBadge}>Report Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker}>Report</p>
            <h1>{selectedItem ? selectedItem.title : "Report Management"}</h1>
            <p>
              Review training schedules, internal reports, and HRD reporting outputs in one workspace.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleSection} aria-label="Report Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Report Operation</span>
              <h2>Select a workspace</h2>
            </div>
            <p>{centerReportItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {centerReportItems.map((item, index) => (
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
