// The company logo picked at the last successful sign-in on this browser, so the login page reopens
// with it already selected.
//
// Kept out of LoginPage.tsx on purpose: tests/ui/login-ui-contract.test.ts forbids browser storage
// in the login UI so credentials never land there. This module is the one exception, and
// tests/auth/last-login-company.test.ts pins it to storing nothing but a known company code -
// never the employee ID or password (login PCs are shared).

export const LAST_LOGIN_COMPANY_CODES = ["ATA", "SNF", "NIC", "ATFB", "SATI", "TEP"] as const;
export type LastLoginCompany = (typeof LAST_LOGIN_COMPANY_CODES)[number];

const STORAGE_KEY = "attg.login.lastCompany";

const isCompany = (value: string | null): value is LastLoginCompany =>
  LAST_LOGIN_COMPANY_CODES.includes(value as LastLoginCompany);

export const readLastLoginCompany = (): LastLoginCompany | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isCompany(stored) ? stored : null;
  } catch {
    return null;
  }
};

/** Pass null after a general (Admin/HQ) sign-in to forget the company. */
export const rememberLastLoginCompany = (company: LastLoginCompany | null) => {
  try {
    if (isCompany(company)) window.localStorage.setItem(STORAGE_KEY, company);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private window, policy): the page just opens without a preselected logo.
  }
};

// Nothing else writes the key while the page is open, so there is nothing to subscribe to.
export const noLastLoginCompanySubscription = () => () => {};
