"use client";

import type { CertificatePlanView, CertificateUploadResult, ConfirmCertificatesInput } from "./types";

type Fetcher = typeof fetch;

const parseApiResponse = async <T>(response: Response): Promise<T> => {
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    const message =
      json.error?.message || (response.status === 401 ? "Authentication required" : "An unexpected error occurred");
    throw new Error(message);
  }
  return json.data as T;
};

const basePath = (planId: string) => `/api/training-plan/training-records/${planId}/certificates`;

export const loadPlanCertificates = async (
  planId: string,
  fetcher: Fetcher = fetch,
): Promise<CertificatePlanView> => {
  const response = await fetcher(basePath(planId), { credentials: "include", cache: "no-store" });
  return parseApiResponse<CertificatePlanView>(response);
};

export const uploadPlanCertificates = async (
  planId: string,
  files: readonly File[],
  fetcher: Fetcher = fetch,
): Promise<CertificateUploadResult> => {
  const body = new FormData();
  for (const file of files) body.append("files", file);

  // No Content-Type header: the browser has to set it so it can add the multipart boundary.
  const response = await fetcher(basePath(planId), { method: "POST", body, credentials: "include" });
  return parseApiResponse<CertificateUploadResult>(response);
};

export const confirmPlanCertificates = async (
  planId: string,
  input: ConfirmCertificatesInput,
  fetcher: Fetcher = fetch,
): Promise<CertificatePlanView> => {
  const response = await fetcher(`${basePath(planId)}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  return parseApiResponse<CertificatePlanView>(response);
};

export const discardPlanCertificates = async (
  planId: string,
  fetcher: Fetcher = fetch,
): Promise<CertificatePlanView> => {
  const response = await fetcher(basePath(planId), { method: "DELETE", credentials: "include" });
  return parseApiResponse<CertificatePlanView>(response);
};

/** Takes one uploaded file out of the draft, on the server rather than only on screen. */
export const removePlanCertificateFile = async (
  planId: string,
  certificateFileId: string,
  fetcher: Fetcher = fetch,
): Promise<CertificatePlanView> => {
  const response = await fetcher(`${basePath(planId)}/${certificateFileId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return parseApiResponse<CertificatePlanView>(response);
};

/** The authenticated stream. Used as an iframe src for preview and as an anchor href to download. */
export const certificateFileUrl = (certificateFileId: string, options: { download?: boolean } = {}): string =>
  `/api/certificates/${certificateFileId}/file${options.download ? "?download=1" : ""}`;
