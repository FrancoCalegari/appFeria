import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feria de las Heras — Mapa Interactivo de Puestos y Precios",
  description:
    "Explora el mapa de casillas de la Feria de las Heras, encuentra verdulerías y negocios, consulta precios actualizados y paga con alias de Mercado Pago.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased selection:bg-emerald-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}

