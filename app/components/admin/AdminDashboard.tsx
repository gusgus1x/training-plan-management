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
  type UpdateUserAccountInput,
  type UserAccountRecord,
  type UserAccountStatus,
} from "../../lib/userAccounts/types";
import { ROLE_CODES, type RoleCode } from "../../lib/auth/types";
import {
  listAuditLogs,
  listActiveUsers,
  sendHeartbeat,
  fetchSystemStats,
  purgeAuditLogs,
  type AuditLogRecord,
  type ActiveUserSession,
  type SystemStatsResponse,
} from "../../lib/audit/client";
import NewActivitiesReport from "../center_factory/ReportManagement/modules/NewActivitiesReport";
import styles from "./AdminDashboard.module.css";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ClipboardList,
  Clock,
  Database,
  Download,
  FileText,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Sun,
  Trash2,
  TrendingUp,
  Unlock,
  User,
  Users,
} from "../icons/LucideIcons";

type TabKey = "dashboard" | "users" | "audit" | "announcements";

const needsCompany = (roleCode: RoleCode) =>
  roleCode === "HRD_FACTORY" || roleCode === "EMPLOYEE";
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

function getPaginationItems(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const delta = 2;
  const range: number[] = [];
  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }

  const items: (number | string)[] = [1];

  if (currentPage - delta > 2) {
    items.push("ellipsis-prev");
  } else if (currentPage - delta === 2) {
    items.push(2);
  }

  for (const page of range) {
    if (!items.includes(page)) {
      items.push(page);
    }
  }

  if (currentPage + delta < totalPages - 1) {
    items.push("ellipsis-next");
  } else if (currentPage + delta === totalPages - 1) {
    if (!items.includes(totalPages - 1)) {
      items.push(totalPages - 1);
    }
  }

  if (!items.includes(totalPages)) {
    items.push(totalPages);
  }

  return items;
}

export type AdminTabKey = TabKey;

export type AdminDashboardProps = {
  initialTab?: TabKey;
};

