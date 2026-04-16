Frontend MVP en Next.js (App Router) integrado con el backend de reservas.

## Getting Started

1) Define la URL pública de la API en un `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

2) Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Rutas MVP

- `/login`: inicia sesión con backend (`/auth/login`) y guarda JWT en `localStorage`.
- `/complexes`: lista complejos.
- `/complexes/[complexId]/courts`: lista canchas del complejo.
- `/courts/[courtId]/availability`: consulta disponibilidad por `date` y `durationMin`, crea booking.
- `/bookings`: lista reservas del usuario, permite cancelar y pagar (`/bookings/:id/pay`).

## Auth strategy

Se usa `localStorage` para guardar el token JWT (`auth_token`) y `apiFetch` agrega automáticamente `Authorization: Bearer <token>` cuando existe.

## Nota

Esta estrategia es simple para MVP. No usa cookies httpOnly todavía.
Para producción, migrar a cookies httpOnly + refresh token para reducir exposición ante XSS.
