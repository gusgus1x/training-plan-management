"use client";

import { useEffect, useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  APPROVED_TRAINING_NEED_STORAGE_KEY,
  EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY,
  type EmployeeTrainingNeedRequest,
  type TrainingNeedRequestStatus,
} from "../../../../lib/trainingRequests";
import styles from "./RequestTrainingNeed.module.css";

export const requestTrainingNeedModule = {
  title: "Request Training Need",
  subtitle: "Employee request inbox",
  description:
    "Review Course Needed and Request Reason submitted from the employee training request page.",
} as const;

const companies = ["SATI", "ATFB", "TEP", "ATA", "NIC", "SNF"] as const;
const statuses: Array<TrainingNeedRequestStatus | "all"> = [
  "all",
  "New Request",
  "Review",
  "Accepted",
  "Rejected",
];

const defaultRequests: EmployeeTrainingNeedRequest[] = [
  {
    id: "req-001",
    requestNo: "REQ-2026-001",
    employeeCode: "SATI-5401",
    employeeName: "Wipada Chaiporn",
    company: "SATI",
    functionName: "IT Promotion",
    courseNeed: "Advanced Quality Control",
    reason: "Need to improve quality inspection skills for production line work.",
    sourceCourse: "Quality Control Basics",
    sourceCourseDate: "24 Sep 2026",
    sourceCourseResult: "Pending",
    sourceCourseOwner: "Center",
    expectedBenefit: "Improve inspection accuracy and reduce repeat production issues.",
    preferredMonth: "August 2026",
    urgency: "High",
    status: "New Request",
    submittedAt: "2026-07-16",
    approvedBy: "",
  },
  {
    id: "req-002",
    requestNo: "REQ-2026-002",
    employeeCode: "ATFB-3202",
    employeeName: "Orasa Jandee",
    company: "ATFB",
    functionName: "Safety and Environment",
    courseNeed: "ISO 45001 Internal Audit",
    reason: "Team needs more internal auditors before the next surveillance audit.",
    expectedBenefit: "Improve audit readiness and close findings faster.",
    preferredMonth: "September 2026",
    urgency: "Normal",
    sourceCourseOwner: "Factory",
    status: "Review",
    submittedAt: "2026-07-12",
    approvedBy: "HRD Center",
  },
  {
    id: "req-003",
    requestNo: "REQ-2026-003",
    employeeCode: "TEP-2102",
    employeeName: "Benjamas Yingcharoen",
    company: "TEP",
    functionName: "Production Planing",
    courseNeed: "Advanced Excel for Planning",
    reason: "Planning team handles capacity files and needs stronger formula skills.",
    expectedBenefit: "Reduce planning errors and shorten weekly planning work.",
    preferredMonth: "October 2026",
    urgency: "Normal",
    sourceCourseOwner: "Center",
    status: "Accepted",
    submittedAt: "2026-07-08",
    approvedBy: "HRD Center",
  },
  {
    id: "req-004",
    requestNo: "REQ-2026-004",
    employeeCode: "NIC-4301",
    employeeName: "Kanda Rungrueang",
    company: "NIC",
    functionName: "Purchase",
    courseNeed: "Negotiation Skill",
    reason: "Purchasing staff need better supplier negotiation techniques.",
    expectedBenefit: "Improve cost saving discussions and supplier communication.",
    preferredMonth: "November 2026",
    urgency: "Low",
    sourceCourseOwner: "Factory",
    status: "New Request",
    submittedAt: "2026-07-18",
    approvedBy: "",
  },
];

const readStoredRequests = () => {
  if (typeof window === "undefined") {
    return [] as EmployeeTrainingNeedRequest[];
  }

  try {
    const storedValue = window.localStorage.getItem(EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY);
    return storedValue ? (JSON.parse(storedValue) as EmployeeTrainingNeedRequest[]) : [];
  } catch {
    return [] as EmployeeTrainingNeedRequest[];
  }
};

