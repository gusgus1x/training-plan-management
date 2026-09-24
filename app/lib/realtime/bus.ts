import type { AuthenticatedPrincipal, RoleCode } from "../auth/types";
import type { RealtimeEvent } from "./events";

/**
 * Who an event is for. Any one match is enough. An event only ever says *what* changed; the page
 * that hears it refetches through its usual API, which is where access is really checked - so a
 * wide audience costs a wasted refetch, never a leak.
 */
export type Audience = {
  all?: boolean;
  roles?: readonly RoleCode[];
  /** HRD_FACTORY accounts of these companies (company_id). */
  factoryCompanies?: ReadonlyArray<string | bigint | null | undefined>;
  /** Login accounts (user_account.user_id). */
  accounts?: ReadonlyArray<string | bigint | null | undefined>;
  /** People (employee.user_id), matched to their account through the session. */
  employees?: ReadonlyArray<string | null | undefined>;
};

type Listener = { principal: AuthenticatedPrincipal; send: (event: RealtimeEvent) => void };

const has = (list: ReadonlyArray<string | bigint | null | undefined> | undefined, value: string | null) =>
  value !== null && Boolean(list?.some((item) => item !== null && item !== undefined && String(item) === value));

export const audienceIncludes = (audience: Audience, principal: AuthenticatedPrincipal) =>
  Boolean(audience.all) ||
  Boolean(audience.roles?.includes(principal.role)) ||
  (principal.role === "HRD_FACTORY" && has(audience.factoryCompanies, principal.companyId)) ||
  has(audience.accounts, principal.userId) ||
  has(audience.employees, principal.employeeUserId);

// ponytail: in-process only. One server process is how this app runs; teammates each running their
// own `next dev` against the shared DB will not see each other's events. Crossing processes needs a
// shared channel (a DB event table polled, or Redis pub/sub).
const globalForBus = globalThis as unknown as { realtimeListeners?: Set<Listener> };
const listeners = (globalForBus.realtimeListeners ??= new Set<Listener>());

/** Registers one open stream; returns the function that removes it. */
export const subscribe = (principal: AuthenticatedPrincipal, send: (event: RealtimeEvent) => void) => {
  const listener: Listener = { principal, send };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Tells every open stream in the audience that something changed. Call it after the change is
 * saved. Never throws: the change has happened, and a stream that cannot be told only misses a
 * refresh.
 */
export const publish = (event: RealtimeEvent, audience: Audience) => {
  const sent: RealtimeEvent = audience.all ? { ...event, spread: true } : event;
  for (const listener of listeners) {
    try {
      if (audienceIncludes(audience, listener.principal)) listener.send(sent);
    } catch {
      // A closed stream; its own cleanup removes it.
    }
  }
};

export const listenerCount = () => listeners.size;
