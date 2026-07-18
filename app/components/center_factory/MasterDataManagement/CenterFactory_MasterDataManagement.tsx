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
      <Navbar username={username} onHome={onHome} onLogout={onLogout} />

      <section className={styles.header}>
        <button className={styles.backButton} type="button" onClick={handleBack}>
          Back
        </button>
        <p className={styles.kicker}>Master Data</p>
        <h1>{selectedItem ? selectedItem.title : "Master Data Management"}</h1>
      </section>

      {SelectedModule ? (
        <SelectedModule />
      ) : (
        <section className={styles.moduleGrid} aria-label="Master Data Management modules">
          {masterDataItems.map((item) => (
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
