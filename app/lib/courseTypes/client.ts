"use client";
import type { CourseTypeRecord, CourseTypeStatus, CreateCourseTypeInput, UpdateCourseTypeInput } from "./types";
type Fetcher = typeof fetch;
type Envelope<T> = { ok: true; data: T } | { ok: false; error?: { code?: string; message?: string } };
export class CourseTypeClientError extends Error { constructor(readonly code = "COURSE_TYPE_REQUEST_FAILED", message = "Course type request failed") { super(message); this.name = "CourseTypeClientError"; } }
const read = async <T>(response: Response): Promise<T> => { let body: Envelope<T>; try { body = await response.json() as Envelope<T>; } catch { throw new CourseTypeClientError(); } if (!response.ok || body.ok !== true) { const e = body.ok === false ? body.error : undefined; throw new CourseTypeClientError(e?.code, e?.message); } return body.data; };
const json = (method: string, body: unknown): RequestInit => ({ method, credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const listCourseTypes = async (filters: { status?: CourseTypeStatus } = {}, fetcher: Fetcher = fetch) => { const p = new URLSearchParams({ page: "1", pageSize: "100" }); if (filters.status) p.set("status", filters.status); return read<{ items: CourseTypeRecord[] }>(await fetcher(`/api/master-data/course-types?${p}`, { credentials: "include", cache: "no-store" })); };
export const createCourseType = async (input: CreateCourseTypeInput, fetcher: Fetcher = fetch) => read<{ courseType: CourseTypeRecord }>(await fetcher("/api/master-data/course-types", json("POST", input)));
export const updateCourseType = async (id: string, input: UpdateCourseTypeInput, fetcher: Fetcher = fetch) => read<{ courseType: CourseTypeRecord }>(await fetcher(`/api/master-data/course-types/${id}`, json("PATCH", input)));
export const deleteCourseType = async (id: string, fetcher: Fetcher = fetch) => read<{ courseType: CourseTypeRecord; outcome: "DELETED" }>(await fetcher(`/api/master-data/course-types/${id}`, { method: "DELETE", credentials: "include" }));
