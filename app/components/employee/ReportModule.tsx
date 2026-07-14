import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type ReportModuleProps = {
  completedHours: number;
  onBack: () => void;
};

const receiveItems = [
  { title: "รายงานอบรมรายบุคคล", detail: "สรุปหลักสูตรที่ผ่านและชั่วโมงสะสม", status: "พร้อมดู" },
  { title: "ผลตรวจสอบข้อมูล", detail: "HRD Center ตรวจสอบข้อมูลล่าสุดแล้ว", status: "รับแล้ว" },
  { title: "ไฟล์รายงาน", detail: "PDF / Excel สำหรับดาวน์โหลด", status: "2 files" },
] as const;

export default function ReportModule({ completedHours, onBack }: ReportModuleProps) {
  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="User Report"
        title="ส่งข้อมูล / รับข้อมูล"
        detail="หน้าสำหรับส่งข้อมูลรายงานให้ HRD Center และรับข้อมูลรายงานกลับ"
        onBack={onBack}
      />

      <div className={styles.reportWorkspace}>
        <section className={styles.reportControlPanel} aria-label="Send report data">
          <div className={styles.panelHeader}>
            <div>
              <p>Send Data</p>
              <h2>ส่งข้อมูล</h2>
            </div>
            <span>To HRD Center</span>
          </div>

          <form className={styles.recordRequestForm}>
            <label>
              ประเภทข้อมูล
              <select defaultValue="training-summary">
                <option value="training-summary">ข้อมูลสรุปการอบรม</option>
                <option value="training-hours">ข้อมูลชั่วโมงอบรม</option>
                <option value="training-record">ข้อมูลประวัติอบรม</option>
              </select>
            </label>
            <label>
              รายละเอียดที่ต้องการส่ง
              <textarea defaultValue="ส่งข้อมูลรายงานการอบรมรายบุคคลเพื่อให้ HRD Center ตรวจสอบ" />
            </label>
            <label>
              จำนวนชั่วโมงอบรมปัจจุบัน
              <input type="text" defaultValue={`${completedHours} hours`} />
            </label>
            <button type="button">ส่งข้อมูล</button>
          </form>
        </section>

        <section className={styles.reportResultPanel} aria-label="Receive report data">
          <div className={styles.panelHeader}>
            <div>
              <p>Receive Data</p>
              <h2>รับข้อมูล</h2>
            </div>
            <span>From HRD Center</span>
          </div>

          <div className={styles.savedReportList}>
            {receiveItems.map((item) => (
              <article key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
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
