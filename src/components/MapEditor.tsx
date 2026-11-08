"use client";

import React, { useMemo, useState } from "react";
import type { FairState, Stall } from "@/lib/db/schema";
import { validateStallPlacement, type GridPoint } from "@/lib/grid";
import { getCategoryStyle } from "@/lib/categories";
import { FAIR_SURFACE, formatStallMeters } from "@/lib/fair-metrics";

interface MapEditorProps {
  initialState: FairState;
  onStateSaved: (newState: FairState) => void;
}

type EditorTool = "MOVE_STALL" | "PAINT_PATH" | "ERASE_CELL";

export default function MapEditor({
  initialState,
  onStateSaved,
}: MapEditorProps) {
  const [fairName, setFairName] = useState(initialState.settings.name);
  const [cols, setCols] = useState(initialState.settings.cols);
  const [rows, setRows] = useState(initialState.settings.rows);
  const [stalls, setStalls] = useState<Stall[]>(initialState.stalls);
  const [pathCells, setPathCells] = useState<GridPoint[]>(
    initialState.pathCells.map((c) => ({ x: c.x, y: c.y }))
  );

  const [tool, setTool] = useState<EditorTool>("MOVE_STALL");
  const [selectedStallId, setSelectedStallId] = useState<number | null>(
    initialState.stalls[0]?.id ?? null
  );
  const [isPointerPainting, setIsPointerPainting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "ok" | "err" | "info";
    text: string;
  } | null>(null);

  const selectedStall = useMemo(
    () => stalls.find((s) => s.id === selectedStallId) ?? null,
    [stalls, selectedStallId]
  );

  const placedStalls = useMemo(
    () => stalls.filter((s) => s.x !== null && s.y !== null),
    [stalls]
  );

  const unplacedStalls = useMemo(
    () => stalls.filter((s) => s.x === null || s.y === null),
    [stalls]
  );

  const pathSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of pathCells) s.add(`${c.x},${c.y}`);
    return s;
  }, [pathCells]);

  const occupiedMap = useMemo(() => {
    const map = new Map<string, Stall>();
    for (const s of placedStalls) {
      for (let dx = 0; dx < s.w; dx++) {
        for (let dy = 0; dy < s.h; dy++) {
          map.set(`${s.x! + dx},${s.y! + dy}`, s);
        }
      }
    }
    return map;
  }, [placedStalls]);

  // Safely update dimensions (cols, rows) and clean up any out-of-bounds paths/stalls if shrinking
  const applyNewDimensions = (nextColsRaw: number, nextRowsRaw: number) => {
    const nextCols = Math.max(1, Math.min(300, Math.round(nextColsRaw)));
    const nextRows = Math.max(1, Math.min(300, Math.round(nextRowsRaw)));

    setCols(nextCols);
    setRows(nextRows);

    // Filter out any path cells outside the new dimensions
    setPathCells((prev) =>
      prev.filter((c) => c.x >= 1 && c.x <= nextCols && c.y >= 1 && c.y <= nextRows)
    );

    // Unplace stalls that no longer fit if the user shrunk the grid
    let unplacedCount = 0;
    setStalls((prev) =>
      prev.map((s) => {
        if (s.x === null || s.y === null) return s;
        if (s.x + s.w - 1 > nextCols || s.y + s.h - 1 > nextRows) {
          unplacedCount++;
          return { ...s, x: null, y: null };
        }
        return s;
      })
    );

    const widthMeters = (nextCols * FAIR_SURFACE.cellNominalM).toFixed(0);
    const heightMeters = (nextRows * FAIR_SURFACE.cellNominalM).toFixed(0);
    const areaMeters = (
      nextCols *
      nextRows *
      FAIR_SURFACE.cellNominalM *
      FAIR_SURFACE.cellNominalM
    ).toLocaleString("es-AR");

    setStatus({
      type: "info",
      text: `Superficie ajustada a ${nextCols} col × ${nextRows} filas (${nextCols * nextRows} casillas ≈ ${widthMeters}m × ${heightMeters}m = ${areaMeters} m²).${
        unplacedCount > 0
          ? ` ${unplacedCount} puesto(s) fuera del borde pasaron a 'Sin ubicar'.`
          : " Recuerda presionar 'Guardar Mapa'."
      }`,
    });
  };

  // Insert column at the left (x = 1) shifting existing stalls and paths right by +1
  const insertColumnLeft = () => {
    const nextCols = Math.min(300, cols + 1);
    if (nextCols === cols) return;
    setCols(nextCols);
    setPathCells((prev) => prev.map((c) => ({ x: c.x + 1, y: c.y })));
    setStalls((prev) =>
      prev.map((s) => (s.x !== null ? { ...s, x: s.x + 1 } : s))
    );
    setStatus({
      type: "info",
      text: `Se insertó 1 columna a la izquierda (ahora ${nextCols}×${rows}).`,
    });
  };

  // Insert row at the top (y = 1) shifting existing stalls and paths down by +1
  const insertRowTop = () => {
    const nextRows = Math.min(300, rows + 1);
    if (nextRows === rows) return;
    setRows(nextRows);
    setPathCells((prev) => prev.map((c) => ({ x: c.x, y: c.y + 1 })));
    setStalls((prev) =>
      prev.map((s) => (s.y !== null ? { ...s, y: s.y + 1 } : s))
    );
    setStatus({
      type: "info",
      text: `Se insertó 1 fila arriba (ahora ${cols}×${nextRows}).`,
    });
  };

  // Attempt to move or place a stall at target cell (targetX, targetY)
  const tryPlaceOrMoveStall = (
    stallId: number,
    targetX: number,
    targetY: number
  ) => {
    const targetStall = stalls.find((s) => s.id === stallId);
    if (!targetStall) return;

    const candidate = {
      id: targetStall.id,
      x: targetX,
      y: targetY,
      w: targetStall.w,
      h: targetStall.h,
    };

    const otherRects = placedStalls
      .filter((s) => s.id !== stallId)
      .map((s) => ({ id: s.id, x: s.x!, y: s.y!, w: s.w, h: s.h }));

    const check = validateStallPlacement(
      candidate,
      otherRects,
      pathCells,
      cols,
      rows
    );

    if (!check.valid) {
      setStatus({ type: "err", text: check.reason || "Ubicación inválida" });
      return;
    }

    setStalls((prev) =>
      prev.map((s) =>
        s.id === stallId ? { ...s, x: targetX, y: targetY } : s
      )
    );
    setStatus({
      type: "info",
      text: `"${targetStall.name}" ubicado en Col ${targetX}, Fila ${targetY} (${targetStall.w}×${targetStall.h}). Recuerda guardar el mapa.`,
    });
  };

  // Attempt to resize the selected stall (newW, newH)
  const tryResizeStall = (stallId: number, newW: number, newH: number) => {
    const targetStall = stalls.find((s) => s.id === stallId);
    if (!targetStall) return;

    const clampedW = Math.max(1, Math.min(cols, newW));
    const clampedH = Math.max(1, Math.min(rows, newH));

    if (targetStall.x === null || targetStall.y === null) {
      setStalls((prev) =>
        prev.map((s) =>
          s.id === stallId ? { ...s, w: clampedW, h: clampedH } : s
        )
      );
      return;
    }

    const candidate = {
      id: targetStall.id,
      x: targetStall.x,
      y: targetStall.y,
      w: clampedW,
      h: clampedH,
    };

    const otherRects = placedStalls
      .filter((s) => s.id !== stallId)
      .map((s) => ({ id: s.id, x: s.x!, y: s.y!, w: s.w, h: s.h }));

    const check = validateStallPlacement(
      candidate,
      otherRects,
      pathCells,
      cols,
      rows
    );

    if (!check.valid) {
      setStatus({
        type: "err",
        text: check.reason || "No se puede redimensionar ahí",
      });
      return;
    }

    setStalls((prev) =>
      prev.map((s) =>
        s.id === stallId ? { ...s, w: clampedW, h: clampedH } : s
      )
    );
    setStatus({
      type: "info",
      text: `Tamaño de "${targetStall.name}" ajustado a ${clampedW}×${clampedH} casillas.`,
    });
  };

  const unplaceStall = (stallId: number) => {
    setStalls((prev) =>
      prev.map((s) => (s.id === stallId ? { ...s, x: null, y: null } : s))
    );
    setStatus({
      type: "info",
      text: "Puesto retirado de la grilla (pasó a 'Puestos sin ubicar').",
    });
  };

  // Handle cell interaction according to current tool
  const handleCellAction = (x: number, y: number) => {
    const key = `${x},${y}`;
    const occupyingStall = occupiedMap.get(key);

    if (tool === "PAINT_PATH") {
      if (occupyingStall) {
        setStatus({
          type: "err",
          text: `La casilla (${x},${y}) está ocupada por "${occupyingStall.name}".`,
        });
        return;
      }
      if (!pathSet.has(key)) {
        setPathCells((prev) => [...prev, { x, y }]);
      }
      return;
    }

    if (tool === "ERASE_CELL") {
      if (occupyingStall) {
        unplaceStall(occupyingStall.id);
        return;
      }
      if (pathSet.has(key)) {
        setPathCells((prev) => prev.filter((c) => !(c.x === x && c.y === y)));
      }
      return;
    }

    // Tool === MOVE_STALL
    if (occupyingStall) {
      setSelectedStallId(occupyingStall.id);
      return;
    }

    if (selectedStallId !== null) {
      tryPlaceOrMoveStall(selectedStallId, x, y);
    }
  };

  const handleSaveMap = async () => {
    setSaving(true);
    setStatus(null);
    const validPaths = pathCells.filter(
      (c) => c.x >= 1 && c.x <= cols && c.y >= 1 && c.y <= rows
    );

    try {
      const res = await fetch("/api/map", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fairName,
          cols,
          rows,
          pathCells: validPaths,
          stalls: stalls.map((s) => ({
            id: s.id,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({
          type: "err",
          text: data.error || "Error al guardar el mapa.",
        });
      } else {
        onStateSaved(data);
        setStatus({
          type: "ok",
          text: "✓ ¡Diseño y superficie del mapa guardados y publicados exitosamente!",
        });
      }
    } catch {
      setStatus({ type: "err", text: "Error de red al guardar el mapa." });
    } finally {
      setSaving(false);
    }
  };

  // Cells not covered by any stall
  const backgroundCells = useMemo(() => {
    const cells: Array<{ x: number; y: number; isPath: boolean }> = [];
    for (let y = 1; y <= rows; y++) {
      for (let x = 1; x <= cols; x++) {
        const key = `${x},${y}`;
        if (occupiedMap.has(key)) continue;
        cells.push({ x, y, isPath: pathSet.has(key) });
      }
    }
    return cells;
  }, [cols, rows, occupiedMap, pathSet]);

  const activeSurfaceM2 =
    cols * rows * FAIR_SURFACE.cellNominalM * FAIR_SURFACE.cellNominalM;
  const activeWidthM = cols * FAIR_SURFACE.cellNominalM;
  const activeHeightM = rows * FAIR_SURFACE.cellNominalM;

  return (
    <div
      className="flex flex-col gap-5"
      onPointerUp={() => setIsPointerPainting(false)}
    >
      {/* Top Toolbar: Surface Expansion Controls, Tools & Save */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Nombre Feria
              </label>
              <input
                type="text"
                value={fairName}
                onChange={(e) => setFairName(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
              />
            </div>

            {/* Column Expansion Controls */}
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                Columnas (Ancho: {activeWidthM} m)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyNewDimensions(cols - 1, rows)}
                  title="Quitar 1 columna al final"
                  className="px-2 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  −1
                </button>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={cols}
                  onChange={(e) =>
                    applyNewDimensions(Number(e.target.value || 1), rows)
                  }
                  className="w-16 text-center px-2 py-1 rounded-md border border-slate-300 bg-white text-xs font-extrabold"
                />
                <button
                  type="button"
                  onClick={() => applyNewDimensions(cols + 1, rows)}
                  title="Agregar 1 columna a la derecha"
                  className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  +1 Col
                </button>
                <button
                  type="button"
                  onClick={() => applyNewDimensions(cols + 5, rows)}
                  title="Agregar 5 columnas a la derecha"
                  className="px-2 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold cursor-pointer"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Row Expansion Controls */}
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                Filas (Fondo: {activeHeightM} m)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyNewDimensions(cols, rows - 1)}
                  title="Quitar 1 fila del final"
                  className="px-2 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  −1
                </button>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={rows}
                  onChange={(e) =>
                    applyNewDimensions(cols, Number(e.target.value || 1))
                  }
                  className="w-16 text-center px-2 py-1 rounded-md border border-slate-300 bg-white text-xs font-extrabold"
                />
                <button
                  type="button"
                  onClick={() => applyNewDimensions(cols, rows + 1)}
                  title="Agregar 1 fila abajo"
                  className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  +1 Fila
                </button>
                <button
                  type="button"
                  onClick={() => applyNewDimensions(cols, rows + 5)}
                  title="Agregar 5 filas abajo"
                  className="px-2 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold cursor-pointer"
                >
                  +5
                </button>
              </div>
            </div>
          </div>

          {/* Tool Selector */}
          <div
            role="group"
            aria-label="Herramientas del editor de mapa"
            className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200"
          >
            <button
              type="button"
              onClick={() => setTool("MOVE_STALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                tool === "MOVE_STALL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              🖐️ Ubicar / Mover Puestos
            </button>
            <button
              type="button"
              onClick={() => setTool("PAINT_PATH")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                tool === "PAINT_PATH"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              👣 Pintar Camino
            </button>
            <button
              type="button"
              onClick={() => setTool("ERASE_CELL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                tool === "ERASE_CELL"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              🧹 Vaciar Casilla
            </button>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveMap}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition"
          >
            {saving ? "Guardando..." : "💾 Guardar Mapa"}
          </button>
        </div>

        {/* Secondary Surface Bar: Quick Insert at Start & Surface Presets */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-600">
              📐 Superficie de grilla activa:
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
              {cols}×{rows} = {cols * rows} casillas ({activeWidthM}m ×{" "}
              {activeHeightM}m ≈ {activeSurfaceM2.toLocaleString("es-AR")} m²)
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">
              Predio ref.: 10,085 m² (Perímetro 401.30 m | Casilla 1.5–2.0 m)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={insertColumnLeft}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
              title="Insertar 1 columna a la izquierda desplazando el mapa actual"
            >
              ⬅️ +1 Col a la Izquierda
            </button>
            <button
              type="button"
              onClick={insertRowTop}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
              title="Insertar 1 fila arriba desplazando el mapa actual"
            >
              ⬆️ +1 Fila Arriba
            </button>
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-[11px] font-bold text-slate-500">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => applyNewDimensions(7, 21)}
              className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
            >
              7×21
            </button>
            <button
              type="button"
              onClick={() => applyNewDimensions(15, 30)}
              className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
            >
              15×30
            </button>
            <button
              type="button"
              onClick={() => applyNewDimensions(50, 50)}
              className="px-2 py-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold cursor-pointer"
              title="50x50 casillas de 2m x 2m = 100m x 100m (~10,085 m²)"
            >
              50×50 (10,000 m²)
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div
          role="status"
          className={`p-3 rounded-xl text-xs font-semibold border ${
            status.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : status.type === "err"
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-sky-50 border-sky-200 text-sky-900"
          }`}
        >
          {status.text}
        </div>
      )}

      {/* Main Editor Workspace: Sidebar Inspector + Expandable Grid Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Selected Stall Inspector & Unassigned Stalls */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Selected Stall Sizing & Placement Inspector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Puesto Seleccionado para Ubicar / Redimensionar
            </h3>

            {selectedStall ? (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {getCategoryStyle(selectedStall.category).emoji}{" "}
                      {selectedStall.name}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                      {selectedStall.w}×{selectedStall.h} cas. (
                      {formatStallMeters(selectedStall.w, selectedStall.h)})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedStall.x !== null && selectedStall.y !== null
                      ? `Posición actual: Columna ${selectedStall.x}, Fila ${selectedStall.y}`
                      : "Actualmente sin ubicar en la grilla"}
                  </p>
                </div>

                {/* Rectangular Dimensions Controls (1 or more cells) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl border border-slate-200 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      Ancho (Columnas: {selectedStall.w})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          tryResizeStall(
                            selectedStall.id,
                            selectedStall.w - 1,
                            selectedStall.h
                          )
                        }
                        className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                      >
                        −
                      </button>
                      <span className="font-bold text-sm px-2">
                        {selectedStall.w}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          tryResizeStall(
                            selectedStall.id,
                            selectedStall.w + 1,
                            selectedStall.h
                          )
                        }
                        className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      Alto (Filas: {selectedStall.h})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          tryResizeStall(
                            selectedStall.id,
                            selectedStall.w,
                            selectedStall.h - 1
                          )
                        }
                        className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                      >
                        −
                      </button>
                      <span className="font-bold text-sm px-2">
                        {selectedStall.h}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          tryResizeStall(
                            selectedStall.id,
                            selectedStall.w,
                            selectedStall.h + 1
                          )
                        }
                        className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {selectedStall.x !== null && (
                  <button
                    type="button"
                    onClick={() => unplaceStall(selectedStall.id)}
                    className="w-full py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold cursor-pointer"
                  >
                    📤 Quitar del mapa (mover a Sin ubicar)
                  </button>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  💡 <strong>Cómo mover:</strong> Con la herramienta{" "}
                  <em>&ldquo;Ubicar / Mover Puestos&rdquo;</em> activa, arrastra
                  el puesto sobre la grilla o haz clic directamente en cualquier{" "}
                  <strong>Casilla Vacía</strong> de destino.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Selecciona cualquier puesto de la lista o del mapa.
              </p>
            )}
          </div>

          {/* Unassigned Stalls List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
              📦 Puestos Sin Ubicar ({unplacedStalls.length})
            </h3>
            {unplacedStalls.length === 0 ? (
              <p className="text-xs text-slate-400">
                Todos los puestos están ubicados en el mapa.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {unplacedStalls.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      setSelectedStallId(s.id);
                      setTool("MOVE_STALL");
                      e.dataTransfer.setData("text/plain", String(s.id));
                    }}
                    onClick={() => {
                      setSelectedStallId(s.id);
                      setTool("MOVE_STALL");
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs flex items-center justify-between cursor-pointer transition ${
                      selectedStallId === s.id
                        ? "border-emerald-600 bg-emerald-50 font-bold"
                        : "border-slate-200 hover:border-slate-300 bg-slate-50"
                    }`}
                  >
                    <span>
                      {getCategoryStyle(s.category).emoji} {s.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-sm bg-amber-100 text-amber-900 font-bold text-[10px]">
                      {s.w}×{s.h} • Ubicar →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Placed Stalls Quick Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              📍 Puestos en el Mapa ({placedStalls.length})
            </h3>
            <div className="scrollable-panel max-h-64 flex flex-col gap-1.5 pr-1">
              {placedStalls.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedStallId(s.id);
                    setTool("MOVE_STALL");
                  }}
                  className={`px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer ${
                    selectedStallId === s.id
                      ? "bg-emerald-700 text-white font-bold"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  <span className="truncate">
                    {getCategoryStyle(s.category).emoji} {s.name}
                  </span>
                  <span className="text-[10px] opacity-85 shrink-0 ml-2">
                    ({s.x},{s.y}) • {s.w}×{s.h}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Canvas: Interactive Expandable Grid Editor */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Column Headers + Direct "+ Col" Button */}
            <div className="flex items-center gap-2 mb-1.5 pl-9">
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 68px)`,
                }}
              >
                {Array.from({ length: cols }, (_, i) => (
                  <div
                    key={i}
                    className="text-center text-[11px] font-bold text-slate-400"
                  >
                    COL {i + 1}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => applyNewDimensions(cols + 1, rows)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer shrink-0 shadow-xs"
                title="Agregar 1 columna más a la derecha"
              >
                + Columna
              </button>
            </div>

            <div className="flex gap-1.5 items-start">
              {/* Row Headers */}
              <div
                className="grid gap-1.5 w-7 shrink-0"
                style={{
                  gridTemplateRows: `repeat(${rows}, 52px)`,
                }}
              >
                {Array.from({ length: rows }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-[11px] font-bold text-slate-400"
                  >
                    F{i + 1}
                  </div>
                ))}
              </div>

              {/* Interactive Grid */}
              <div
                className="grid gap-1.5 bg-slate-200 p-2 rounded-xl border border-slate-300 select-none"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 68px)`,
                  gridTemplateRows: `repeat(${rows}, 52px)`,
                }}
              >
                {/* Unoccupied cells (PATH or EMPTY) */}
                {backgroundCells.map((cell) => (
                  <div
                    key={`ed-cell-${cell.x}-${cell.y}`}
                    style={{
                      gridColumn: `${cell.x} / span 1`,
                      gridRow: `${cell.y} / span 1`,
                    }}
                    onPointerDown={() => {
                      setIsPointerPainting(true);
                      handleCellAction(cell.x, cell.y);
                    }}
                    onPointerEnter={() => {
                      if (
                        isPointerPainting &&
                        (tool === "PAINT_PATH" || tool === "ERASE_CELL")
                      ) {
                        handleCellAction(cell.x, cell.y);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = Number(
                        e.dataTransfer.getData("text/plain") || selectedStallId
                      );
                      if (draggedId) {
                        tryPlaceOrMoveStall(draggedId, cell.x, cell.y);
                      }
                    }}
                    className={`rounded-md flex flex-col items-center justify-center text-[10px] cursor-pointer transition ${
                      cell.isPath
                        ? "path-cell-pattern border border-slate-400 text-slate-700 font-semibold"
                        : "bg-white/80 hover:bg-emerald-50 border border-dashed border-slate-300 text-slate-400"
                    }`}
                  >
                    {cell.isPath ? (
                      <>
                        <span>👣</span>
                        <span className="text-[9px] uppercase">Camino</span>
                      </>
                    ) : (
                      <span>
                        {cell.x},{cell.y}
                      </span>
                    )}
                  </div>
                ))}

                {/* Placed Rectangular Stalls */}
                {placedStalls.map((stall) => {
                  const style = getCategoryStyle(stall.category);
                  const isSelected = stall.id === selectedStallId;

                  return (
                    <div
                      key={`ed-stall-${stall.id}`}
                      draggable={tool === "MOVE_STALL"}
                      onDragStart={(e) => {
                        setSelectedStallId(stall.id);
                        e.dataTransfer.setData("text/plain", String(stall.id));
                      }}
                      onClick={() => {
                        if (tool === "ERASE_CELL") {
                          unplaceStall(stall.id);
                        } else {
                          setSelectedStallId(stall.id);
                        }
                      }}
                      style={{
                        gridColumn: `${stall.x} / span ${stall.w}`,
                        gridRow: `${stall.y} / span ${stall.h}`,
                      }}
                      className={`relative rounded-lg border-2 p-1.5 flex flex-col justify-between cursor-grab active:cursor-grabbing transition overflow-clip ${
                        style.bg
                      } ${style.border} ${style.text} ${
                        isSelected
                          ? "ring-3 ring-emerald-700 shadow-md z-10"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-extrabold leading-tight line-clamp-2">
                          {style.emoji} {stall.name}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-black/15 shrink-0">
                          {stall.w}×{stall.h}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="text-[9px] font-mono opacity-80">
                          Col {stall.x}, Fila {stall.y}
                        </span>
                        <span className="text-[9px] font-bold underline">
                          {isSelected ? "Seleccionado" : "Editar"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right-side vertical bar to quickly add columns */}
              <button
                type="button"
                onClick={() => applyNewDimensions(cols + 1, rows)}
                title="Agregar 1 columna a la derecha"
                className="self-stretch px-2 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center cursor-pointer transition"
              >
                + Col
              </button>
            </div>

            {/* Bottom bar to quickly add rows at the bottom of the grid */}
            <div className="mt-2.5 pl-9 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyNewDimensions(cols, rows + 1)}
                className="px-4 py-2 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs cursor-pointer transition"
              >
                ⬇️ + Agregar 1 Fila Abajo (Fila {rows + 1})
              </button>
              <button
                type="button"
                onClick={() => applyNewDimensions(cols, rows + 5)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition"
              >
                ⬇️ + Agregar 5 Filas Abajo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
