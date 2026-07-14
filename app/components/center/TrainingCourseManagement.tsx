"use client";

import { useState } from "react";
import Navbar from "../Navbar";
import styles from "./TrainingCourseManagement.module.css";

const courseItems = [
  {
    title: "Course Type",
    subtitle: "หมวดหมู่หลักสูตร",
    description: "จัดกลุ่มประเภทของหลักสูตรสำหรับการใช้งานภายในระบบ",
  },
  {
    title: "Course Group",
    subtitle: "กลุ่มของหลักสูตร",
    description: "จัดกลุ่มหลักสูตรตามสายงาน แผนก หรือระดับการเรียนรู้",
  },
  {
    title: "Course Master",
    subtitle: "ข้อมูลหลักสูตร",
    description: "จัดการข้อมูลหลักสูตรหลัก เช่น รหัส ชื่อ ระยะเวลา และผู้รับผิดชอบ",
  },
  {
    title: "Course Standard",
    subtitle: "หลักสูตรตามมาตรฐาน",
    description: "กำหนดหลักสูตรที่ต้องอบรมตามมาตรฐานและข้อบังคับ",
  },
] as const;

type TrainingCourseManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function TrainingCourseManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: TrainingCourseManagementProps) {
  const [selectedCourseItem, setSelectedCourseItem] = useState<(typeof courseItems)[number] | null>(
    null,
  );

  const handleBack = () => {
    if (selectedCourseItem) {
      setSelectedCourseItem(null);
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
        <p className={styles.kicker}>Training Course Management</p>
        <h1>{selectedCourseItem ? selectedCourseItem.title : "Training Course Management"}</h1>
      </section>

      {selectedCourseItem ? (
        <section className={styles.blankWorkspace} aria-label={`${selectedCourseItem.title} page`}>
          <div className={styles.blankCanvas} />
        </section>
      ) : (
        <section className={styles.courseGrid} aria-label="Training course management menu">
          {courseItems.map((item) => (
            <button
              key={item.title}
              className={`${styles.courseCard} ${styles.clickableCard}`}
              type="button"
              onClick={() => setSelectedCourseItem(item)}
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
