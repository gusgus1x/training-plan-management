import type { CourseListFilters, CreateCourseInput, UpdateCourseInput } from "./types";
import type { WorkflowCourse, WorkflowStandard } from "../trainingWorkflow";

const parseApiResponse = async <T>(response: Response): Promise<T> => {
  let json: any;
  try {
    json = await response.json();
  } catch {
    const errorMsg = response.status === 401 ? "Authentication required" : `Request failed with status ${response.status}`;
    console.error(`[API Error] ${response.status}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!response.ok || !json.ok) {
    const msg = json.error?.message || (response.status === 401 ? "Authentication required" : "An unexpected error occurred");
    const code = json.error?.code || (response.status === 401 ? "UNAUTHENTICATED" : "UNKNOWN");
    const details = json.error?.details ? JSON.stringify(json.error.details) : "";
    console.error(`[API Error] ${response.status} ${code}: ${msg}`, details, json);
    throw new Error(msg);
  }
  return json.data as T;
};

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listCourses = async (filters: CourseListFilters) => {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  const response = await fetch(`/api/course-master/courses?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ courses: WorkflowCourse[]; standards: WorkflowStandard[] }>(response);
};

export const createCourse = async (input: CreateCourseInput) => {
  const response = await fetch("/api/course-master/courses", jsonInit("POST", input));
  return parseApiResponse<{ courseId: string }>(response);
};

export const updateCourse = async (id: string, input: UpdateCourseInput) => {
  const response = await fetch(`/api/course-master/courses/${id}`, jsonInit("PUT", input));
  return parseApiResponse<{ courseId: string }>(response);
};

export const deleteCourse = async (id: string) => {
  const response = await fetch(`/api/course-master/courses/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return parseApiResponse<{ courseId: string }>(response);
};

