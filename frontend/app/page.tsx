import AppNav from "@/components/app-nav";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Reserva de complejos deportivos</h1>
      <p className="text-sm text-zinc-600">
        MVP integrado con backend para login, disponibilidad, reservas y pago
        simulado.
      </p>
      <AppNav />
    </main>
  );
}
