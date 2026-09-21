"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import { useAuthenticatedUser } from "../AuthenticatedUserContext";
import {
  buildEmployeeNotices,
  loadNoticeState,
  NOTICE_EVENT,
  stampFirstSeen,
  updateNoticeState,
  type NoticeState,
} from "./employeeNotices";

import type { TrainingRecordRequestRecord } from "../../lib/trainingRecordRequests/types";
import { listRecordRequests } from "../../lib/trainingRecordRequests/client";
import type { NotificationRecord } from "../../lib/notifications/types";
import { listNotifications } from "../../lib/notifications/client";

export type RecordRequestsState = {
  myRequests: TrainingRecordRequestRecord[];
  pendingApprovals: TrainingRecordRequestRecord[];
};

/** The notices for this employee's enrollments and training record requests, and what they have done with each one. */
export function useEmployeeNotices(
  enrollments: EnrollmentRecord[],
  initialRecordRequests?: RecordRequestsState,
) {
  const user = useAuthenticatedUser();
  // The login account's own id: always present, and unique per account.
  const userKey = user?.userId ?? null;
  const [recordRequests, setRecordRequests] = useState<RecordRequestsState>(
    initialRecordRequests ?? { myRequests: [], pendingApprovals: [] },
  );
  const [pendingApproverEnrollments, setPendingApproverEnrollments] = useState<EnrollmentRecord[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<NotificationRecord[]>([]);

  useEffect(() => {
    if (!userKey) return;
    let isMounted = true;

    // 1. Record requests
    listRecordRequests()
      .then((data) => {
        if (isMounted && data) {
          setRecordRequests({
            myRequests: data.myRequests || [],
            pendingApprovals: data.pendingApprovals || [],
          });
        }
      })
      .catch(() => {});

    // 2. Pending team enrollments for approver
    fetch("/api/training-plan/enrollments?pendingForApprover=true", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.ok && data.data?.enrollments) {
          setPendingApproverEnrollments(data.data.enrollments);
        }
      })
      .catch(() => {});

    // 3. System notifications
    listNotifications()
      .then((data) => {
        if (isMounted && data?.notifications) {
          setSystemNotifications(data.notifications);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [userKey]);

  const notices = useMemo(
    () => buildEmployeeNotices(enrollments, recordRequests, pendingApproverEnrollments, systemNotifications),
    [enrollments, recordRequests, pendingApproverEnrollments, systemNotifications],
  );
  const [state, setState] = useState<NoticeState>({});

  useEffect(() => {
    if (!userKey) return;
    const sync = () => setState(loadNoticeState(userKey));
    sync();
    window.addEventListener(NOTICE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NOTICE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userKey]);

  useEffect(() => {
    if (userKey && notices.length) updateNoticeState(userKey, (current) => stampFirstSeen(current, notices, Date.now()));
  }, [userKey, notices]);

  const update = useCallback(
    (change: (current: NoticeState) => NoticeState) => {
      if (userKey) updateNoticeState(userKey, change);
    },
    [userKey],
  );

  return { notices, state, update, userKey };
}
