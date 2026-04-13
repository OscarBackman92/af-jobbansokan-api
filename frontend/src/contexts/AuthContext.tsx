import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, logout as apiLogout } from "../api/auth";
import type { MeResponse } from "../api/auth";

interface AuthCtx {
  user: MeResponse | null;
  loading: boolean;
  refetch: () => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, refetch: () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    fetchMe()
      .then(setUser)
      .catch(() => { localStorage.clear(); setUser(null); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, refetch: load, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
