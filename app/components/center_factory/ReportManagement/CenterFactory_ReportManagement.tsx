"use client";

import { useState } from "react";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_ReportManagement.module.css";
import {
  centerReportItems,
  internalReportTitle,
  type InternalReportDraft,
} from "./modules";

type ReportManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
  initialModuleTitle?: string;
  initialYear?: string;
  initialMonth?: string;
};

export default function ReportManagement({
  username,
  onBack,
  onHome,
  onLogout,
  initialModuleTitle,
  initialYear,
  initialMonth,
}: ReportManagementProps) {
  const [preparedDraft, setPreparedDraft] = useState<InternalReportDraft | null>(null);
  const [selectedItem, setSelectedItem] = useState<(typeof centerReportItems)[number] | null>(
    () => {
      if (typeof initialModuleTitle !== "string") {
        return null;
      }
      return (
        centerReportItems.find(
          (item) => item.title.toLowerCase() === initialModuleTitle.toLowerCase()
        ) ?? null
      );
    }
  );
  const SelectedModule = selectedItem?.Component;
  const internalReportItem =
    centerReportItems.find((item) => item.title === internalReportTitle) ?? null;
  const isInternalReportLocked = internalReportItem?.locked ?? true;

  const handleSelectItem = (item: (typeof centerReportItems)[number]) => {
    if (item.locked) {
      return;
    }

    setPreparedDraft(null);
    setSelectedItem(item);
  };

  const handlePrepareEmail = (draft: InternalReportDraft) => {
    if (isInternalReportLocked) {
      return;
    }

    setPreparedDraft(draft);
    setSelectedItem(internalReportItem);
  };

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
          locked: item.locked,
          onClick: () => handleSelectItem(item),
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
            <p className={styles.kicker} translate="no">Report</p>
            <h1 translate="no">{selectedItem ? selectedItem.title : "Report Management"}</h1>
            <p>
              Review training schedules, internal reports, and HRD reporting outputs in one workspace.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule
          onPrepareEmail={
            isInternalReportLocked ? undefined : handlePrepareEmail
          }
          preparedDraft={selectedItem?.title === internalReportTitle ? preparedDraft : null}
          initialYear={initialYear}
          initialMonth={initialMonth}
        />
      ) : (
        <section className={styles.moduleSection} aria-label="Report Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Report Operation</span>
              <h2 translate="no">Select a workspace</h2>
            </div>
            <p>{centerReportItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {centerReportItems.map((item, index) => (
              <button
                className={`${styles.moduleCard} ${item.locked ? styles.lockedModuleCard : ""
                  }`}
                disabled={item.locked}
                key={item.title}
                type="button"
                onClick={() => handleSelectItem(item)}
              >
                <span className={styles.moduleIcon} aria-hidden="true">
                  <span>{item.icon}</span>
                </span>
                <span className={styles.cardIndex} aria-hidden="true">
                  {item.locked ? "🔒" : String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className={styles.cardSubtitle} translate="no">{item.subtitle}</span>
                  <h3 translate="no">{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <strong>{item.locked ? "Locked" : "Open"}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
