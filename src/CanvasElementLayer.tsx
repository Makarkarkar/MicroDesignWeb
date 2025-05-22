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
}


interface Props {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    elements: Element[];
    visibleLayers: string[];
    draggingId: string | null;
    setDraggingId: (id: string | null) => void;
    setElements: React.Dispatch<React.SetStateAction<Element[]>>;
    layerColors: Record<string, string>;
    selectedIds: string[];
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
    setEditingGroupId: (id: string | null) => void;
}

const CanvasElementLayer: React.FC<Props> = ({
    canvasRef,
    elements,
    visibleLayers,
    draggingId,
    setDraggingId,
    setElements,
    layerColors,
    selectedIds,
    setSelectedIds,
    setEditingGroupId

}) => {
    const isResizingRef = useRef(false);
    const resizingIdRef = useRef<string | null>(null);
    const copiedElementRef = useRef<Element[] | null>(null);
    const lastMousePosRef = useRef<{ x: number, y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const resizeHandleSize = 2;
    const GRID_SIZE = 1;
    const CANVAS_SCALE = 2;
    const initialPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
    const newCombinedIdMap = new Map<string | undefined, string>();
    const layerOpacities: Record<string, number> = {
        M1: 1, M2: 0.9, TM1: 0.85, TM2: 0.85, NA: 0.8, P: 0.8,
        CNE: 0.75, SI: 0.75, CPA: 0.7, CPE: 0.7, SN: 0.65, CNA: 0.65,
        KP: 0.6, KN: 0.6, SPK: 0.55, CM: 0.5, CW: 0.45, M3: 0.4, CSI: 0.3, POLY: 0.2, N: 0.2
    };
    const dragModeRef = useRef<"MOVE_ALL" | "MOVE_P1" | "MOVE_P2" | null>(null);

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
            ctx.scale(CANVAS_SCALE, CANVAS_SCALE);

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
                x: (e.clientX - rect.left) / CANVAS_SCALE,
                y: (e.clientY - rect.top) / CANVAS_SCALE
            };
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 2) return;
            const { x, y } = getMousePos(e);

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

            const hit = [...elements]
                .filter(el => visibleLayers.includes(el.type))
                .find(el => {
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
                        initialPositionsRef.current[el.id] = { x: el.x, y: el.y, x2: el.x2, y2: el.y2 };
                    }
                });
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
            isResizingRef.current = false;
            resizingIdRef.current = null;
            lastMousePosRef.current = null;
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
                setElements(prev => [...prev, ...pasted]);
                setSelectedIds(pasted.map(el => el.id));
            } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
                setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
                setSelectedIds([]);
            } else if (e.key.toLowerCase() === "r" && selectedIds.length > 0) {
                setElements(prev => {
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
    }, [elements, draggingId, visibleLayers, selectedIds]);

    return null;
};

export default CanvasElementLayer;
