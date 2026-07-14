import styles from "./UserDashboard.module.css";

type ModuleHeaderProps = {
  eyebrow?: string;
  title: string;
  detail?: string;
  onBack: () => void;
};

export default function ModuleHeader({ title, onBack }: ModuleHeaderProps) {
  return (
    <div className={styles.moduleHeader}>
      <div>
        <h1>{title}</h1>
      </div>
      <button type="button" onClick={onBack}>
        กลับ Dashboard
      </button>
    </div>
  );
}
