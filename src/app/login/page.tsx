"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        setLoading(false);
        return;
      }
      if (data.user.role === "ADMIN") {
        router.push("/cms/admin");
      } else {
        router.push("/cms/mi-puesto");
      }
      router.refresh();
    } catch {
      setError("Error de red al intentar iniciar sesión.");
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-dvh bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl bg-emerald-100 p-2 rounded-xl">🧺</span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                CMS Feria de las Heras
              </h1>
              <p className="text-xs text-slate-500">
                Acceso para Administración y Puesteros
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            ← Ver Mapa
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@feria.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm cursor-pointer transition"
          >
            {loading ? "Ingresando..." : "Ingresar al Panel"}
          </button>
        </form>

        {/* Quick Demo Access */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Cuentas de prueba rápidas (1 clic):
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fillDemo("admin@feria.com", "admin123")}
              className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 text-xs flex items-center justify-between cursor-pointer transition"
            >
              <span>
                <strong className="text-slate-900">⚙️ Admin Feria:</strong>{" "}
                admin@feria.com
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Editor Mapa + Todo
              </span>
            </button>

            <button
              type="button"
              onClick={() => fillDemo("puestero1@feria.com", "puesto123")}
              className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 text-xs flex items-center justify-between cursor-pointer transition"
            >
              <span>
                <strong className="text-slate-900">🥬 Puestero 1:</strong>{" "}
                puestero1@feria.com
              </span>
              <span className="text-[11px] font-semibold text-sky-700">
                El Choclo de Oro / Don José
              </span>
            </button>

            <button
              type="button"
              onClick={() => fillDemo("puestero2@feria.com", "puesto123")}
              className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 text-xs flex items-center justify-between cursor-pointer transition"
            >
              <span>
                <strong className="text-slate-900">🍎 Puestero 2:</strong>{" "}
                puestero2@feria.com
              </span>
              <span className="text-[11px] font-semibold text-orange-700">
                Frutería Los Andes
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

