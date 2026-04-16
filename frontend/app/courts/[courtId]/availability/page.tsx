"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

type AvailabilitySlot = {
  startLocal: string;
  endLocal: string;
  available: boolean;
  durationOptionsMin: number[];
  reason?: "BOOKED" | "OUTSIDE_SCHEDULE";
};

type AvailabilityResponse = {
  slots: AvailabilitySlot[];
  durationsAllowedMin: number[];
};

type BookingResponse = {
  id: string;
  status: string;
};

const AVAILABLE_DURATIONS = [60, 90, 120];

function todayLocalDate() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export default function AvailabilityPage() {
  const params = useParams<{ courtId: string }>();
  const courtId = params.courtId;
  const [date, setDate] = useState(todayLocalDate());
  const [durationMin, setDurationMin] = useState(90);
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadAvailability() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<AvailabilityResponse>(
        `/courts/${courtId}/availability?date=${date}&durationMin=${durationMin}`,
        { auth: false },
      );
      setData(response);
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo cargar la disponibilidad");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (courtId) {
      void loadAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtId]);

  async function createBooking(startLocal: string) {
    setError(null);
    setMessage(null);
    try {
      const booking = await apiFetch<BookingResponse>("/bookings", {
        method: "POST",
        body: JSON.stringify({ courtId, date, startLocal, durationMin }),
      });
      setMessage(`Reserva creada (${booking.id}).`);
      await loadAvailability();
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo crear la reserva");
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Disponibilidad</h1>
        <Link className="rounded border px-3 py-2 text-sm" href="/bookings">
          Mis reservas
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <input
            className="rounded border px-3 py-2"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duración (min)
          <select
            className="rounded border px-3 py-2"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          >
            {AVAILABLE_DURATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          className="self-end rounded border px-3 py-2 text-sm"
          onClick={() => void loadAvailability()}
          type="button"
        >
          Consultar
        </button>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <ul className="grid gap-3">
        {data?.slots.map((slot) => (
          <li className="rounded border p-3" key={`${slot.startLocal}-${slot.endLocal}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {slot.startLocal} - {slot.endLocal}
                </p>
                <p className="text-xs text-zinc-600">
                  Opciones: {slot.durationOptionsMin.join(", ") || "ninguna"}
                </p>
                {!slot.available && slot.reason && (
                  <p className="text-xs text-red-600">{slot.reason}</p>
                )}
              </div>
              <button
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                disabled={!slot.available}
                onClick={() => void createBooking(slot.startLocal)}
                type="button"
              >
                Reservar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
