import { publish } from "../realtime/bus";

export type ActiveUserSession = {
  userId: string;
  username: string;
  role: string;
  companyCode: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  currentPage: string;
  loginAt: string;
  lastActiveAt: string;
  status: "ONLINE" | "IDLE";
};

type InternalSession = {
  userId: string;
  username: string;
  role: string;
  companyCode: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  currentPage: string;
  loginAt: Date;
  lastActiveAt: Date;
};

// Global singleton map to survive hot-reloads during development
const globalForSessions = globalThis as unknown as {
  activeUserSessionsMap?: Map<string, InternalSession>;
};

const sessionsMap =
  globalForSessions.activeUserSessionsMap ?? new Map<string, InternalSession>();

if (process.env.NODE_ENV !== "production") {
  globalForSessions.activeUserSessionsMap = sessionsMap;
}

export const trackUserSession = (data: {
  userId: string;
  username: string;
  role: string;
  companyCode?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  currentPage?: string;
}) => {
  const existing = sessionsMap.get(data.userId);
  const now = new Date();
  // Only a change Admin would see: someone new, or on another page. Heartbeats alone stay quiet.
  if (!existing || (data.currentPage && data.currentPage !== existing.currentPage)) {
    publish({ type: "session.changed" }, { roles: ["ADMIN"] });
  }
  sessionsMap.set(data.userId, {
    userId: data.userId,
    username: data.username,
    role: data.role,
    companyCode: data.companyCode ?? existing?.companyCode ?? null,
    ipAddress: data.ipAddress ?? existing?.ipAddress ?? null,
    userAgent: data.userAgent ?? existing?.userAgent ?? null,
    currentPage: data.currentPage ?? existing?.currentPage ?? "หน้าแรก",
    loginAt: existing?.loginAt ?? now,
    lastActiveAt: now,
  });
};

export const removeUserSession = (userId: string) => {
  if (sessionsMap.delete(userId)) publish({ type: "session.changed" }, { roles: ["ADMIN"] });
};

export const getActiveSessionsList = (
  idleThresholdMs = 10 * 60 * 1000,
  offlineThresholdMs = 30 * 60 * 1000,
): ActiveUserSession[] => {
  const now = Date.now();
  const list: ActiveUserSession[] = [];

  for (const [userId, session] of sessionsMap.entries()) {
    const elapsed = now - session.lastActiveAt.getTime();
    if (elapsed > offlineThresholdMs) {
      sessionsMap.delete(userId);
      continue;
    }
    list.push({
      userId: session.userId,
      username: session.username,
      role: session.role,
      companyCode: session.companyCode,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      currentPage: session.currentPage,
      loginAt: session.loginAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
      status: elapsed <= idleThresholdMs ? "ONLINE" : "IDLE",
    });
  }

  return list.sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
  );
};
