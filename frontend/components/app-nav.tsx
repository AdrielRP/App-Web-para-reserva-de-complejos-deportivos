"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { authStorage } from "@/lib/authStorage";

type Role = "USER" | "OWNER" | "STAFF";

type AuthMe = {
  role: Role;
};

export default function AppNav() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const hasToken = Boolean(authStorage.getToken());

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      const token = authStorage.getToken();
      if (!token) {
        if (!cancelled) setRole(null);
        return;
      }

      try {
        const me = await apiFetch<AuthMe>("/auth/me");
        if (!cancelled) setRole(me.role);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          authStorage.clearToken();
          if (!cancelled) setRole(null);
        }
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    authStorage.clearToken();
    setRole(null);
    router.push("/login");
  }

  return (
    <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-3">
      <Link className="rounded border px-3 py-2 text-sm" href="/complexes">
        Ver complejos
      </Link>
      {role === "USER" && (
        <Link className="rounded border px-3 py-2 text-sm" href="/bookings">
          Mis reservas
        </Link>
      )}
      {role === "OWNER" && (
        <Link className="rounded border px-3 py-2 text-sm" href="/owner/bookings">
          Reservas owner
        </Link>
      )}
      {!hasToken && (
        <Link className="rounded border px-3 py-2 text-sm" href="/login">
          Login
        </Link>
      )}
      {hasToken && (
        <button className="rounded border px-3 py-2 text-sm" onClick={logout} type="button">
          Cerrar sesión
        </button>
      )}
    </nav>
  );
}
