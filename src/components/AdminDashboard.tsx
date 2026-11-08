"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DEFAULT_CATEGORIES,
  type FairState,
} from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth";
import MapEditor from "./MapEditor";
import StallForm from "./StallForm";
import { getCategoryStyle } from "@/lib/categories";

interface AdminDashboardProps {
  initialState: FairState;
  currentUser: SessionUser;
}

type AdminTab = "MAP_EDITOR" | "STALLS" | "USERS_CLOUD";

export default function AdminDashboard({
  initialState,
  currentUser,
}: AdminDashboardProps) {
  const router = useRouter();
  const [state, setState] = useState<FairState>(initialState);
  const [activeTab, setActiveTab] = useState<AdminTab>("MAP_EDITOR");
  const [selectedStallId, setSelectedStallId] = useState<number>(
    initialState.stalls[0]?.id ?? 0
  );

  // New Stall Modal / Panel State
  const [showNewStall, setShowNewStall] = useState(false);
  const [newStallName, setNewStallName] = useState("");
  const [newStallCat, setNewStallCat] = useState("Verdulería");
  const [newStallAlias, setNewStallAlias] = useState("");
  const [newStallW, setNewStallW] = useState("1");
  const [newStallH, setNewStallH] = useState("1");
  const [newStallError, setNewStallError] = useState<string | null>(null);

  // New User Form State
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uPass, setUPass] = useState("");
  const [uRole, setURole] = useState<"VENDOR" | "ADMIN">("VENDOR");
  const [userMsg, setUserMsg] = useState<string | null>(null);

  const selectedStall =
    state.stalls.find((s) => s.id === selectedStallId) ??
    state.stalls[0] ??
    null;

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
    router.refresh();
  };

  const handleCreateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewStallError(null);
    const res = await fetch("/api/stalls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newStallName,
        category: newStallCat,
        mp_aliases: newStallAlias.trim()
          ? newStallAlias
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
        w: Number(newStallW || 1),
        h: Number(newStallH || 1),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNewStallError(data.error || "No se pudo crear el puesto");
      return;
    }
    setState(data.state);
    setSelectedStallId(data.id);
    setNewStallName("");
    setNewStallAlias("");
    setShowNewStall(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_user",
        name: uName,
        email: uEmail,
        password: uPass,
        role: uRole,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setUserMsg(`❌ ${data.error}`);
      return;
    }
    setUName("");
    setUEmail("");
    setUPass("");
    setUserMsg(`✓ Usuario ${data.user.email} creado correctamente.`);
    const mapRes = await fetch("/api/map");
    if (mapRes.ok) {
      setState(await mapRes.json());
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("¿Eliminar este usuario?")) return;
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_user", id }),
    });
    if (res.ok) {
      const mapRes = await fetch("/api/map");
      if (mapRes.ok) setState(await mapRes.json());
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-slate-100">
      {/* Top CMS Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl bg-emerald-600 p-2 rounded-xl">⚙️</span>
            <div>
              <h1 className="font-bold text-base sm:text-lg">
                CMS Administración — {state.settings.name}
              </h1>
              <p className="text-xs text-slate-400">
                Sesión: {currentUser.name} ({currentUser.email})
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
              className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-xs font-semibold cursor-pointer"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-2 border-t border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("MAP_EDITOR")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl cursor-pointer transition ${
              activeTab === "MAP_EDITOR"
                ? "bg-slate-100 text-slate-900"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            🗺️ Editor del Mapa ({state.settings.cols}×{state.settings.rows})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("STALLS")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl cursor-pointer transition ${
              activeTab === "STALLS"
                ? "bg-slate-100 text-slate-900"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            🏪 Puestos, Precios y Alias MP ({state.stalls.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("USERS_CLOUD")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl cursor-pointer transition ${
              activeTab === "USERS_CLOUD"
                ? "bg-slate-100 text-slate-900"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            👥 Puesteros & Exportar SQL Cloud
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 py-6 flex-1">
        {activeTab === "MAP_EDITOR" && (
          <MapEditor
            key={`${state.settings.updated_at}-${state.stalls.length}`}
            initialState={state}
            onStateSaved={(newState) => setState(newState)}
          />
        )}

        {activeTab === "STALLS" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar: Stall Selector & New Stall Button */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900">
                  Puestos Registrados ({state.stalls.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewStall(!showNewStall)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                >
                  {showNewStall ? "Cancelar" : "+ Nuevo Puesto"}
                </button>
              </div>

              {showNewStall && (
                <form
                  onSubmit={handleCreateStall}
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-2.5"
                >
                  <h3 className="text-xs font-bold text-emerald-950">
                    Crear Nuevo Puesto
                  </h3>
                  {newStallError && (
                    <p className="text-xs text-rose-700 font-semibold">
                      {newStallError}
                    </p>
                  )}
                  <input
                    type="text"
                    required
                    value={newStallName}
                    onChange={(e) => setNewStallName(e.target.value)}
                    placeholder="Nombre del puesto"
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs"
                  />
                  <select
                    value={newStallCat}
                    onChange={(e) => setNewStallCat(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs"
                  >
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newStallAlias}
                    onChange={(e) => setNewStallAlias(e.target.value)}
                    placeholder="Alias MP (separados por coma)"
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-mono"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-900">
                        Ancho (casillas)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={newStallW}
                        onChange={(e) => setNewStallW(e.target.value)}
                        className="w-full px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-900">
                        Alto (casillas)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={newStallH}
                        onChange={(e) => setNewStallH(e.target.value)}
                        className="w-full px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Guardar Nuevo Puesto
                  </button>
                </form>
              )}

              <div className="scrollable-panel max-h-[600px] flex flex-col gap-1.5 pr-1">
                {state.stalls.map((s) => {
                  const style = getCategoryStyle(s.category);
                  const active = selectedStall?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStallId(s.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? "bg-emerald-900 text-white border-emerald-900 shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">
                          {style.emoji} {s.name}
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            active ? "text-emerald-200" : "text-slate-500"
                          }`}
                        >
                          {s.category} • {s.products.length} prod. •{" "}
                          {s.mp_aliases.length} alias MP
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          s.x !== null
                            ? active
                              ? "bg-white/20 text-white"
                              : "bg-emerald-100 text-emerald-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {s.x !== null
                          ? `(${s.x},${s.y}) ${s.w}×${s.h}`
                          : "Sin ubicar"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Area: Selected Stall Editor */}
            <div className="lg:col-span-8">
              {selectedStall ? (
                <StallForm
                  key={selectedStall.id}
                  stall={selectedStall}
                  isAdmin={true}
                  users={state.users || []}
                  onStateUpdated={(newState) => setState(newState)}
                  onDeleted={(newState) => {
                    setState(newState);
                    setSelectedStallId(newState.stalls[0]?.id ?? 0);
                  }}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                  Selecciona o crea un puesto para editar su información.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "USERS_CLOUD" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Users Management */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
              <h2 className="text-base font-bold text-slate-900">
                👥 Cuentas de Puesteros y Administradores
              </h2>

              {userMsg && (
                <div className="p-3 rounded-xl bg-slate-100 text-xs font-semibold">
                  {userMsg}
                </div>
              )}

              <form
                onSubmit={handleCreateUser}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nombre completo / Puesto
                  </label>
                  <input
                    type="text"
                    required
                    value={uName}
                    onChange={(e) => setUName(e.target.value)}
                    placeholder="Ej: María López"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Correo electrónico (Login)
                  </label>
                  <input
                    type="email"
                    required
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                    placeholder="maria@feria.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Contraseña inicial
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={uPass}
                    onChange={(e) => setUPass(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Rol en el SaaS
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={uRole}
                      onChange={(e) =>
                        setURole(e.target.value as "VENDOR" | "ADMIN")
                      }
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      <option value="VENDOR">Puestero (VENDOR)</option>
                      <option value="ADMIN">Administrador (ADMIN)</option>
                    </select>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Crear
                    </button>
                  </div>
                </div>
              </form>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase">
                      <th className="py-2.5 px-3 font-bold">Nombre</th>
                      <th className="py-2.5 px-3 font-bold">Email</th>
                      <th className="py-2.5 px-3 font-bold">Rol</th>
                      <th className="py-2.5 px-3 font-bold text-right">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(state.users || []).map((u) => (
                      <tr key={u.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {u.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {u.email}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.role === "ADMIN"
                                ? "bg-purple-100 text-purple-900"
                                : "bg-sky-100 text-sky-900"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-rose-600 hover:underline font-bold cursor-pointer"
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cloud SQL & Cloud Storage Export Panel */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
              <h2 className="text-base font-bold text-slate-900">
                ☁️ Exportación a Base de Datos SQL en la Nube & Cloud Storage
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                El sistema está funcionando con <strong>SQLite local</strong>{" "}
                (módulo nativo <code>node:sqlite</code>) y preparado para migrar
                en cualquier momento a tu servicio propio de Base de Datos SQL y
                Cloud Storage.
              </p>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-3">
                <h3 className="text-xs font-bold text-emerald-950">
                  1. Exportar Base de Datos Completa (.sql estándar)
                </h3>
                <p className="text-xs text-emerald-800">
                  Genera un script SQL transaccional (<code>CREATE TABLE</code>{" "}
                  + <code>INSERT INTO</code>) con la configuración del mapa{" "}
                  {state.settings.cols}×{state.settings.rows}, casillas de
                  camino, usuarios, puestos, alias de Mercado Pago y productos.
                </p>
                <a
                  href="/api/map?export=sql"
                  download="feria_las_heras_cloud.sql"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition"
                >
                  ⬇️ Descargar Dump SQL para Nube (.sql)
                </a>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs text-slate-700">
                <h3 className="font-bold text-slate-900">
                  2. Variables de Entorno para Producción Cloud
                </h3>
                <p>
                  En producción, configura en tu archivo <code>.env</code>:
                </p>
                <pre className="p-2.5 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto">
{`DATABASE_URL="tu-conexion-sql"
STORAGE_DRIVER="cloud"
CLOUD_STORAGE_URL="https://tu-storage/upload"
CLOUD_STORAGE_KEY="tu-token"`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

