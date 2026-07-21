import { requestStatuses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type RequestTrainingModuleProps = {
  reason: string;
  setReason: (value: string) => void;
  setTrainingNeed: (value: string) => void;
  trainingNeed: string;
};

export default function RequestTrainingModule({
  reason,
  setReason,
  setTrainingNeed,
  trainingNeed,
}: RequestTrainingModuleProps) {
  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Request Training Need"
        title="Request Training Need"
        detail="Submit a training need to HRD Center and follow the approval progress."
      />

      <div className={styles.requestLayout}>
        <form className={styles.requestForm}>
          <label>
            Course Needed
            <input
              type="text"
              value={trainingNeed}
              onChange={(event) => setTrainingNeed(event.target.value)}
              placeholder="Enter course or skill topic"
            />
          </label>
          <label>
            Request Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this training is needed"
            />
          </label>
          <button type="button">Submit Training Need</button>
        </form>

        <div className={styles.requestPreview}>
          <article>
            <p>Preview Request</p>
            <h3>{trainingNeed || "Course name will appear here"}</h3>
            <span>{reason || "Request reason will appear here"}</span>
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
