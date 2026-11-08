"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { FairState, Stall } from "@/lib/db/schema";
import { formatARS, getCategoryStyle } from "@/lib/categories";
import {
  FAIR_SURFACE,
  formatStallMeters,
  getCanvasPalette,
} from "@/lib/fair-metrics";
import type { SessionUser } from "@/lib/auth";

interface FairMapProps {
  initialState: FairState;
  currentUser: SessionUser | null;
}

// 1 meter = 32 world units at zoom = 1.0
// Therefore 1 casilla (2.0m x 2.0m) = 64 x 64 world units
const UNITS_PER_METER = 32;
const CELL_UNITS = FAIR_SURFACE.cellNominalM * UNITS_PER_METER; // 64 world units per cell (2m x 2m)
const LOT_WIDTH_UNITS = FAIR_SURFACE.widthM * UNITS_PER_METER; // ~3209.6 units (100.30m)
const LOT_HEIGHT_UNITS = FAIR_SURFACE.heightM * UNITS_PER_METER; // ~3217.6 units (100.55m)

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 3.2;

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export default function FairMap({ initialState, currentUser }: FairMapProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [activeStall, setActiveStall] = useState<Stall | null>(null);
  const [hoveredStall, setHoveredStall] = useState<Stall | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(
    null
  );
  const [copiedAlias, setCopiedAlias] = useState<string | null>(null);
  const [modalProductFilter, setModalProductFilter] = useState("");
  const [showListDrawer, setShowListDrawer] = useState<boolean>(false);
  const [showSurfaceSpecs, setShowSurfaceSpecs] = useState<boolean>(false);

  // Camera state: x, y are the world coordinates at the top-left of the viewport, zoom is scale
  const [camera, setCamera] = useState<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 0.85,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogTitleId = useId();

  const { settings, stalls, pathCells } = initialState;
  const cols = settings.cols;
  const rows = settings.rows;

  // Position the active (cols x rows) grid centered horizontally near the North entrance of the 10,085 m² lot
  const sectorWidthUnits = cols * CELL_UNITS;
  const sectorHeightUnits = rows * CELL_UNITS;
  const lotWidthUnits = Math.max(
    LOT_WIDTH_UNITS,
    sectorWidthUnits + CELL_UNITS * 4
  );
  const lotHeightUnits = Math.max(
    LOT_HEIGHT_UNITS,
    sectorHeightUnits + CELL_UNITS * 4
  );
  const sectorOffsetX = Math.max(
    CELL_UNITS * 2,
    (lotWidthUnits - sectorWidthUnits) / 2
  );
  const sectorOffsetY = CELL_UNITS * 2; // 4m inside North Entrance

  const placedStalls = useMemo(
    () => stalls.filter((s) => s.x !== null && s.y !== null),
    [stalls]
  );

  const pathSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of pathCells) s.add(`${p.x},${p.y}`);
    return s;
  }, [pathCells]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of placedStalls) set.add(s.category);
    return ["TODOS", ...Array.from(set)];
  }, [placedStalls]);

  const normalizedQuery = search.trim().toLowerCase();

  const matchingStallIds = useMemo(() => {
    const set = new Set<number>();
    for (const s of placedStalls) {
      if (selectedCategory !== "TODOS" && s.category !== selectedCategory) {
        continue;
      }
      if (!normalizedQuery) {
        set.add(s.id);
        continue;
      }
      const inName = s.name.toLowerCase().includes(normalizedQuery);
      const inCat = s.category.toLowerCase().includes(normalizedQuery);
      const inDesc = s.description.toLowerCase().includes(normalizedQuery);
      const inAlias = s.mp_aliases.some((a) =>
        a.toLowerCase().includes(normalizedQuery)
      );
      const inProd = s.products.some((p) =>
        p.name.toLowerCase().includes(normalizedQuery)
      );
      if (inName || inCat || inDesc || inAlias || inProd) {
        set.add(s.id);
      }
    }
    return set;
  }, [placedStalls, selectedCategory, normalizedQuery]);

  // Camera framing helpers
  const frameActiveSector = useCallback(() => {
    const canvas = canvasRef.current;
    const vw = canvas?.clientWidth || window.innerWidth;
    const vh = canvas?.clientHeight || window.innerHeight;

    const padX = 120;
    const padY = 180;
    const fitZoom = Math.min(
      1.15,
      Math.max(
        0.45,
        Math.min(
          (vw - padX) / (sectorWidthUnits + CELL_UNITS * 2),
          (vh - padY) / (sectorHeightUnits + CELL_UNITS * 2)
        )
      )
    );

    const centerX = sectorOffsetX + sectorWidthUnits / 2;
    const centerY = sectorOffsetY + sectorHeightUnits * 0.38;

    setCamera({
      zoom: Number(fitZoom.toFixed(2)),
      x: centerX - vw / (2 * fitZoom),
      y: centerY - vh / (2 * fitZoom),
    });
  }, [sectorOffsetX, sectorOffsetY, sectorWidthUnits, sectorHeightUnits]);

  const frameFullLot = useCallback(() => {
    const canvas = canvasRef.current;
    const vw = canvas?.clientWidth || window.innerWidth;
    const vh = canvas?.clientHeight || window.innerHeight;

    const fitZoom = Math.min(
      0.8,
      Math.max(
        MIN_ZOOM,
        Math.min(
          (vw - 100) / (lotWidthUnits + 200),
          (vh - 180) / (lotHeightUnits + 200)
        )
      )
    );

    const centerX = lotWidthUnits / 2;
    const centerY = lotHeightUnits / 2;

    setCamera({
      zoom: Number(fitZoom.toFixed(2)),
      x: centerX - vw / (2 * fitZoom),
      y: centerY - vh / (2 * fitZoom),
    });
  }, [lotWidthUnits, lotHeightUnits]);

  const focusStallOnCanvas = useCallback(
    (stall: Stall) => {
      if (stall.x === null || stall.y === null) return;
      const canvas = canvasRef.current;
      const vw = canvas?.clientWidth || window.innerWidth;
      const vh = canvas?.clientHeight || window.innerHeight;

      const targetZoom = Math.max(camera.zoom, 1.25);
      const stallCenterX =
        sectorOffsetX + (stall.x - 1 + stall.w / 2) * CELL_UNITS;
      const stallCenterY =
        sectorOffsetY + (stall.y - 1 + stall.h / 2) * CELL_UNITS;

      setCamera({
        zoom: Number(targetZoom.toFixed(2)),
        x: stallCenterX - vw / (2 * targetZoom),
        y: stallCenterY - vh / (2 * targetZoom),
      });
    },
    [camera.zoom, sectorOffsetX, sectorOffsetY]
  );

  // Initial framing on mount
  useEffect(() => {
    frameActiveSector();
  }, [frameActiveSector]);

  // Modern Web Guidance: Fallback for <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent, el: HTMLDialogElement) => {
        const r = el.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e, dialog);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e, dialog)) {
          dialog.close();
        }
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      return () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }
  }, []);

  // Zoom around screen point (screenX, screenY)
  const zoomAtPoint = useCallback(
    (nextZoomRaw: number, screenX?: number, screenY?: number) => {
      const canvas = canvasRef.current;
      const vw = canvas?.clientWidth || window.innerWidth;
      const vh = canvas?.clientHeight || window.innerHeight;
      const sx = screenX ?? vw / 2;
      const sy = screenY ?? vh / 2;

      setCamera((prev) => {
        const nextZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, Number(nextZoomRaw.toFixed(3)))
        );
        // World coordinate currently under (sx, sy)
        const worldX = prev.x + sx / prev.zoom;
        const worldY = prev.y + sy / prev.zoom;
        return {
          zoom: nextZoom,
          x: worldX - sx / nextZoom,
          y: worldY - sy / nextZoom,
        };
      });
    },
    []
  );

  // Wheel zoom listener on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      zoomAtPoint(camera.zoom * factor, sx, sy);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [camera.zoom, zoomAtPoint]);

  // Convert screen coordinates on canvas to World coordinates & Grid Cell (col, row)
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { worldX: 0, worldY: 0, col: null, row: null };
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const worldX = camera.x + sx / camera.zoom;
      const worldY = camera.y + sy / camera.zoom;

      const relX = worldX - sectorOffsetX;
      const relY = worldY - sectorOffsetY;
      const col = Math.floor(relX / CELL_UNITS) + 1;
      const row = Math.floor(relY / CELL_UNITS) + 1;

      const validCell = col >= 1 && col <= cols && row >= 1 && row <= rows;
      return {
        worldX,
        worldY,
        col: validCell ? col : null,
        row: validCell ? row : null,
      };
    },
    [camera, sectorOffsetX, sectorOffsetY, cols, rows]
  );

  const findStallAtCell = useCallback(
    (col: number | null, row: number | null): Stall | null => {
      if (col === null || row === null) return null;
      return (
        placedStalls.find(
          (s) =>
            col >= s.x! &&
            col < s.x! + s.w &&
            row >= s.y! &&
            row < s.y! + s.h
        ) ?? null
      );
    },
    [placedStalls]
  );

  // Pointer drag / pan & click hit-testing state
  const pointerStateRef = useRef<{
    active: boolean;
    pointerId: number;
    lastX: number;
    lastY: number;
    movedDistance: number;
  }>({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    movedDistance: 0,
  });

  const openStallDialog = (stall: Stall, shouldFocus = false) => {
    setActiveStall(stall);
    setModalProductFilter(search.trim());
    setCopiedAlias(null);
    if (shouldFocus) {
      focusStallOnCanvas(stall);
    }
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    pointerStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
      movedDistance: 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = pointerStateRef.current;
    if (st.active && e.pointerId === st.pointerId) {
      const dx = e.clientX - st.lastX;
      const dy = e.clientY - st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      st.movedDistance += Math.hypot(dx, dy);

      if (st.movedDistance > 4) {
        if (!isDragging) {
          setIsDragging(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore
          }
        }
        setCamera((prev) => ({
          ...prev,
          x: prev.x - dx / prev.zoom,
          y: prev.y - dy / prev.zoom,
        }));
      }
      return;
    }

    // Hover hit-testing when not dragging
    const { col, row } = screenToWorld(e.clientX, e.clientY);
    setHoveredCell(col && row ? { x: col, y: row } : null);
    setHoveredStall(findStallAtCell(col, row));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = pointerStateRef.current;
    if (!st.active || e.pointerId !== st.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }

    const wasClick = st.movedDistance <= 6;
    st.active = false;
    setIsDragging(false);

    if (wasClick) {
      const { col, row } = screenToWorld(e.clientX, e.clientY);
      const clickedStall = findStallAtCell(col, row);
      if (clickedStall) {
        openStallDialog(clickedStall);
      }
    }
  };

  // MAIN HTML5 2D CANVAS RENDER LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear surrounding viewport background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    // Apply Camera Transform (world -> screen)
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 2. Draw the Fair Ground Lot (base 10,085 m² or expanded dynamically with cols/rows)
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 40;
    drawRoundedRect(ctx, 0, 0, lotWidthUnits, lotHeightUnits, 20);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.shadowBlur = 0;

    // Subtle 2m x 2m architectural module grid across the entire lot
    if (camera.zoom >= 0.25) {
      ctx.strokeStyle = "rgba(51, 65, 85, 0.35)";
      ctx.lineWidth = 1 / camera.zoom;
      ctx.beginPath();
      for (let gx = 0; gx <= lotWidthUnits; gx += CELL_UNITS) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, lotHeightUnits);
      }
      for (let gy = 0; gy <= lotHeightUnits; gy += CELL_UNITS) {
        ctx.moveTo(0, gy);
        ctx.lineTo(lotWidthUnits, gy);
      }
      ctx.stroke();
    }

    // Major 10m (5 casillas) survey lines across the lot
    ctx.strokeStyle = "rgba(16, 185, 129, 0.14)";
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath();
    const tenMeterUnits = 10 * UNITS_PER_METER;
    for (let gx = 0; gx <= lotWidthUnits; gx += tenMeterUnits) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, lotHeightUnits);
    }
    for (let gy = 0; gy <= lotHeightUnits; gy += tenMeterUnits) {
      ctx.moveTo(0, gy);
      ctx.lineTo(lotWidthUnits, gy);
    }
    ctx.stroke();

    // Perimeter Boundary Border
    drawRoundedRect(ctx, 0, 0, lotWidthUnits, lotHeightUnits, 20);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3 / camera.zoom;
    ctx.stroke();

    // Lot Perimeter & Area Dimension Labels on the Canvas
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `⬆️ FRENTE NORTE DEL PREDIO: ${FAIR_SURFACE.widthM.toFixed(2)} m  •  ÁREA TOTAL: 10,085 m² (1.01 ha | 108,554.04 ft² | 2.49 ac)  •  PERÍMETRO: ${FAIR_SURFACE.perimeterM.toFixed(2)} m (0.40 km) ⬆️`,
      lotWidthUnits / 2,
      -22
    );

    ctx.fillText(
      `⬇️ LÍMITE SUR DEL PREDIO — ${settings.name.toUpperCase()} (${cols} col × ${rows} filas activas) ⬇️`,
      lotWidthUnits / 2,
      lotHeightUnits + 36
    );

    // 10m ruler ticks along top and left edge of the 10,085 m² lot
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 13px monospace";
    for (let m = 0; m <= 100; m += 10) {
      const pos = m * UNITS_PER_METER;
      ctx.fillText(`${m}m`, pos, 18);
      ctx.save();
      ctx.textAlign = "left";
      ctx.fillText(`${m}m`, 8, pos + 14);
      ctx.restore();
    }

    // 3. Draw Active Sector Board (cols x rows of 2m x 2m casillas)
    const boardPad = 24;
    drawRoundedRect(
      ctx,
      sectorOffsetX - boardPad,
      sectorOffsetY - boardPad - 28,
      sectorWidthUnits + boardPad * 2,
      sectorHeightUnits + boardPad * 2 + 28,
      14
    );
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2 / camera.zoom;
    ctx.stroke();

    // Sector header banner inside canvas
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `SECTOR DE PUESTOS (${cols} col × ${rows} filas = ${(cols * FAIR_SURFACE.cellNominalM).toFixed(0)}m × ${(rows * FAIR_SURFACE.cellNominalM).toFixed(0)}m • Casilla módulo: 1.5 a 2.0 m)`,
      sectorOffsetX + sectorWidthUnits / 2,
      sectorOffsetY - 30
    );

    // Column headers (C1..cols) and Row headers (F1..rows)
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    for (let c = 1; c <= cols; c++) {
      const cx = sectorOffsetX + (c - 0.5) * CELL_UNITS;
      ctx.textAlign = "center";
      ctx.fillText(
        `C${c} (${(c * FAIR_SURFACE.cellNominalM).toFixed(0)}m)`,
        cx,
        sectorOffsetY - 8
      );
    }
    for (let r = 1; r <= rows; r++) {
      const cy = sectorOffsetY + (r - 0.5) * CELL_UNITS + 4;
      ctx.textAlign = "right";
      ctx.fillText(`F${r}`, sectorOffsetX - 6, cy);
    }

    // Build set of cells covered by placed stalls
    const occupiedSet = new Set<string>();
    for (const s of placedStalls) {
      for (let dx = 0; dx < s.w; dx++) {
        for (let dy = 0; dy < s.h; dy++) {
          occupiedSet.add(`${s.x! + dx},${s.y! + dy}`);
        }
      }
    }

    // 4. Draw single cells: PATH (Camino) and EMPTY (Casilla vacía)
    const cellInset = 3;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const key = `${c},${r}`;
        if (occupiedSet.has(key)) continue;

        const cx = sectorOffsetX + (c - 1) * CELL_UNITS + cellInset;
        const cy = sectorOffsetY + (r - 1) * CELL_UNITS + cellInset;
        const cw = CELL_UNITS - cellInset * 2;
        const ch = CELL_UNITS - cellInset * 2;
        const isPath = pathSet.has(key);
        const isHoveredCell =
          hoveredCell?.x === c && hoveredCell?.y === r && !hoveredStall;

        drawRoundedRect(ctx, cx, cy, cw, ch, 6);

        if (isPath) {
          ctx.fillStyle = isHoveredCell ? "#cbd5e1" : "#94a3b8";
          ctx.fill();
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 1;
          ctx.stroke();

          if (camera.zoom >= 0.55) {
            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 12px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("👣", cx + cw / 2, cy + ch / 2 - (camera.zoom >= 0.85 ? 2 : -4));
            if (camera.zoom >= 0.85) {
              ctx.font = "bold 8px system-ui, sans-serif";
              ctx.fillText("CAMINO", cx + cw / 2, cy + ch / 2 + 12);
            }
          }
        } else {
          // Empty Cell (Casilla vacía 1.5-2m x 1.5-2m)
          ctx.fillStyle = isHoveredCell
            ? "rgba(30, 41, 59, 0.9)"
            : "rgba(15, 23, 42, 0.65)";
          ctx.fill();
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          if (camera.zoom >= 0.7) {
            ctx.fillStyle = "#475569";
            ctx.font = "9px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Vacío", cx + cw / 2, cy + ch / 2 - 2);
            ctx.font = "8px monospace";
            ctx.fillText("2m×2m", cx + cw / 2, cy + ch / 2 + 10);
          }
        }
      }
    }

    // 5. Draw Stalls (Puestos que ocupan 1 o más casillas w x h)
    for (const stall of placedStalls) {
      const sx = sectorOffsetX + (stall.x! - 1) * CELL_UNITS + cellInset;
      const sy = sectorOffsetY + (stall.y! - 1) * CELL_UNITS + cellInset;
      const sw = stall.w * CELL_UNITS - cellInset * 2;
      const sh = stall.h * CELL_UNITS - cellInset * 2;

      const palette = getCanvasPalette(stall.category);
      const isMatch = matchingStallIds.has(stall.id);
      const isHovered = hoveredStall?.id === stall.id;
      const isSelected = activeStall?.id === stall.id;

      ctx.save();
      if (!isMatch) {
        ctx.globalAlpha = 0.22;
      }

      // Stall Box
      drawRoundedRect(ctx, sx, sy, sw, sh, 8);
      ctx.fillStyle = palette.fill;
      ctx.fill();

      ctx.lineWidth = isSelected || isHovered ? 3.5 / camera.zoom : 2 / camera.zoom;
      ctx.strokeStyle = isSelected
        ? "#10b981"
        : isHovered
          ? "#ffffff"
          : normalizedQuery && isMatch
            ? "#f59e0b"
            : palette.stroke;
      ctx.stroke();

      // Clip text to stall rectangle
      ctx.clip();

      // Stall Title + Emoji
      ctx.fillStyle = palette.text;
      ctx.textAlign = "left";
      ctx.font = "bold 11px system-ui, sans-serif";
      const titleText = `${palette.emoji} ${stall.name}`;
      ctx.fillText(titleText, sx + 7, sy + 16, sw - 14);

      // Dimensions in Casillas & Meters
      if (camera.zoom >= 0.65) {
        const wMeters = stall.w * FAIR_SURFACE.cellNominalM;
        const hMeters = stall.h * FAIR_SURFACE.cellNominalM;
        ctx.fillStyle = palette.badgeFill;
        ctx.font = "bold 8.5px system-ui, sans-serif";
        ctx.fillText(
          `${stall.category.toUpperCase()} • ${stall.w}×${stall.h} cas. (${wMeters}m×${hMeters}m)`,
          sx + 7,
          sy + 29,
          sw - 14
        );
      }

      // Level of Detail: When zoomed in, draw products & prices and MP alias right inside the canvas stall!
      if (camera.zoom >= 1.05 && sh >= 56) {
        let lineY = sy + 44;
        const maxLines = stall.h > 1 ? 4 : 1;
        const prods = stall.products.slice(0, maxLines);

        ctx.font = "9px system-ui, sans-serif";
        for (const p of prods) {
          if (lineY + 10 > sy + sh - 14) break;
          ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
          drawRoundedRect(ctx, sx + 6, lineY - 9, sw - 12, 13, 3);
          ctx.fill();

          ctx.fillStyle = "#0f172a";
          ctx.fillText(
            `• ${p.name}: ${formatARS(p.price)}/${p.unit}`,
            sx + 9,
            lineY,
            sw - 18
          );
          lineY += 15;
        }
      }

      // Bottom bar inside stall: MP alias or product count
      if (camera.zoom >= 0.75) {
        ctx.fillStyle = palette.text;
        ctx.font = "bold 8.5px system-ui, sans-serif";
        const footerText =
          stall.mp_aliases.length > 0
            ? `💳 MP: ${stall.mp_aliases[0]} • ${stall.products.length} prod.`
            : `${stall.products.length} productos disponibles`;
        ctx.fillText(footerText, sx + 7, sy + sh - 6, sw - 14);
      }

      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }, [
    camera,
    cols,
    rows,
    placedStalls,
    pathSet,
    matchingStallIds,
    hoveredStall,
    hoveredCell,
    activeStall,
    normalizedQuery,
    sectorOffsetX,
    sectorOffsetY,
    sectorWidthUnits,
    sectorHeightUnits,
    lotWidthUnits,
    lotHeightUnits,
    settings.name,
  ]);

  // Repaint on window resize
  useEffect(() => {
    const onResize = () => setCamera((c) => ({ ...c }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleCopyAlias = async (alias: string) => {
    try {
      await navigator.clipboard.writeText(alias);
      setCopiedAlias(alias);
      setTimeout(() => setCopiedAlias(null), 2200);
    } catch {
      // Fallback
    }
  };

  const filteredModalProducts = useMemo(() => {
    if (!activeStall) return [];
    const q = modalProductFilter.trim().toLowerCase();
    if (!q) return activeStall.products;
    return activeStall.products.filter((p) => p.name.toLowerCase().includes(q));
  }, [activeStall, modalProductFilter]);

  // Dynamic visual scale bar length in pixels for 10 meters (or 2 meters = 1 casilla)
  const twoMetersPx = Math.round(2 * UNITS_PER_METER * camera.zoom);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-950 select-none">
      {/* FULL-SCREEN INTERACTIVE HTML5 <canvas> */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={`Lienzo Canvas del Mapa de ${settings.name} — Superficie 10,085 m²`}
        className={`block w-full h-full touch-none ${
          isDragging
            ? "cursor-grabbing"
            : hoveredStall
              ? "cursor-pointer"
              : "cursor-grab"
        }`}
      />

      {/* FLOATING TOP HUD: Brand, Search, Category Filters & CMS Access */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-20 p-3 sm:p-4 flex flex-col gap-2 max-w-6xl mx-auto">
        <div className="pointer-events-auto bg-slate-900/92 backdrop-blur-md text-white rounded-2xl border border-slate-700/80 shadow-xl px-3.5 py-2.5 flex flex-wrap items-center gap-2.5 justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl bg-emerald-600/90 p-1.5 rounded-xl border border-emerald-400/40">
              🧺
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold leading-tight">
                {settings.name}
              </h1>
              <p className="text-[11px] text-emerald-300">
                Predio: 10,085 m² (1.01 ha) • Perímetro: 401.30 m • Casilla: 1.5–2.0 m
              </p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[210px] max-w-md">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto (papa, tomate...), puesto o alias MP..."
              aria-label="Buscar productos, puestos o alias"
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-600 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-xs sm:text-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              🔍
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSurfaceSpecs((v) => !v)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-600 transition hidden md:inline-flex"
              title="Ver datos catastrales y dimensiones de casilla"
            >
              📐 10,085 m²
            </button>

            <button
              type="button"
              onClick={() => setShowListDrawer((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition ${
                showListDrawer
                  ? "bg-emerald-500 text-slate-950 border-emerald-400"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
              }`}
            >
              📋 Puestos ({matchingStallIds.size})
            </button>

            {currentUser ? (
              <Link
                href={
                  currentUser.role === "ADMIN" ? "/cms/admin" : "/cms/mi-puesto"
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
              >
                {currentUser.role === "ADMIN" ? "⚙️ CMS Admin" : "🏪 Mi Puesto"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition"
              >
                🔐 CMS
              </Link>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div
          className="pointer-events-auto filter-pills bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/70 shadow-lg self-start"
          role="group"
          aria-label="Filtrar mapa por rubro"
        >
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            const style = cat === "TODOS" ? null : getCategoryStyle(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow-xs"
                    : "bg-slate-800/90 hover:bg-slate-700 text-slate-200"
                }`}
              >
                {style ? `${style.emoji} ${cat}` : "🗺️ Todos"}
              </button>
            );
          })}
          {(search || selectedCategory !== "TODOS") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory("TODOS");
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600 text-white cursor-pointer"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Optional Surface Specifications Banner */}
        {showSurfaceSpecs && (
          <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-slate-200 rounded-2xl border border-emerald-500/40 p-3.5 text-xs shadow-2xl max-w-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <strong className="text-emerald-400 uppercase tracking-wider">
                📐 Ficha Técnica de la Superficie y Módulos
              </strong>
              <button
                type="button"
                onClick={() => setShowSurfaceSpecs(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="mb-1">
              • <strong>Superficie del Predio:</strong> Área: 10,085 m² | 1.01 ha
              | 0.01 km² | 108,554.04 ft² | 2.49 ac
            </p>
            <p className="mb-1">
              • <strong>Perímetro Total:</strong> 401.30 m | 0.40 km (~100.30 m
              de frente × 100.55 m de fondo)
            </p>
            <p>
              • <strong>Dimensión de cada Casilla (Módulo):</strong> 1.5 a 2.0 m
              de frente × 1.5 a 2.0 m de fondo (escala base: 2.0 m × 2.0 m = 4
              m² por casilla).
            </p>
          </div>
        )}
      </header>

      {/* FLOATING HOVER TOOLTIP WHEN POINTER IS OVER A STALL ON THE CANVAS */}
      {hoveredStall && !isDragging && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl border border-emerald-500/60 shadow-2xl flex items-center gap-3">
          <span className="text-xl">
            {getCategoryStyle(hoveredStall.category).emoji}
          </span>
          <div>
            <div className="text-xs font-extrabold flex items-center gap-2">
              <span>{hoveredStall.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                {hoveredStall.w}×{hoveredStall.h} casillas (
                {formatStallMeters(hoveredStall.w, hoveredStall.h)})
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              {hoveredStall.products.length} productos • Clic para ver precios y
              alias de Mercado Pago
            </div>
          </div>
        </div>
      )}

      {/* OPTIONAL FLOATING DRAWER: Quick Directory of Stalls */}
      {showListDrawer && (
        <aside
          aria-label="Directorio rápido de puestos"
          className="fixed top-32 right-4 z-20 w-80 max-w-[calc(100vw-2rem)] max-h-[64dvh] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl border border-slate-700 shadow-2xl p-3.5 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Puestos en el Mapa ({matchingStallIds.size})
            </h2>
            <button
              type="button"
              onClick={() => setShowListDrawer(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer font-bold px-1.5"
            >
              ✕
            </button>
          </div>
          <div className="scrollable-panel flex-1 flex flex-col gap-2 pr-1">
            {placedStalls
              .filter((s) => matchingStallIds.has(s.id))
              .map((stall) => {
                const style = getCategoryStyle(stall.category);
                return (
                  <button
                    key={stall.id}
                    type="button"
                    onClick={() => openStallDialog(stall, true)}
                    className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500 text-left transition cursor-pointer flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-white truncate">
                        {style.emoji} {stall.name}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300 shrink-0">
                        C{stall.x}, F{stall.y} ({stall.w}×{stall.h})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {formatStallMeters(stall.w, stall.h)} •{" "}
                      {stall.products.length} prod.
                    </span>
                  </button>
                );
              })}
          </div>
        </aside>
      )}

      {/* FLOATING BOTTOM-LEFT METRIC SCALE BAR & LEGEND */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-20 hidden sm:flex flex-col gap-1.5 bg-slate-900/92 backdrop-blur-md text-slate-200 px-3.5 py-2.5 rounded-2xl border border-slate-700/80 shadow-xl text-[11px]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-mono text-emerald-300 font-bold">
              1 casilla ≈ 1.5–2.0 m
            </span>
            <div
              className="h-2 border-x-2 border-b-2 border-emerald-400 bg-emerald-400/20 mt-0.5 transition-all"
              style={{ width: `${Math.max(18, Math.min(180, twoMetersPx))}px` }}
            />
          </div>
          <span className="text-slate-400">|</span>
          <span>
            <strong>Área:</strong> 10,085 m² (1.01 ha)
          </span>
          <span className="text-slate-400">|</span>
          <span>
            <strong>Perímetro:</strong> 401.30 m
          </span>
        </div>
      </div>

      {/* FLOATING BOTTOM-RIGHT CANVAS CAMERA & ZOOM CONTROLS */}
      <div
        role="group"
        aria-label="Controles de cámara y zoom del canvas"
        className="fixed bottom-4 right-4 z-20 flex flex-wrap items-center gap-1.5 bg-slate-900/95 backdrop-blur-md text-white p-1.5 rounded-2xl border border-slate-700 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => zoomAtPoint(camera.zoom * 0.85)}
          aria-label="Alejar mapa"
          title="Alejar (−)"
          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 font-extrabold text-base flex items-center justify-center cursor-pointer transition"
        >
          −
        </button>
        <span className="px-2 text-xs font-mono font-bold text-emerald-300 min-w-[50px] text-center">
          {Math.round(camera.zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomAtPoint(camera.zoom * 1.18)}
          aria-label="Acercar mapa"
          title="Acercar (+)"
          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 font-extrabold text-base flex items-center justify-center cursor-pointer transition"
        >
          +
        </button>
        <button
          type="button"
          onClick={frameActiveSector}
          title="Encuadrar zona de puestos"
          className="px-2.5 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer transition"
        >
          🎯 Puestos
        </button>
        <button
          type="button"
          onClick={frameFullLot}
          title="Ver superficie completa del predio (10,085 m² | Perímetro 401.30 m)"
          className="px-2.5 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-600 font-bold text-xs cursor-pointer transition"
        >
          🗺️ Predio 10,085 m²
        </button>
      </div>

      {/* Native Modal Dialog for Selected Stall Details & Products */}
      <dialog
        ref={dialogRef}
        closedby="any"
        aria-labelledby={dialogTitleId}
        className="m-auto w-[min(94vw,640px)] max-h-[88dvh] rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 p-0 overflow-hidden"
      >
        {activeStall && (
          <div className="flex flex-col max-h-[88dvh]">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                    {getCategoryStyle(activeStall.category).emoji}{" "}
                    {activeStall.category}
                  </span>
                  <span className="text-xs text-emerald-300 font-medium">
                    📍 Col {activeStall.x}, Fila {activeStall.y} •{" "}
                    {activeStall.w}×{activeStall.h} casillas (
                    {formatStallMeters(activeStall.w, activeStall.h)})
                  </span>
                </div>
                <h2 id={dialogTitleId} className="text-xl font-bold">
                  {activeStall.name}
                </h2>
                {activeStall.description && (
                  <p className="text-xs text-slate-300 mt-1">
                    {activeStall.description}
                  </p>
                )}
              </div>

              <form method="dialog">
                <button
                  type="submit"
                  aria-label="Cerrar ventana"
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </form>
            </div>

            {/* Modal Body */}
            <div className="p-5 scrollable-panel flex-1 flex flex-col gap-5">
              {/* Mercado Pago Aliases Section */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-900 mb-2 flex items-center gap-1.5">
                  💳 Alias de Mercado Pago ({activeStall.mp_aliases.length})
                </h3>
                {activeStall.mp_aliases.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Este puesto no registró alias de Mercado Pago aún.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activeStall.mp_aliases.map((alias) => (
                      <div
                        key={alias}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-sky-200"
                      >
                        <code className="font-mono font-bold text-sm text-sky-950 select-all">
                          {alias}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyAlias(alias)}
                          className="px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer transition shrink-0"
                        >
                          {copiedAlias === alias ? "✓ ¡Copiado!" : "Copiar alias"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Products and Prices List */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">
                    🏷️ Productos y Precios ({activeStall.products.length})
                  </h3>
                  {activeStall.products.length > 3 && (
                    <input
                      type="search"
                      value={modalProductFilter}
                      onChange={(e) => setModalProductFilter(e.target.value)}
                      placeholder="Filtrar producto en este puesto..."
                      aria-label="Filtrar producto en este puesto"
                      className="px-3 py-1 rounded-lg border border-slate-300 text-xs w-56"
                    />
                  )}
                </div>

                {filteredModalProducts.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                    No hay productos que coincidan con el filtro.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-xs uppercase">
                          <th className="py-2.5 px-3 font-bold">Producto</th>
                          <th className="py-2.5 px-3 font-bold">Unidad</th>
                          <th className="py-2.5 px-3 font-bold text-right">
                            Precio
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredModalProducts.map((prod) => (
                          <tr
                            key={prod.id}
                            className={
                              prod.in_stock ? "bg-white" : "bg-slate-50 opacity-60"
                            }
                          >
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {prod.name}
                              {!prod.in_stock && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 font-bold">
                                  Sin stock
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-xs">
                              por {prod.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                              {formatARS(prod.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <form method="dialog">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
              </form>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
