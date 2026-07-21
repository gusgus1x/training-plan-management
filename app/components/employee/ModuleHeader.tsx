import styles from "./UserDashboard.module.css";

type ModuleHeaderProps = {
  eyebrow?: string;
  title: string;
  detail?: string;
};

export default function ModuleHeader({
  eyebrow = "Employee Workspace",
  title,
  detail,
}: ModuleHeaderProps) {
  return (
    <div className={styles.moduleHeader}>
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}
