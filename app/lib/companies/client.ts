"use client";

import type {
  CompanyListResponse,
  CompanyRecord,
  CreateCompanyInput,
  UpdateCompanyInput,
} from "./types";

type Fetcher = typeof fetch;

type SuccessEnvelope<T> = {
  ok: true;
  data: T;
};

type ErrorEnvelope = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
};

export class CompanyClientError extends Error {
  readonly code: string;

  constructor(code = "COMPANY_REQUEST_FAILED", message = "Company request failed") {
    super(message);
    this.name = "CompanyClientError";
    this.code = code;
  }
}

const readResponse = async <Data>(response: Response): Promise<Data> => {
  let body: SuccessEnvelope<Data> | ErrorEnvelope;

  try {
    body = (await response.json()) as SuccessEnvelope<Data> | ErrorEnvelope;
  } catch {
    throw new CompanyClientError();
  }

  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new CompanyClientError(error?.code, error?.message);
  }

  return body.data;
};

export const listCompanies = async (fetcher: Fetcher = fetch) => {
  const response = await fetcher(
    "/api/master-data/companies?page=1&pageSize=100",
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    },
  );

  return readResponse<CompanyListResponse>(response);
};

export const createCompany = async (
  input: CreateCompanyInput,
  fetcher: Fetcher = fetch,
) => {
  const response = await fetcher("/api/master-data/companies", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  return readResponse<{ company: CompanyRecord }>(response);
};

export const updateCompany = async (
  companyId: string,
  input: UpdateCompanyInput,
  fetcher: Fetcher = fetch,
) => {
  const response = await fetcher(`/api/master-data/companies/${companyId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  return readResponse<{ company: CompanyRecord }>(response);
};

export const deleteCompany = async (
  companyId: string,
  fetcher: Fetcher = fetch,
) => {
  const response = await fetcher(`/api/master-data/companies/${companyId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return readResponse<{ company: CompanyRecord }>(response);
};
