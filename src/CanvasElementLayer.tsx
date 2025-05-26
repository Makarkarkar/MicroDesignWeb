import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface Element {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    width: number;
    height: number;
    orientation: string;
    groupId?: string;
    combinedElementId?: string; // ← Добавить
    points?: { index: number; x: number; y: number }[];
}


interface Props {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    elements: Element[];
    visibleLayers: string[];
    draggingId: string | null;
    setDraggingId: (id: string | null) => void;
    updateElements: (newElements: Element[]) => void;
    setElements: React.Dispatch<React.SetStateAction<Element[]>>;
    layerColors: Record<string, string>;
    selectedIds: string[];
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
    setEditingGroupId: (id: string | null) => void;
    canvasScale: number
    polygonMode: boolean;
    polygonPointsRequired: number;
    setPolygonMode: (val: boolean) => void;
    setPolygonPointsRequired: (value: number) => void;
    tempPolygonPoints: { x: number; y: number }[];
    setTempPolygonPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;

}

const CanvasElementLayer: React.FC<Props> = ({
    canvasRef,
    elements,
    visibleLayers,
    draggingId,
    setDraggingId,
    updateElements,
    setElements,
    layerColors,
    selectedIds,
    setSelectedIds,
    setEditingGroupId,
    canvasScale,
    polygonMode,
    polygonPointsRequired,
    setPolygonMode,
    setPolygonPointsRequired,
    tempPolygonPoints,
    setTempPolygonPoints

}) => {
    const isResizingRef = useRef(false);
    const resizingIdRef = useRef<string | null>(null);
    const copiedElementRef = useRef<Element[] | null>(null);
    const lastMousePosRef = useRef<{ x: number, y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const resizeHandleSize = 2;
    const GRID_SIZE = 5;
    const CANVAS_SCALE = 5;
    const initialPositionsRef = useRef<Record<string, {
        x: number;
        y: number;
        x2?: number;
        y2?: number;
        points?: { index: number; x: number; y: number }[];
    }>>({});

    const newCombinedIdMap = new Map<string | undefined, string>();
    const layerOpacities: Record<string, number> = {
        M1: 1, M2: 0.9, TM1: 0.85, TM2: 0.85, NA: 0.8, P: 0.8,
        CNE: 0.75, SI: 0.75, CPA: 0.7, CPE: 0.7, SN: 0.65, CNA: 0.65,
        KP: 0.6, KN: 0.6, SPK: 0.55, CM: 0.5, CW: 0.45, M3: 0.4, CSI: 0.3, POLY: 0.2, N: 0.2
    };
    const dragModeRef = useRef<"MOVE_ALL" | "MOVE_P1" | "MOVE_P2" | `MOVE_POINT_${number}` | null>(null);

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const isPanningRef = useRef(false);
    const panStartRef = useRef<{ x: number; y: number } | null>(null);
    const initialElementsRef = useRef<Element[] | null>(null);
    const elementsRef = useRef<Element[]>(elements);
    const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
    const polygonPointsRef = useRef<{ x: number; y: number }[]>([]);


    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    function isPointNearLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number, tolerance = 6): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1) < tolerance;

        const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        if (t < 0 || t > 1) return false;

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const dist = Math.hypot(px - projX, py - projY);

        return dist <= tolerance;
    }
    function isPointInPolygon(x: number, y: number, points: { x: number; y: number }[]): boolean {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }


    function rotateCombinedElements(elements: Element[], selectedIds: string[]): Element[] {
        console.log("🔄 Ротация: выбранные элементы", selectedIds);
        const updated = [...elements];
        const byGroup = new Map<string, Element[]>();

        selectedIds.forEach(id => {
            const el = elements.find(e => e.id === id);
            if (el?.combinedElementId) {
                const group = byGroup.get(el.combinedElementId) || [];
                byGroup.set(el.combinedElementId, [...group, el]);
            }
        });

        byGroup.forEach(group => {
            const minX = Math.min(...group.map(e => e.x));
            const minY = Math.min(...group.map(e => e.y));
            const maxX = Math.max(...group.map(e => e.x + e.width));
            const maxY = Math.max(...group.map(e => e.y + e.height));
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;

            group.forEach(orig => {
                const centerX = orig.x + orig.width / 2;
                const centerY = orig.y + orig.height / 2;
                const dx = centerX - cx;
                const dy = centerY - cy;

                const rotatedDx = -dy;
                const rotatedDy = dx;

                const newCenterX = cx + rotatedDx;
                const newCenterY = cy + rotatedDy;

                const newOrientation = rotateOrientation(orig.orientation);

                const shouldSwap = orig.width !== orig.height;
                const newWidth = shouldSwap ? orig.height : orig.width;
                const newHeight = shouldSwap ? orig.width : orig.height;

                const newX = newCenterX - newWidth / 2;
                const newY = newCenterY - newHeight / 2;

                const rotatedElement = {
                    ...orig,
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                    orientation: newOrientation
                };

                const index = updated.findIndex(e => e.id === orig.id);
                updated[index] = rotatedElement;
            });
        });
        console.log("✅ После поворота:", updated.filter(e => selectedIds.includes(e.id)));
        return updated;
    }

    function rotateOrientation(orientation: string): string {
        const directions = ["EAST", "SOUTH", "WEST", "NORTH"];
        const index = directions.indexOf(orientation);
        return index >= 0 ? directions[(index + 1) % 4] : "EAST";
    }


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth * 0.8;
            canvas.height = window.innerHeight * 0.6;
            draw(ctx);
        };

        const getDrawRect = (el: Element) => {
            let drawWidth = el.width;
            let drawHeight = el.height;
            if (["NORTH", "SOUTH"].includes(el.orientation)) {
                [drawWidth, drawHeight] = [el.height, el.width];
            }
            return { x: el.x, y: el.y, width: drawWidth, height: drawHeight };
        };

        const draw = (ctx: CanvasRenderingContext2D) => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);
            ctx.save();
            ctx.scale(canvasScale, canvasScale);
            ctx.translate(offset.x, offset.y);

            ctx.strokeStyle = "#e5e7eb";
            ctx.lineWidth = 1;
            for (let x = 0; x < width; x += 50) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += 50) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            ctx.fillStyle = "#6b7280";
            ctx.font = "10px sans-serif";
            for (let x = 0; x < width; x += 100) ctx.fillText(`${x}`, x + 2, 10);
            for (let y = 0; y < height; y += 100) ctx.fillText(`${y}`, 2, y + 10);

            const sortedElements = [...elements].sort((a, b) => {
                const order = Object.keys(layerColors);
                return order.indexOf(a.type) - order.indexOf(b.type);
            });

            sortedElements.forEach(el => {
                if (!visibleLayers.includes(el.type)) return;

                const baseColor = layerColors[el.type] || "#000";
                const baseOpacity = layerOpacities[el.type] ?? 1;
                ctx.globalAlpha = selectedIds.includes(el.id) ? 0.8 : baseOpacity;

                // 🎯 Двухточечный элемент — линия
                if (el.x2 !== undefined && el.y2 !== undefined) {
                    ctx.beginPath();
                    ctx.moveTo(el.x, el.y);
                    ctx.lineTo(el.x2, el.y2);
                    ctx.lineWidth = el.width || 2;
                    ctx.strokeStyle = baseColor;
                    ctx.stroke();

                    // 🔷 Рамка при выделении (дублируем линию)
                    if (selectedIds.includes(el.id)) {
                        ctx.strokeStyle = "#2563eb";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(el.x, el.y);
                        ctx.lineTo(el.x2, el.y2);
                        ctx.stroke();
                    }

                    ctx.globalAlpha = 1.0;
                    ctx.lineWidth = 1; // 🔧 сброс на дефолт
                    return;
                }

                if (el.points && el.points.length >= 2) {
                    ctx.beginPath();
                    el.points.forEach((pt, idx) => {
                        if (idx === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    });
                    ctx.closePath();
                    ctx.fillStyle = baseColor;
                    ctx.fill();

                    if (selectedIds.includes(el.id)) {
                        ctx.strokeStyle = "#2563eb";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }

                    ctx.globalAlpha = 1.0;
                    ctx.lineWidth = 1;
                    return;
                }

                // 🟦 Прямоугольный элемент
                const { x: drawX, y: drawY, width: drawWidth, height: drawHeight } = getDrawRect(el);
                ctx.fillStyle = baseColor;
                ctx.fillRect(drawX, drawY, drawWidth, drawHeight);

                if (selectedIds.includes(el.id)) {
                    ctx.strokeStyle = "#2563eb";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(drawX - 2, drawY - 2, drawWidth + 4, drawHeight + 4);
                }

                ctx.globalAlpha = 1.0;
                ctx.lineWidth = 1;
            });


            ctx.restore();
        };

        const getMousePos = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) / canvasScale,
                y: (e.clientY - rect.top) / canvasScale
            };
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 2) return;
            const { x, y } = getMousePos(e);

            if (polygonMode) {
                const point = { x, y };
                setTempPolygonPoints(prev => {
                    const updated = [...prev, point];

                    if (updated.length === polygonPointsRequired) {
                        const newId = uuidv4();

                        let newElement: Element;

                        if (updated.length === 2) {
                            const [p1, p2] = updated;
                            newElement = {
                                id: newId,
                                name: "Line",
                                type: "M1",
                                x: p1.x,
                                y: p1.y,
                                x2: p2.x,
                                y2: p2.y,
                                width: 2,
                                height: 2,
                                orientation: "EAST",
                                combinedElementId: newId
                            };
                        } else {
                            newElement = {
                                id: newId,
                                name: "Polygon",
                                type: "M1",
                                x: updated[0].x,
                                y: updated[0].y,
                                width: 0,
                                height: 0,
                                orientation: "EAST",
                                points: updated.map((pt, i) => ({ ...pt, index: i })),
                                combinedElementId: newId
                            };
                        }

                        const finalElements = [...elementsRef.current, newElement];
                        setElements(finalElements);         // 👈 важно
                        updateElements(finalElements, true); // 👈 явное добавление в историю


                        setPolygonMode(false);
                        setPolygonPointsRequired(2);
                        return [];
                    }

                    return updated;
                });

                return;
            }


            for (const el of [...elements].reverse()) {
                const { x: drawX, y: drawY, width: drawWidth, height: drawHeight } = getDrawRect(el);
                if (
                    x >= drawX + drawWidth - resizeHandleSize &&
                    x <= drawX + drawWidth &&
                    y >= drawY + drawHeight - resizeHandleSize &&
                    y <= drawY + drawHeight
                ) {
                    resizingIdRef.current = el.id;
                    isResizingRef.current = true;
                    setSelectedIds([el.id]);
                    return;
                }
            }
            if (e.button === 1) {
                isPanningRef.current = true;
                panStartRef.current = { x: e.clientX, y: e.clientY };
                e.preventDefault(); // предотвращаем прокрутку
                return;
            }
            for (const el of [...elements].reverse()) {
                if (el.points) {
                    for (let i = 0; i < el.points.length; i++) {
                        const pt = el.points[i];
                        const radius = 6;
                        if (
                            x >= pt.x - radius &&
                            x <= pt.x + radius &&
                            y >= pt.y - radius &&
                            y <= pt.y + radius
                        ) {
                            console.log(`🎯 Клик по точке #${i} полигона ${el.id}`);
                            setSelectedIds([el.id]);
                            setEditingGroupId(el.combinedElementId || el.id);
                            setDraggingId(el.id);
                            isDraggingRef.current = true;
                            lastMousePosRef.current = { x, y };
                            dragModeRef.current = `MOVE_POINT_${i}`; // 👈 сохраняем индекс точки
                            initialElementsRef.current = elements.map(e => ({ ...e }));
                            // сохраняем начальные позиции точек
                            initialPositionsRef.current = {
                                [el.id]: {
                                    points: el.points.map(pt => ({ ...pt }))
                                }
                            };
                            return;
                        }
                    }
                }
            }

            const hit = [...elements]
                .filter(el => visibleLayers.includes(el.type))
                .find(el => {
                    if (el.points && el.points.length >= 3) {
                        return isPointInPolygon(x, y, el.points);
                    }

                    if (el.x2 !== undefined && el.y2 !== undefined) {
                        return isPointNearLine(x, y, el.x, el.y, el.x2, el.y2);
                    } else {
                        const { x: drawX, y: drawY, width: drawWidth, height: drawHeight } = getDrawRect(el);
                        return x >= drawX && x <= drawX + drawWidth && y >= drawY && y <= drawY + drawHeight;
                    }
                });


            if (hit) {
                const group = hit.combinedElementId
                    ? elements.filter(el => el.combinedElementId === hit.combinedElementId).map(el => el.id)
                    : hit.groupId
                        ? elements.filter(el => el.groupId === hit.groupId).map(el => el.id)
                        : [hit.id];

                const isGroupSelected = group.every(id => selectedIds.includes(id));
                const newSelection = (e.ctrlKey || e.metaKey)
                    ? isGroupSelected
                        ? selectedIds.filter(id => !group.includes(id))
                        : [...selectedIds, ...group.filter(id => !selectedIds.includes(id))]
                    : group;

                setSelectedIds(newSelection);
                setEditingGroupId(hit.combinedElementId || hit.id);
                setDraggingId(hit.id);
                isDraggingRef.current = true;
                lastMousePosRef.current = { x, y };
                initialElementsRef.current = elements.map(el => ({ ...el })); // 👈 глубокая копия
                console.log("💾 Saved initialElementsRef", initialElementsRef.current);

                // 🎯 Определяем dragModeRef для линий
                if (hit.x2 !== undefined && hit.y2 !== undefined) {
                    const d1 = Math.hypot(x - hit.x, y - hit.y);
                    const d2 = Math.hypot(x - hit.x2, y - hit.y2);
                    const midX = (hit.x + hit.x2) / 2;
                    const midY = (hit.y + hit.y2) / 2;
                    const dMid = Math.hypot(x - midX, y - midY);

                    const minD = Math.min(d1, d2, dMid);
                    if (minD === d1) dragModeRef.current = "MOVE_P1";
                    else if (minD === d2) dragModeRef.current = "MOVE_P2";
                    else dragModeRef.current = "MOVE_ALL";
                } else {
                    dragModeRef.current = "MOVE_ALL";
                }
                console.log("🔥 dragModeRef =", dragModeRef.current);
                // сохраняем стартовые позиции
                initialPositionsRef.current = {};
                elements.forEach(el => {
                    if (newSelection.includes(el.id)) {
                        initialPositionsRef.current[el.id] = {
                            x: el.x,
                            y: el.y,
                            x2: el.x2,
                            y2: el.y2,
                            points: el.points ? el.points.map(pt => ({ ...pt })) : undefined
                        };
                    }
                });
            }
            else {
                setSelectedIds([]);
                setEditingGroupId(null);
            }
        }

        const handleMouseMove = (e: MouseEvent) => {
            const { x, y } = getMousePos(e);

            const overResize = elements.some(el => {
                const { x: drawX, y: drawY, width: drawWidth, height: drawHeight } = getDrawRect(el);
                return (
                    x >= drawX + drawWidth - resizeHandleSize &&
                    x <= drawX + drawWidth &&
                    y >= drawY + drawHeight - resizeHandleSize &&
                    y <= drawY + drawHeight
                );
            });
            if (canvas) canvas.style.cursor = overResize ? "nwse-resize" : "default";
            if (isPanningRef.current && panStartRef.current) {
                const dx = e.clientX - panStartRef.current.x;
                const dy = e.clientY - panStartRef.current.y;

                setOffset(prev => ({
                    x: prev.x + dx / canvasScale,
                    y: prev.y + dy / canvasScale,
                }));

                panStartRef.current = { x: e.clientX, y: e.clientY };
                return;
            }

            // 🔁 Изменение размеров (resize)
            if (isResizingRef.current && resizingIdRef.current !== null) {
                setElements(prev =>
                    prev.map(el => {
                        if (el.id !== resizingIdRef.current) return el;

                        const mouse = getMousePos(e);
                        let newWidth = el.width;
                        let newHeight = el.height;
                        let newX = el.x;
                        let newY = el.y;

                        switch (el.orientation) {
                            case "EAST":
                                newWidth = Math.max(10, Math.round((mouse.x - el.x) / GRID_SIZE) * GRID_SIZE);
                                newHeight = Math.max(10, Math.round((mouse.y - el.y) / GRID_SIZE) * GRID_SIZE);
                                break;
                            case "WEST":
                                newWidth = Math.max(10, Math.round((el.x + el.width - mouse.x) / GRID_SIZE) * GRID_SIZE);
                                newX = el.x + el.width - newWidth;
                                newHeight = Math.max(10, Math.round((mouse.y - el.y) / GRID_SIZE) * GRID_SIZE);
                                break;
                            case "SOUTH":
                                newHeight = Math.max(10, Math.round((mouse.y - el.y) / GRID_SIZE) * GRID_SIZE);
                                newWidth = Math.max(10, Math.round((mouse.x - el.x) / GRID_SIZE) * GRID_SIZE);
                                break;
                            case "NORTH":
                                newHeight = Math.max(10, Math.round((el.y + el.height - mouse.y) / GRID_SIZE) * GRID_SIZE);
                                newY = el.y + el.height - newHeight;
                                newWidth = Math.max(10, Math.round((mouse.x - el.x) / GRID_SIZE) * GRID_SIZE);
                                break;
                        }

                        return {
                            ...el,
                            x: newX,
                            y: newY,
                            width: newWidth,
                            height: newHeight
                        };
                    })
                );
                return;
            }

            if (!isDraggingRef.current || !lastMousePosRef.current) return;

            const dx = Math.round((x - lastMousePosRef.current.x) / GRID_SIZE) * GRID_SIZE;
            const dy = Math.round((y - lastMousePosRef.current.y) / GRID_SIZE) * GRID_SIZE;

            setElements(prev =>
                prev.map(el => {
                    if (!selectedIds.includes(el.id)) return el;

                    const initial = initialPositionsRef.current[el.id];
                    if (!initial) return el;

                    // 🔁 Линии с перемещением одной точки
                    if (el.x2 !== undefined && el.y2 !== undefined) {
                        if (dragModeRef.current === "MOVE_P1") {
                            return {
                                ...el,
                                x: initial.x + dx,
                                y: initial.y + dy
                            };
                        } else if (dragModeRef.current === "MOVE_P2") {
                            return {
                                ...el,
                                x2: initial.x2! + dx,
                                y2: initial.y2! + dy
                            };
                        } else {
                            return {
                                ...el,
                                x: initial.x + dx,
                                y: initial.y + dy,
                                x2: initial.x2! + dx,
                                y2: initial.y2! + dy
                            };
                        }
                    }
                    if (Array.isArray(el.points) && el.points.length > 0) {
                        const initialPoly = initialPositionsRef.current[el.id];
                        if (!initialPoly?.points) return el;

                        const movePointIndex = dragModeRef.current?.startsWith("MOVE_POINT_")
                            ? parseInt(dragModeRef.current.split("_")[2], 10)
                            : null;

                        if (movePointIndex !== null && !isNaN(movePointIndex)) {
                            // Перемещаем только одну точку
                            const movedPoints = el.points.map((pt, i) => {
                                if (i === movePointIndex) {
                                    const base = initialPoly.points![i];
                                    return { ...pt, x: base.x + dx, y: base.y + dy };
                                }
                                return pt;
                            });

                            return {
                                ...el,
                                points: movedPoints
                            };
                        } else {
                            // Перемещаем все точки
                            const movedPoints = el.points.map((pt, i) => {
                                const base = initialPoly.points![i];
                                return base ? { ...pt, x: base.x + dx, y: base.y + dy } : pt;
                            });

                            return {
                                ...el,
                                x: movedPoints[0].x,
                                y: movedPoints[0].y,
                                points: movedPoints
                            };
                        }
                    }



                    // 🔁 Прямоугольник
                    return {
                        ...el,
                        x: initial.x + dx,
                        y: initial.y + dy
                    };
                })
            );
        };


        const handleMouseUp = () => {
            setDraggingId(null);
            isDraggingRef.current = false;

            const initial = initialElementsRef.current;
            initialElementsRef.current = null;

            isResizingRef.current = false;
            resizingIdRef.current = null;
            lastMousePosRef.current = null;
            isPanningRef.current = false;
            panStartRef.current = null;

            const currentElements = elementsRef.current;

            if (initial) {
                console.log("📦 Initial elements:", initial);
                console.log("📦 Current elements:", currentElements);
                const changed = JSON.stringify(initial) !== JSON.stringify(currentElements);
                if (changed) {
                    console.log("📝 Change detected — pushing to history");
                    updateElements(currentElements, true); // ✅ главное изменение
                } else {
                    console.log("⛔ No changes — not saved to history");
                }
            }

        };



        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "c" && selectedIds.length > 0) {
                const selected = elements.filter(el => selectedIds.includes(el.id));
                copiedElementRef.current = JSON.parse(JSON.stringify(selected));
            } else if (e.ctrlKey && e.key === "v" && copiedElementRef.current) {
                const offset = 20;
                const pasted = copiedElementRef.current.map(el => {
                    const newCombinedId = el.combinedElementId
                        ? newCombinedIdMap.get(el.combinedElementId) || (() => {
                            const newId = uuidv4();
                            newCombinedIdMap.set(el.combinedElementId, newId);
                            return newId;
                        })()
                        : undefined;

                    return {
                        ...el,
                        id: uuidv4(),
                        combinedElementId: newCombinedId,
                        x: el.x + offset,
                        y: el.y + offset
                    };
                });
                const updated = [...elements, ...pasted]; // 1️⃣ создаём новое состояние
                setElements(updated);                     // 2️⃣ обновляем напрямую
                updateElements(updated, true);            // 3️⃣ явно записываем в историю
                setSelectedIds(pasted.map(el => el.id));
            } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
                updateElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
                setSelectedIds([]);
            } else if (e.key.toLowerCase() === "r" && selectedIds.length > 0) {
                updateElements(prev => {
                    // найдём все связанные combinedElementId
                    const combinedIds = new Set(
                        prev.filter(e => selectedIds.includes(e.id) && e.combinedElementId)
                            .map(e => e.combinedElementId!)
                    );

                    const allIds = prev
                        .filter(e => e.combinedElementId && combinedIds.has(e.combinedElementId))
                        .map(e => e.id);

                    return rotateCombinedElements(prev, allIds);
                });
            }

        };

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            canvas.removeEventListener("mousedown", handleMouseDown);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [elements, draggingId, visibleLayers, selectedIds, canvasScale, offset]);

    return null;
};

export default CanvasElementLayer;
