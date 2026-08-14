"use client";

import { useRouter } from "next/navigation";
import { useAuthActions } from "../../AuthActionsContext";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useSectionNavigation } from "../../../lib/useSectionNavigation";
import Navbar from "../../Navbar";
import styles from "./CenterFactory_MasterDataManagement.module.css";
import { masterDataItems } from "./modules";

type MasterDataManagementProps = {
  selectedSlug?: string | null;
};

export default function MasterDataManagement({
  selectedSlug = null,
}: MasterDataManagementProps) {
  const router = useRouter();
  const { logout } = useAuthActions();
  const username = useAuthenticatedUser()?.username ?? "";
  const { selectedItem, openSection, goToGrid } = useSectionNavigation(
    "/master-data",
    masterDataItems,
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
        contextTitle={
          selectedItem
            ? `Master Data Management / ${selectedItem.title}`
            : "Master Data Management"
        }
        contextItems={masterDataItems.map((item) => ({
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
          <span className={styles.sectionBadge}>Master Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker} translate="no">Master Data</p>
            <h1 translate="no">{selectedItem ? selectedItem.title : "Master Data Management"}</h1>
            <p>
              Maintain course classifications, company, function, position, employee, instructor, institute/provider, level, and mapping data for every training workflow.
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
              <h2 translate="no">Select a workspace</h2>
            </div>
            <p>{masterDataItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {masterDataItems.map((item, index) => (
              <button
                className={styles.moduleCard}
                key={item.title}
                type="button"
                onClick={() => openSection(item)}
              >
                <span className={styles.moduleIcon} aria-hidden="true">
                  <span>{item.icon}</span>
                </span>
                <span className={styles.cardIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className={styles.cardSubtitle} translate="no">{item.subtitle}</span>
                  <h3 translate="no">{item.title}</h3>
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
