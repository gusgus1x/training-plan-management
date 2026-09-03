import { apiSuccess } from "../../../lib/api/response";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { getActiveSessionsList } from "../../../lib/auth/activeSessions";

const adminOptions = { allowedRoles: ["ADMIN"] as const };

export const GET = createProtectedRoute(async () => {
  const sessions = getActiveSessionsList();
  const onlineCount = sessions.filter((s) => s.status === "ONLINE").length;
  const idleCount = sessions.filter((s) => s.status === "IDLE").length;

  return apiSuccess({
    sessions,
    onlineCount,
    idleCount,
    totalActive: sessions.length,
  });
}, adminOptions);

