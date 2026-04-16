"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  startAt: string;
  endAt: string;
  totalPaid: number;
  court?: {
    name: string;
    complex?: {
      name: string;
    };
  };
};

function generatePaymentReference() {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `sim-${Date.now()}-${randomSuffix}`;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Booking[]>("/bookings/mine");
      setBookings(data);
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudieron cargar las reservas");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  async function cancelBooking(bookingId: string) {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/bookings/${bookingId}/cancel`, { method: "PATCH" });
      setMessage("Reserva cancelada");
      await loadBookings();
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
      await loadBookings();
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
        <Link className="rounded border px-3 py-2 text-sm" href="/complexes">
          Ver complejos
        </Link>
        <Link className="rounded border px-3 py-2 text-sm" href="/login">
          Login
        </Link>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

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
                disabled={booking.status === "CANCELLED"}
                onClick={() => void cancelBooking(booking.id)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                disabled={booking.status !== "PENDING"}
                onClick={() => void payBooking(booking.id)}
                type="button"
              >
                Pagar (simulado)
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
