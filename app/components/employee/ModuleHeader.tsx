import type { ReactNode } from "react";
import shell from "../shared/ModuleShell.module.css";

type ModuleHeaderProps = {
  eyebrow?: string;
  title: string;
  detail?: string;
  /** Right-hand column of the hero, the way HRD modules carry their permission note. */
  aside?: ReactNode;
};

export default function ModuleHeader({
  eyebrow = "Employee Workspace",
  title,
  detail,
  aside,
}: ModuleHeaderProps) {
  return (
    <section className={shell.moduleHero}>
      <div>
        <p className={shell.panelKicker}>{eyebrow}</p>
        <h2>{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </section>
  );
}
