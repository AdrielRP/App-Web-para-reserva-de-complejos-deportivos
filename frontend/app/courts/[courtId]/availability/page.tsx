"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import AppNav from "@/components/app-nav";

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

type AuthMe = {
  role: "USER" | "OWNER" | "STAFF";
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
  const [canBook, setCanBook] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const latestRequestIdRef = useRef(0);
  const latestAbortRef = useRef<AbortController | null>(null);

  const loadAvailability = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    latestAbortRef.current?.abort();
    const abortController = new AbortController();
    latestAbortRef.current = abortController;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<AvailabilityResponse>(
        `/courts/${courtId}/availability?date=${date}&durationMin=${durationMin}`,
        { auth: false, signal: abortController.signal },
      );
      if (requestId !== latestRequestIdRef.current) return;
      setData(response);
    } catch (err) {
      if (abortController.signal.aborted) return;
      if (requestId !== latestRequestIdRef.current) return;
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo cargar la disponibilidad");
      }
    } finally {
      if (requestId !== latestRequestIdRef.current) return;
      setLoading(false);
    }
  }, [courtId, date, durationMin]);

  useEffect(() => {
    async function loadRole() {
      try {
        const me = await apiFetch<AuthMe>("/auth/me");
        setCanBook(me.role === "USER");
      } catch {
        setCanBook(false);
      } finally {
        setRoleLoaded(true);
      }
    }

    void loadRole();
  }, []);

  useEffect(() => {
    if (!courtId) return;
    void loadAvailability();
  }, [courtId, loadAvailability]);

  useEffect(() => {
    return () => {
      latestAbortRef.current?.abort();
    };
  }, []);

  async function createBooking(startLocal: string) {
    setError(null);
    setMessage(null);
    if (!canBook) {
      setMessage("Solo usuarios pueden reservar");
      return;
    }

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
    <motion.main
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <h1 className="text-2xl font-semibold text-zinc-100">Disponibilidad</h1>
        <AppNav />
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <input
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duración (min)
          <select
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
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
          className="self-end rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-100 transition hover:border-sky-400 hover:text-sky-300"
          onClick={() => void loadAvailability()}
          type="button"
        >
          Consultar
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-400">Cargando...</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {roleLoaded && !canBook && (
        <p className="text-sm text-amber-300">Solo usuarios pueden reservar</p>
      )}

      <motion.ul
        className="grid gap-3"
        initial="hidden"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.04 } },
        }}
        animate="show"
      >
        {(data?.slots ?? []).map((slot) => (
          <motion.li
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
            key={`${slot.startLocal}-${slot.endLocal}`}
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-zinc-100">
                  {slot.startLocal} - {slot.endLocal}
                </p>
                <p className="text-xs text-zinc-400">
                  Opciones: {slot.durationOptionsMin.join(", ") || "ninguna"}
                </p>
                {!slot.available && slot.reason && (
                  <p className="text-xs text-rose-300">{slot.reason}</p>
                )}
              </div>
              {canBook ? (
                <button
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!slot.available}
                  onClick={() => void createBooking(slot.startLocal)}
                  type="button"
                >
                  Reservar
                </button>
              ) : (
                <span className="text-xs text-zinc-500">Solo visualización</span>
              )}
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </motion.main>
  );
}
