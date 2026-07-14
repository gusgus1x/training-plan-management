import { useState } from "react";
import { externalRecordRequests, recordCourses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type RecordModuleProps = {
  completedHours: number;
  onBack: () => void;
};

const recordYears = ["2026", "2027"] as const;

const recordMonths = [
  { value: "all", label: "ทั้งปี" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

export default function RecordModule({ completedHours, onBack }: RecordModuleProps) {
  const [selectedRecordYear, setSelectedRecordYear] = useState<(typeof recordYears)[number]>("2026");
  const [selectedRecordMonth, setSelectedRecordMonth] = useState<(typeof recordMonths)[number]["value"]>("all");

  const visibleRecordCourses = recordCourses.filter(
    (course) =>
      course.year === selectedRecordYear &&
      (selectedRecordMonth === "all" || course.month === selectedRecordMonth),
  );

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Record"
        title="User Record Dashboard"
        detail="ตรวจสอบประวัติอบรมในระบบ ทำแบบทดสอบ/แบบประเมิน และส่งคำขอรับรอง record ภายนอก"
        onBack={onBack}
      />

      <div className={styles.recordSummary}>
        <article>
          <span>ชั่วโมงสะสม</span>
          <strong>{completedHours}</strong>
        </article>
        <article>
          <span>ผ่านแล้ว</span>
          <strong>2</strong>
        </article>
        <article>
          <span>รอยืนยัน</span>
          <strong>1</strong>
        </article>
      </div>

      <div className={styles.recordWorkflow}>
        <article>
          <small>Step 1</small>
          <strong>แสดงรายละเอียดที่เข้าอบรม</strong>
          <span>ระบบแสดงหลักสูตร วันที่อบรม ผลการอบรม และสถานะการประเมิน</span>
        </article>
        <article>
          <small>Decision</small>
          <strong>สำเร็จหรือไม่</strong>
          <span>ถ้าผ่านจะแสดงว่าสำเร็จ ถ้าไม่ผ่านให้ทำ pre/post test หรือแบบประเมิน</span>
        </article>
        <article>
          <small>External record</small>
          <strong>Request training record</strong>
          <span>กรณีอบรมนอกระบบหรือจากที่ทำงานเดิม ส่งให้ HRD ตรวจสอบก่อนรับรองผล</span>
        </article>
      </div>

      <div className={styles.recordLayout}>
        <section className={styles.recordPanel} aria-label="Training record in system">
          <div className={styles.panelHeader}>
            <div>
              <p>System Record</p>
              <h2>รายการอบรมในระบบ</h2>
            </div>
            <span>{visibleRecordCourses.length} courses</span>
          </div>

          <div className={styles.recordFilters}>
            <label>
              <span>ปี</span>
              <select
                value={selectedRecordYear}
                onChange={(event) =>
                  setSelectedRecordYear(event.target.value as (typeof recordYears)[number])
                }
              >
                {recordYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <label>
              <span>เดือน</span>
              <select
                value={selectedRecordMonth}
                onChange={(event) =>
                  setSelectedRecordMonth(event.target.value as (typeof recordMonths)[number]["value"])
                }
              >
                {recordMonths.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.recordCourseList}>
            {visibleRecordCourses.map((item) => (
              <article key={item.course}>
                <div>
                  <strong>{item.course}</strong>
                  <span>{item.date}</span>
                </div>
                <b>{item.result}</b>
                <span>{item.assessment}</span>
                <button type="button">{item.action}</button>
              </article>
            ))}
            {visibleRecordCourses.length === 0 ? (
              <div className={styles.recordEmpty}>ไม่มีรายการอบรมในช่วงเวลานี้</div>
            ) : null}
          </div>
        </section>

        <section className={styles.recordPanel} aria-label="Request external training record">
          <div className={styles.panelHeader}>
            <div>
              <p>Request Record</p>
              <h2>ขอรับรองประวัติอบรมภายนอก</h2>
            </div>
            <span>HRD</span>
          </div>

          <form className={styles.recordRequestForm}>
            <label>
              ชื่อหลักสูตร
              <input type="text" defaultValue="Forklift Safety Training" />
            </label>
            <label>
              แหล่งที่มา
              <select defaultValue="external">
                <option value="external">อบรมนอกบริษัท</option>
                <option value="previous">ประวัติจากที่ทำงานเดิม</option>
              </select>
            </label>
            <label>
              หมายเหตุ/หลักฐาน
              <textarea defaultValue="แนบใบประกาศหรือเอกสารรับรองเพื่อให้ HRD ตรวจสอบ" />
            </label>
            <div className={styles.recordReasonBox}>
              <span>สาเหตุ</span>
              <strong>ใช้เป็นหลักฐานยืนยันการเข้าอบรมและแนบเอกสารรับรองให้ HRD ตรวจสอบ</strong>
            </div>
            <button type="button">ส่งคำขอรับรอง</button>
          </form>

          <div className={styles.externalRecordList}>
            {externalRecordRequests.map((item) => (
              <article key={item.course}>
                <div>
                  <strong>{item.course}</strong>
                  <span>{item.source}</span>
                </div>
                <b>{item.status}</b>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
