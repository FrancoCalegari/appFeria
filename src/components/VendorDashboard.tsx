"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FairState } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth";
import StallForm from "./StallForm";
import { getCategoryStyle } from "@/lib/categories";

interface VendorDashboardProps {
  initialState: FairState;
  currentUser: SessionUser;
}

export default function VendorDashboard({
  initialState,
  currentUser,
}: VendorDashboardProps) {
  const router = useRouter();
  const [state, setState] = useState<FairState>(initialState);

  const myStalls = state.stalls.filter((s) => s.owner_id === currentUser.id);
  const [selectedId, setSelectedId] = useState<number>(
    myStalls[0]?.id ?? 0
  );

  const activeStall =
    myStalls.find((s) => s.id === selectedId) ?? myStalls[0] ?? null;

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh flex flex-col bg-slate-100">
      <header className="bg-emerald-900 text-white border-b border-emerald-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl bg-emerald-700 p-2 rounded-xl">🏪</span>
            <div>
              <h1 className="font-bold text-base sm:text-lg">
                Panel del Puestero — {state.settings.name}
              </h1>
              <p className="text-xs text-emerald-200">
                Hola, {currentUser.name} ({currentUser.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition"
            >
              🗺️ Ver Mapa Público
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold cursor-pointer"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-4 py-6 flex-1 flex flex-col gap-5">
        {myStalls.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              Mis puestos asignados:
            </span>
            {myStalls.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                  activeStall?.id === s.id
                    ? "bg-emerald-800 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {getCategoryStyle(s.category).emoji} {s.name}
              </button>
            ))}
          </div>
        )}

        {activeStall ? (
          <StallForm
            key={activeStall.id}
            stall={activeStall}
            isAdmin={false}
            onStateUpdated={(newState) => setState(newState)}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Aún no tienes un puesto vinculado a tu cuenta
            </h2>
            <p className="text-xs text-slate-500">
              Solicita al administrador de la Feria de las Heras que vincule tu
              usuario ({currentUser.email}) a tu puesto en el CMS.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

