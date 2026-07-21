"use client";

import { useState } from "react";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_MasterDataManagement.module.css";
import { masterDataItems } from "./modules";

type MasterDataManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function MasterDataManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: MasterDataManagementProps) {
  const [selectedItem, setSelectedItem] = useState<(typeof masterDataItems)[number] | null>(null);
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
            ? `Master Data Management / ${selectedItem.title}`
            : "Master Data Management"
        }
        contextItems={masterDataItems.map((item) => ({
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
          <span className={styles.sectionBadge}>Master Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker}>Master Data</p>
            <h1>{selectedItem ? selectedItem.title : "Master Data Management"}</h1>
            <p>
              Maintain company, function, position, employee, instructor, level, and mapping data for every training workflow.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleSection} aria-label="Master Data Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Data Setup</span>
              <h2>Select a workspace</h2>
            </div>
            <p>{masterDataItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {masterDataItems.map((item, index) => (
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
