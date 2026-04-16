"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

type Court = {
  id: string;
  name: string;
  sport: string;
  pricePerHour: number;
};

export default function CourtsPage() {
  const params = useParams<{ complexId: string }>();
  const complexId = params.complexId;
  const [courts, setCourts] = useState<Court[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Court[]>(`/complexes/${complexId}/courts`, {
          auth: false,
        });
        setCourts(data);
      } catch (err) {
        if (err instanceof ApiError || err instanceof Error) {
          setError(err.message);
        } else {
          setError("No se pudieron cargar las canchas");
        }
      } finally {
        setLoading(false);
      }
    }

    if (complexId) {
      void load();
    }
  }, [complexId]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Canchas</h1>
        <Link className="rounded border px-3 py-2 text-sm" href="/complexes">
          Volver a complejos
        </Link>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="grid gap-3">
        {courts.map((court) => (
          <li className="rounded border p-4" key={court.id}>
            <h2 className="font-medium">{court.name}</h2>
            <p className="text-sm text-zinc-600">
              {court.sport} · S/ {court.pricePerHour}/h
            </p>
            <Link
              className="mt-2 inline-block rounded border px-3 py-1 text-sm"
              href={`/courts/${court.id}/availability`}
            >
              Ver disponibilidad
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
