"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LoginRequest, RegisterRequest, AuthResponse } from "@/types";

interface UseAuthReturn {
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  register: (credentials: RegisterRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useAuth(): UseAuthReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data: AuthResponse = await res.json();
      if (data.success) {
        // Cookie is set server-side — just navigate
        router.push("/dashboard");
        router.refresh(); // Force RSC re-render so middleware sees the new cookie
      } else {
        setError(data.message);
      }
      return data;
    } catch {
      const msg = "Network error — please try again";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterRequest): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data: AuthResponse = await res.json();
      if (data.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.message);
      }
      return data;
    } catch {
      const msg = "Network error — please try again";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return { login, register, logout, loading, error };
}
