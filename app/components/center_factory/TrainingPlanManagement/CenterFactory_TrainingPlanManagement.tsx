"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "../../AuthActionsContext";
import { useAuthenticatedUser } from "../../AuthenticatedUserContext";
import { useSectionNavigation } from "../../../lib/useSectionNavigation";
import { isSectionHeadOrAbove } from "../../../lib/employeeMasterData";
import Navbar from "../../Navbar";
import { useToast } from "../../ToastHost";
import styles from "./CenterFactory_TrainingPlanManagement.module.css";
import { planItems } from "./modules";

type TrainingPlanManagementProps = {
  selectedSlug?: string | null;
  initialCourseId?: string;
};

export default function TrainingPlanManagement({
  selectedSlug = null,
  initialCourseId,
}: TrainingPlanManagementProps) {
  const router = useRouter();
  const toast = useToast();
  const { logout } = useAuthActions();
  const user = useAuthenticatedUser();
  const username = user?.username ?? "";
  const isEmployeeBelowSectionHead =
    user?.roleCode === "EMPLOYEE" && !isSectionHeadOrAbove(user);

  useEffect(() => {
    if (isEmployeeBelowSectionHead) {
      toast.error("ตำแหน่งของคุณไม่ถึงที่จะเข้าลิ้งค์ (คุณมีตำแหน่งไม่ถึงที่จะส่งคนเข้าอบรม)");
    }
  }, [isEmployeeBelowSectionHead, toast]);

  const { selectedItem, openSection, goToGrid } = useSectionNavigation(
    "/training-plan",
    planItems,
    selectedSlug,
  );
  const SelectedModule = selectedItem?.Component;
  const trainingOapItem = planItems.find((item) => item.title === "Training OAP");

  const handleBack = () => {
    if (selectedItem) {
      goToGrid();
      return;
    }

    router.push("/");
  };

  if (isEmployeeBelowSectionHead) {
    return (
      <main className={styles.page}>
        <Navbar
          username={username}
          contextTitle="Access Denied"
          onBack={() => router.push("/")}
          onHome={() => router.push("/")}
          onLogout={logout}
        />
        <div className={styles.accessDeniedContainer}>
          <div className={styles.accessDeniedCard}>
            <div className={styles.accessDeniedIconWrap}>
              <span className={styles.accessDeniedBigIcon}>🚫</span>
            </div>
            <h1 className={styles.accessDeniedMainTitle}>ตำแหน่งของคุณไม่ถึงที่จะเข้าลิ้งค์</h1>
            <p className={styles.accessDeniedSubTitle}>
              ไม่อนุญาตให้เข้าใช้งาน — คุณมีตำแหน่งไม่ถึงที่จะส่งคนเข้าอบรม
            </p>
            <div className={styles.accessDeniedDivider} />
            <p className={styles.accessDeniedDescription}>
              ลิ้งก์นี้จัดทำขึ้นสำหรับหัวหน้างานระดับ <strong>Section Head (ผู้จัดการแผนก) ขึ้นไป</strong> เท่านั้น เพื่อใช้ในการคัดเลือกและเสนอชื่อพนักงานในสังกัดเข้าร่วมการฝึกอบรม
            </p>
            <div className={styles.accessDeniedProfileCard}>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>ผู้ใช้งาน:</span>
                <span className={styles.profileValue}>{user?.displayName || user?.username} ({user?.employeeCode || "-"})</span>
              </div>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>ตำแหน่งของคุณ:</span>
                <span className={styles.profileValueHighlight}>
                  {user?.positionName || user?.positionCode || "-"} ({user?.levelCode || user?.levelName || "-"})
                </span>
              </div>
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>สังกัด:</span>
                <span className={styles.profileValue}>{user?.companyName || user?.companyCode || "-"} / {user?.functionName || user?.functionCode || "-"}</span>
              </div>
            </div>
            <div className={styles.accessDeniedActionRow}>
              <button
                type="button"
                className={styles.backToHomeBtn}
                onClick={() => router.push("/")}
              >
                🏠 กลับสู่หน้าหลักของคุณ (Home Dashboard)
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Navbar
        username={username}
        contextTitle={
          selectedItem
            ? `Training Plan Management / ${selectedItem.title}`
            : "Training Plan Management"
        }
        contextItems={planItems.map((item) => ({
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
          <span className={styles.sectionBadge}>Planning Workspace</span>
        </div>
        <div className={styles.heroPanel}>
          <div>
            <p className={styles.kicker} translate="no">Training Plan</p>
            <h1 translate="no">{selectedItem ? selectedItem.title : "Training Plan Management"}</h1>
            <p>
              Prepare annual training plans, rolling schedules, training needs, and acceptance surveys for the HRD workflow.
            </p>
          </div>
        </div>
      </section>

      {SelectedModule ? (
        <SelectedModule
          onOpenTrainingOap={() => {
            if (trainingOapItem) {
              openSection(trainingOapItem);
            }
          }}
          username={username}
          initialCourseId={initialCourseId}
        />
      ) : (
        <section className={styles.moduleSection} aria-label="Training Plan Management modules">
          <div className={styles.moduleHeader}>
            <div>
              <span>Plan Setup</span>
              <h2 translate="no">Select a workspace</h2>
            </div>
            <p>{planItems.length} modules</p>
          </div>

          <div className={styles.moduleGrid}>
            {planItems.map((item, index) => (
              <button
                className={`${styles.moduleCard} ${item.locked ? styles.lockedCard : ""}`}
                key={item.title}
                type="button"
                onClick={() => {
                  if (item.locked) {
                    // No module carries locked:true today. The message names the module it blocks
                    // rather than a fixed one, so re-locking anything says the right thing.
                    toast.warning(`${item.title} ถูกล็อกการใช้งานไว้ชั่วคราว`);
                    return;
                  }
                  openSection(item);
                }}
              >
                <span className={styles.moduleIcon} aria-hidden="true">
                  <span>{item.icon}</span>
                </span>
                <span className={styles.cardIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className={styles.cardSubtitle} translate="no">{item.subtitle}</span>
                  <h3 translate="no">
                    {item.title}
                    {item.locked ? <span className={styles.lockedTag}>🔒 Locked</span> : null}
                  </h3>
                  <p>{item.description}</p>
                </div>
                <strong>{item.locked ? "🔒 Locked" : "Open"}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
