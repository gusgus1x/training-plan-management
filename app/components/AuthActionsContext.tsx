"use client";

import { createContext, useContext, type ReactNode } from "react";

type AuthActions = { logout: () => void };

const AuthActionsContext = createContext<AuthActions>({ logout: () => {} });

export function AuthActionsProvider({
  actions,
  children,
}: {
  actions: AuthActions;
  children: ReactNode;
}) {
  return (
    <AuthActionsContext.Provider value={actions}>
      {children}
    </AuthActionsContext.Provider>
  );
}

export const useAuthActions = () => useContext(AuthActionsContext);
