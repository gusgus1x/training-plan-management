"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "../AuthActionsContext";
import { useAuthenticatedUser } from "../AuthenticatedUserContext";
import { useConfirm } from "../ConfirmDialog";
import { listCompanies } from "../../lib/companies/client";
import type { CompanyRecord } from "../../lib/companies/types";
import {
  createUserAccount,
  listUserAccounts,
  resetUserAccountPassword,
  updateUserAccount,
  UserAccountClientError,
} from "../../lib/userAccounts/client";
import {
  USER_ACCOUNT_STATUSES,
  type UserAccountRecord,
  type UserAccountStatus,
} from "../../lib/userAccounts/types";
import { ROLE_CODES, type RoleCode } from "../../lib/auth/types";
import Navbar from "../Navbar";
import styles from "./AdminWorkspace.module.css";

// Company is required for HRD_FACTORY and forbidden for HRD_CENTER/ADMIN; the service rejects
// anything else, so the form mirrors that rather than letting people submit doomed accounts.
const needsCompany = (roleCode: RoleCode) => roleCode === "HRD_FACTORY";
const needsEmployee = (roleCode: RoleCode) => roleCode === "EMPLOYEE";

type FormState = {
  username: string;
  password: string;
  roleCode: RoleCode;
  companyId: string;
  employeeId: string;
  email: string;
};

const emptyForm: FormState = {
  username: "",
  password: "",
  roleCode: "HRD_FACTORY",
  companyId: "",
  employeeId: "",
  email: "",
};

