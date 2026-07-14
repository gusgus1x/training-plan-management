"use client";

import { useState } from "react";
import { roadmapItems } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type RoadmapModuleProps = {
  onBack: () => void;
};

export default function RoadmapModule({ onBack }: RoadmapModuleProps) {
  const [selectedCourseCode, setSelectedCourseCode] =
    useState<(typeof roadmapItems)[number]["code"]>(roadmapItems[0].code);
  const selectedCourse =
    roadmapItems.find((item) => item.code === selectedCourseCode) ?? roadmapItems[0];

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Roadmap"
        title="หลักสูตรที่ควรอบรม"
        detail="แสดงหลักสูตรที่ระบบแนะนำให้ลงทะเบียนตามตำแหน่ง แผนก และหลักสูตรบังคับ"
        onBack={onBack}
      />

      <div className={styles.roadmapGrid}>
        {roadmapItems.map((item) => (
          <article
            className={item.code === selectedCourseCode ? styles.activeRoadmapItem : ""}
            key={item.title}
          >
            <div className={styles.roadmapContent}>
              <small>{item.category}</small>
              <strong>{item.title}</strong>
              <span>
                {item.due} / {item.round} / {item.type}
              </span>
            </div>
            <div className={styles.roadmapMeta}>
              <b>{item.status}</b>
              <em>ภายใน {item.due}</em>
            </div>
            <div className={styles.trainingActions}>
              <button
                className={styles.secondaryActionButton}
                type="button"
                onClick={() => setSelectedCourseCode(item.code)}
              >
                ดูรายละเอียด
              </button>
              <button type="button">ลงทะเบียน</button>
            </div>
          </article>
        ))}
      </div>

      <section className={styles.courseDetailPanel} aria-label="Recommended course detail">
        <p>รายละเอียดเกี่ยวกับ Course</p>
        <span>{selectedCourse.detail}</span>
        <dl className={styles.courseDetailGrid}>
          <div>
            <dt>รหัสคอร์ส</dt>
            <dd>{selectedCourse.code}</dd>
          </div>
          <div>
            <dt>ชื่อคอร์ส</dt>
            <dd>{selectedCourse.title}</dd>
          </div>
          <div>
            <dt>รุ่นอบรม</dt>
            <dd>{selectedCourse.round}</dd>
          </div>
          <div>
            <dt>Status ว่าอบรมหรือยัง</dt>
            <dd>{selectedCourse.trainingStatus}</dd>
          </div>
          <div>
            <dt>ประเภทคอร์ส</dt>
            <dd>{selectedCourse.type}</dd>
          </div>
          <div>
            <dt>งบประมาณ</dt>
            <dd>{selectedCourse.budget}</dd>
          </div>
          <div>
            <dt>วิทยากร</dt>
            <dd>{selectedCourse.trainer}</dd>
          </div>
          <div>
            <dt>หน่วยงานจัดอบรม</dt>
            <dd>{selectedCourse.owner}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
