import type { ReactNode } from "react";
import Navbar from "./Navbar";

type DashboardLayoutProps = {
  children: ReactNode;
  pageClassName: string;
  workspaceClassName: string;
  workspaceLabel: string;
  username: string;
  userLevel?: "Admin" | "User";
  company?: string;
  onHome: () => void;
  onLogout: () => void;
};

export default function DashboardLayout({
  children,
  pageClassName,
  workspaceClassName,
  workspaceLabel,
  username,
  userLevel,
  company,
  onHome,
  onLogout,
}: DashboardLayoutProps) {
  return (
    <main className={pageClassName}>
      <Navbar
        username={username}
        userLevel={userLevel}
        company={company}
        onHome={onHome}
        onLogout={onLogout}
      />
      <section className={workspaceClassName} aria-label={workspaceLabel}>
        {children}
      </section>
    </main>
  );
}
