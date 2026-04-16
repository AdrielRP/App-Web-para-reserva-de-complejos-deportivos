"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { authStorage } from "@/lib/authStorage";

type Complex = {
  id: string;
  name: string;
  district: string;
  address?: string | null;
};

export default function ComplexesPage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Complex[]>("/complexes", { auth: false });
        setComplexes(data);
      } catch (err) {
        if (err instanceof ApiError || err instanceof Error) {
          setError(err.message);
        } else {
          setError("No se pudieron cargar los complejos");
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Complejos</h1>
        <Link className="rounded border px-3 py-2 text-sm" href="/bookings">
          Mis reservas
        </Link>
        <button
          className="rounded border px-3 py-2 text-sm"
          onClick={() => {
            authStorage.clearToken();
          }}
          type="button"
        >
          Cerrar sesión
        </button>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="grid gap-3">
        {complexes.map((complex) => (
          <li className="rounded border p-4" key={complex.id}>
            <h2 className="font-medium">{complex.name}</h2>
            <p className="text-sm text-zinc-600">
              {complex.district}
              {complex.address ? ` · ${complex.address}` : ""}
            </p>
            <Link
              className="mt-2 inline-block rounded border px-3 py-1 text-sm"
              href={`/complexes/${complex.id}/courts`}
            >
              Ver canchas
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
