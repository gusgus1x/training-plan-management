import { ApiError } from "../api/errors";
import {
  instituteProviderRepository,
  type InstituteProviderRepository,
} from "./repository";
import type {
  CreateInstituteProviderInput,
  InstituteProviderListFilters,
  UpdateInstituteProviderInput,
} from "./types";

const notFound = () =>
  new ApiError({
    code: "INSTITUTE_PROVIDER_NOT_FOUND",
    message: "Institute/Provider not found",
    status: 404,
  });
const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });

export type InstituteProviderService = ReturnType<typeof createInstituteProviderService>;
export const createInstituteProviderService = (
  repository: InstituteProviderRepository = instituteProviderRepository,
) => ({
  listInstituteProviders: (filters: InstituteProviderListFilters) =>
    repository.list(filters),
  async getInstituteProvider(id: string) {
    const record = await repository.findById(id);
    if (!record) throw notFound();
    return record;
  },
  async createInstituteProvider(input: CreateInstituteProviderInput) {
    if (await repository.findByCode(input.instituteProviderCode)) {
      throw conflict(
        "INSTITUTE_PROVIDER_CODE_CONFLICT",
        "Institute/Provider code already exists",
      );
    }
    return repository.create(input);
  },
  async updateInstituteProvider(id: string, input: UpdateInstituteProviderInput) {
    if (!(await repository.findById(id))) throw notFound();
    if (
      input.instituteProviderCode &&
      (await repository.findByCode(input.instituteProviderCode, id))
    ) {
      throw conflict(
        "INSTITUTE_PROVIDER_CODE_CONFLICT",
        "Institute/Provider code already exists",
      );
    }
    return repository.update(id, input);
  },
  async deleteInstituteProvider(id: string) {
    const current = await repository.findById(id);
    if (!current) throw notFound();

    if (await repository.isReferenced(id)) {
      return {
        instituteProvider:
          current.status === "INACTIVE"
            ? current
            : await repository.update(id, { status: "INACTIVE" }),
        outcome: "DEACTIVATED" as const,
      };
    }

    try {
      return {
        instituteProvider: await repository.delete(id),
        outcome: "DELETED" as const,
      };
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        return {
          instituteProvider: await repository.update(id, { status: "INACTIVE" }),
          outcome: "DEACTIVATED" as const,
        };
      }
      throw error;
    }
  },
});

export const instituteProviderService = createInstituteProviderService();
