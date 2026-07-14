import { requestStatuses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type RequestTrainingModuleProps = {
  onBack: () => void;
  reason: string;
  setReason: (value: string) => void;
  setTrainingNeed: (value: string) => void;
  trainingNeed: string;
};

export default function RequestTrainingModule({
  onBack,
  reason,
  setReason,
  setTrainingNeed,
  trainingNeed,
}: RequestTrainingModuleProps) {
  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Request Training Need"
        title="ส่งความต้องการอบรม"
        detail="ส่ง training need ไป HRD Center และติดตามผลอนุมัติจาก HRD Center"
        onBack={onBack}
      />

      <div className={styles.requestLayout}>
        <form className={styles.requestForm}>
          <label>
            หลักสูตรที่ต้องการ
            <input
              type="text"
              value={trainingNeed}
              onChange={(event) => setTrainingNeed(event.target.value)}
            />
          </label>
          <label>
            เหตุผลการอบรม
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="button">ส่ง Training Need</button>
        </form>

        <div className={styles.requestPreview}>
          <article>
            <p>Preview request</p>
            <h3>{trainingNeed || "ระบุหลักสูตรที่ต้องการ"}</h3>
            <span>{reason || "ระบุเหตุผลการอบรม"}</span>
          </article>

          <div className={styles.approvalTimeline}>
            {requestStatuses.map((item) => (
              <article key={item.title}>
                <b>{item.status}</b>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.owner}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
