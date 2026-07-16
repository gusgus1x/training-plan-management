import { randomBytes } from "node:crypto";
import { ApiError } from "../api/errors";
import {
  authenticationRepository,
  type AuthenticationRepository,
} from "./repository";
import { hashPassword, verifyPassword } from "./password";
import {
  ROLE_CODES,
  type AuthenticatedPrincipal,
  type AuthenticationAccount,
  type RoleCode,
} from "./types";

type PasswordVerifier = (
  passwordHash: string,
  plaintext: string,
) => Promise<boolean>;

type AuthenticationDependencies = {
  repository?: AuthenticationRepository;
  verify?: PasswordVerifier;
  getDummyHash?: () => Promise<string>;
};

const invalidCredentials = () =>
  new ApiError({
    code: "INVALID_CREDENTIALS",
    message: "Invalid username or password",
    status: 401,
  });

const isActive = (status: string | null) => status === "ACTIVE";

const isRoleCode = (roleCode: string): roleCode is RoleCode =>
  ROLE_CODES.some((candidate) => candidate === roleCode);

const hasActiveOptionalAssociation = (
  id: string | null,
  status: string | null,
) => id === null || isActive(status);

const firstAvailable = (...values: Array<string | null>) =>
  values.find((value) => value?.trim()) ?? null;

const buildProfile = (account: AuthenticationAccount) => ({
  email: firstAvailable(account.employeeEmail, account.accountEmail),
  employeeCode: account.employeeCode,
  displayName: firstAvailable(
    [account.employeeFirstNameTh, account.employeeLastNameTh]
      .filter(Boolean)
      .join(" ") || null,
    [account.employeeFirstNameEn, account.employeeLastNameEn]
      .filter(Boolean)
      .join(" ") || null,
  ),
  companyCode: account.companyCode,
  companyName: firstAvailable(account.companyNameTh, account.companyNameEn),
  functionCode: account.functionCode,
  functionName: firstAvailable(account.functionNameTh, account.functionNameEn),
  positionCode: account.positionCode,
  positionName: firstAvailable(account.positionNameTh, account.positionNameEn),
  levelCode: account.levelCode,
  levelName: firstAvailable(account.levelNameTh, account.levelNameEn),
  pl: account.pl,
});

export const resolveActivePrincipal = (
  account: AuthenticationAccount,
): AuthenticatedPrincipal | null => {
  if (
    !isActive(account.accountStatus) ||
    !isActive(account.roleStatus) ||
    !isRoleCode(account.roleCode) ||
    !hasActiveOptionalAssociation(account.employeeId, account.employeeStatus) ||
    !hasActiveOptionalAssociation(
      account.employeeCompanyId,
      account.employeeCompanyStatus,
    ) ||
    !hasActiveOptionalAssociation(
      account.accountCompanyId,
      account.accountCompanyStatus,
    )
  ) {
    return null;
  }

  if (account.roleCode === "EMPLOYEE") {
    if (
      account.employeeId === null ||
      account.employeeCompanyId === null ||
      !isActive(account.employeeStatus) ||
      !isActive(account.employeeCompanyStatus) ||
      (account.accountCompanyId !== null &&
        account.accountCompanyId !== account.employeeCompanyId)
    ) {
      return null;
    }

    return {
      userId: account.userId,
      username: account.username,
      role: account.roleCode,
      employeeId: account.employeeId,
      companyId: account.employeeCompanyId,
      ...buildProfile(account),
    };
  }

  if (account.roleCode === "HRD_FACTORY") {
    if (
      account.accountCompanyId === null ||
      !isActive(account.accountCompanyStatus)
    ) {
      return null;
    }

    return {
      userId: account.userId,
      username: account.username,
      role: account.roleCode,
      employeeId: account.employeeId,
      companyId: account.accountCompanyId,
      ...buildProfile(account),
    };
  }

  return {
    userId: account.userId,
    username: account.username,
    role: account.roleCode,
    employeeId: null,
    companyId: null,
    ...buildProfile(account),
  };
};

let dummyHashPromise: Promise<string> | undefined;

const getDefaultDummyHash = () => {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(32).toString("base64url"));
  }

  return dummyHashPromise;
};

export const authenticateCredentials = async (
  username: string,
  password: string,
  dependencies: AuthenticationDependencies = {},
) => {
  const repository = dependencies.repository ?? authenticationRepository;
  const verify = dependencies.verify ?? verifyPassword;
  const getDummyHash = dependencies.getDummyHash ?? getDefaultDummyHash;
  const account = await repository.findByUsername(username);

  if (!account) {
    await verify(await getDummyHash(), password);
    throw invalidCredentials();
  }

  const passwordMatches = await verify(account.passwordHash, password);
  const principal = resolveActivePrincipal(account);

  if (!passwordMatches || !principal) {
    throw invalidCredentials();
  }

  return principal;
};

export const revalidateAuthenticatedUser = async (
  userId: string,
  repository: AuthenticationRepository = authenticationRepository,
) => {
  const account = await repository.findByUserId(userId);
  const principal = account ? resolveActivePrincipal(account) : null;

  if (!principal) {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Authentication required",
      status: 401,
    });
  }

  return principal;
};
