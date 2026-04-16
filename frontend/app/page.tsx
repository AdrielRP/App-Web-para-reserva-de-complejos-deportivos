import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Reserva de complejos deportivos</h1>
      <p className="text-sm text-zinc-600">
        MVP integrado con backend para login, disponibilidad, reservas y pago
        simulado.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded border px-3 py-2" href="/login">
          Login
        </Link>
        <Link className="rounded border px-3 py-2" href="/complexes">
          Ver complejos
        </Link>
        <Link className="rounded border px-3 py-2" href="/bookings">
          Mis reservas
        </Link>
      </div>
    </main>
  );
}
