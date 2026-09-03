import type { AuditLogRecord } from "../../api/admin/audit/route";
import type { ActiveUserSession } from "../auth/activeSessions";

export type { AuditLogRecord, ActiveUserSession };

export type AuditLogFilters = {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  from?: string;
  to?: string;
};

export type AuditLogsResponse = {
  logs: AuditLogRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ActiveUsersResponse = {
  sessions: ActiveUserSession[];
  onlineCount: number;
  idleCount: number;
  totalActive: number;
};

export class AuditClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AuditClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new AuditClientError(message, response.status);
  }

  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
};

export const listAuditLogs = async (filters: AuditLogFilters = {}): Promise<AuditLogsResponse> => {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.limit) params.set("limit", filters.limit.toString());
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const res = await fetch(`/api/admin/audit?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return read<AuditLogsResponse>(res);
};

export const listActiveUsers = async (): Promise<ActiveUsersResponse> => {
  const res = await fetch("/api/admin/active-users", {
    credentials: "include",
    cache: "no-store",
  });
  return read<ActiveUsersResponse>(res);
};

export const sendHeartbeat = async (currentPage?: string): Promise<{ success: boolean; activeCount: number }> => {
  try {
    const res = await fetch("/api/auth/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPage }),
      credentials: "include",
    });
    return read<{ success: boolean; activeCount: number }>(res);
  } catch {
    return { success: false, activeCount: 0 };
  }
};
