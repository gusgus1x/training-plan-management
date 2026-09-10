"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "../../AuthActionsContext";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useSectionNavigation } from "../../../lib/useSectionNavigation";
import Navbar from "../../Navbar";
import { Lock } from "../../icons/LucideIcons";
import styles from "./CenterFactory_ReportManagement.module.css";
import {
  centerReportItems,
} from "./modules";

type ReportManagementProps = {
  selectedSlug?: string | null;
  initialYear?: string;
  initialMonth?: string;
};

export default function ReportManagement({
  selectedSlug = null,
  initialYear,
  initialMonth,
}: ReportManagementProps) {
  const router = useRouter();
  const { logout } = useAuthActions();
  const username = useAuthenticatedUser()?.username ?? "";
  const { selectedItem, openSection, goToGrid } = useSectionNavigation(
    "/report",
    centerReportItems,
    selectedSlug,
  );
  const SelectedModule = selectedItem?.Component;

  const handleBack = () => {
    if (selectedItem) {
      goToGrid();
      return;
    }

    router.push("/");
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
          onClick: () => openSection(item),
        }))}
        onBack={handleBack}
        onHome={() => router.push("/")}
        onLogout={logout}
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
              Review training schedules, summary analytics, and new activities reporting outputs in one workspace.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule
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
                onClick={() => openSection(item)}
              >
                <span className={styles.moduleIcon} aria-hidden="true">
                  <span>{item.icon}</span>
                </span>
                <span className={styles.cardIndex} aria-hidden="true">
                  {item.locked ? <Lock size={14} /> : String(index + 1).padStart(2, "0")}
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
