import { ApiError } from "./errors";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const invalidPagination = (field: string) =>
  new ApiError({
    code: "INVALID_PAGINATION",
    message: "Pagination parameters are invalid",
    status: 400,
    details: { field },
  });

const readPositiveInteger = (
  searchParams: URLSearchParams,
  field: string,
  fallback: number,
) => {
  const value = searchParams.get(field);

  if (value === null) {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw invalidPagination(field);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw invalidPagination(field);
  }

  return parsed;
};

export const readPagination = (
  input: Request | URL | URLSearchParams,
  options: { defaultPageSize?: number; maxPageSize?: number } = {},
) => {
  const searchParams =
    input instanceof URLSearchParams
      ? input
      : input instanceof URL
        ? input.searchParams
        : new URL(input.url).searchParams;
  const defaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE;
  const page = readPositiveInteger(searchParams, "page", 1);
  const pageSize = readPositiveInteger(
    searchParams,
    "pageSize",
    defaultPageSize,
  );

  if (pageSize > maxPageSize) {
    throw invalidPagination("pageSize");
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
};

export const createPaginationMeta = (
  page: number,
  pageSize: number,
  totalItems: number,
) => ({
  page,
  pageSize,
  totalItems,
  totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
});
