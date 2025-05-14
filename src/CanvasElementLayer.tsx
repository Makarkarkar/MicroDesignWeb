import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface Element {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    groupId?: string;
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
    setSelectedIds
}) => {
    const isResizingRef = useRef(false);
    const resizingIdRef = useRef<string | null>(null);
    const copiedElementRef = useRef<Element[] | null>(null);
    const lastMousePosRef = useRef<{ x: number, y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const resizeHandleSize = 10;
    const GRID_SIZE = 10;

    const initialPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
    const layerOpacities: Record<string, number> = {
        M1: 1, M2: 0.9, TM1: 0.85, TM2: 0.85, NA: 0.8, P: 0.8,
        CNE: 0.75, SI: 0.75, CPA: 0.7, CPE: 0.7, SN: 0.65, CNA: 0.65,
        KP: 0.6, KN: 0.6, SPK: 0.55, CM: 0.5, CW: 0.45, M3: 0.4
    };

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

        const draw = (ctx: CanvasRenderingContext2D) => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            // Сетка
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

            // Координаты
            ctx.fillStyle = "#6b7280";
            ctx.font = "10px sans-serif";
            for (let x = 0; x < width; x += 100) {
                ctx.fillText(`${x}`, x + 2, 10);
            }
            for (let y = 0; y < height; y += 100) {
                ctx.fillText(`${y}`, 2, y + 10);
            }

            // Сортировка по слоям
            const sortedElements = [...elements].sort((a, b) => {
                const layerOrder = ["M1", "M2", "TM1", "TM2", "NA", "P", "CNE", "SI", "CPA", "CPE", "SN", "CNA", "KP", "KN", "SPK", "CM", "CW", "M3"];
                return layerOrder.indexOf(a.type) - layerOrder.indexOf(b.type);
            });

            // Отрисовка элементов
            sortedElements.forEach((el) => {
                if (!visibleLayers.includes(el.type)) return;

                const baseColor = layerColors[el.type] || "#000";
                const baseOpacity = layerOpacities[el.type] ?? 1;

                ctx.fillStyle = baseColor;
                ctx.globalAlpha = selectedIds.includes(el.id) ? 0.8 : baseOpacity;
                ctx.fillRect(el.x, el.y, el.width, el.height);
                ctx.globalAlpha = 1.0;

                if (selectedIds.includes(el.id)) {
                    ctx.strokeStyle = "#2563eb";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(el.x - 2, el.y - 2, el.width + 4, el.height + 4);
                }
            });
        };

        const getMousePos = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 2) return;
            const { x, y } = getMousePos(e);

            // Проверка на resize
            for (const el of [...elements].reverse()) {
                if (
                    x >= el.x + el.width - resizeHandleSize &&
                    x <= el.x + el.width &&
                    y >= el.y + el.height - resizeHandleSize &&
                    y <= el.y + el.height
                ) {
                    resizingIdRef.current = el.id;
                    isResizingRef.current = true;
                    setSelectedIds([el.id]);
                    return;
                }
            }

            const hit = [...elements]
                .sort((a, b) => {
                    const order = ["M1", "M2", "TM1", "TM2", "NA", "P", "CNE", "SI", "CPA", "CPE", "SN", "CNA", "KP", "KN", "SPK", "CM", "CW", "M3"];
                    return order.indexOf(b.type) - order.indexOf(a.type);
                })
                .filter(el => visibleLayers.includes(el.type))
                .find(el => x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height);

            if (hit) {
                const groupElements = hit.groupId
                    ? elements.filter(el => el.groupId === hit.groupId).map(el => el.id)
                    : [hit.id];

                let newSelection: string[];

                if (e.ctrlKey || e.metaKey) {
                    // Ctrl: добавляем или убираем все из группы
                    const isGroupSelected = groupElements.every(id => selectedIds.includes(id));
                    newSelection = isGroupSelected
                        ? selectedIds.filter(id => !groupElements.includes(id))
                        : [...selectedIds, ...groupElements.filter(id => !selectedIds.includes(id))];
                } else {
                    // обычный клик: выделяем всю группу
                    newSelection = groupElements;
                }

                setSelectedIds(newSelection);
                setDraggingId(hit.id);
                isDraggingRef.current = true;
                lastMousePosRef.current = { x, y };

                // Сохраняем стартовые позиции всех новых
                initialPositionsRef.current = {};
                elements.forEach(el => {
                    if (newSelection.includes(el.id)) {
                        initialPositionsRef.current[el.id] = { x: el.x, y: el.y };
                    }
                });
            }
        };



        const handleMouseMove = (e: MouseEvent) => {
            const { x, y } = getMousePos(e);

            const overResize = elements.some(el =>
                x >= el.x + el.width - resizeHandleSize &&
                x <= el.x + el.width &&
                y >= el.y + el.height - resizeHandleSize &&
                y <= el.y + el.height
            );
            if (canvas) {
                canvas.style.cursor = overResize ? "nwse-resize" : "default";
            }

            if (isResizingRef.current && resizingIdRef.current !== null) {
                setElements(prev =>
                    prev.map(el =>
                        el.id === resizingIdRef.current
                            ? {
                                ...el,
                                width: Math.max(10, Math.round((x - el.x) / GRID_SIZE) * GRID_SIZE),
                                height: Math.max(10, Math.round((y - el.y) / GRID_SIZE) * GRID_SIZE)
                            }
                            : el
                    )
                );
                return;
            }

            if (!isDraggingRef.current || !lastMousePosRef.current) return;

            const dx = x - lastMousePosRef.current.x;
            const dy = y - lastMousePosRef.current.y;

            const dxSnapped = Math.round(dx / GRID_SIZE) * GRID_SIZE;
            const dySnapped = Math.round(dy / GRID_SIZE) * GRID_SIZE;

            setElements(prev =>
                prev.map(el =>
                    selectedIds.includes(el.id)
                        ? {
                            ...el,
                            ...selectedIds.includes(el.id) && initialPositionsRef.current[el.id]
                                ? {
                                    ...el,
                                    x: initialPositionsRef.current[el.id].x + dxSnapped,
                                    y: initialPositionsRef.current[el.id].y + dySnapped
                                }
                                : el
                        }
                        : el
                )
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
            console.log("KEY PRESS:", e.key, "CTRL:", e.ctrlKey);
            if (e.ctrlKey && e.key === "c" && selectedIds.length > 0) {
                const selected = elements.filter(el => selectedIds.includes(el.id));
                copiedElementRef.current = JSON.parse(JSON.stringify(selected));
            } else if (e.ctrlKey && e.key === "v" && copiedElementRef.current) {
                const offset = 20;
                const pasted = copiedElementRef.current.map(el => ({
                    ...el,
                    id: uuidv4(),
                    x: el.x + offset,
                    y: el.y + offset
                }));
                setElements(prev => [...prev, ...pasted]);

                // автоматически выделяем вставленные элементы
                setSelectedIds(pasted.map(el => el.id));
            } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
                setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
                setSelectedIds([]);
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