export default function AdminWorkspace() {
  const router = useRouter();
  const { logout } = useAuthActions();
  const confirm = useConfirm();
  const currentUser = useAuthenticatedUser();

  const [accounts, setAccounts] = useState<UserAccountRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserAccountStatus>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleCode>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = async () => {
    try {
      const result = await listUserAccounts();
      setAccounts(result.accounts);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof UserAccountClientError
          ? loadError.message
          : "Unable to load accounts",
      );
    }
  };

  useEffect(() => {
    void load();
    void listCompanies()
      .then((result) => setCompanies(result.items ?? []))
      .catch(() => setCompanies([]));
  }, []);

  const visible = useMemo(
    () =>
      accounts.filter((account) => {
        if (statusFilter !== "all" && account.status !== statusFilter) return false;
        if (roleFilter !== "all" && account.roleCode !== roleFilter) return false;
        if (!search.trim()) return true;
        const haystack = [account.username, account.email, account.companyCode, account.roleName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      }),
    [accounts, search, statusFilter, roleFilter],
  );

  const run = async (action: () => Promise<unknown>, success: string) => {
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
      return true;
    } catch (actionError) {
      setError(
        actionError instanceof UserAccountClientError
          ? actionError.message
          : "The request failed",
      );
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreate = async () => {
    const ok = await run(
      () =>
        createUserAccount({
          username: form.username.trim(),
          password: form.password,
          roleCode: form.roleCode,
          companyId: needsCompany(form.roleCode) ? form.companyId || null : null,
          employeeId: needsEmployee(form.roleCode) ? form.employeeId || null : null,
          email: form.email.trim() || null,
          status: "ACTIVE",
        }),
      `Created account ${form.username.trim()}`,
    );

    if (ok) {
      setForm(emptyForm);
      setIsFormOpen(false);
    }
  };

  const handleStatusChange = async (account: UserAccountRecord, status: UserAccountStatus) => {
    const disabling = status !== "ACTIVE";
    if (
      disabling &&
      !(await confirm({
        message: `Disable the account "${account.username}"? They will not be able to sign in.`,
        confirmLabel: "Disable account",
        danger: true,
      }))
    ) {
      return;
    }

    await run(
      () => updateUserAccount(account.userId, { status }),
      `Updated ${account.username}`,
    );
  };

  const handleRoleChange = async (account: UserAccountRecord, roleCode: RoleCode) => {
    await run(
      () =>
        updateUserAccount(account.userId, {
          roleCode,
          // Clear bindings the new role must not carry, so the change never fails validation.
          companyId: needsCompany(roleCode) ? account.companyId : null,
          employeeId: needsEmployee(roleCode) ? account.employeeId : null,
        }),
      `Updated ${account.username}`,
    );
  };

  const handleResetPassword = async (account: UserAccountRecord) => {
    const password = window.prompt(
      `New password for "${account.username}" (at least 6 characters)`,
    );
    if (!password) return;

    await run(
      () => resetUserAccountPassword(account.userId, password),
      `Password reset for ${account.username}`,
    );
  };

  return (
    <main className={styles.page}>
      <Navbar
        username={currentUser?.username ?? ""}
        contextTitle="System Administration / User Accounts"
        onBack={() => router.push("/")}
        onHome={() => router.push("/")}
        onLogout={logout}
      />

      <section className={styles.header}>
        <div>
          <span className={styles.badge}>Administration</span>
          <h1>User Accounts</h1>
          <p>
            Create accounts, assign roles and reset passwords. Accounts are disabled rather than
            deleted so the audit trail keeps naming them.
          </p>
        </div>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => {
            setIsFormOpen((open) => !open);
            setForm(emptyForm);
          }}
        >
          {isFormOpen ? "Close" : "+ New account"}
        </button>
      </section>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.success} role="status">{message}</p> : null}

      {isFormOpen ? (
        <section className={styles.formPanel} aria-label="Create user account">
          <div className={styles.formGrid}>
            <label>
              <span>Username <b>*</b></span>
              <input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </label>
            <label>
              <span>Password <b>*</b></span>
              <input
                type="password"
                value={form.password}
                placeholder="At least 6 characters"
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            <label>
              <span>Role <b>*</b></span>
              <select
                value={form.roleCode}
                onChange={(event) =>
                  setForm({ ...form, roleCode: event.target.value as RoleCode })
                }
              >
                {ROLE_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            {needsCompany(form.roleCode) ? (
              <label>
                <span>Company <b>*</b></span>
                <select
                  value={form.companyId}
                  onChange={(event) => setForm({ ...form, companyId: event.target.value })}
                >
                  <option value="">Select company</option>
                  {companies.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.companyCode}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {needsEmployee(form.roleCode) ? (
              <label>
                <span>Employee ID <b>*</b></span>
                <input
                  value={form.employeeId}
                  placeholder="Numeric employee id"
                  onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
                />
              </label>
            ) : null}
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              disabled={isBusy || !form.username.trim() || !form.password}
              type="button"
              onClick={() => void handleCreate()}
            >
              Create account
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setIsFormOpen(false)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.toolbar}>
        <input
          className={styles.search}
          aria-label="Search accounts"
          placeholder="Search username, email, company..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className={styles.filter}>
          <span>Role</span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | RoleCode)}
          >
            <option value="all">All roles</option>
            {ROLE_CODES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | UserAccountStatus)
            }
          >
            <option value="all">All status</option>
            {USER_ACCOUNT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <span className={styles.count} translate="no">{visible.length}</span>
      </section>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Company</th>
              <th>Linked employee</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody translate="no">
            {visible.map((account) => {
              const isSelf = account.userId === currentUser?.userId;
              return (
                <tr key={account.userId}>
                  <td>
                    <strong>{account.username}</strong>
                    <span>{account.email || "-"}</span>
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${account.username}`}
                      disabled={isBusy || isSelf}
                      title={isSelf ? "You cannot change your own role" : undefined}
                      value={account.roleCode}
                      onChange={(event) =>
                        void handleRoleChange(account, event.target.value as RoleCode)
                      }
                    >
                      {ROLE_CODES.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </td>
                  <td>{account.companyCode || "-"}</td>
                  <td>{account.employeeName || "-"}</td>
                  <td>
                    <span
                      className={`${styles.statusPill} ${
                        account.status === "ACTIVE" ? styles.statusActive : styles.statusOff
                      }`}
                    >
                      {account.status}
                    </span>
                  </td>
                  <td>{account.lastLoginAt?.slice(0, 10) || "Never"}</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={isBusy}
                      type="button"
                      onClick={() => void handleResetPassword(account)}
                    >
                      Reset password
                    </button>
                    {account.status === "ACTIVE" ? (
                      <button
                        className={styles.dangerButton}
                        disabled={isBusy || isSelf}
                        title={isSelf ? "You cannot disable your own account" : undefined}
                        type="button"
                        onClick={() => void handleStatusChange(account, "INACTIVE")}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        className={styles.secondaryButton}
                        disabled={isBusy}
                        type="button"
                        onClick={() => void handleStatusChange(account, "ACTIVE")}
                      >
                        Enable
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className={styles.empty}>No accounts match the current filters.</p>
        ) : null}
      </div>
    </main>
  );
}
