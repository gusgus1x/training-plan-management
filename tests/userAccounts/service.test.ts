import { describe, expect, it, vi } from "vitest";
import { createUserAccountService } from "../../app/lib/userAccounts/service";
import type { UserAccountRecord } from "../../app/lib/userAccounts/types";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const account = (overrides: Partial<UserAccountRecord> = {}): UserAccountRecord => ({
  userId: "5",
  username: "someone",
  email: null,
  roleCode: "HRD_CENTER",
  roleName: "HRD Center",
  companyId: null,
  companyCode: null,
  employeeId: null,
  employeeName: null,
  status: "ACTIVE",
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const repo = (overrides: Record<string, unknown> = {}) =>
  ({
    roleIdFor: vi.fn().mockResolvedValue(3),
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(account()),
    usernameTaken: vi.fn().mockResolvedValue(false),
    countActiveAdmins: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockImplementation(async (input) => account({ username: input.username })),
    update: vi.fn().mockResolvedValue(account()),
    setPassword: vi.fn().mockResolvedValue(account()),
    ...overrides,
  }) as never;

const admin = { userId: "1", username: "admin", role: "ADMIN" } as AuthenticatedPrincipal;

const newAccount = {
  username: "new.user",
  password: "correct-horse-battery",
  email: null,
  status: "ACTIVE" as const,
};

describe("user account service", () => {
  it("requires an employee link for EMPLOYEE accounts", async () => {
    const service = createUserAccountService(repo());
    await expect(
      service.create({ ...newAccount, roleCode: "EMPLOYEE", companyId: "2", employeeId: null }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("requires a company for HRD_FACTORY accounts", async () => {
    const service = createUserAccountService(repo());
    await expect(
      service.create({ ...newAccount, roleCode: "HRD_FACTORY", companyId: null, employeeId: null }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuses to scope an ADMIN to a company or an employee", async () => {
    const service = createUserAccountService(repo());
    await expect(
      service.create({ ...newAccount, roleCode: "ADMIN", companyId: "2", employeeId: null }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.create({ ...newAccount, roleCode: "ADMIN", companyId: null, employeeId: "7" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("hashes the password instead of storing it", async () => {
    const repository = repo();
    const service = createUserAccountService(repository);
    await service.create({ ...newAccount, roleCode: "ADMIN", companyId: null, employeeId: null });

    const [, storedHash] = (repository as never as { create: { mock: { calls: unknown[][] } } })
      .create.mock.calls[0];
    expect(storedHash).not.toBe(newAccount.password);
    expect(String(storedHash)).toMatch(/^\$argon2id\$/);
  });

  it("rejects a duplicate username", async () => {
    const service = createUserAccountService(repo({ usernameTaken: vi.fn().mockResolvedValue(true) }));
    await expect(
      service.create({ ...newAccount, roleCode: "ADMIN", companyId: null, employeeId: null }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("stops an administrator changing their own role or status", async () => {
    const service = createUserAccountService(
      repo({ findById: vi.fn().mockResolvedValue(account({ userId: "1", roleCode: "ADMIN" })) }),
    );
    await expect(service.update(admin, "1", { roleCode: "EMPLOYEE" })).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.update(admin, "1", { status: "INACTIVE" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("keeps at least one active administrator", async () => {
    const service = createUserAccountService(
      repo({
        findById: vi.fn().mockResolvedValue(account({ userId: "9", roleCode: "ADMIN" })),
        countActiveAdmins: vi.fn().mockResolvedValue(0),
      }),
    );
    await expect(service.update(admin, "9", { status: "INACTIVE" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("allows disabling an administrator while another one remains", async () => {
    const service = createUserAccountService(
      repo({
        findById: vi.fn().mockResolvedValue(account({ userId: "9", roleCode: "ADMIN" })),
        countActiveAdmins: vi.fn().mockResolvedValue(1),
      }),
    );
    await expect(service.update(admin, "9", { status: "INACTIVE" })).resolves.toBeDefined();
  });

  it("reports a missing account as 404", async () => {
    const service = createUserAccountService(repo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(service.update(admin, "404", { status: "ACTIVE" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("allows changing the username when the new username is available", async () => {
    const repository = repo({
      findById: vi.fn().mockResolvedValue(account({ userId: "5", username: "old.name" })),
      usernameTaken: vi.fn().mockResolvedValue(false),
      update: vi.fn().mockImplementation(async (userId, input) => account({ userId, username: input.username })),
    });
    const service = createUserAccountService(repository);
    const updated = await service.update(admin, "5", { username: "new.name" });
    expect(updated.username).toBe("new.name");
  });

  it("rejects changing the username if the new username is already taken", async () => {
    const repository = repo({
      findById: vi.fn().mockResolvedValue(account({ userId: "5", username: "old.name" })),
      usernameTaken: vi.fn().mockResolvedValue(true),
    });
    const service = createUserAccountService(repository);
    await expect(service.update(admin, "5", { username: "taken.name" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("does not check usernameTaken if the username is not changed", async () => {
    const usernameTakenMock = vi.fn().mockResolvedValue(true);
    const repository = repo({
      findById: vi.fn().mockResolvedValue(account({ userId: "5", username: "same.name" })),
      usernameTaken: usernameTakenMock,
    });
    const service = createUserAccountService(repository);
    await service.update(admin, "5", { username: "same.name", email: "new@example.com" });
    expect(usernameTakenMock).not.toHaveBeenCalled();
  });

  it("allows an administrator to update their own username", async () => {
    const repository = repo({
      findById: vi.fn().mockResolvedValue(account({ userId: "1", username: "admin", roleCode: "ADMIN" })),
      usernameTaken: vi.fn().mockResolvedValue(false),
      update: vi.fn().mockImplementation(async (userId, input) =>
        account({ userId, username: input.username, roleCode: "ADMIN" }),
      ),
    });
    const service = createUserAccountService(repository);
    const updated = await service.update(admin, "1", { username: "admin.super" });
    expect(updated.username).toBe("admin.super");
  });

  it("allows updating username on an existing employee account without employeeId", async () => {
    const repository = repo({
      findById: vi.fn().mockResolvedValue(
        account({ userId: "10", username: "old.emp", roleCode: "EMPLOYEE", employeeId: null }),
      ),
      usernameTaken: vi.fn().mockResolvedValue(false),
      update: vi.fn().mockImplementation(async (userId, input) =>
        account({ userId, username: input.username, roleCode: "EMPLOYEE", employeeId: null }),
      ),
    });
    const service = createUserAccountService(repository);
    const updated = await service.update(admin, "10", { username: "new.emp" });
    expect(updated.username).toBe("new.emp");
  });
});


