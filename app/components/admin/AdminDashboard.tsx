"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import logoImage from "../../photo/logo.png";
import { useAuthActions } from "../AuthActionsContext";
import { useAuthenticatedUser } from "../AuthenticatedUserContext";
import {
  createUserAccount,
  deleteUserAccount,
  listUserAccounts,
  resetUserAccountPassword,
  updateUserAccount,
  UserAccountClientError,
} from "../../lib/userAccounts/client";
import { listCompanies } from "../../lib/companies/client";
import type { CompanyRecord } from "../../lib/companies/types";
import {
  USER_ACCOUNT_STATUSES,
  type UserAccountRecord,
  type UserAccountStatus,
} from "../../lib/userAccounts/types";
import { ROLE_CODES, type RoleCode } from "../../lib/auth/types";
import {
  listAuditLogs,
  listActiveUsers,
  sendHeartbeat,
  type AuditLogRecord,
  type ActiveUserSession,
} from "../../lib/audit/client";
import styles from "./AdminDashboard.module.css";

type TabKey = "dashboard" | "users" | "audit" | "charts" | "tables";

const needsCompany = (roleCode: RoleCode) => roleCode === "HRD_FACTORY";
const needsEmployee = (roleCode: RoleCode) => roleCode === "EMPLOYEE";

type CreateFormState = {
  username: string;
  password: string;
  roleCode: RoleCode;
  companyId: string;
  employeeId: string;
  email: string;
};

const emptyCreateForm: CreateFormState = {
  username: "",
  password: "",
  roleCode: "HRD_FACTORY",
  companyId: "",
  employeeId: "",
  email: "",
};

