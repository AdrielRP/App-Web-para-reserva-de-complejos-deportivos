"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import AppNav from "@/components/app-nav";

type Complex = {
  id: string;
  name: string;
  district: string;
};

type Court = {
  id: string;
  name: string;
};

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  startAt: string;
  endAt: string;
  user: { fullName: string; email: string };
  court: {
    id: string;
    name: string;
    complex: {
      id: string;
      name: string;
      district: string;
    };
  };
};

type StatusFilter = "" | "PENDING" | "CONFIRMED" | "CANCELLED";

type Filters = {
  complexId: string;
  courtId: string;
  district: string;
  status: StatusFilter;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: Filters = {
  complexId: "",
  courtId: "",
  district: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

export default function OwnerBookingsPage() {
  const router = useRouter();
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBookings(currentFilters: Filters) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (currentFilters.complexId) params.set("complexId", currentFilters.complexId);
      if (currentFilters.courtId) params.set("courtId", currentFilters.courtId);
      if (currentFilters.district.trim()) params.set("district", currentFilters.district.trim());
      if (currentFilters.status) params.set("status", currentFilters.status);
      if (currentFilters.dateFrom) params.set("dateFrom", currentFilters.dateFrom);
      if (currentFilters.dateTo) params.set("dateTo", currentFilters.dateTo);

      const query = params.toString();
      const data = await apiFetch<Booking[]>(`/bookings/owner${query ? `?${query}` : ""}`);
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
    async function initPage() {
      setCheckingRole(true);
      setError(null);
      try {
        const me = await apiFetch<{ role: "USER" | "OWNER" | "STAFF" }>("/auth/me");
        if (me.role !== "OWNER") {
          router.replace("/complexes");
          return;
        }
        setAuthorized(true);

        const data = await apiFetch<Complex[]>("/complexes/mine");
        setComplexes(data);
        await loadBookings(DEFAULT_FILTERS);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError || err instanceof Error) {
          setError(err.message);
        } else {
          setError("No se pudieron cargar los complejos");
        }
      } finally {
        setCheckingRole(false);
      }
    }

    void initPage();
  }, [router]);

  useEffect(() => {
    async function loadCourts() {
      if (!filters.complexId) {
        setCourts([]);
        return;
      }
      try {
        const data = await apiFetch<Court[]>(`/complexes/${filters.complexId}/courts`, {
          auth: false,
        });
        setCourts(data);
      } catch (err) {
        if (err instanceof ApiError || err instanceof Error) {
          setError(err.message);
        } else {
          setError("No se pudieron cargar las canchas");
        }
      }
    }

    void loadCourts();
  }, [filters.complexId]);

  async function cancelBooking(bookingId: string) {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/bookings/${bookingId}/owner-cancel`, { method: "PATCH" });
      setMessage("Reserva cancelada");
      await loadBookings(filters);
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo cancelar la reserva");
      }
    }
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => {
      if (key === "complexId") {
        return { ...prev, complexId: value as string, courtId: "" };
      }
      return { ...prev, [key]: value };
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Reservas del owner</h1>
        <AppNav />
      </div>

      {checkingRole && <p>Cargando...</p>}

      {authorized && (
        <>

      <div className="grid gap-3 rounded border p-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Complejo
          <select
            className="rounded border px-2 py-1"
            onChange={(e) => updateFilter("complexId", e.target.value)}
            value={filters.complexId}
          >
            <option value="">Todos</option>
            {complexes.map((complex) => (
              <option key={complex.id} value={complex.id}>
                {complex.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Cancha
          <select
            className="rounded border px-2 py-1"
            onChange={(e) => updateFilter("courtId", e.target.value)}
            value={filters.courtId}
          >
            <option value="">Todas</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Estado
          <select
            className="rounded border px-2 py-1"
            onChange={(e) => updateFilter("status", e.target.value as StatusFilter)}
            value={filters.status}
          >
            <option value="">Todos</option>
            <option value="PENDING">PENDING</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Distrito
          <input
            className="rounded border px-2 py-1"
            onChange={(e) => updateFilter("district", e.target.value)}
            placeholder="Ej. Miraflores"
            value={filters.district}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Desde
          <input
            className="rounded border px-2 py-1"
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            type="date"
            value={filters.dateFrom}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Hasta
          <input
            className="rounded border px-2 py-1"
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            type="date"
            value={filters.dateTo}
          />
        </label>

        <div className="flex gap-2 md:col-span-3">
          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={() => void loadBookings(filters)}
            type="button"
          >
            Filtrar
          </button>
          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setCourts([]);
              void loadBookings(DEFAULT_FILTERS);
            }}
            type="button"
          >
            Limpiar
          </button>
        </div>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <ul className="grid gap-3">
        {bookings.map((booking) => (
          <li className="rounded border p-4" key={booking.id}>
            <p className="font-medium">
              {booking.court.name} · {booking.court.complex.name}
            </p>
            <p className="text-sm text-zinc-600">
              {new Date(booking.startAt).toLocaleString()} -{" "}
              {new Date(booking.endAt).toLocaleString()}
            </p>
            <p className="text-sm">Distrito: {booking.court.complex.district}</p>
            <p className="text-sm">Usuario: {booking.user.fullName} ({booking.user.email})</p>
            <p className="text-sm">Estado: {booking.status}</p>
            <button
              className="mt-2 rounded border px-3 py-1 text-sm disabled:opacity-50"
              disabled={
                booking.status === "CANCELLED" ||
                new Date(booking.endAt).getTime() <= Date.now()
              }
              onClick={() => void cancelBooking(booking.id)}
              type="button"
            >
              Cancelar
            </button>
          </li>
        ))}
      </ul>

      {!loading && bookings.length === 0 && (
        <p className="text-sm text-zinc-600">No hay reservas para los filtros seleccionados.</p>
      )}
        </>
      )}
    </main>
  );
}
