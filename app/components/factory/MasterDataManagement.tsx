"use client";

import { useState } from "react";
import Navbar from "../Navbar";
import styles from "./MasterDataManagement.module.css";

const masterDataItems = [
  {
    title: "Company Data",
    subtitle: "รายชื่อบริษัท",
    description: "จัดการข้อมูลบริษัทหลักที่ใช้ในระบบ",
  },
  {
    title: "Funtion Data",
    subtitle: "รายชื่อหน่วยงาน",
    description: "จัดการข้อมูลหน่วยงานสำหรับโครงสร้างองค์กร",
  },
  {
    title: "Funtion Mapping",
    subtitle: "รายชื่อหน่วยงาน Mapping",
    description: "เชื่อมโยงหน่วยงานกับโครงสร้างหรือรหัสที่เกี่ยวข้อง",
  },
  {
    title: "Position Data",
    subtitle: "รายชื่อตำแหน่งงาน",
    description: "จัดการข้อมูลตำแหน่งงานที่ใช้ในระบบ",
  },
  {
    title: "Level Data",
    subtitle: "รายชื่อระดับ",
    description: "กำหนดระดับหรือขั้นของข้อมูลบุคลากร",
  },
  {
    title: "Employee Data",
    subtitle: "รายชื่อพนักงาน",
    description: "จัดการข้อมูลพนักงานทั้งหมดในระบบ",
  },
  {
    title: "Instructor Data",
    subtitle: "รายชื่อวิทยากร",
    description: "จัดการข้อมูลวิทยากรภายในและภายนอก",
  },
] as const;

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
        <p className={styles.kicker}>Master Data Management</p>
        <h1>{selectedItem ? selectedItem.title : "Master Data Management"}</h1>
      </section>

      {selectedItem ? (
        <section className={styles.blankWorkspace} aria-label={`${selectedItem.title} page`}>
          <div className={styles.blankCanvas} />
        </section>
      ) : (
        <section className={styles.masterGrid} aria-label="Master data management menu">
          {masterDataItems.map((item) => (
            <button
              key={item.title}
              className={`${styles.masterCard} ${styles.clickableCard}`}
              type="button"
              onClick={() => setSelectedItem(item)}
            >
              <span className={styles.badge}>{item.subtitle}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
