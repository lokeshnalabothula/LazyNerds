"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "@/types/client";
import { api, getStoredToken, setStoredToken } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  setSession: (session: { user: User; access_token: string }) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setUser(null);
        if (typeof document !== "undefined") {
          document.cookie = "fixops_access_token=; path=/; max-age=0; SameSite=Lax;";
        }
        setLoading(false);
        return;
      }
      if (typeof document !== "undefined" && !document.cookie.includes("fixops_access_token=")) {
        const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `fixops_access_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax${secureFlag}`;
      }
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
      setStoredToken(null);
      if (typeof document !== "undefined") {
        document.cookie = "fixops_access_token=; path=/; max-age=0; SameSite=Lax;";
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await api.login(email, password);
      setUser(result.user);
      setStoredToken(result.access_token);

      if (typeof document !== "undefined") {
        const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `fixops_access_token=${encodeURIComponent(result.access_token)}; path=/; max-age=86400; SameSite=Lax${secureFlag}`;
      }

      // Redirect to overview landing page by default, or to safe preserved redirect path
      let targetPath = "/overview";
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectParam = urlParams.get("redirect");
        if (
          redirectParam &&
          redirectParam.startsWith("/") &&
          !redirectParam.startsWith("//") &&
          redirectParam !== "/login" &&
          redirectParam !== "/register"
        ) {
          targetPath = redirectParam;
        }
      }
      router.push(targetPath);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.logout();
    } catch {
      // Safe fallback if network error occurs during sign out
    } finally {
      setUser(null);
      setStoredToken(null);
      if (typeof document !== "undefined") {
        document.cookie = "fixops_access_token=; path=/; max-age=0; SameSite=Lax;";
      }
      setLoading(false);
      router.push("/login");
    }
  };

  const setSession = useCallback((session: { user: User; access_token: string }) => {
    setStoredToken(session.access_token);
    if (typeof document !== "undefined") {
      const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `fixops_access_token=${encodeURIComponent(session.access_token)}; path=/; max-age=86400; SameSite=Lax${secureFlag}`;
    }
    setUser(session.user);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
