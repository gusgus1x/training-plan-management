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
  contextTitle?: string;
  contextItems?: Array<{
    title: string;
    active: boolean;
    onClick: () => void;
  }>;
  onBack?: () => void;
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
  contextTitle,
  contextItems,
  onBack,
  onHome,
  onLogout,
}: DashboardLayoutProps) {
  return (
    <main className={pageClassName}>
      <Navbar
        username={username}
        userLevel={userLevel}
        company={company}
        contextTitle={contextTitle}
        contextItems={contextItems}
        onBack={onBack}
        onHome={onHome}
        onLogout={onLogout}
      />
      <section className={workspaceClassName} aria-label={workspaceLabel}>
        {children}
      </section>
    </main>
  );
}