const mergeRequests = (storedRequests: EmployeeTrainingNeedRequest[]) => {
  const storedIds = new Set(storedRequests.map((request) => request.id));

  return [
    ...storedRequests,
    ...defaultRequests.filter((request) => !storedIds.has(request.id)),
  ];
};

type RequestTrainingNeedProps = {
  onOpenTrainingOap?: () => void;
};

export default function RequestTrainingNeed({ onOpenTrainingOap }: RequestTrainingNeedProps) {
  const user = useAuthenticatedUser();
  const userCompanyCode = profileValue(user?.companyCode);
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const [requests, setRequests] = useState<EmployeeTrainingNeedRequest[]>(defaultRequests);
  const [selectedId, setSelectedId] = useState(defaultRequests[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TrainingNeedRequestStatus | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<(typeof companies)[number] | "all">("all");

  useEffect(() => {
    const syncStoredRequests = () => {
      setRequests(mergeRequests(readStoredRequests()));
    };

    syncStoredRequests();
    window.addEventListener("storage", syncStoredRequests);
    window.addEventListener("employee-training-requests-changed", syncStoredRequests);

    return () => {
      window.removeEventListener("storage", syncStoredRequests);
      window.removeEventListener("employee-training-requests-changed", syncStoredRequests);
    };
  }, []);

  const selectedRequest =
    requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const courseOwner = request.sourceCourseOwner ?? "Center";
      const matchesPermission =
        isFactoryUser
          ? courseOwner === "Factory" &&
            (userCompanyCode === "-" || request.company === userCompanyCode)
          : courseOwner === "Center";
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesCompany = companyFilter === "all" || request.company === companyFilter;
      const matchesSearch =
        !query ||
        [
          request.requestNo,
          request.employeeCode,
          request.employeeName,
          request.company,
          request.functionName,
          request.courseNeed,
          request.reason,
          request.expectedBenefit,
          request.preferredMonth,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesPermission && matchesStatus && matchesCompany && matchesSearch;
    });
  }, [companyFilter, isFactoryUser, requests, search, statusFilter, userCompanyCode]);

  const updateSelectedStatus = (status: TrainingNeedRequestStatus) => {
    if (!selectedRequest) {
      return;
    }

    const updateRequest = (request: EmployeeTrainingNeedRequest) =>
      request.id === selectedRequest.id
        ? {
            ...request,
            status,
            approvedBy: status === "New Request" ? "" : "HRD Center",
          }
        : request;

    setRequests((current) => current.map((request) => updateRequest(request)));

    const storedRequests = readStoredRequests();
    if (storedRequests.some((request) => request.id === selectedRequest.id)) {
      window.localStorage.setItem(
        EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY,
        JSON.stringify(storedRequests.map((request) => updateRequest(request))),
      );
      window.dispatchEvent(new Event("employee-training-requests-changed"));
    }
  };

  const handleApproveToPlan = () => {
    if (!selectedRequest) {
      return;
    }

    updateSelectedStatus("Accepted");
    window.localStorage.setItem(
      APPROVED_TRAINING_NEED_STORAGE_KEY,
      JSON.stringify({
        ...selectedRequest,
        status: "Accepted" as TrainingNeedRequestStatus,
        approvedBy: "HRD Center",
      }),
    );
    window.dispatchEvent(new Event("approved-training-need-changed"));
    onOpenTrainingOap?.();
  };

  const handleRefresh = () => {
    setRequests(defaultRequests);
    window.localStorage.removeItem(EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY);
    window.dispatchEvent(new Event("employee-training-requests-changed"));
    setSelectedId(defaultRequests[0]?.id ?? "");
    setSearch("");
    setStatusFilter("all");
    setCompanyFilter("all");
  };

  return (
    <section className={styles.moduleWorkspace} aria-label="Request Training Need module">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{requestTrainingNeedModule.subtitle}</p>
          <h2>{requestTrainingNeedModule.title}</h2>
          <p>{requestTrainingNeedModule.description}</p>
          {isFactoryUser ? (
            <span className={styles.permissionNote}>
              Factory permission: {userCompanyCode} factory requests only
            </span>
          ) : (
            <span className={styles.permissionNote}>Center permission: center requests</span>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search employee training requests"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search request, employee, course, reason"
          />
          <select
            aria-label="Filter company"
            value={companyFilter}
            onChange={(event) =>
              setCompanyFilter(event.target.value as (typeof companies)[number] | "all")
            }
          >
            <option value="all">All companies</option>
            {companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as TrainingNeedRequestStatus | "all")
            }
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All status" : status}
              </option>
            ))}
          </select>
          <button className={styles.refreshButton} type="button" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Employee inbox</span>
              <h3>Training Requests</h3>
            </div>
            <p>{visibleRequests.length} in view</p>
          </div>

          <div className={styles.requestList}>
            {visibleRequests.map((request) => (
              <button
                className={request.id === selectedRequest?.id ? styles.activeRequest : styles.requestCard}
                key={request.id}
                type="button"
                onClick={() => setSelectedId(request.id)}
              >
                <span className={styles.cardTopline}>
                  <b>{request.requestNo}</b>
                  <i className={styles[request.urgency.toLowerCase()]}>{request.urgency}</i>
                </span>
                <strong>{request.courseNeed}</strong>
                <small>
                  {request.employeeName} / {request.company} / {request.functionName}
                </small>
                <small>{request.sourceCourseOwner ?? "Center"} course</small>
                <span className={styles.statusPill}>{request.status}</span>
              </button>
            ))}
            {visibleRequests.length === 0 ? (
              <div className={styles.emptyState}>No employee training request found.</div>
            ) : null}
          </div>
        </section>

        <section className={styles.detailPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Employee request preview</span>
              <h3>{selectedRequest?.courseNeed ?? "No request selected"}</h3>
            </div>
            {selectedRequest ? <p>{selectedRequest.status}</p> : null}
          </div>

          {selectedRequest ? (
            <>
              <div className={styles.employeeRequestPreview}>
                <article>
                  <span>Course Needed</span>
                  <strong>{selectedRequest.courseNeed}</strong>
                </article>
                <article>
                  <span>Request Reason</span>
                  <p>{selectedRequest.reason}</p>
                </article>
              </div>

              <dl className={styles.detailGrid}>
                {selectedRequest.sourceCourse ? (
                  <div className={styles.fullDetail}>
                    <dt>Based On Training Record</dt>
                    <dd>
                      {selectedRequest.sourceCourse} / {selectedRequest.sourceCourseDate ?? "-"} /{" "}
                      {selectedRequest.sourceCourseResult ?? "-"} /{" "}
                      {selectedRequest.sourceCourseOwner ?? "Center"}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Request No.</dt>
                  <dd>{selectedRequest.requestNo}</dd>
                </div>
                <div>
                  <dt>Employee</dt>
                  <dd>
                    {selectedRequest.employeeCode} / {selectedRequest.employeeName}
                  </dd>
                </div>
                <div>
                  <dt>Company</dt>
                  <dd>{selectedRequest.company}</dd>
                </div>
                <div>
                  <dt>Function</dt>
                  <dd>{selectedRequest.functionName}</dd>
                </div>
                <div>
                  <dt>Preferred Month</dt>
                  <dd>{selectedRequest.preferredMonth}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{selectedRequest.submittedAt}</dd>
                </div>
              </dl>

              <div className={styles.reasonBox}>
                <span>Expected Benefit</span>
                <p>{selectedRequest.expectedBenefit}</p>
              </div>

              <div className={styles.reviewActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => updateSelectedStatus("Review")}
                >
                  Mark Review
                </button>
                <button
                  className={styles.actionButton}
                  type="button"
                  onClick={handleApproveToPlan}
                >
                  Approve & Create Training
                </button>
                <button
                  className={styles.dangerButton}
                  type="button"
                  onClick={() => updateSelectedStatus("Rejected")}
                >
                  Reject
                </button>
              </div>
            </>
          ) : null}
        </section>
      </section>

    </section>
  );
}
