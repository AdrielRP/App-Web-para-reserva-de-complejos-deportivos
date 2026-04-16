import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reserva de complejos deportivos",
  description: "MVP frontend integrado con backend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
