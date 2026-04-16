"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/authStorage";

type LoginResponse = {
  access_token?: string;
  token?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("user.dev@pichangaya.local");
  const [password, setPassword] = useState("User123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password }),
      });

      const token = response.access_token ?? response.token;
      if (!token) {
        throw new Error("Respuesta de login inválida");
      }

      authStorage.setToken(token);
      router.push("/complexes");
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="text-sm text-zinc-600">API: {getApiUrl()}</p>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1">
          Email
          <input
            className="rounded border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          Contraseña
          <input
            className="rounded border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
