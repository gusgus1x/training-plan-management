"use client";

import { useState } from "react";
import { availableCourses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type RegisterTrainingModuleProps = {
  onBack: () => void;
};

export default function RegisterTrainingModule({ onBack }: RegisterTrainingModuleProps) {
  const [selectedCourseId, setSelectedCourseId] =
    useState<(typeof availableCourses)[number]["id"]>(availableCourses[0].id);
  const selectedCourse =
    availableCourses.find((course) => course.id === selectedCourseId) ?? availableCourses[0];

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Register Training"
        title="Regiser Training"
        detail="แสดงหลักสูตรในระบบรายบุคคล เลือกหลักสูตร และรอ HRD อนุมัติ"
        onBack={onBack}
      />

      <div className={styles.trainingList}>
        {availableCourses.map((course) => (
          <article
            className={`${styles.trainingItem} ${
              course.id === selectedCourseId ? styles.activeTrainingItem : ""
            }`}
            key={course.id}
          >
            <div>
              <small>{course.category}</small>
              <strong>{course.title}</strong>
              <span>
                {course.date} / {course.time} / {course.place} / {course.seats}
              </span>
            </div>
            <b>{course.status}</b>
            <div className={styles.trainingActions}>
              <button
                className={styles.secondaryActionButton}
                type="button"
                onClick={() => setSelectedCourseId(course.id)}
              >
                ดูรายละเอียด
              </button>
              <button type="button">ลงทะเบียน</button>
            </div>
          </article>
        ))}
      </div>

      <section className={styles.courseDetailPanel} aria-label="Course detail">
        <p>รายละเอียดเกี่ยวกับ Course</p>
        <span>{selectedCourse.description}</span>
        <dl className={styles.courseDetailGrid}>
          <div>
            <dt>รหัสคอร์ส</dt>
            <dd>{selectedCourse.id}</dd>
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

      <ol className={styles.flowSteps}>
        <li className={styles.currentStep}>แสดงหลักสูตรในระบบรายบุคคล</li>
        <li className={styles.currentStep}>เลือกหลักสูตรและส่งตรวจสอบ</li>
        <li>รอ HRD อนุมัติ</li>
        <li>แสดงผลอนุมัติและบันทึกประวัติ</li>
      </ol>
    </section>
  );
}