export default function AdminDashboard({
  initialTab = "dashboard",
}: AdminDashboardProps = {}) {
  const { logout } = useAuthActions();
  const currentUser = useAuthenticatedUser();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const targetUrl =
        tab === "users"
          ? "/admin/user_accounts"
          : tab === "audit"
          ? "/admin/audit_logs"
          : tab === "announcements"
          ? "/admin/announcements"
          : "/admin";
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/admin/user_accounts") {
        setActiveTab("users");
      } else if (
        path === "/admin/audit_logs" ||
        path === "/admin/audit-logs" ||
        decodeURIComponent(path) === "/admin/audit logs"
      ) {
        setActiveTab("audit");
      } else if (
        path === "/admin/announcements" ||
        path === "/admin/announcement"
      ) {
        setActiveTab("announcements");
      } else if (path === "/admin") {
        setActiveTab("dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
  const [modalError, setModalError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    roleCode: "HRD_FACTORY" as RoleCode,
    companyId: "",
    employeeId: "",
    email: "",
    status: "ACTIVE" as UserAccountStatus,
  });

  const [resetAccount, setResetAccount] = useState<UserAccountRecord | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmValue, setResetConfirmValue] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

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

  // ════════════════════ SYSTEM STATS & MAINTENANCE STATE ════════════════════
  const [systemStats, setSystemStats] = useState<SystemStatsResponse | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);

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

  const loadSystemStats = async () => {
    setIsStatsLoading(true);
    try {
      const res = await fetchSystemStats();
      setSystemStats(res);
    } catch (err) {
      console.error("Failed to load system stats", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handlePurgeLogs = async () => {
    setIsPurging(true);
    setError(null);
    setMessage(null);
    try {
      const res = await purgeAuditLogs();
      setMessage(res.message || `ล้างข้อมูล Audit Log ที่หมดอายุแล้วจำนวน ${res.deletedCount} รายการเรียบร้อย`);
      setIsPurgeModalOpen(false);
      await loadSystemStats();
      if (activeTab === "audit") {
        await loadAuditLogs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการล้างข้อมูล Audit Log");
    } finally {
      setIsPurging(false);
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
    void loadSystemStats();
    void listCompanies()
      .then((res) => setCompanies(res.items ?? []))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (activeTab === "dashboard") {
      void loadSystemStats();
    }
  }, [activeTab]);

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
    setShowCreatePassword(false);
    setError(null);
    setMessage(null);
    setIsCreateOpen(true);
    if (companies.length === 0) {
      void listCompanies()
        .then((res) => setCompanies(res.items ?? []))
        .catch(() => setCompanies([]));
    }
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
    setModalError(null);
    setEditForm({
      username: account.username,
      roleCode: account.roleCode,
      companyId: account.companyId ?? "",
      employeeId: account.employeeId ?? "",
      email: account.email ?? "",
      status: account.status,
    });
    setError(null);
    setMessage(null);
    if (companies.length === 0) {
      void listCompanies()
        .then((res) => setCompanies(res.items ?? []))
        .catch(() => setCompanies([]));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    const trimmedUsername = editForm.username.trim();
    if (!trimmedUsername) {
      setModalError("กรุณากรอกชื่อผู้ใช้ (Username)");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setError(null);
    setMessage(null);
    try {
      const payload: UpdateUserAccountInput = {};

      if (trimmedUsername !== editingAccount.username) {
        payload.username = trimmedUsername;
      }

      const trimmedEmail = editForm.email.trim() || null;
      if (trimmedEmail !== (editingAccount.email || null)) {
        payload.email = trimmedEmail;
      }

      if (editForm.roleCode !== editingAccount.roleCode) {
        payload.roleCode = editForm.roleCode;
      }
      if (editForm.status !== editingAccount.status) {
        payload.status = editForm.status;
      }

      if (needsCompany(editForm.roleCode)) {
        const nextCompanyId = editForm.companyId || null;
        if (nextCompanyId !== (editingAccount.companyId || null)) {
          payload.companyId = nextCompanyId;
        }
      } else if (editingAccount.companyId) {
        payload.companyId = null;
      }

      if (needsEmployee(editForm.roleCode)) {
        const nextEmployeeId = editForm.employeeId.trim() || null;
        if (nextEmployeeId !== (editingAccount.employeeId || null)) {
          payload.employeeId = nextEmployeeId;
        }
      } else if (editingAccount.employeeId) {
        payload.employeeId = null;
      }

      if (Object.keys(payload).length === 0) {
        setEditingAccount(null);
        return;
      }

      await updateUserAccount(editingAccount.userId, payload);
      setMessage(`อัปเดตข้อมูลบัญชี "${trimmedUsername}" เรียบร้อยแล้ว`);
      setEditingAccount(null);
      await loadAccounts();
    } catch (err) {
      const msg = err instanceof UserAccountClientError ? err.message : "เกิดข้อผิดพลาดในการอัปเดตข้อมูล";
      setModalError(msg);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReset = (account: UserAccountRecord) => {
    setResetAccount(account);
    setResetPasswordValue("");
    setResetConfirmValue("");
    setShowResetPassword(false);
    setShowResetConfirm(false);
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

  const handleQuickUnlock = async (account: UserAccountRecord) => {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await updateUserAccount(account.userId, { status: "ACTIVE" });
      setMessage(`ปลดล็อกบัญชีผู้ใช้ "${account.username}" สำเร็จ (สถานะเป็น ACTIVE แล้ว)`);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof UserAccountClientError ? err.message : "เกิดข้อผิดพลาดในการปลดล็อกบัญชี");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportUsers = () => {
    if (visibleAccounts.length === 0) {
      setError("ไม่มีข้อมูลบัญชีผู้ใช้สำหรับส่งออก");
      return;
    }

    const headers = ["User ID", "Username", "Role", "Company Code", "Company Name", "Email", "Status", "Created At"];
    const rows = visibleAccounts.map((acc) => {
      const comp = companies.find(
        (c) => c.companyCode === acc.companyCode || c.companyId === acc.companyId
      );
      return [
        acc.userId,
        `"${acc.username.replace(/"/g, '""')}"`,
        acc.roleCode,
        acc.companyCode || "",
        `"${(comp?.companyNameTh || "").replace(/"/g, '""')}"`,
        acc.email || "",
        acc.status,
        new Date(acc.createdAt).toLocaleString("th-TH"),
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `UserAccounts_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage(`ส่งออกรายชื่อผู้ใช้ ${visibleAccounts.length} บัญชีเป็นไฟล์ CSV สำเร็จ`);
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
        return <span className={`${styles.categoryBadge} ${styles.catAuth}`}><Lock size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> AUTH</span>;
      case "CREATE":
        return <span className={`${styles.categoryBadge} ${styles.catCreate}`}><Plus size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> CREATE</span>;
      case "UPDATE":
        return <span className={`${styles.categoryBadge} ${styles.catUpdate}`}><Pencil size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> UPDATE</span>;
      case "DELETE":
        return <span className={`${styles.categoryBadge} ${styles.catDelete}`}><Trash2 size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> DELETE</span>;
      case "ACCOUNT":
        return <span className={`${styles.categoryBadge} ${styles.catAccount}`}><User size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> ACCOUNT</span>;
      default:
        return <span className={`${styles.categoryBadge} ${styles.catDefault}`}>{category}</span>;
    }
  };


  return (
    <div className={styles.wrapper}>
      {/* ── Top Navbar ── */}
      <nav className={styles.topNav}>
        <div className={styles.brandGroup}>
          <Link
            href="/admin"
            className={styles.brand}
            onClick={(e) => {
              e.preventDefault();
              switchTab("dashboard");
            }}
          >
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
          ><Menu size={18} /></button>
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
            <button className={styles.searchBtn} type="submit" aria-label="Submit search"><Search size={16} /></button>
          </form>

          <div className={styles.userMenu}>
            <button
              className={styles.userBtn}
              type="button"
              aria-label="Settings and user menu"
              title="Settings"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
            ><Settings size={18} /></button>

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
                    switchTab("users");
                  }}
                ><Users size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /> Manage Users</button>
                <div className={styles.themeSection}>
                  <div className={styles.themeSectionLabel}>
                    <span>ธีมหน้าจอ (Theme)</span>
                    <span className={styles.themeActiveBadge}>{theme === "dark" ? <><Moon size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} /> Dark</> : <><Sun size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} /> Light</>}</span>
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
                    ><Sun size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Light</button>
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
                    ><Moon size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Dark</button>
                  </div>
                </div>
                <button
                  className={`${styles.userDropdownItem} ${styles.logoutBtn}`}
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void logout();
                  }}
                ><LogOut size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /> Logout</button>
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
            <Link
              href="/admin"
              className={`${styles.navItem} ${activeTab === "dashboard" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                switchTab("dashboard");
              }}
            >
              <span className={styles.navIcon}><TrendingUp size={16} /></span>
              <span>Dashboard</span>
            </Link>

            <div className={styles.navHeading}>INTERFACE</div>
            <Link
              href="/admin/user_accounts"
              className={`${styles.navItem} ${activeTab === "users" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                switchTab("users");
              }}
            >
              <span className={styles.navIcon}><Users size={16} /></span>
              <span>User Accounts</span>
            </Link>
            <Link
              href="/admin/audit_logs"
              className={`${styles.navItem} ${activeTab === "audit" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                switchTab("audit");
              }}
            >
              <span className={styles.navIcon}><FileText size={16} /></span>
              <span>Audit Logs</span>
            </Link>
            <Link
              href="/admin/announcements"
              className={`${styles.navItem} ${activeTab === "announcements" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                switchTab("announcements");
              }}
            >
              <span className={styles.navIcon}><Megaphone size={16} /></span>
              <span>Announcements</span>
            </Link>
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
              <span><Check size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> {message}</span>
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
              <span><AlertTriangle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> {error}</span>
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
                      <Link
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          switchTab("dashboard");
                        }}
                      >
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
                      className={styles.exportBtn}
                      type="button"
                      onClick={handleExportUsers}
                      title="ส่งออกรายชื่อผู้ใช้เป็นไฟล์ CSV"
                    >
                      <Download size={15} style={{ display: "inline", verticalAlign: "middle" }} />
                      <span>ส่งออก (Export CSV)</span>
                    </button>
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
                              <td>
                                {acc.companyCode ? (
                                  <div>
                                    <span style={{ fontWeight: 700 }}>{acc.companyCode}</span>
                                    {(() => {
                                      const comp = companies.find(
                                        (c) =>
                                          c.companyCode === acc.companyCode ||
                                          c.companyId === acc.companyId,
                                      );
                                      return comp?.companyNameTh ? (
                                        <span
                                          style={{
                                            fontSize: "0.75rem",
                                            fontWeight: 400,
                                            color: "var(--ui-30-muted, #64748b)",
                                            display: "block",
                                            marginTop: "2px",
                                          }}
                                        >
                                          {comp.companyNameTh}
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>-</span>
                                )}
                              </td>
                              <td style={{ fontSize: "0.82rem" }}>{acc.email || "-"}</td>
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
                                  {acc.status === "LOCKED" ? (
                                    <button
                                      className={`${styles.actionIconBtn} ${styles.unlockBtn}`}
                                      type="button"
                                      title="ปลดล็อกบัญชีทันที (Unlock Account)"
                                      onClick={() => void handleQuickUnlock(acc)}
                                    >
                                      <Unlock size={13} style={{ display: "inline", verticalAlign: "middle" }} />
                                      ปลดล็อก
                                    </button>
                                  ) : null}
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
                      {getPaginationItems(currentPage, totalPages).map((item, idx) =>
                        typeof item === "number" ? (
                          <button
                            key={item}
                            className={`${styles.pageBtn} ${currentPage === item ? styles.pageBtnActive : ""}`}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                          >
                            {item}
                          </button>
                        ) : (
                          <span key={`ellipsis-${idx}`} className={styles.paginationEllipsis}>
                            …
                          </span>
                        )
                      )}
                      <button
                        className={styles.pageBtn}
                        type="button"
                        disabled={currentPage === totalPages || totalPages === 0}
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
                      <Link
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          switchTab("dashboard");
                        }}
                      >
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
                      {getPaginationItems(auditPage, auditTotalPages).map((item, idx) =>
                        typeof item === "number" ? (
                          <button
                            key={item}
                            className={`${styles.pageBtn} ${auditPage === item ? styles.pageBtnActive : ""}`}
                            type="button"
                            onClick={() => setAuditPage(item)}
                          >
                            {item}
                          </button>
                        ) : (
                          <span key={`ellipsis-${idx}`} className={styles.paginationEllipsis}>
                            …
                          </span>
                        )
                      )}
                      <button
                        className={styles.pageBtn}
                        type="button"
                        disabled={auditPage === auditTotalPages || auditTotalPages === 0}
                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </section>
          ) : activeTab === "announcements" ? (
            /* ════════════════════ TAB: ANNOUNCEMENTS & NEWS ════════════════════ */
            <section aria-label="Announcements and Activities Management">
              <div className={styles.pageHeader}>
                <div className={styles.headerTopRow}>
                  <div>
                    <h1 className={styles.pageTitle}>ระบบประกาศและกิจกรรม (Announcements)</h1>
                    <nav className={styles.breadcrumb} aria-label="breadcrumb">
                      <Link
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          switchTab("dashboard");
                        }}
                      >
                        Dashboard
                      </Link>
                      <span className={styles.breadcrumbSeparator}>›</span>
                      <span>Interface</span>
                      <span className={styles.breadcrumbSeparator}>›</span>
                      <span className={styles.breadcrumbActive}>Announcements</span>
                    </nav>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <NewActivitiesReport />
              </div>
            </section>
          ) : (
            /* ════════════════════ TAB: DASHBOARD OVERVIEW ════════════════════ */
            <section aria-label="Dashboard Overview">
              <div className={styles.pageHeader}>
                <div className={styles.headerTopRow}>
                  <div>
                    <h1 className={styles.pageTitle}>Dashboard ภาพรวมระบบ</h1>
                    <nav className={styles.breadcrumb} aria-label="breadcrumb">
                      <span className={styles.breadcrumbActive}>System Health &amp; Overview</span>
                    </nav>
                  </div>
                  <div className={styles.actionButtonsGroup}>
                    <button
                      className={styles.btnSecondaryAction}
                      type="button"
                      disabled={isStatsLoading}
                      onClick={() => void loadSystemStats()}
                      title="รีเฟรชข้อมูลสถานะล่าสุด"
                    >
                      <RefreshCw size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                      <span>{isStatsLoading ? "กำลังอัปเดต..." : "รีเฟรชสถานะ"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* System Health Status Bar */}
              <div className={styles.systemStatusBar}>
                <div className={styles.statusGroup}>
                  <div className={styles.pulseDot} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                      สถานะฐานข้อมูล: <span style={{ color: "#10b981" }}>{systemStats?.database.status ?? "ONLINE"}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--ui-30-muted, #64748b)" }}>
                      ตรวจสอบล่าสุด: {systemStats?.database.checkedAt ? new Date(systemStats.database.checkedAt).toLocaleTimeString("th-TH") : "กำลังตรวจสอบ..."}
                    </div>
                  </div>
                </div>

                <div className={styles.systemStatusMeta}>
                  <span className={styles.statusMetaPill}>
                    <Server size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                    Prisma ORM &amp; SQL Server
                  </span>
                  <span className={styles.statusMetaPill}>
                    <Activity size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                    {activeStats.totalActive > 0 ? `${activeStats.totalActive} คนกำลังใช้งานระบบ` : "ไม่มีผู้ใช้ออนไลน์"}
                  </span>
                </div>
              </div>

              {/* 4 Core Metric Cards */}
              <section className={styles.cardsRow} aria-label="Summary statistics">
                {/* 1. User Accounts Card */}
                <article className={`${styles.statCard} ${styles.primaryCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.88, fontWeight: 600 }}>
                          บัญชีผู้ใช้ในระบบ
                        </div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "2px" }}>
                          {systemStats?.counts.users ?? accounts.length}
                        </div>
                      </div>
                      <Users size={28} style={{ opacity: 0.3 }} />
                    </div>
                    <div style={{ fontSize: "0.78rem", marginTop: "6px", opacity: 0.85 }}>
                      ใช้งานปกติ {systemStats?.counts.activeUsers ?? stats.active} | แอดมิน {stats.admins} บัญชี
                    </div>
                  </div>
                  <Link
                    href="/admin/user_accounts"
                    className={styles.statCardFooter}
                    onClick={(e) => {
                      e.preventDefault();
                      switchTab("users");
                    }}
                  >
                    <span>จัดการบัญชีผู้ใช้ (User Accounts)</span>
                    <span>›</span>
                  </Link>
                </article>

                {/* 2. Organization Master Data */}
                <article className={`${styles.statCard} ${styles.infoCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.88, fontWeight: 600 }}>
                          ข้อมูลองค์กร &amp; พนักงาน
                        </div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "2px" }}>
                          {systemStats?.counts.employees ?? 0}
                        </div>
                      </div>
                      <Database size={28} style={{ opacity: 0.3 }} />
                    </div>
                    <div style={{ fontSize: "0.78rem", marginTop: "6px", opacity: 0.85 }}>
                      สังกัด {systemStats?.counts.companies ?? companies.length} บริษัทในเครือ
                    </div>
                  </div>
                  <div className={styles.statCardFooter} style={{ cursor: "default" }}>
                    <span>ข้อมูลหลักจาก Master Data</span>
                    <span>✓</span>
                  </div>
                </article>

                {/* 3. Training & Courses */}
                <article className={`${styles.statCard} ${styles.successCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.88, fontWeight: 600 }}>
                          หลักสูตร &amp; แผนฝึกอบรม
                        </div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "2px" }}>
                          {systemStats?.counts.courses ?? 0}
                        </div>
                      </div>
                      <ClipboardList size={28} style={{ opacity: 0.3 }} />
                    </div>
                    <div style={{ fontSize: "0.78rem", marginTop: "6px", opacity: 0.85 }}>
                      {systemStats?.counts.plans ?? 0} แผนอบรม | {systemStats?.counts.enrollments ?? 0} รายการลงทะเบียน
                    </div>
                  </div>
                  <div className={styles.statCardFooter} style={{ cursor: "default" }}>
                    <span>หลักสูตรทั้งหมดในระบบ</span>
                    <span>✓</span>
                  </div>
                </article>

                {/* 4. Audit & Security Trail */}
                <article className={`${styles.statCard} ${styles.warningCard}`}>
                  <div className={styles.statCardBody}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.88, fontWeight: 600 }}>
                          บันทึกความปลอดภัย (Logs)
                        </div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "2px" }}>
                          {systemStats?.auditStats.totalLogs ?? auditTotal}
                        </div>
                      </div>
                      <FileText size={28} style={{ opacity: 0.3 }} />
                    </div>
                    <div style={{ fontSize: "0.78rem", marginTop: "6px", opacity: 0.85 }}>
                      หมดอายุแล้ว {systemStats?.auditStats.expiredLogs ?? 0} รายการ (รอเคลียร์)
                    </div>
                  </div>
                  <Link
                    href="/admin/audit_logs"
                    className={styles.statCardFooter}
                    onClick={(e) => {
                      e.preventDefault();
                      switchTab("audit");
                    }}
                  >
                    <span>ตรวจสอบ Audit Logs</span>
                    <span>›</span>
                  </Link>
                </article>
              </section>

              {/* Middle Section: Real 7-Day Security/Activity Chart + Log Retention Management Card */}
              <section className={styles.chartsRow} aria-label="System Analytics &amp; Security">
                {/* Panel 1: 7-Day Activity & Login Stats */}
                <article className={styles.panelCard}>
                  <header className={styles.panelHeader} style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <TrendingUp size={16} />
                      <span style={{ fontWeight: 700 }}>สถิติกิจกรรมและการล็อกอิน 7 วันล่าสุด</span>
                    </div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.78rem" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: 10, height: 10, background: "#10b981", borderRadius: 2 }} />
                        สำเร็จ ({systemStats?.securitySummary.logins7Days ?? 0})
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: 10, height: 10, background: "#ef4444", borderRadius: 2 }} />
                        ล้มเหลว ({systemStats?.securitySummary.failedLogins7Days ?? 0})
                      </span>
                    </div>
                  </header>

                  <div className={styles.panelBody}>
                    {/* Security Warning if failed logins exist */}
                    {(systemStats?.securitySummary.failedLogins7Days ?? 0) > 0 ? (
                      <div className={styles.securityWarningBanner}>
                        <ShieldAlert size={18} />
                        <div>
                          <strong>แจ้งเตือนความปลอดภัย:</strong> พบการพยายามเข้าสู่ระบบไม่สำเร็จ{" "}
                          <strong>{systemStats?.securitySummary.failedLogins7Days} ครั้ง</strong> ในรอบ 7 วันที่ผ่านมา
                          กรุณาตรวจสอบในแท็บ Audit Logs หมวด AUTH เพื่อเฝ้าระวัง
                        </div>
                      </div>
                    ) : null}

                    {/* CSS Bar Chart for 7-Day Activity */}
                    <div className={styles.activityChartContainer}>
                      {(systemStats?.securitySummary.dailyActivity ?? []).map((day, idx) => {
                        const total = day.success + day.failed + day.other;
                        const maxVal = Math.max(
                          10,
                          ...((systemStats?.securitySummary.dailyActivity ?? []).map((d) => d.success + d.failed + d.other))
                        );
                        const heightPct = Math.max(8, Math.round((total / maxVal) * 100));

                        return (
                          <div key={day.date || idx} className={styles.activityDayCol}>
                            <div className={styles.activityBarTrack}>
                              <div
                                className={styles.activityBarFill}
                                style={{ height: `${heightPct}%` }}
                                title={`${day.label}: สำเร็จ ${day.success}, ล้มเหลว ${day.failed}, กิจกรรมอื่น ${day.other}`}
                              >
                                {day.failed > 0 ? (
                                  <div
                                    className={styles.barFailedPortion}
                                    style={{ height: `${(day.failed / Math.max(1, total)) * 100}%` }}
                                  />
                                ) : null}
                              </div>
                            </div>
                            <span className={styles.activityDayLabel}>{day.label}</span>
                            <span className={styles.activityDayCount}>{total}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>

                {/* Panel 2: Audit Log Retention & Storage Management */}
                <article className={styles.panelCard}>
                  <header className={styles.panelHeader}>
                    <Clock size={16} />
                    <span style={{ fontWeight: 700 }}>นโยบายและการจัดเก็บ Audit Logs (PDPA &amp; Storage)</span>
                  </header>

                  <div className={styles.panelBody} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className={styles.retentionInfoBox}>
                      <div className={styles.retentionRow}>
                        <span className={styles.retentionLabel}>ระยะเวลาจัดเก็บ (Retention Period):</span>
                        <span className={styles.retentionValue}>90 วัน (ตามนโยบาย PDPA)</span>
                      </div>
                      <div className={styles.retentionRow}>
                        <span className={styles.retentionLabel}>จำนวนบันทึกทั้งหมดในฐานข้อมูล:</span>
                        <span className={styles.retentionValue}>
                          <strong>{(systemStats?.auditStats.totalLogs ?? 0).toLocaleString()}</strong> รายการ
                        </span>
                      </div>
                      <div className={styles.retentionRow}>
                        <span className={styles.retentionLabel}>วันที่ของ Log ที่เก่าที่สุด:</span>
                        <span className={styles.retentionValue}>
                          {systemStats?.auditStats.oldestLogDate
                            ? new Date(systemStats.auditStats.oldestLogDate).toLocaleDateString("th-TH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "ยังไม่มีประวัติ"}
                        </span>
                      </div>
                      <div className={styles.retentionRow} style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "8px" }}>
                        <span className={styles.retentionLabel}>Log ที่ครบกำหนดล้างแล้ว (เกิน 90 วัน):</span>
                        <span className={styles.retentionValue} style={{ color: (systemStats?.auditStats.expiredLogs ?? 0) > 0 ? "#d97706" : "#10b981", fontWeight: 700 }}>
                          {(systemStats?.auditStats.expiredLogs ?? 0).toLocaleString()} รายการ
                        </span>
                      </div>
                    </div>

                    <div className={styles.purgeActionCard}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                          ล้างประวัติที่หมดอายุเพื่อเพิ่มประสิทธิภาพฐานข้อมูล
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ui-30-muted, #64748b)", marginTop: "2px" }}>
                          ลบเฉพาะ Log ที่เกิน 90 วัน ข้อมูลที่ยังอยู่ในระยะเวลาจะไม่ได้รับผลกระทบ
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
                        <button
                          type="button"
                          className={styles.btnPurgeAction}
                          disabled={(systemStats?.auditStats.expiredLogs ?? 0) === 0 || isPurging}
                          onClick={() => setIsPurgeModalOpen(true)}
                        >
                          <Trash2 size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                          {(systemStats?.auditStats.expiredLogs ?? 0) > 0
                            ? `ล้าง Log หมดอายุ (${systemStats?.auditStats.expiredLogs} รายการ)`
                            : "ไม่มี Log ที่หมดอายุ"}
                        </button>

                        <button
                          type="button"
                          className={styles.btnSecondaryAction}
                          onClick={() => switchTab("audit")}
                        >
                          ดู Log ทั้งหมด →
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </section>

              {/* Bottom Section: Recent Events Feed & User Accounts Table */}
              <section className={styles.chartsRow} aria-label="Recent Events and Users" style={{ marginTop: "20px" }}>
                {/* Left: Recent System Events */}
                <article className={styles.panelCard} style={{ flex: "1 1 50%" }}>
                  <header className={styles.panelHeader} style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Activity size={16} />
                      <span style={{ fontWeight: 700 }}>เหตุการณ์ล่าสุดในระบบ (Recent System Events)</span>
                    </div>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => switchTab("audit")}
                    >
                      ดูทั้งหมด →
                    </button>
                  </header>

                  <div className={styles.panelBody} style={{ padding: "8px 16px" }}>
                    {(!systemStats?.recentEvents || systemStats.recentEvents.length === 0) ? (
                      <div style={{ textAlign: "center", padding: "24px", color: "var(--ui-30-muted, #64748b)", fontSize: "0.88rem" }}>
                        ยังไม่มีกิจกรรมบันทึกไว้ในระบบ
                      </div>
                    ) : (
                      <div className={styles.recentEventList}>
                        {systemStats.recentEvents.map((evt) => (
                          <div key={evt.id} className={styles.recentEventItem}>
                            <div className={styles.recentEventHeader}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                {renderAuditCategoryBadge(evt.category)}
                                <strong style={{ fontSize: "0.85rem" }}>{evt.action}</strong>
                              </div>
                              <span style={{ fontSize: "0.75rem", color: "var(--ui-30-muted, #64748b)" }}>
                                {new Date(evt.occurredAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className={styles.recentEventMeta}>
                              <span>
                                โดย: <strong>{evt.actorUsername || "System"}</strong>{" "}
                                {evt.actorRole ? `(${evt.actorRole})` : ""}
                              </span>
                              {evt.entityLabel ? (
                                <span className={styles.recentEventEntity}>
                                  เป้าหมาย: {evt.entityLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>

                {/* Right: Database Users Overview */}
                <article className={styles.panelCard} style={{ flex: "1 1 50%" }}>
                  <header className={styles.panelHeader} style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Users size={16} />
                      <span style={{ fontWeight: 700 }}>ผู้ใช้งานระบบล่าสุด</span>
                    </div>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => switchTab("users")}
                    >
                      จัดการผู้ใช้ทั้งหมด →
                    </button>
                  </header>

                  <div className={styles.panelBody} style={{ padding: "0" }}>
                    <div className={styles.tableResponsive}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Company</th>
                            <th>Status</th>
                            <th style={{ textAlign: "center" }}>จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.slice(0, 5).map((acc) => (
                            <tr key={acc.userId}>
                              <td>
                                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{acc.username}</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--ui-30-muted, #64748b)" }}>
                                  #{acc.userId} {acc.email ? `• ${acc.email}` : ""}
                                </div>
                              </td>
                              <td>{renderRoleBadge(acc.roleCode)}</td>
                              <td>{acc.companyCode || "-"}</td>
                              <td>{renderStatusBadge(acc.status)}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  className={`${styles.actionIconBtn} ${styles.editBtn}`}
                                  type="button"
                                  onClick={() => {
                                    switchTab("users");
                                    handleOpenEdit(acc);
                                  }}
                                >
                                  แก้ไข
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              </section>
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
                  <div className={styles.passwordInputWrapper}>
                    <input
                      id="create-password"
                      type={showCreatePassword ? "text" : "password"}
                      required
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    />
                    <button
                      className={styles.passwordToggleBtn}
                      type="button"
                      tabIndex={-1}
                      title={showCreatePassword ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน"}
                      aria-label={showCreatePassword ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน"}
                      onClick={() => setShowCreatePassword((prev) => !prev)}
                    >
                      {showCreatePassword ? (
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
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
                      Company (บริษัท) {createForm.roleCode === "HRD_FACTORY" ? <b>*</b> : null}
                    </label>
                    <select
                      id="create-company"
                      required={createForm.roleCode === "HRD_FACTORY"}
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
                {modalError ? (
                  <div
                    style={{
                      padding: "10px 14px",
                      marginBottom: "14px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      color: "#b91c1c",
                      fontSize: "0.88rem",
                    }}
                  >
                    <AlertTriangle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /> {modalError}
                  </div>
                ) : null}

                <div className={styles.formGroup}>
                  <label htmlFor="edit-username">
                    ชื่อผู้ใช้ (Username) <b>*</b>
                  </label>
                  <input
                    id="edit-username"
                    type="text"
                    required
                    maxLength={100}
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  />
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
                      Company (บริษัท) {editForm.roleCode === "HRD_FACTORY" ? <b>*</b> : null}
                    </label>
                    <select
                      id="edit-company"
                      required={editForm.roleCode === "HRD_FACTORY"}
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
                  <div className={styles.passwordInputWrapper}>
                    <input
                      id="reset-new-pw"
                      type={showResetPassword ? "text" : "password"}
                      required
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                    />
                    <button
                      className={styles.passwordToggleBtn}
                      type="button"
                      tabIndex={-1}
                      title={showResetPassword ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน"}
                      aria-label={showResetPassword ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน"}
                      onClick={() => setShowResetPassword((prev) => !prev)}
                    >
                      {showResetPassword ? (
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="reset-confirm-pw">
                    ยืนยันรหัสผ่านใหม่ <b>*</b>
                  </label>
                  <div className={styles.passwordInputWrapper}>
                    <input
                      id="reset-confirm-pw"
                      type={showResetConfirm ? "text" : "password"}
                      required
                      placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                      value={resetConfirmValue}
                      onChange={(e) => setResetConfirmValue(e.target.value)}
                    />
                    <button
                      className={styles.passwordToggleBtn}
                      type="button"
                      tabIndex={-1}
                      title={showResetConfirm ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน"}
                      aria-label={showResetConfirm ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน"}
                      onClick={() => setShowResetConfirm((prev) => !prev)}
                    >
                      {showResetConfirm ? (
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
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

      {/* ════════════════════ MODAL: PURGE EXPIRED AUDIT LOGS ════════════════════ */}
      {isPurgeModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setIsPurgeModalOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 style={{ color: "#d97706" }}>ยืนยันการล้างประวัติ Audit Log ที่หมดอายุ</h3>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                ระบบจะทำการลบข้อมูล Audit Log ที่เกินกำหนดระยะเวลาจัดเก็บ (90 วัน) ออกจากฐานข้อมูลถาวร
              </p>
              <div style={{ background: "var(--ui-60-surface-soft, #f8fafc)", padding: "14px", borderRadius: "8px", margin: "12px 0", border: "1px solid var(--ui-30-border, #cbd5e1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>จำนวนบันทึกที่ครบกำหนดล้าง:</span>
                  <strong style={{ color: "#d97706", fontSize: "1.1rem" }}>
                    {(systemStats?.auditStats.expiredLogs ?? 0).toLocaleString()} รายการ
                  </strong>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--ui-30-muted, #64748b)" }}>
                  บันทึกที่ยังไม่ครบกำหนด (ภายใน 90 วัน) จะยังคงถูกเก็บรักษาไว้อย่างสมบูรณ์
                </div>
              </div>
              <div className={styles.deleteWarningBox}>
                <strong>คำเตือน:</strong> ข้อมูลที่ถูกล้างจะไม่สามารถกู้คืนได้ และระบบจะบันทึกกิจกรรมการล้างนี้ลงใน Audit Log อัตโนมัติ
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnCancel}
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                className={styles.btnDangerSubmit}
                type="button"
                style={{ backgroundColor: "#d97706", borderColor: "#b45309" }}
                disabled={isPurging || (systemStats?.auditStats.expiredLogs ?? 0) === 0}
                onClick={() => void handlePurgeLogs()}
              >
                {isPurging ? "กำลังดำเนินการ..." : "ยืนยันการล้างข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
