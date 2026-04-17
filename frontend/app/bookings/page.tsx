"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import AppNav from "@/components/app-nav";

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  startAt: string;
  endAt: string;
  isPast?: boolean;
  totalPaid: number;
  court?: {
    name: string;
    complex?: {
      name: string;
    };
  };
};

type AuthMe = {
  role: "USER" | "OWNER" | "STAFF";
};

type BookingTab = "ACTIVE" | "HISTORY";

function generatePaymentReference() {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `sim-${Date.now()}-${randomSuffix}`;
}

function getScope(tab: BookingTab) {
  return tab === "ACTIVE" ? "active" : "history";
}

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<BookingTab>("ACTIVE");
  const [authorized, setAuthorized] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);
  const latestAbortRef = useRef<AbortController | null>(null);

  const loadBookings = useCallback(async (tab: BookingTab) => {
    const requestId = ++latestRequestIdRef.current;
    latestAbortRef.current?.abort();
    const abortController = new AbortController();
    latestAbortRef.current = abortController;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Booking[]>(`/bookings/mine?scope=${getScope(tab)}`, {
        signal: abortController.signal,
      });
      if (requestId !== latestRequestIdRef.current) return;
      setBookings(data);
    } catch (err) {
      if (abortController.signal.aborted) return;
      if (requestId !== latestRequestIdRef.current) return;
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudieron cargar las reservas");
      }
    } finally {
      if (requestId !== latestRequestIdRef.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function checkRole() {
      setCheckingRole(true);
      setError(null);
      try {
        const me = await apiFetch<AuthMe>("/auth/me");
        if (me.role !== "USER") {
          router.replace("/complexes");
          return;
        }
        setAuthorized(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError || err instanceof Error) {
          setError(err.message);
        } else {
          setError("No se pudo validar tu sesión");
        }
      } finally {
        setCheckingRole(false);
      }
    }

    void checkRole();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    void loadBookings(activeTab);
  }, [authorized, activeTab, loadBookings]);

  useEffect(() => {
    return () => {
      latestAbortRef.current?.abort();
    };
  }, []);

  async function cancelBooking(bookingId: string) {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/bookings/${bookingId}/cancel`, { method: "PATCH" });
      setMessage("Reserva cancelada");
      await loadBookings(activeTab);
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo cancelar la reserva");
      }
    }
  }

  async function payBooking(bookingId: string) {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/bookings/${bookingId}/pay`, {
        method: "POST",
        body: JSON.stringify({ reference: generatePaymentReference() }),
      });
      setMessage("Pago simulado aplicado y reserva confirmada");
      await loadBookings(activeTab);
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo pagar la reserva");
      }
    }
  }

  function getStatusClasses(status: Booking["status"]) {
    if (status === "PENDING") {
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    }
    if (status === "CONFIRMED") {
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    }
    return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  }

  return (
    <motion.main
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <h1 className="text-2xl font-semibold text-zinc-100">Mis reservas</h1>
        <AppNav />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm text-zinc-300">
          Gestiona tus reservas activas y revisa tu historial.
        </p>
        {checkingRole && <p className="mt-2 text-sm text-zinc-400">Cargando...</p>}
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        {message && <p className="mt-2 text-sm text-emerald-300">{message}</p>}
      </div>

      {authorized && (
        <>
          <div className="relative flex w-fit rounded-full border border-zinc-800 bg-zinc-900 p-1">
            <motion.span
              className="absolute bottom-1 top-1 rounded-full bg-emerald-500/20"
              layout
              style={{
                left: activeTab === "ACTIVE" ? 4 : "calc(50% + 2px)",
                right: activeTab === "ACTIVE" ? "calc(50% + 2px)" : 4,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            />
            <button
              className="relative z-10 rounded-full px-4 py-2 text-sm font-medium text-zinc-100"
              onClick={() => setActiveTab("ACTIVE")}
              type="button"
            >
              Activas
            </button>
            <button
              className="relative z-10 rounded-full px-4 py-2 text-sm font-medium text-zinc-100"
              onClick={() => setActiveTab("HISTORY")}
              type="button"
            >
              Historial
            </button>
          </div>

          {loading && <p className="text-sm text-zinc-400">Cargando...</p>}

          <motion.ul
            className="grid gap-3"
            initial={false}
            transition={{ staggerChildren: 0.05 }}
          >
            <AnimatePresence mode="wait">
              {bookings.map((booking) => (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                  exit={{ opacity: 0, y: -6 }}
                  initial={{ opacity: 0, y: 10 }}
                  key={booking.id}
                  layout
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-100">
                        {booking.court?.name ?? "Cancha"} ·{" "}
                        {booking.court?.complex?.name ?? "Complejo"}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {new Date(booking.startAt).toLocaleString()} -{" "}
                        {new Date(booking.endAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${getStatusClasses(booking.status)}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    Total pagado: S/ {booking.totalPaid}
                  </p>
                  {activeTab === "ACTIVE" && booking.status === "PENDING" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-100 transition hover:border-rose-400 hover:text-rose-300"
                        onClick={() => void cancelBooking(booking.id)}
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
                        onClick={() => void payBooking(booking.id)}
                        type="button"
                      >
                        Pagar (simulado)
                      </button>
                    </div>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
          {!loading && bookings.length === 0 && (
            <p className="text-sm text-zinc-400">No hay reservas en esta sección.</p>
          )}
        </>
      )}
    </motion.main>
  );
}
