import React, { useState, useRef, useEffect, } from "react";
import LayerVisibilityMenu from "./ControlPanels/LayerVisibilityMenu";
import CanvasElementLayer from "./CanvasElementLayer";
import LayerButtonPanel from "./ControlPanels/LayerButtonPanel";
import LayerColorSettings from "./ControlPanels/LayerColorSettings";
import { v4 as uuidv4 } from "uuid";
import { expandTPElement } from "./utils/expandTP";
import { expandTNElement } from "./utils/expandTN";
import { useUndoableElements } from "./utils/useUndoableElements";



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


interface MacroBlock {
    name: string;
    elements: Element[];
}

export default function MicroDesignWeb() {
    const [canvasScale, setCanvasScale] = useState(2);
    const {
        elements,
        setElements,
        updateElements,
        undo,
        redo,
        canUndo,
        canRedo
    } = useUndoableElements([]);


    const [macroLibrary, setMacroLibrary] = useState<MacroBlock[]>(() => {
        const saved = localStorage.getItem("microdesign-schema");
        if (saved) {
            try {
                const data = JSON.parse(saved);
                return Array.isArray(data.macroLibrary) ? data.macroLibrary : [];
            } catch {
                return [];
            }
        }
        return [];
    });
    const updateElement = (id: string, changes: Partial<Element>) => {
        updateElements(prev =>
            prev.map(el =>
                el.id === id ? { ...el, ...changes } : el
            )
        );
    };

    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const layers = [
        "M1", "M2", "TM1", "TM2", "NA", "P", "CNE", "SI", "CPA",
        "CPE", "SN", "CNA", "KP", "KN", "SPK", "CM", "CW", "M3", "CSI", "POLY", "N"
    ];

    const [layerColors, setLayerColors] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem("microdesign-schema");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.layerColors || {
                    M1: "#b91c1c",
                    M2: "#7e22ce",
                    TM1: "#86efac",
                    TM2: "#22c55e",
                    NA: "#facc15",
                    P: "#ea580c",
                    CNE: "#db2777",
                    SI: "#3b82f6",
                    CPA: "#0d9488",
                    CPE: "#115e59",
                    SN: "#84cc16",
                    CNA: "#0ea5e9",
                    KP: "#4338ca",
                    KN: "#06b6d4",
                    SPK: "#fbbf24",
                    CM: "#71717a",
                    CW: "#6b7280",
                    M3: "#1e3a8a",
                    CSI: "#30ba8f",
                    POLY: "#30ba8f",
                    N: "#30ba8f"
                };
            } catch {
                return {
                    M1: "#b91c1c",
                    M2: "#7e22ce",
                    TM1: "#86efac",
                    TM2: "#22c55e",
                    NA: "#facc15",
                    P: "#ea580c",
                    CNE: "#db2777",
                    SI: "#3b82f6",
                    CPA: "#0d9488",
                    CPE: "#115e59",
                    SN: "#84cc16",
                    CNA: "#0ea5e9",
                    KP: "#4338ca",
                    KN: "#06b6d4",
                    SPK: "#fbbf24",
                    CM: "#71717a",
                    CW: "#6b7280",
                    M3: "#1e3a8a",
                    CSI: "#30ba8f",
                    POLY: "#30ba8f",
                    N: "#30ba8f"
                };
            }
        }
        return {
            M1: "#b91c1c",
            M2: "#7e22ce",
            TM1: "#86efac",
            TM2: "#22c55e",
            NA: "#facc15",
            P: "#ea580c",
            CNE: "#db2777",
            SI: "#3b82f6",
            CPA: "#0d9488",
            CPE: "#115e59",
            SN: "#84cc16",
            CNA: "#0ea5e9",
            KP: "#4338ca",
            KN: "#06b6d4",
            SPK: "#fbbf24",
            CM: "#71717a",
            CW: "#6b7280",
            M3: "#1e3a8a",
            CSI: "#30ba8f",
            POLY: "#30ba8f",
            N: "#30ba8f"
        };
    });


    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [nextId, setNextId] = useState<number>(1);
    const [visibleLayers, setVisibleLayers] = useState<string[]>([...layers]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [codeInput, setCodeInput] = useState("");
    const [polygonMode, setPolygonMode] = useState(false);
    const [polygonPointsRequired, setPolygonPointsRequired] = useState(2);
    const [tempPolygonPoints, setTempPolygonPoints] = useState<{ x: number; y: number }[]>([]);
    useEffect(() => {
        const saved = localStorage.getItem("microdesign-schema");
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (Array.isArray(data.elements)) updateElements(data.elements);
                if (Array.isArray(data.macroLibrary)) setMacroLibrary(data.macroLibrary);
                console.log("✅ Загружено из localStorage:", data);
            } catch (err) {
                console.error("❌ Ошибка при парсинге localStorage:", err);
            }
        }
    }, []);

    useEffect(() => {
        const data = JSON.stringify({
            elements,
            macroLibrary,
            layerColors
        });
        localStorage.setItem("microdesign-schema", data);
    }, [elements, macroLibrary, layerColors]);

    useEffect(() => {
        localStorage.setItem("microdesign-elements", JSON.stringify(elements));
    }, [elements]);
    const addElement = (type: string) => {
        const newId = uuidv4();
        const newElement = {
            id: newId,
            type,
            x: 100,
            y: 100,
            width: 40,
            height: 20,
            orientation: "EAST",
            combinedElementId: newId,
        };

        // 1️⃣ Сначала создаём новое состояние
        const updated = [...elements, newElement];

        // 2️⃣ Обновляем state
        setElements(updated);

        // 3️⃣ Принудительно сохраняем новое состояние в историю
        updateElements(updated, true);
    };



    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === "z") {
                e.preventDefault();
                e.shiftKey ? redo() : undo();
            } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo]);

    const toggleLayer = (layer: string) => {
        setVisibleLayers(prev =>
            prev.includes(layer)
                ? prev.filter(l => l !== layer)
                : [...prev, layer]
        );
    };

    const handleCodeParse = () => {
        const lines = codeInput.split("\n").map(line => line.trim()).filter(Boolean);
        const newElements: Element[] = [];

        lines.forEach((line) => {
            const match = line.match(/^(\w+)\(x=(\d+),\s*y=(\d+),\s*w=(\d+),\s*h=(\d+)\)$/);
            if (match) {
                const [, type, x, y, width, height] = match;
                newElements.push({
                    id: uuidv4() + newElements.length,
                    type,
                    x: Number(x),
                    y: Number(y),
                    width: Number(width),
                    height: Number(height),
                });
            }
        });

        if (newElements.length > 0) {
            updateElements((prev) => [...prev, ...newElements]);
            setNextId((prev) => prev + newElements.length);
            setCodeInput("");
        }
    };

    const handleCppImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split(/\r?\n/);
        const elements: Element[] = [];

        let currentWidth = 0.2;
        let currentHeight = 0.2;
        let currentOrientation = "EAST";

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i].trim();
            if (!rawLine || rawLine.startsWith("//")) continue;

            // Геометрические параметры
            const wMatch = rawLine.match(/W\((\d+(\.\d+)?)\)/);
            const lMatch = rawLine.match(/L\((\d+(\.\d+)?)\)/);
            const orMatch = rawLine.match(/OR\((\w+)\)/);

            currentWidth = wMatch ? parseFloat(wMatch[1]) : currentWidth;
            currentHeight = lMatch ? parseFloat(lMatch[1]) : currentHeight;
            currentOrientation = orMatch ? orMatch[1] : currentOrientation;

            // Одноточечные примитивы
            const singleMatch = rawLine.match(
                /(CM|CPA|CNA|CSI|KN|KP|P_TP|N_TN)\(([\d.]+),\s*([\d.]+)\)/
            );
            if (singleMatch) {
                const [, name, xStr, yStr] = singleMatch;
                const x = parseFloat(xStr) * 10;
                const y = parseFloat(yStr) * 10;
                const width = currentWidth * 10;
                const height = currentHeight * 10;
                const newId = crypto.randomUUID();
                elements.push({
                    id: newId,
                    name,
                    type: name,
                    x,
                    y,
                    width,
                    height,
                    orientation: currentOrientation,
                    combinedElementId: newId
                });
                continue;
            }

            const tpMatch = rawLine.match(/TP\(([\d.]+),\s*([\d.]+)\)/);
            if (tpMatch) {
                const [, xStr, yStr] = tpMatch;
                const x = parseFloat(xStr) * 10;
                const y = parseFloat(yStr) * 10;
                const width = currentWidth * 10;
                const height = currentHeight * 10;

                elements.push(...expandTPElement({
                    id: crypto.randomUUID(),
                    name: "TP",
                    type: "P",
                    x,
                    y,
                    width,
                    height,
                    orientation: currentOrientation
                }));
                continue;
            }
            const tnMatch = rawLine.match(/TN\(([\d.]+),\s*([\d.]+)\)/);
            if (tnMatch) {
                const [, xStr, yStr] = tnMatch;
                const x = parseFloat(xStr) * 10;
                const y = parseFloat(yStr) * 10;
                const width = currentWidth * 10;
                const height = currentHeight * 10;

                elements.push(...expandTNElement({
                    id: crypto.randomUUID(),
                    name: "TN",
                    type: "N",
                    x,
                    y,
                    width,
                    height,
                    orientation: currentOrientation
                }));
                continue;
            }
            const cepaneMatch = rawLine.match(/CEPANE\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/);
            if (cepaneMatch) {
                const [, x1Str, y1Str, x2Str, y2Str] = cepaneMatch;
                const x1 = parseFloat(x1Str) * 10;
                const y1 = parseFloat(y1Str) * 10;
                const x2 = parseFloat(x2Str) * 10;
                const y2 = parseFloat(y2Str) * 10;
                const newId = uuidv4();
                elements.push({
                    id: newId,
                    name: "CEPANE",
                    type: "M1", // можно задать как "CM" или "M1", если нужно
                    x: x1,
                    y: y1,
                    x2: x2,
                    y2: y2,
                    width: 2,
                    height: 2,
                    orientation: currentOrientation,
                    combinedElementId: newId
                });
                continue;
            }



            // Двухточечные (CEPANE, CENAPE)
            // const dualMatch = rawLine.match(
            //     /(CEPANE|CENAPE)\(([\d.]+),([\d.]+),\s*([\d.]+),([\d.]+)\)/
            // );
            // if (dualMatch) {
            //     const [, name, x1, y1, x2, y2] = dualMatch;
            //     elements.push({
            //         id: crypto.randomUUID(),
            //         name,
            //         type: name,
            //         x: parseFloat(x1) * 10,
            //         y: parseFloat(y1) * 10,
            //         x2: parseFloat(x2) * 10,
            //         y2: parseFloat(y2) * 10,
            //         width: currentWidth * 10,
            //         height: currentHeight * 10,
            //         orientation: currentOrientation
            //     });
            //     continue;
            // }

            // W_WIRE с X/Y цепочкой
            const wireMatch = rawLine.match(/W_WIRE\(([\d.]+)\)\s+(\w+)\(([\d.]+),([\d.]+)\)/);

            if (wireMatch) {
                const [, wireWidth, material, xStr, yStr] = wireMatch;

                const points: { x: number; y: number }[] = [
                    { x: parseFloat(xStr) * 10, y: parseFloat(yStr) * 10 }
                ];

                // Чтение последующих точек (X(...) / Y(...))
                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j].trim();
                    const xPt = nextLine.match(/^X\(([\d.]+)\)/);
                    const yPt = nextLine.match(/^Y\(([\d.]+)\)/);
                    if (xPt) {
                        const last = points[points.length - 1];
                        points.push({ x: parseFloat(xPt[1]) * 10, y: last.y });
                        j++;
                    } else if (yPt) {
                        const last = points[points.length - 1];
                        points.push({ x: last.x, y: parseFloat(yPt[1]) * 10 });
                        j++;
                    } else {
                        break;
                    }
                }
                i = j - 1; // продвигаем основной счётчик

                // Превращаем точки в отрезки
                for (let k = 0; k < points.length - 1; k++) {
                    elements.push({
                        id: crypto.randomUUID(),
                        name: "W_WIRE",
                        type: material,
                        x: points[k].x,
                        y: points[k].y,
                        x2: points[k + 1].x,
                        y2: points[k + 1].y,
                        width: parseFloat(wireWidth) * 10,
                        height: 1,
                        orientation: "EAST"
                    });
                }

                continue;
            }
        }

        const baseName = file.name.replace(/\.[^.]+$/, "");
        let blockName = baseName;
        const existingNames = new Set(macroLibrary.map(m => m.name));
        let count = 1;
        while (existingNames.has(blockName)) {
            blockName = `${baseName} (${count++})`;
        }

        const macroBlock: MacroBlock = {
            name: blockName,
            elements
        };

        setMacroLibrary(prev => {
            const updated = [...prev, macroBlock];
            localStorage.setItem("microdesign-schema", JSON.stringify({ elements: [], macroLibrary: updated }));
            return updated;
        });

        alert(`✅ Импортирован макроблок '${blockName}' (${elements.length} элементов)`);
    };

    return (
        <div className="relative w-full min-h-screen bg-zinc-900">
            <div className="items-center justify-center w-full">
                <div className="pt-4 bg-zinc-900 pb-10">
                    <h1 className="text-4xl  font-extrabold flex-wrap ml-10 text-white">MicroDesignWeb</h1>
                </div>

                <button
                    onClick={() => {
                        updateElements([]);
                        localStorage.removeItem("microdesign-elements");
                    }}
                    className="font-extrabold mb-4 ml-4 px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white shadow"
                >
                    Очистить схему
                </button>
                <button
                    onClick={() => {
                        if (selectedIds.length === 0) {
                            alert("Сначала выделите элементы.");
                            return;
                        }

                        const name = prompt("Введите имя макроблока:");
                        if (!name) return;

                        const selected = elements.filter(el => selectedIds.includes(el.id));

                        const newMacro = { name, elements: selected };
                        setMacroLibrary(prev => {
                            const updatedMacroLibrary = [...prev, newMacro];
                            localStorage.setItem(
                                "microdesign-schema",
                                JSON.stringify({ elements, macroLibrary: updatedMacroLibrary })
                            );
                            return updatedMacroLibrary;
                        });
                    }}
                    className="font-extrabold ml-2 px-4 py-2 text-sm rounded bg-green-600 hover:bg-green-700 text-white shadow"
                >
                    Сохранить как макроблок
                </button>
                <button
                    onClick={() => {
                        const data = {
                            elements,
                            macroLibrary
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);

                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "microdesign-scheme.json";
                        link.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="font-extrabold  ml-2 px-4 py-2 text-sm rounded bg-yellow-600 hover:bg-yellow-700 text-white shadow"
                >
                    Сохранить схему
                </button>
                <div className="ml-2 relative inline-block">
                    <label className="font-extrabold  cursor-pointer px-4 py-2 text-sm rounded bg-pink-600 hover:bg-pink-700 text-white shadow">
                        Импорт .cpp
                        <input type="file" accept=".cpp" onChange={handleCppImport} className="hidden" />
                    </label>
                </div>
                <button
                    onClick={() => {
                        setPolygonMode(true);
                        setPolygonPointsRequired(Math.max(2, Math.min(10, polygonPointsRequired)));
                        alert("👆 Кликните на канвасе для указания точек фигуры");
                    }}
                    className="font-extrabold  ml-2 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800"
                >
                    Вставить фигуру по точкам
                </button>

                <input
                    type="number"
                    min={2}
                    max={10}
                    value={polygonPointsRequired}
                    onChange={(e) => setPolygonPointsRequired(Number(e.target.value))}
                    className="w-16 p-1 bg-zinc-800 text-white border border-gray-400 text-sm ml-2"
                />
                <button
                    onClick={() => {
                        if (selectedIds.length < 2) {
                            alert("Выделите как минимум два элемента.");
                            return;
                        }

                        const newCombinedId = uuidv4();

                        const updated = elements.map(el =>
                            selectedIds.includes(el.id)
                                ? { ...el, combinedElementId: newCombinedId }
                                : el
                        );

                        setElements(updated);         // Обновляем напрямую
                        updateElements(updated, true); // Сохраняем в историю
                    }}
                    className="font-extrabold  ml-2 px-4 py-2 text-sm rounded bg-purple-600 hover:bg-purple-700 text-white shadow"
                >
                    Объединить
                </button>
                <button
                    onClick={() => {
                        if (selectedIds.length === 0) {
                            alert("Выделите элементы для разъединения.");
                            return;
                        }

                        const updated = elements.map(el =>
                            selectedIds.includes(el.id)
                                ? { ...el, combinedElementId: el.id }
                                : el
                        );

                        setElements(updated);         // Обновляем напрямую
                        updateElements(updated, true); // Сохраняем в историю
                    }}
                    className="font-extrabold  ml-2 px-4 py-2 text-sm rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow"
                >
                    Разъединить
                </button>

                <div className="flex items-center gap-2 my-4">
                    <label className="ml-4 text-sm text-white font-extrabold">Вставить макроблок:</label>
                    <select
                        onChange={(e) => {
                            const selected = macroLibrary.find(m => m.name === e.target.value);
                            if (!selected) return;

                            const offset = 40;
                            const newGroupId = uuidv4();

                            const pasted = selected.elements.map(el => ({
                                ...el,
                                id: uuidv4(),
                                groupId: newGroupId,
                                x: el.x + offset,
                                y: el.y + offset
                            }));

                            const updated = [...elements, ...pasted]; // 1️⃣ Вычисляем новое состояние
                            setElements(updated);                     // 2️⃣ Обновляем напрямую
                            updateElements(updated, true);            // 3️⃣ Явно записываем в историю
                        }}
                        className="bg-zinc-900 rounded px-2 py-1 text-sm"
                    >
                        <option>Выберите макроблок</option>
                        {macroLibrary.map(block => (
                            <option key={block.name} value={block.name}>{block.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-start gap-2 mb-2 ml-2">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className={`px-3 py-1 rounded text-sm font-medium shadow ${canUndo ? "bg-zinc-700 text-white hover:bg-zinc-600" : "bg-zinc-800 text-gray-400 cursor-not-allowed"
                            }`}
                    >
                        ↺ Отменить
                    </button>

                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className={`px-3 py-1 rounded text-sm font-medium shadow ${canRedo ? "bg-zinc-700 text-white hover:bg-zinc-600" : "bg-zinc-800 text-gray-400 cursor-not-allowed"
                            }`}
                    >
                        ↻ Повторить
                    </button>
                </div>

                <div className="w-full flex justify-center bg-zinc-900">
                    <div className="border border-zinc-300 bg-zinc-900 rounded-lg p-2 shadow-md">
                        <CanvasElementLayer
                            canvasRef={canvasRef}
                            elements={elements}
                            visibleLayers={visibleLayers}
                            draggingId={draggingId}
                            setDraggingId={setDraggingId}
                            updateElements={updateElements}
                            layerColors={layerColors}
                            selectedIds={selectedIds}
                            setSelectedIds={setSelectedIds}
                            setEditingGroupId={setEditingGroupId}
                            canvasScale={canvasScale}
                            setElements={setElements}
                            polygonMode={polygonMode}
                            polygonPointsRequired={polygonPointsRequired}
                            setPolygonMode={setPolygonMode}
                            polygonPointsRequired={polygonPointsRequired}
                            setPolygonPointsRequired={setPolygonPointsRequired}
                            tempPolygonPoints={tempPolygonPoints}
                            setTempPolygonPoints={setTempPolygonPoints}
                        />
                        <canvas
                            ref={canvasRef}
                            className="block border border-gray-300 rounded cursor-pointer"
                        />
                        <div className="w-full max-w-xl mt-4">
                            <textarea
                                className="w-full h-10 p-2 text-sm bg-zinc-900 text-white rounded border border-gray-300"
                                placeholder="Например: M1(x=100, y=150, w=40, h=20)"
                                value={codeInput}
                                onChange={(e) => setCodeInput(e.target.value)}
                            />
                            <button
                                onClick={handleCodeParse}
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Добавить из кода
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <button
                                onClick={() => setCanvasScale(prev => Math.max(0.5, prev - 0.5))}
                                className="px-3 py-1 text-lg bg-gray-700 text-white rounded hover:bg-gray-600"
                            >
                                −
                            </button>
                            <span className="text-white text-sm">{canvasScale.toFixed(1)}x</span>
                            <button
                                onClick={() => setCanvasScale(prev => prev + 0.5)}
                                className="px-3 py-1 text-lg bg-gray-700 text-white rounded hover:bg-gray-600"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>


                <div className="bg-zinc-900 flex flex-col">
                    <LayerVisibilityMenu
                        layers={layers}
                        visibleLayers={visibleLayers}
                        toggleLayer={toggleLayer}
                    />
                    <LayerButtonPanel
                        layers={layers}
                        layerColors={layerColors}
                        addElement={addElement}
                    />
                    <LayerColorSettings
                        layers={layers}
                        layerColors={layerColors}
                        setLayerColors={setLayerColors}
                    />
                </div>

            </div>
            {editingGroupId && (
                <div className="absolute top-0 right-0 w-80 h-full overflow-auto bg-zinc-800 text-white p-4 border-l border-zinc-600 shadow-lg z-50">
                    <h2 className="text-xl font-bold mb-2">Редактирование</h2>
                    {elements
                        .filter(el => el.combinedElementId === editingGroupId)
                        .map(el => (
                            <div key={el.id} className="border-b border-zinc-600 pb-2 mb-2">
                                <p className="font-semibold">{el.name || el.type}</p>
                                <label className="block text-sm mt-1">name:
                                    <input
                                        className="w-full p-1 bg-zinc-700 text-white rounded"
                                        value={el.name}
                                        onChange={e => updateElement(el.id, { name: e.target.value })}
                                    />
                                </label>
                                <label className="block text-sm mt-1">type:
                                    <input
                                        className="w-full p-1 bg-zinc-700 text-white rounded"
                                        value={el.type}
                                        onChange={e => updateElement(el.id, { type: e.target.value })}
                                    />
                                </label>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                    {["x", "y", "x2", "y2", "width", "height"].map(field => (
                                        <label key={field}>
                                            {field}:
                                            <input
                                                type="number"
                                                className="w-full p-1 bg-zinc-700 text-white rounded"
                                                value={el[field as keyof Element] ?? ""}
                                                onChange={e =>
                                                    updateElement(el.id, {
                                                        [field]: e.target.value === "" ? undefined : Number(e.target.value)
                                                    })
                                                }
                                            />
                                        </label>
                                    ))}
                                </div>
                                <label className="block text-sm mt-2">orientation:
                                    <select
                                        className="w-full p-1 bg-zinc-700 text-white rounded"
                                        value={el.orientation}
                                        onChange={e => updateElement(el.id, { orientation: e.target.value })}
                                    >
                                        <option value="EAST">EAST</option>
                                        <option value="SOUTH">SOUTH</option>
                                        <option value="WEST">WEST</option>
                                        <option value="NORTH">NORTH</option>
                                    </select>
                                </label>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}