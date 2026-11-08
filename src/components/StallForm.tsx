"use client";

import React, { useState } from "react";
import {
  DEFAULT_CATEGORIES,
  PRODUCT_UNITS,
  type FairState,
  type Product,
  type Stall,
  type User,
} from "@/lib/db/schema";
import { formatARS, getCategoryStyle } from "@/lib/categories";

interface StallFormProps {
  stall: Stall;
  isAdmin: boolean;
  users?: User[];
  onStateUpdated: (newState: FairState) => void;
  onDeleted?: (newState: FairState) => void;
}

export default function StallForm({
  stall,
  isAdmin,
  users = [],
  onStateUpdated,
  onDeleted,
}: StallFormProps) {
  const [name, setName] = useState(stall.name);
  const [category, setCategory] = useState(stall.category);
  const [description, setDescription] = useState(stall.description);
  const [ownerId, setOwnerId] = useState<string>(
    stall.owner_id ? String(stall.owner_id) : ""
  );
  const [aliases, setAliases] = useState<string[]>(stall.mp_aliases);
  const [newAlias, setNewAlias] = useState("");

  // Admin optional grid position fields
  const [x, setX] = useState<string>(stall.x !== null ? String(stall.x) : "");
  const [y, setY] = useState<string>(stall.y !== null ? String(stall.y) : "");
  const [w, setW] = useState<string>(String(stall.w || 1));
  const [h, setH] = useState<string>(String(stall.h || 1));

  // New product fields
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodUnit, setProdUnit] = useState("kg");

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  const handleAddAlias = () => {
    const clean = newAlias.trim().toLowerCase();
    if (!clean) return;
    if (!aliases.includes(clean)) {
      setAliases([...aliases, clean]);
    }
    setNewAlias("");
  };

  const handleRemoveAlias = (target: string) => {
    setAliases(aliases.filter((a) => a !== target));
  };

  const handleSaveStall = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    // Include pending alias if user typed one in the box without pressing "+ Agregar"
    let finalAliases = [...aliases];
    if (newAlias.trim()) {
      const clean = newAlias.trim().toLowerCase();
      if (!finalAliases.includes(clean)) finalAliases.push(clean);
      setAliases(finalAliases);
      setNewAlias("");
    }

    try {
      const payload: Record<string, unknown> = {
        id: stall.id,
        name,
        category,
        description,
        mp_aliases: finalAliases,
      };

      if (isAdmin) {
        payload.owner_id = ownerId ? Number(ownerId) : null;
        payload.x = x !== "" ? Number(x) : null;
        payload.y = y !== "" ? Number(y) : null;
        payload.w = Math.max(1, Number(w || 1));
        payload.h = Math.max(1, Number(h || 1));
      }

      const res = await fetch("/api/stalls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "err", msg: data.error || "Error al guardar" });
      } else {
        onStateUpdated(data.state);
        setFeedback({
          type: "ok",
          msg: "Datos del puesto y alias guardados correctamente.",
        });
      }
    } catch {
      setFeedback({ type: "err", msg: "Error de conexión al guardar." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStall = async () => {
    if (
      !window.confirm(
        `¿Seguro que deseas eliminar el puesto "${stall.name}" y todos sus productos?`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/stalls?id=${stall.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.ok && onDeleted) {
      onDeleted(data.state);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodPrice) return;
    setFeedback(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stall_id: stall.id,
        name: prodName.trim(),
        price: Number(prodPrice),
        unit: prodUnit,
        in_stock: true,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setProdName("");
      setProdPrice("");
      onStateUpdated(data.state);
    } else {
      setFeedback({
        type: "err",
        msg: data.error || "No se pudo agregar el producto",
      });
    }
  };

  const handleUpdateProduct = async (
    prod: Product,
    patch: Partial<Product>
  ) => {
    const res = await fetch("/api/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: prod.id,
        name: patch.name ?? prod.name,
        price: patch.price ?? prod.price,
        unit: patch.unit ?? prod.unit,
        in_stock: patch.in_stock ?? prod.in_stock,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onStateUpdated(data.state);
    }
  };

  const handleDeleteProduct = async (prodId: number) => {
    const res = await fetch(`/api/products?id=${prodId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.ok) {
      onStateUpdated(data.state);
    }
  };

  const style = getCategoryStyle(category);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl p-2.5 rounded-xl bg-slate-100">
            {style.emoji}
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{stall.name}</h2>
            <p className="text-xs text-slate-500">
              {stall.x !== null && stall.y !== null
                ? `📍 Ubicado en Columna ${stall.x}, Fila ${stall.y} (Ocupa ${stall.w}×${stall.h} casillas)`
                : "⚠️ Sin ubicar en el mapa actualmente"}
            </p>
          </div>
        </div>

        {isAdmin && onDeleted && (
          <button
            type="button"
            onClick={handleDeleteStall}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
          >
            🗑️ Eliminar Puesto
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="alert"
          className={`p-3 rounded-xl text-xs font-semibold border ${
            feedback.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Main Stall Info + Mercado Pago Aliases Form */}
      <form onSubmit={handleSaveStall} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre del Puesto
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Rubro / Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Descripción breve
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Verduras frescas de chacra, atención mayorista y minorista..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        {/* Admin-only: Owner & Coordinates */}
        {isAdmin && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Puestero asignado (Cuenta dueña)
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">— Sin puestero asignado —</option>
                {users
                  .filter((u) => u.role === "VENDOR")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Columna (X)
              </label>
              <input
                type="number"
                min={1}
                placeholder="Vacío"
                value={x}
                onChange={(e) => setX(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Fila (Y)
              </label>
              <input
                type="number"
                min={1}
                placeholder="Vacío"
                value={y}
                onChange={(e) => setY(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Ancho (W)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={w}
                  onChange={(e) => setW(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Alto (H)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={h}
                  onChange={(e) => setH(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* 1 or more Mercado Pago Aliases */}
        <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200">
          <label className="block text-xs font-bold text-sky-950 mb-2">
            💳 Alias de Mercado Pago (1 o más alias)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {aliases.map((alias) => (
              <span
                key={alias}
                className="inline-flex items-center gap-2 bg-white border border-sky-300 px-3 py-1 rounded-lg text-xs font-mono font-bold text-sky-950"
              >
                {alias}
                <button
                  type="button"
                  onClick={() => handleRemoveAlias(alias)}
                  aria-label={`Quitar alias ${alias}`}
                  className="text-rose-600 hover:text-rose-800 font-sans font-bold cursor-pointer"
                >
                  ✕
                </button>
              </span>
            ))}
            {aliases.length === 0 && (
              <span className="text-xs text-slate-500">
                No hay alias cargados todavía.
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddAlias();
                }
              }}
              placeholder="Ej: mi.puesto.feria.mp"
              className="flex-1 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-xs font-mono"
            />
            <button
              type="button"
              onClick={handleAddAlias}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              + Agregar Alias
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer transition"
          >
            {saving ? "Guardando..." : "💾 Guardar Datos del Puesto"}
          </button>
        </div>
      </form>

      {/* Products and Prices Management */}
      <div className="pt-5 border-t border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 mb-3">
          🏷️ Productos y Precios del Puesto ({stall.products.length})
        </h3>

        {/* Add Product Inline Form */}
        <form
          onSubmit={handleAddProduct}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200"
        >
          <input
            type="text"
            required
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            placeholder="Nombre del producto (ej. Papa negra, Tomate perita)"
            className="sm:col-span-5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
          />
          <input
            type="number"
            required
            min={0}
            step="any"
            value={prodPrice}
            onChange={(e) => setProdPrice(e.target.value)}
            placeholder="Precio en ARS (ej. 1200)"
            className="sm:col-span-3 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
          />
          <select
            value={prodUnit}
            onChange={(e) => setProdUnit(e.target.value)}
            className="sm:col-span-2 px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
          >
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>
                por {u}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            + Producto
          </button>
        </form>

        {/* Products Table with Quick Price Edit */}
        {stall.products.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            Aún no hay productos cargados en este puesto.
          </p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase">
                  <th className="py-2.5 px-3 font-bold">Producto</th>
                  <th className="py-2.5 px-3 font-bold">Precio ($)</th>
                  <th className="py-2.5 px-3 font-bold">Unidad</th>
                  <th className="py-2.5 px-3 font-bold">Estado</th>
                  <th className="py-2.5 px-3 font-bold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stall.products.map((prod) => (
                  <ProductRow
                    key={prod.id}
                    product={prod}
                    onUpdate={handleUpdateProduct}
                    onDelete={handleDeleteProduct}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  onUpdate,
  onDelete,
}: {
  product: Product;
  onUpdate: (prod: Product, patch: Partial<Product>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [name, setName] = useState(product.name);
  const [unit, setUnit] = useState(product.unit);

  const isDirty =
    Number(price) !== product.price ||
    name.trim() !== product.name ||
    unit !== product.unit;

  return (
    <tr className={product.in_stock ? "bg-white" : "bg-slate-50/80 opacity-65"}>
      <td className="py-2 px-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full min-w-[140px] px-2 py-1 rounded-md border border-transparent hover:border-slate-300 focus:border-emerald-600 bg-transparent font-medium text-slate-900"
        />
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-bold">$</span>
          <input
            type="number"
            min={0}
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 px-2 py-1 rounded-md border border-slate-300 font-bold text-emerald-800 bg-white"
          />
          <span className="text-[11px] text-slate-400 hidden md:inline">
            ({formatARS(Number(price || 0))})
          </span>
        </div>
      </td>
      <td className="py-2 px-3">
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="px-2 py-1 rounded-md border border-slate-200 bg-white"
        >
          {PRODUCT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 px-3">
        <button
          type="button"
          onClick={() => onUpdate(product, { in_stock: !product.in_stock })}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
            product.in_stock
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {product.in_stock ? "✓ En stock" : "Sin stock"}
        </button>
      </td>
      <td className="py-2 px-3 text-right whitespace-nowrap">
        {isDirty && (
          <button
            type="button"
            onClick={() =>
              onUpdate(product, {
                name: name.trim(),
                price: Number(price),
                unit,
              })
            }
            className="mr-2 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold cursor-pointer"
          >
            Guardar
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(product.id)}
          className="px-2 py-1 rounded-md text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
          title="Eliminar producto"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