export default function AdminDashboard() {
  const { logout } = useAuthActions();
  const currentUser = useAuthenticatedUser();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("dark", next === "dark");
    }
  };

  // Accounts & Master data state
  const [accounts, setAccounts] = useState<UserAccountRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleCode>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserAccountStatus>("all");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm);

  const [editingAccount, setEditingAccount] = useState<UserAccountRecord | null>(null);
  const [editForm, setEditForm] = useState({
    roleCode: "HRD_FACTORY" as RoleCode,
    companyId: "",
    employeeId: "",
    email: "",
    status: "ACTIVE" as UserAccountStatus,
  });

  const [resetAccount, setResetAccount] = useState<UserAccountRecord | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmValue, setResetConfirmValue] = useState("");

  const [deleteAccount, setDeleteAccount] = useState<UserAccountRecord | null>(null);

  // ════════════════════ AUDIT LOGS & ONLINE USERS STATE ════════════════════
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditCategory, setAuditCategory] = useState("all");
  const [auditRole, setAuditRole] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogRecord | null>(null);

  const [activeSessions, setActiveSessions] = useState<ActiveUserSession[]>([]);
  const [activeStats, setActiveStats] = useState({ onlineCount: 0, idleCount: 0, totalActive: 0 });
  const [isActiveLoading, setIsActiveLoading] = useState(false);

  // Load accounts and companies on mount
  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await listUserAccounts();
      setAccounts(res.accounts ?? []);
    } catch (err) {
      setError(err instanceof UserAccountClientError ? err.message : "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsAuditLoading(true);
    try {
      const res = await listAuditLogs({
        page: auditPage,
        limit: 15,
        category: auditCategory,
        role: auditRole,
        search: auditSearch,
        from: auditFrom || undefined,
        to: auditTo || undefined,
      });
      setAuditLogs(res.logs ?? []);
      setAuditTotal(res.total ?? 0);
      setAuditTotalPages(res.totalPages ?? 1);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const loadActiveUsers = async () => {
    setIsActiveLoading(true);
    try {
      const res = await listActiveUsers();
      setActiveSessions(res.sessions ?? []);
      setActiveStats({
        onlineCount: res.onlineCount ?? 0,
        idleCount: res.idleCount ?? 0,
        totalActive: res.totalActive ?? 0,
      });
    } catch (err) {
      console.error("Failed to load active users", err);
    } finally {
      setIsActiveLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
    void listCompanies()
      .then((res) => setCompanies(res.items ?? []))
      .catch(() => setCompanies([]));
  }, []);

  // Send activity heartbeat on mount and tab switch
  useEffect(() => {
    const pageName =
      activeTab === "dashboard"
        ? "ภาพรวม (Dashboard)"
        : activeTab === "users"
        ? "จัดการผู้ใช้งาน (User Accounts)"
        : activeTab === "audit"
        ? "Audit Logs & ผู้ใช้ออนไลน์"
        : activeTab;
    void sendHeartbeat(pageName);
  }, [activeTab]);

  // Load audit and active users when switching to audit tab or filters change
  useEffect(() => {
    if (activeTab === "audit") {
      void loadAuditLogs();
      void loadActiveUsers();
    }
  }, [activeTab, auditPage, auditCategory, auditRole]);

  // Periodic poll for active users every 10 seconds when on audit tab
  useEffect(() => {
    if (activeTab !== "audit") return;
    const interval = setInterval(() => {
      void loadActiveUsers();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);


  // Filtered accounts
  const visibleAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (statusFilter !== "all" && acc.status !== statusFilter) return false;
      if (roleFilter !== "all" && acc.roleCode !== roleFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const haystack = [
        acc.username,
        acc.email,
        acc.companyCode,
        acc.roleCode,
        acc.roleName,
        acc.employeeName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [accounts, searchTerm, statusFilter, roleFilter]);

  // Statistics calculation for dashboard cards
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => a.status === "ACTIVE").length;
    const inactive = accounts.filter((a) => a.status !== "ACTIVE").length;
    const admins = accounts.filter((a) => a.roleCode === "ADMIN").length;
    return { total, active, inactive, admins };
  }, [accounts]);

  // Paginated accounts
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * entriesPerPage;
    return visibleAccounts.slice(start, start + entriesPerPage);
  }, [visibleAccounts, currentPage, entriesPerPage]);

  const totalPages = Math.max(1, Math.ceil(visibleAccounts.length / entriesPerPage));

  // ── Handlers ──
  const handleOpenCreate = () => {
    setCreateForm(emptyCreateForm);
    setError(null);
    setMessage(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.password) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await createUserAccount({
        username: createForm.username.trim(),
        password: createForm.password,
        roleCode: createForm.roleCode,
        companyId: needsCompany(createForm.roleCode) ? createForm.companyId || null : null,
        employeeId: needsEmployee(createForm.roleCode) ? createForm.employeeId || null : null,
        email: createForm.email.trim() || null,
        status: "ACTIVE",
      });
      setMessage(`สร้างบัญชีผู้ใช้ "${createForm.username.trim()}" สำเร็จเรียบร้อย`);
      setIsCreateOpen(false);
      setCreateForm(emptyCreateForm);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof UserAccountClientError ? err.message : "เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (account: UserAccountRecord) => {
    setEditingAccount(account);
    setEditForm({
      roleCode: account.roleCode,
      companyId: account.companyId ?? "",
      employeeId: account.employeeId ?? "",
      email: account.email ?? "",
      status: account.status,
    });
    setError(null);
    setMessage(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await updateUserAccount(editingAccount.userId, {
        roleCode: editForm.roleCode,
        companyId: needsCompany(editForm.roleCode) ? editForm.companyId || null : null,
        employeeId: needsEmployee(editForm.roleCode) ? editForm.employeeId || null : null,
        email: editForm.email.trim() || null,
        status: editForm.status,
      });
      setMessage(`อัปเดตข้อมูลบัญชี "${editingAccount.username}" เรียบร้อยแล้ว`);
      setEditingAccount(null);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof UserAccountClientError ? err.message : "เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReset = (account: UserAccountRecord) => {
    setResetAccount(account);
    setResetPasswordValue("");
    setResetConfirmValue("");
    setError(null);
    setMessage(null);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetAccount) return;

    if (resetPasswordValue.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (resetPasswordValue !== resetConfirmValue) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await resetUserAccountPassword(resetAccount.userId, resetPasswordValue);
      setMessage(`รีเซ็ตรหัสผ่านสำหรับ "${resetAccount.username}" สำเร็จ`);
      setResetAccount(null);
    } catch (err) {
      setError(err instanceof UserAccountClientError ? err.message : "เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (account: UserAccountRecord) => {
    setDeleteAccount(account);
    setError(null);
    setMessage(null);
  };

  const handleDeleteSubmit = async () => {
    if (!deleteAccount) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await deleteUserAccount(deleteAccount.userId);
      setMessage(`ลบบัญชีผู้ใช้ "${deleteAccount.username}" สำเร็จเรียบร้อย`);
      setDeleteAccount(null);
      await loadAccounts();
    } catch (err) {
      const errMsg = err instanceof UserAccountClientError ? err.message : "ไม่สามารถลบบัญชีผู้ใช้ได้";
      setError(
        errMsg.includes("Foreign key") || errMsg.includes("FK_") || errMsg.includes("547")
          ? "ไม่สามารถลบบัญชีนี้ได้เนื่องจากมีข้อมูลประวัติที่เกี่ยวข้องในระบบ แนะนำให้แก้ไขสถานะเป็น 'INACTIVE' แทน"
          : errMsg,
      );
      setDeleteAccount(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRoleBadge = (roleCode: RoleCode) => {
    switch (roleCode) {
      case "ADMIN":
        return <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>ADMIN</span>;
      case "HRD_CENTER":
        return <span className={`${styles.roleBadge} ${styles.roleCenter}`}>HRD CENTER</span>;
      case "HRD_FACTORY":
        return <span className={`${styles.roleBadge} ${styles.roleFactory}`}>HRD FACTORY</span>;
      case "EMPLOYEE":
        return <span className={`${styles.roleBadge} ${styles.roleEmployee}`}>พนักงาน (EMP)</span>;
      default:
        return <span className={styles.roleBadge}>{roleCode}</span>;
    }
  };

  const renderStatusBadge = (status: UserAccountStatus) => {
    switch (status) {
      case "ACTIVE":
        return <span className={`${styles.statusBadge} ${styles.statusActive}`}>ใช้งาน</span>;
      case "INACTIVE":
        return <span className={`${styles.statusBadge} ${styles.statusInactive}`}>ระงับ</span>;
      case "LOCKED":
        return <span className={`${styles.statusBadge} ${styles.statusLocked}`}>ล็อก</span>;
      default:
        return <span className={styles.statusBadge}>{status}</span>;
    }
  };

  const renderAuditCategoryBadge = (category: string) => {
    switch (category) {
      case "AUTH":
        return <span className={`${styles.categoryBadge} ${styles.catAuth}`}>🔐 AUTH</span>;
      case "CREATE":
        return <span className={`${styles.categoryBadge} ${styles.catCreate}`}>＋ CREATE</span>;
      case "UPDATE":
        return <span className={`${styles.categoryBadge} ${styles.catUpdate}`}>✏️ UPDATE</span>;
      case "DELETE":
        return <span className={`${styles.categoryBadge} ${styles.catDelete}`}>🗑️ DELETE</span>;
      case "ACCOUNT":
        return <span className={`${styles.categoryBadge} ${styles.catAccount}`}>👤 ACCOUNT</span>;
      default:
        return <span className={`${styles.categoryBadge} ${styles.catDefault}`}>{category}</span>;
    }
  };


  return (
    <div className={styles.wrapper}>
      {/* ── Top Navbar ── */}
      <nav className={styles.topNav}>
        <div className={styles.brandGroup}>
          <Link href="/admin" className={styles.brand} onClick={() => setActiveTab("dashboard")}>
            <div className={styles.brandLogoWrapper}>
              <Image
                src={logoImage}
                alt="AISIN TAKAOKA THAILAND GROUP"
                className={styles.brandLogo}
                priority
              />
            </div>
            <span className={styles.brandTitle}>Admin</span>
          </Link>
          <button
            className={styles.toggleBtn}
            type="button"
            aria-label="Toggle navigation sidebar"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            ☰
          </button>
        </div>

        <div className={styles.navRight}>
          <form
            className={styles.searchForm}
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search for..."
              aria-label="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className={styles.searchBtn} type="submit" aria-label="Submit search">
              🔍
            </button>
          </form>

          <div className={styles.userMenu}>
            <button
              className={styles.userBtn}
              type="button"
              aria-label="Settings and user menu"
              title="Settings"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
            >
              ⚙️
            </button>

            {isUserMenuOpen ? (
              <div className={styles.userDropdown}>
                <div className={styles.userDropdownHeader}>
                  Signed in as:
                  <strong>{currentUser?.username || "Admin"}</strong>
                </div>
                <button
                  className={styles.userDropdownItem}
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setActiveTab("users");
                  }}
                >
                  👥 Manage Users
                </button>
                <div className={styles.themeSection}>
                  <div className={styles.themeSectionLabel}>
                    <span>🎨 ธีมหน้าจอ (Theme)</span>
                    <span className={styles.themeActiveBadge}>{theme === "dark" ? "🌙 Dark" : "☀️ Light"}</span>
                  </div>
                  <div className={styles.themeSegmentControl}>
                    <button
                      type="button"
                      className={`${styles.themeSegmentBtn} ${theme === "light" ? styles.themeSegmentActive : ""}`}
                      onClick={() => {
                        setTheme("light");
                        localStorage.setItem("theme", "light");
                        document.documentElement.setAttribute("data-theme", "light");
                        document.documentElement.classList.remove("dark");
                        if (typeof document !== "undefined" && document.body) {
                          document.body.classList.remove("dark");
                        }
                      }}
                    >
                      ☀️ Light
                    </button>
                    <button
                      type="button"
                      className={`${styles.themeSegmentBtn} ${theme === "dark" ? styles.themeSegmentActive : ""}`}
                      onClick={() => {
                        setTheme("dark");
                        localStorage.setItem("theme", "dark");
                        document.documentElement.setAttribute("data-theme", "dark");
                        document.documentElement.classList.add("dark");
                        if (typeof document !== "undefined" && document.body) {
                          document.body.classList.add("dark");
                        }
                      }}
                    >
                      🌙 Dark
                    </button>
                  </div>
                </div>
                <button
                  className={`${styles.userDropdownItem} ${styles.logoutBtn}`}
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void logout();
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      {/* ── Body: Sidebar + Main Content ── */}
      <div className={styles.layoutBody}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${isSidebarOpen ? "" : styles.collapsed}`}>
          <div className={styles.sidebarNav}>
            <div className={styles.navHeading}>CORE</div>
            <a
              href="#"
              className={`${styles.navItem} ${activeTab === "dashboard" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("dashboard");
              }}
            >
              <span className={styles.navIcon}>📈</span>
              <span>Dashboard</span>
            </a>

            <div className={styles.navHeading}>INTERFACE</div>
            <a
              href="#"
              className={`${styles.navItem} ${activeTab === "users" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("users");
              }}
            >
              <span className={styles.navIcon}>👥</span>
              <span>User Accounts</span>
            </a>
            <a
              href="#"
              className={`${styles.navItem} ${activeTab === "audit" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("audit");
              }}
            >
              <span className={styles.navIcon}>📜</span>
              <span>Audit Logs</span>
            </a>

            <div className={styles.navHeading}>ADDONS</div>
            <a
              href="#"
              className={`${styles.navItem} ${activeTab === "charts" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("charts");
              }}
            >
              <span className={styles.navIcon}>📊</span>
              <span>Charts</span>
            </a>
            <a
              href="#"
              className={`${styles.navItem} ${activeTab === "tables" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("tables");
              }}
            >
              <span className={styles.navIcon}>📋</span>
              <span>Tables</span>
            </a>
          </div>

          <div className={styles.sidebarFooter}>
            <div>Logged in as:</div>
            <strong>
              {currentUser?.username || "Admin"} ({currentUser?.roleCode || "ADMIN"})
            </strong>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={styles.mainContent}>
          {/* Notifications */}
          {message ? (
            <div className={styles.alertSuccess} role="status">
              <span>✓ {message}</span>
              <button
                className={styles.closeAlertBtn}
                type="button"
                onClick={() => setMessage(null)}
              >
                ×
              </button>
            </div>
          ) : null}

          {error ? (
            <div className={styles.alertError} role="alert">
              <span>⚠ {error}</span>
              <button
                className={styles.closeAlertBtn}
                type="button"
                onClick={() => setError(null)}
              >
                ×
              </button>
            </div>
          ) : null}

          {/* ════════════════════ TAB: USER ACCOUNTS (INTERFACE) ════════════════════ */}
          {activeTab === "users" ? (
            <section aria-label="User Accounts Management">
              <div className={styles.pageHeader}>
                <div className={styles.headerTopRow}>
                  <div>
                    <h1 className={styles.pageTitle}>User Accounts</h1>
                    <nav className={styles.breadcrumb} aria-label="breadcrumb">
                      <Link href="/admin" onClick={() => setActiveTab("dashboard")}>
                        Dashboard
                      </Link>
                      <span className={styles.breadcrumbSeparator}>›</span>
                      <span>Interface</span>
                      <span className={styles.breadcrumbSeparator}>›</span>
                      <span className={styles.breadcrumbActive}>User Accounts</span>
                    </nav>
                  </div>

                  <div className={styles.actionButtonsGroup}>
                    <button
                      className={styles.btnPrimaryAction}
                      type="button"
                      onClick={handleOpenCreate}
                    >
                      <span>＋</span>
                      <span>เพิ่มผู้ใช้งาน (Add User)</span>
                    </button>
                    <button
                      className={styles.btnSecondaryAction}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void loadAccounts()}
                    >
                      <span>{isLoading ? "กำลังโหลด..." : "รีเฟรช"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className={styles.filterCard}>
                <div className={`${styles.filterItem} ${styles.filterSearchInput}`}>
                  <label htmlFor="user-search">
                    <span>ค้นหา (Search):</span>
                  </label>
                  <input
                    id="user-search"
                    className={styles.filterInput}
                    type="search"
                    placeholder="Username, Email, บริษัท, หรือ Role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className={styles.filterItem}>
                  <label htmlFor="user-role-filter">
                    <span>บทบาท (Role):</span>
                  </label>
                  <select
                    id="user-role-filter"
                    className={styles.filterSelect}
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as "all" | RoleCode)}
                  >
                    <option value="all">ทั้งหมด (All Roles)</option>
                    {ROLE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterItem}>
                  <label htmlFor="user-status-filter">
                    <span>สถานะ (Status):</span>
                  </label>
                  <select
                    id="user-status-filter"
                    className={styles.filterSelect}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | UserAccountStatus)}
                  >
                    <option value="all">ทั้งหมด (All Statuses)</option>
                    {USER_ACCOUNT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real Data Table Card */}
              <article className={styles.panelCard}>
                <header className={styles.panelHeader}>
                  <div className={styles.panelHeaderLeft}>
                    <span>รายการบัญชีผู้ใช้ในระบบ</span>
                    <span className={styles.headerCountBadge}>{visibleAccounts.length} บัญชี</span>
                  </div>
                </header>

                <div className={styles.panelBody}>
                  <div className={styles.tableResponsive}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>ผู้ใช้งาน (User)</th>
                          <th>บทบาท (Role)</th>
                          <th>บริษัท (Company)</th>
                          <th>อีเมล (Email)</th>
                          <th>สถานะ (Status)</th>
                          <th>วันที่สร้าง (Created)</th>
                          <th style={{ textAlign: "center" }}>จัดการ (Actions)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAccounts.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#6c757d" }}>
                              {isLoading ? "กำลังดึงข้อมูลจากฐานข้อมูล..." : "ไม่พบบัญชีผู้ใช้ที่ตรงกับเงื่อนไข"}
                            </td>
                          </tr>
                        ) : (
                          paginatedAccounts.map((acc) => (
                            <tr key={acc.userId}>
                              <td style={{ minWidth: "130px" }}>
                                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--ui-30-ink, #0f172a)" }}>
                                  {acc.username}
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "var(--ui-30-muted, #64748b)", marginTop: "2px" }}>
                                  ID: #{acc.userId}
                                </div>
                              </td>
                              <td>{renderRoleBadge(acc.roleCode)}</td>
                              <td style={{ fontWeight: 700 }}>{acc.companyCode || "-"}</td>
                              <td
                                style={{
                                  maxWidth: "200px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={acc.email || undefined}
                              >
                                {acc.email || "-"}
                              </td>
                              <td>{renderStatusBadge(acc.status)}</td>
                              <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                                {new Date(acc.createdAt).toLocaleDateString("th-TH", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td>
                                <div className={styles.actionsCell} style={{ justifyContent: "center" }}>
                                  <button
                                    className={`${styles.actionIconBtn} ${styles.editBtn}`}
                                    type="button"
                                    title="แก้ไขข้อมูล (Edit)"
                                    onClick={() => handleOpenEdit(acc)}
                                  >
                                    แก้ไข
                                  </button>
                                  <button
                                    className={`${styles.actionIconBtn} ${styles.keyBtn}`}
                                    type="button"
                                    title="รีเซ็ตรหัสผ่าน (Reset Password)"
                                    onClick={() => handleOpenReset(acc)}
                                  >
                                    รีเซ็ตรหัส
                                  </button>
                                  <button
                                    className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                                    type="button"
                                    title="ลบบัญชีผู้ใช้ (Delete)"
                                    onClick={() => handleOpenDelete(acc)}
                                  >
                                    ลบ
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className={styles.tablePagination}>
                    <div>
                      แสดง {paginatedAccounts.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} ถึง{" "}
                      {Math.min(currentPage * entriesPerPage, visibleAccounts.length)} จากทั้งหมด{" "}
                      {visibleAccounts.length} รายการ
                    </div>
                    <div className={styles.paginationControls}>
                      <button
                        className={styles.pageBtn}
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                        <button
                          key={num}
                          className={`${styles.pageBtn} ${currentPage === num ? styles.pageBtnActive : ""}`}
                          type="button"
                          onClick={() => setCurrentPage(num)}
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        className={styles.pageBtn}
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </section>
          ) : activeTab === "audit" ? (
            /* ════════════════════ TAB: AUDIT LOGS & ONLINE MONITORING ════════════════════ */
            <section aria-label="Audit Logs & Online Monitoring">
              <div className={styles.pageHeader}>
                <div className={styles.headerTopRow}>
                  <div>
                    <h1 className={styles.pageTitle}>Audit Logs & ผู้ใช้ออนไลน์</h1>
                    <nav className={styles.breadcrumb} aria-label="breadcrumb">
                      <Link href="/admin" onClick={() => setActiveTab("dashboard")}>
                        Dashboard
                      </Link>
                      <span className={styles.breadcrumbSeparator}>›</span>
                      <span>Interface</span>
                      <span className={styles.breadcrumbSeparator}>›</span>
                      <span className={styles.breadcrumbActive}>Audit Logs</span>
                    </nav>
                  </div>

                  <div className={styles.actionButtonsGroup}>
                    <button
                      className={styles.btnCancel}
                      type="button"
                      onClick={() => {
                        void loadActiveUsers();
                        void loadAuditLogs();
                      }}
                    >
                      <span>รีเฟรชข้อมูล</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Section 1: Live Online Users Monitor ── */}
              <article className={styles.panel} style={{ marginBottom: "24px" }}>
                <div className={styles.panelHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className={styles.pulseDot} />
                    <h2 className={styles.panelTitle} style={{ margin: 0 }}>
                      ผู้ใช้งานที่ออนไลน์ขณะนี้ (Active & Online Users)
                    </h2>
                    <span style={{ fontSize: "0.84rem", opacity: 0.85, fontWeight: 600 }}>
                      ({activeStats.onlineCount} คนออนไลน์ / {activeStats.idleCount} คนพักหน้าจอ)
                    </span>
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "var(--ui-30-muted, #64748b)" }}>
                    ● อัปเดตสดอัตโนมัติ
                  </span>
                </div>

                <div className={styles.panelBody}>
                  {activeSessions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "var(--ui-30-muted, #64748b)", fontSize: "0.9rem" }}>
                      ยังไม่พบผู้ใช้งานอื่นออนไลน์ในขณะนี้
                    </div>
                  ) : (
                    <div className={styles.onlineCardGrid}>
                      {activeSessions.map((session) => (
                        <div key={session.userId} className={styles.onlineUserCard}>
                          <div className={styles.onlineCardHeader}>
                            <div className={styles.onlineUserTitle}>
                              <div className={session.status === "ONLINE" ? styles.pulseDot : styles.idleDot} />
                              <span>{session.username}</span>
                            </div>
                            {renderRoleBadge(session.role as RoleCode)}
                          </div>
                          <div className={styles.onlineCardMeta}>
                            <div>
                              หน้าจอปัจจุบัน: <span className={styles.onlineCardCurrentPage}>{session.currentPage}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                              <span>IP: {session.ipAddress || "127.0.0.1"}</span>
                              <span style={{ fontWeight: 700, color: session.status === "ONLINE" ? "#10b981" : "#f59e0b" }}>
                                {session.status === "ONLINE" ? "● กำลังใช้งาน" : "○ ไม่อยู่หน้าจอ"}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: "2px" }}>
                              ล็อกอินเมื่อ: {new Date(session.loginAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              {/* ── Section 2: Audit Logs Table ── */}
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>ประวัติการทำงานทั้งหมด (Audit Trail)</h2>
                </div>

                <div className={styles.panelBody}>
                  {/* Filter Toolbar */}
                  <div className={styles.filterCard} style={{ flexWrap: "wrap", gap: "14px" }}>
                    <div className={styles.filterItem}>
                      <label htmlFor="auditCategory">หมวดหมู่:</label>
                      <select
                        id="auditCategory"
                        className={styles.filterSelect}
                        value={auditCategory}
                        onChange={(e) => {
                          setAuditCategory(e.target.value);
                          setAuditPage(1);
                        }}
                      >
                        <option value="all">ทั้งหมด (All Categories)</option>
                        <option value="AUTH">AUTH (เข้าสู่ระบบ/ออก)</option>
                        <option value="CREATE">CREATE (สร้างข้อมูล)</option>
                        <option value="UPDATE">UPDATE (แก้ไขข้อมูล)</option>
                        <option value="DELETE">DELETE (ลบข้อมูล)</option>
                        <option value="ACCOUNT">ACCOUNT (จัดการผู้ใช้)</option>
                      </select>
                    </div>

                    <div className={styles.filterItem}>
                      <label htmlFor="auditRole">บทบาท (Role):</label>
                      <select
                        id="auditRole"
                        className={styles.filterSelect}
                        value={auditRole}
                        onChange={(e) => {
                          setAuditRole(e.target.value);
                          setAuditPage(1);
                        }}
                      >
                        <option value="all">ทั้งหมด (All Roles)</option>
                        <option value="ADMIN">ADMIN (ผู้ดูแลระบบ)</option>
                        <option value="HRD_CENTER">HRD_CENTER (ส่วนกลาง)</option>
                        <option value="HRD_FACTORY">HRD_FACTORY (โรงงาน)</option>
                        <option value="EMPLOYEE">EMPLOYEE (พนักงาน)</option>
                        <option value="SYSTEM">SYSTEM (ระบบ/ไม่ระบุ)</option>
                      </select>
                    </div>

                    <div className={styles.filterItem} style={{ flex: 1, minWidth: "200px" }}>
                      <label htmlFor="auditSearch">ค้นหา:</label>
                      <input
                        id="auditSearch"
                        type="search"
                        className={styles.filterInput}
                        placeholder="ค้นหาผู้กระทำ, การกระทำ, ชื่อหลักสูตร, IP..."
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setAuditPage(1);
                            void loadAuditLogs();
                          }
                        }}
                      />
                    </div>

                    <div className={styles.filterItem}>
                      <button
                        className={styles.btnPrimaryAction}
                        type="button"
                        style={{ height: "38px", padding: "0 16px" }}
                        onClick={() => {
                          setAuditPage(1);
                          void loadAuditLogs();
                        }}
                      >
                        ค้นหา
                      </button>
                    </div>
                  </div>

                  {/* Audit Data Table with Frame */}
                  <div className={styles.tableResponsive} style={{ marginTop: "16px" }}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>วัน-เวลา (Timestamp)</th>
                          <th>ผู้กระทำ (Actor)</th>
                          <th>หมวดหมู่ (Category)</th>
                          <th>การกระทำ (Action)</th>
                          <th>เป้าหมาย (Target Entity)</th>
                          <th>IP Address</th>
                          <th style={{ textAlign: "center" }}>รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", padding: "28px", color: "#6c757d" }}>
                              {isAuditLoading ? "กำลังดึงข้อมูล Audit Logs..." : "ไม่พบประวัติการทำงานที่ตรงกับเงื่อนไข"}
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id}>
                              <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                                {new Date(log.occurredAt).toLocaleString("th-TH", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                                  {log.actorUsername || "ระบบ (System)"}
                                </div>
                                {log.actorRole ? (
                                  <div style={{ marginTop: "2px" }}>
                                    {renderRoleBadge(log.actorRole as RoleCode)}
                                  </div>
                                ) : null}
                              </td>
                              <td>{renderAuditCategoryBadge(log.category)}</td>
                              <td style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--ui-30-ink, #0f172a)" }}>
                                {log.action}
                              </td>
                              <td style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {log.entityLabel ? (
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{log.entityLabel}</div>
                                    <div style={{ fontSize: "0.74rem", opacity: 0.7 }}>
                                      {log.entityType ? `[${log.entityType}]` : ""} {log.entityId ? `#${log.entityId}` : ""}
                                    </div>
                                  </div>
                                ) : log.entityType ? (
                                  <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                                    {log.entityType} {log.entityId ? `#${log.entityId}` : ""}
                                  </span>
                                ) : (
                                  <span style={{ opacity: 0.5 }}>-</span>
                                )}
                              </td>
                              <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                                {log.ipAddress || "-"}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  className={styles.btnViewDetail}
                                  type="button"
                                  onClick={() => setSelectedAuditLog(log)}
                                >
                                  รายละเอียด
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className={styles.paginationBar}>
                    <div>
                      แสดงผลรายการที่{" "}
                      <strong>
                        {auditTotal === 0 ? 0 : (auditPage - 1) * 15 + 1} -{" "}
                        {Math.min(auditPage * 15, auditTotal)}
                      </strong>{" "}
                      จากทั้งหมด <strong>{auditTotal}</strong> รายการ
                    </div>

                    <div className={styles.paginationControls}>
                      <button
                        className={styles.pageBtn}
                        type="button"
                        disabled={auditPage === 1}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      {Array.from({ length: auditTotalPages }, (_, i) => i + 1).map((num) => (
                        <button
                          key={num}
                          className={`${styles.pageBtn} ${auditPage === num ? styles.pageBtnActive : ""}`}
                          type="button"
                          onClick={() => setAuditPage(num)}
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        className={styles.pageBtn}
                        type="button"
                        disabled={auditPage === auditTotalPages}
                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </section>
          ) : (
            /* ════════════════════ TAB: DASHBOARD OVERVIEW ════════════════════ */
            <section aria-label="Dashboard Overview">
              <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Dashboard</h1>
                <nav className={styles.breadcrumb} aria-label="breadcrumb">
                  <Link href="/admin" className={styles.breadcrumbActive}>
                    Dashboard
                  </Link>
                </nav>
              </div>

              {/* 4 Colored Stat Cards with Real Database Counts */}
              <section className={styles.cardsRow} aria-label="Summary statistics">
                {/* Primary Blue */}
                <article className={`${styles.statCard} ${styles.primaryCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ fontSize: "0.85rem", opacity: 0.85, fontWeight: 500 }}>
                      Total Accounts
                    </div>
                    <div style={{ fontSize: "1.7rem", fontWeight: 800, marginTop: "4px" }}>
                      {stats.total}
                    </div>
                  </div>
                  <a
                    href="#"
                    className={styles.statCardFooter}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab("users");
                    }}
                  >
                    <span>View User Accounts</span>
                    <span>›</span>
                  </a>
                </article>

                {/* Warning Yellow */}
                <article className={`${styles.statCard} ${styles.warningCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ fontSize: "0.85rem", opacity: 0.85, fontWeight: 500 }}>
                      Inactive / Locked
                    </div>
                    <div style={{ fontSize: "1.7rem", fontWeight: 800, marginTop: "4px" }}>
                      {stats.inactive}
                    </div>
                  </div>
                  <a
                    href="#"
                    className={styles.statCardFooter}
                    onClick={(e) => {
                      e.preventDefault();
                      setStatusFilter("INACTIVE");
                      setActiveTab("users");
                    }}
                  >
                    <span>View Details</span>
                    <span>›</span>
                  </a>
                </article>

                {/* Success Green */}
                <article className={`${styles.statCard} ${styles.successCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ fontSize: "0.85rem", opacity: 0.85, fontWeight: 500 }}>
                      Active Users
                    </div>
                    <div style={{ fontSize: "1.7rem", fontWeight: 800, marginTop: "4px" }}>
                      {stats.active}
                    </div>
                  </div>
                  <a
                    href="#"
                    className={styles.statCardFooter}
                    onClick={(e) => {
                      e.preventDefault();
                      setStatusFilter("ACTIVE");
                      setActiveTab("users");
                    }}
                  >
                    <span>View Details</span>
                    <span>›</span>
                  </a>
                </article>

                {/* Danger Red */}
                <article className={`${styles.statCard} ${styles.dangerCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ fontSize: "0.85rem", opacity: 0.85, fontWeight: 500 }}>
                      Administrators
                    </div>
                    <div style={{ fontSize: "1.7rem", fontWeight: 800, marginTop: "4px" }}>
                      {stats.admins}
                    </div>
                  </div>
                  <a
                    href="#"
                    className={styles.statCardFooter}
                    onClick={(e) => {
                      e.preventDefault();
                      setRoleFilter("ADMIN");
                      setActiveTab("users");
                    }}
                  >
                    <span>View Details</span>
                    <span>›</span>
                  </a>
                </article>
              </section>

              {/* 2 Charts Row */}
              <section className={styles.chartsRow} aria-label="Analytics charts">
                {/* Area Chart Card */}
                <article className={styles.panelCard}>
                  <header className={styles.panelHeader}>
                    <span>📈</span>
                    <span>Area Chart Example</span>
                  </header>
                  <div className={styles.panelBody}>
                    <div className={styles.chartContainer}>
                      <svg viewBox="0 0 500 240" preserveAspectRatio="none" aria-label="Area chart visual">
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0d6efd" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#0d6efd" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Grid lines */}
                        <line x1="50" y1="30" x2="480" y2="30" stroke="#e9ecef" strokeWidth="1" />
                        <line x1="50" y1="75" x2="480" y2="75" stroke="#e9ecef" strokeWidth="1" />
                        <line x1="50" y1="120" x2="480" y2="120" stroke="#e9ecef" strokeWidth="1" />
                        <line x1="50" y1="165" x2="480" y2="165" stroke="#e9ecef" strokeWidth="1" />
                        <line x1="50" y1="210" x2="480" y2="210" stroke="#ced4da" strokeWidth="1.5" />

                        {/* Y-axis Labels */}
                        <text x="42" y="34" textAnchor="end" fontSize="10" fill="#6c757d">
                          40000
                        </text>
                        <text x="42" y="79" textAnchor="end" fontSize="10" fill="#6c757d">
                          30000
                        </text>
                        <text x="42" y="124" textAnchor="end" fontSize="10" fill="#6c757d">
                          20000
                        </text>
                        <text x="42" y="169" textAnchor="end" fontSize="10" fill="#6c757d">
                          10000
                        </text>
                        <text x="42" y="214" textAnchor="end" fontSize="10" fill="#6c757d">
                          0
                        </text>

                        {/* Area polygon fill */}
                        <polygon
                          points="
                            65,165
                            120,75
                            175,100
                            230,135
                            285,85
                            340,70
                            395,110
                            450,55
                            450,210
                            65,210
                          "
                          fill="url(#areaGrad)"
                        />

                        {/* Smooth Line Path */}
                        <polyline
                          points="
                            65,165
                            120,75
                            175,100
                            230,135
                            285,85
                            340,70
                            395,110
                            450,55
                          "
                          fill="none"
                          stroke="#0d6efd"
                          strokeWidth="2.5"
                        />

                        {/* Data Points */}
                        {[
                          { cx: 65, cy: 165 },
                          { cx: 120, cy: 75 },
                          { cx: 175, cy: 100 },
                          { cx: 230, cy: 135 },
                          { cx: 285, cy: 85 },
                          { cx: 340, cy: 70 },
                          { cx: 395, cy: 110 },
                          { cx: 450, cy: 55 },
                        ].map((pt, idx) => (
                          <circle
                            key={idx}
                            cx={pt.cx}
                            cy={pt.cy}
                            r="4"
                            fill="#0d6efd"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                        ))}

                        {/* X-axis Labels */}
                        <text x="65" y="228" textAnchor="middle" fontSize="10" fill="#6c757d">
                          Mar 1
                        </text>
                        <text x="120" y="228" textAnchor="middle" fontSize="10" fill="#6c757d">
                          Mar 3
                        </text>
                        <text x="175" y="228" textAnchor="middle" fontSize="10" fill="#6c757d">
                          Mar 5
                        </text>
                        <text x="230" y="228" textAnchor="middle" fontSize="10" fill="#6c757d">
                          Mar 7
                        </text>
                        <text x="285" y="228" textAnchor="middle" fontSize="10" fill="#6c757d">
                          Mar 9
                        </text>
                        <text x="340" y="228" textAnchor="middle" fontSize="10" fill="#6c757d">
                          Mar 11
                        </text>
                        <text x="410" y="228" textAnchor="middle" fontSize="10" fill="#6c757d">
                          Mar 13
                        </text>
                      </svg>
                    </div>
                  </div>
                </article>

                {/* Bar Chart Card */}
                <article className={styles.panelCard}>
                  <header className={styles.panelHeader}>
                    <span>📊</span>
                    <span>Bar Chart Example</span>
                  </header>
                  <div className={styles.panelBody}>
                    <div className={styles.chartContainer}>
                      <svg viewBox="0 0 500 240" preserveAspectRatio="none" aria-label="Bar chart visual">
                        {/* Horizontal Grid lines */}
                        <line x1="50" y1="30" x2="480" y2="30" stroke="#e9ecef" strokeWidth="1" />
                        <line x1="50" y1="90" x2="480" y2="90" stroke="#e9ecef" strokeWidth="1" />
                        <line x1="50" y1="150" x2="480" y2="150" stroke="#e9ecef" strokeWidth="1" />
                        <line x1="50" y1="210" x2="480" y2="210" stroke="#ced4da" strokeWidth="1.5" />

                        {/* Y-axis Labels */}
                        <text x="42" y="34" textAnchor="end" fontSize="10" fill="#6c757d">
                          15000
                        </text>
                        <text x="42" y="94" textAnchor="end" fontSize="10" fill="#6c757d">
                          10000
                        </text>
                        <text x="42" y="154" textAnchor="end" fontSize="10" fill="#6c757d">
                          5000
                        </text>
                        <text x="42" y="214" textAnchor="end" fontSize="10" fill="#6c757d">
                          0
                        </text>

                        {/* Vertical Bars */}
                        {[
                          { x: 75, height: 50, label: "January" },
                          { x: 140, height: 65, label: "February" },
                          { x: 205, height: 75, label: "March" },
                          { x: 270, height: 95, label: "April" },
                          { x: 335, height: 120, label: "May" },
                          { x: 400, height: 180, label: "June" },
                        ].map((bar, idx) => (
                          <g key={idx}>
                            <rect
                              x={bar.x}
                              y={210 - bar.height}
                              width="42"
                              height={bar.height}
                              rx="2"
                              fill="#0d6efd"
                            />
                            <text
                              x={bar.x + 21}
                              y="228"
                              textAnchor="middle"
                              fontSize="10"
                              fill="#6c757d"
                            >
                              {bar.label}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </article>
              </section>

              {/* DataTable Card: Real database users in overview */}
              <article className={styles.panelCard} aria-label="Data table container">
                <header className={styles.panelHeader}>
                  <span>📋</span>
                  <span>Database Users Overview</span>
                </header>

                <div className={styles.panelBody}>
                  <div className={styles.tableResponsive}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Username</th>
                          <th>Role</th>
                          <th>Company</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.slice(0, 5).map((acc) => (
                          <tr key={acc.userId}>
                            <td style={{ color: "#64748b" }}>#{acc.userId}</td>
                            <td style={{ fontWeight: 600 }}>{acc.username}</td>
                            <td>{renderRoleBadge(acc.roleCode)}</td>
                            <td>{acc.companyCode || "-"}</td>
                            <td>{acc.email || "-"}</td>
                            <td>{renderStatusBadge(acc.status)}</td>
                            <td>
                              <button
                                className={`${styles.actionIconBtn} ${styles.editBtn}`}
                                type="button"
                                onClick={() => {
                                  setActiveTab("users");
                                  handleOpenEdit(acc);
                                }}
                              >
                                ✏️ จัดการ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "14px", textAlign: "right" }}>
                    <button
                      className={styles.btnSecondaryAction}
                      type="button"
                      onClick={() => setActiveTab("users")}
                    >
                      ดูผู้ใช้งานทั้งหมด ({accounts.length} บัญชี) →
                    </button>
                  </div>
                </div>
              </article>
            </section>
          )}
        </main>
      </div>

      {/* ════════════════════ MODAL: CREATE USER ════════════════════ */}
      {isCreateOpen ? (
        <div className={styles.modalOverlay} onClick={() => setIsCreateOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>เพิ่มบัญชีผู้ใช้งานใหม่</h3>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="create-username">
                    Username <b>*</b>
                  </label>
                  <input
                    id="create-username"
                    type="text"
                    required
                    placeholder="เช่น user_name"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="create-password">
                    Password <b>*</b>
                  </label>
                  <input
                    id="create-password"
                    type="password"
                    required
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                  <span className={styles.formHint}>รหัสผ่านจะได้รับการเข้ารหัสด้วย Argon2id</span>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="create-role">
                    Role (บทบาท) <b>*</b>
                  </label>
                  <select
                    id="create-role"
                    value={createForm.roleCode}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, roleCode: e.target.value as RoleCode })
                    }
                  >
                    {ROLE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                {needsCompany(createForm.roleCode) ? (
                  <div className={styles.formGroup}>
                    <label htmlFor="create-company">
                      Company (บริษัท) <b>*</b>
                    </label>
                    <select
                      id="create-company"
                      required
                      value={createForm.companyId}
                      onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })}
                    >
                      <option value="">-- เลือกบริษัท --</option>
                      {companies.map((comp) => (
                        <option key={comp.companyId} value={comp.companyId}>
                          {comp.companyCode} - {comp.companyNameTh}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {needsEmployee(createForm.roleCode) ? (
                  <div className={styles.formGroup}>
                    <label htmlFor="create-employee">Employee ID (รหัสพนักงาน)</label>
                    <input
                      id="create-employee"
                      type="text"
                      placeholder="เช่น 10001"
                      value={createForm.employeeId}
                      onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                    />
                  </div>
                ) : null}

                <div className={styles.formGroup}>
                  <label htmlFor="create-email">Email</label>
                  <input
                    id="create-email"
                    type="email"
                    placeholder="name@example.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={styles.btnCancel}
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className={styles.btnPrimaryAction}
                  type="submit"
                  disabled={isSubmitting || !createForm.username.trim() || !createForm.password}
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ════════════════════ MODAL: EDIT USER ════════════════════ */}
      {editingAccount ? (
        <div className={styles.modalOverlay} onClick={() => setEditingAccount(null)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>แก้ไขข้อมูลผู้ใช้: {editingAccount.username}</h3>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setEditingAccount(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Username</label>
                  <input type="text" disabled value={editingAccount.username} />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edit-role">
                    Role (บทบาท) <b>*</b>
                  </label>
                  <select
                    id="edit-role"
                    value={editForm.roleCode}
                    onChange={(e) =>
                      setEditForm({ ...editForm, roleCode: e.target.value as RoleCode })
                    }
                  >
                    {ROLE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                {needsCompany(editForm.roleCode) ? (
                  <div className={styles.formGroup}>
                    <label htmlFor="edit-company">
                      Company (บริษัท) <b>*</b>
                    </label>
                    <select
                      id="edit-company"
                      required
                      value={editForm.companyId}
                      onChange={(e) => setEditForm({ ...editForm, companyId: e.target.value })}
                    >
                      <option value="">-- เลือกบริษัท --</option>
                      {companies.map((comp) => (
                        <option key={comp.companyId} value={comp.companyId}>
                          {comp.companyCode} - {comp.companyNameTh}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {needsEmployee(editForm.roleCode) ? (
                  <div className={styles.formGroup}>
                    <label htmlFor="edit-employee">Employee ID</label>
                    <input
                      id="edit-employee"
                      type="text"
                      value={editForm.employeeId}
                      onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                    />
                  </div>
                ) : null}

                <div className={styles.formGroup}>
                  <label htmlFor="edit-email">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edit-status">
                    Status (สถานะ) <b>*</b>
                  </label>
                  <select
                    id="edit-status"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as UserAccountStatus })
                    }
                  >
                    {USER_ACCOUNT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={styles.btnCancel}
                  type="button"
                  onClick={() => setEditingAccount(null)}
                >
                  ยกเลิก
                </button>
                <button
                  className={styles.btnPrimaryAction}
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ════════════════════ MODAL: RESET PASSWORD ════════════════════ */}
      {resetAccount ? (
        <div className={styles.modalOverlay} onClick={() => setResetAccount(null)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>รีเซ็ตรหัสผ่าน: {resetAccount.username}</h3>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setResetAccount(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleResetSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="reset-new-pw">
                    รหัสผ่านใหม่ <b>*</b>
                  </label>
                  <input
                    id="reset-new-pw"
                    type="password"
                    required
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="reset-confirm-pw">
                    ยืนยันรหัสผ่านใหม่ <b>*</b>
                  </label>
                  <input
                    id="reset-confirm-pw"
                    type="password"
                    required
                    placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                    value={resetConfirmValue}
                    onChange={(e) => setResetConfirmValue(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={styles.btnCancel}
                  type="button"
                  onClick={() => setResetAccount(null)}
                >
                  ยกเลิก
                </button>
                <button
                  className={styles.btnPrimaryAction}
                  type="submit"
                  disabled={isSubmitting || !resetPasswordValue || !resetConfirmValue}
                >
                  {isSubmitting ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่าน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ════════════════════ MODAL: DELETE CONFIRMATION ════════════════════ */}
      {deleteAccount ? (
        <div className={styles.modalOverlay} onClick={() => setDeleteAccount(null)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 style={{ color: "#dc2626" }}>ยืนยันการลบบัญชีผู้ใช้</h3>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setDeleteAccount(null)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีผู้ใช้ <strong>"{deleteAccount.username}"</strong> (
                {deleteAccount.roleCode}) ?
              </p>
              <div className={styles.deleteWarningBox}>
                <strong>ข้อควรระวัง:</strong> การลบข้อมูลจะไม่สามารถกู้คืนได้
                หากผู้ใช้รายนี้มีประวัติการสร้างเอกสารในระบบ
                แนะนำให้แก้ไขสถานะเป็น <strong>INACTIVE</strong> หรือ <strong>LOCKED</strong> แทน
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnCancel}
                type="button"
                onClick={() => setDeleteAccount(null)}
              >
                ยกเลิก
              </button>
              <button
                className={styles.btnDangerSubmit}
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleDeleteSubmit()}
              >
                {isSubmitting ? "กำลังลบ..." : "ยืนยันการลบ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ════════════════════ MODAL: AUDIT LOG DETAIL ════════════════════ */}
      {selectedAuditLog ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedAuditLog(null)}>
          <div className={styles.modalDialog} style={{ maxWidth: "640px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>รายละเอียด Audit Log #{selectedAuditLog.id}</h3>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setSelectedAuditLog(null)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.88rem" }}>
                <div>
                  <span style={{ color: "var(--ui-30-muted, #64748b)" }}>การกระทำ (Action):</span>
                  <div style={{ fontWeight: 700, marginTop: "2px" }}>{selectedAuditLog.action}</div>
                </div>
                <div>
                  <span style={{ color: "var(--ui-30-muted, #64748b)" }}>หมวดหมู่ (Category):</span>
                  <div style={{ marginTop: "2px" }}>{renderAuditCategoryBadge(selectedAuditLog.category)}</div>
                </div>
                <div>
                  <span style={{ color: "var(--ui-30-muted, #64748b)" }}>ผู้กระทำ (Actor):</span>
                  <div style={{ fontWeight: 700, marginTop: "2px" }}>
                    {selectedAuditLog.actorUsername || "System"} {selectedAuditLog.actorRole ? `(${selectedAuditLog.actorRole})` : ""}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--ui-30-muted, #64748b)" }}>วัน-เวลา (Timestamp):</span>
                  <div style={{ marginTop: "2px" }}>
                    {new Date(selectedAuditLog.occurredAt).toLocaleString("th-TH")}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--ui-30-muted, #64748b)" }}>IP Address:</span>
                  <div style={{ marginTop: "2px" }}>{selectedAuditLog.ipAddress || "-"}</div>
                </div>
                <div>
                  <span style={{ color: "var(--ui-30-muted, #64748b)" }}>เป้าหมาย (Entity):</span>
                  <div style={{ marginTop: "2px" }}>
                    {selectedAuditLog.entityLabel || selectedAuditLog.entityType || "-"}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ color: "var(--ui-30-muted, #64748b)", fontSize: "0.85rem", fontWeight: 600 }}>
                  ข้อมูลบันทึกเชิงลึก (Detail Payload):
                </span>
                <pre className={styles.jsonViewer} style={{ marginTop: "6px" }}>
                  {selectedAuditLog.detail
                    ? JSON.stringify(selectedAuditLog.detail, null, 2)
                    : "ไม่มีข้อมูลเพิ่มเติม (No Detail Payload)"}
                </pre>
              </div>

              {selectedAuditLog.userAgent ? (
                <div style={{ fontSize: "0.74rem", color: "var(--ui-30-muted, #64748b)", wordBreak: "break-all" }}>
                  เบราว์เซอร์ / อุปกรณ์: {selectedAuditLog.userAgent}
                </div>
              ) : null}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnCancel}
                type="button"
                onClick={() => setSelectedAuditLog(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
