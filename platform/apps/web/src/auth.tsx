/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { api, type Session } from "./api";

type AuthState = {
  session: Session | null;
  loading: boolean;
  refresh(): Promise<Session | null>;
  login(email: string, password: string, mfaCode?: string): Promise<{ mfaRequired?: boolean }>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api<Session>("/api/session");
      setSession(result);
      return result;
    } catch {
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      refresh,
      async login(email, password, mfaCode) {
        const result = await api<Session & { mfaRequired?: boolean }>("/api/auth/login", {
          method: "POST",
          body: { email, password, ...(mfaCode ? { mfaCode } : {}) }
        });
        if (result.mfaRequired) return { mfaRequired: true };
        setSession(result);
        return {};
      },
      async logout() {
        await api<void>("/api/auth/logout", { method: "POST" });
        setSession(null);
      }
    }),
    [loading, refresh, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
