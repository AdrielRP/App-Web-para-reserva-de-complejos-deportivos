"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

  const loadBookings = useCallback(async (tab: BookingTab) => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Booking[]>(`/bookings/mine?scope=${getScope(tab)}`);
      if (requestId !== latestRequestIdRef.current) return;
      setBookings(data);
    } catch (err) {
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
    setBookings([]);
    void loadBookings(activeTab);
  }, [authorized, activeTab, loadBookings]);

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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Mis reservas</h1>
        <AppNav />
      </div>

      {checkingRole && <p>Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {authorized && (
        <>
          <div className="flex gap-2">
            <button
              className={`rounded border px-3 py-1 text-sm ${activeTab === "ACTIVE" ? "bg-zinc-100" : ""}`}
              onClick={() => setActiveTab("ACTIVE")}
              type="button"
            >
              Activas
            </button>
            <button
              className={`rounded border px-3 py-1 text-sm ${activeTab === "HISTORY" ? "bg-zinc-100" : ""}`}
              onClick={() => setActiveTab("HISTORY")}
              type="button"
            >
              Historial
            </button>
          </div>

          {loading && <p>Cargando...</p>}

          <ul className="grid gap-3">
            {bookings.map((booking) => (
              <li className="rounded border p-4" key={booking.id}>
                <p className="font-medium">
                  {booking.court?.name ?? "Cancha"} ·{" "}
                  {booking.court?.complex?.name ?? "Complejo"}
                </p>
                <p className="text-sm text-zinc-600">
                  {new Date(booking.startAt).toLocaleString()} -{" "}
                  {new Date(booking.endAt).toLocaleString()}
                </p>
                <p className="text-sm">Estado: {booking.status}</p>
                <p className="text-sm">Total pagado: S/ {booking.totalPaid}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={booking.status === "CANCELLED" || booking.isPast === true}
                    onClick={() => void cancelBooking(booking.id)}
                    type="button"
                  >
                    Cancelar
                  </button>
                  {activeTab === "ACTIVE" && (
                    <button
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                      disabled={booking.status !== "PENDING"}
                      onClick={() => void payBooking(booking.id)}
                      type="button"
                    >
                      Pagar (simulado)
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!loading && bookings.length === 0 && (
            <p className="text-sm text-zinc-600">No hay reservas en esta sección.</p>
          )}
        </>
      )}
    </main>
  );
}
