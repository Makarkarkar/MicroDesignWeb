import React, { useState, useRef, useEffect } from "react";
import LayerVisibilityMenu from "./ControlPanels/LayerVisibilityMenu";
import CanvasElementLayer from "./CanvasElementLayer";
import LayerButtonPanel from "./ControlPanels/LayerButtonPanel";
import { v4 as uuidv4 } from "uuid";

const layers = [
    "M1", "M2", "TM1", "TM2", "NA", "P", "CNE", "SI", "CPA",
    "CPE", "SN", "CNA", "KP", "KN", "SPK", "CM", "CW", "M3"
];

const layerColors: Record<string, string> = {
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
    M3: "#1e3a8a"
};

interface Element {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface MacroBlock {
    name: string;
    elements: Element[];
}

export default function MicroDesignWeb() {
    const [elements, setElements] = useState<Element[]>(() => {
        const saved = localStorage.getItem("microdesign-elements");
        return saved ? JSON.parse(saved) : [];
    });
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



    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [nextId, setNextId] = useState<number>(1);
    const [visibleLayers, setVisibleLayers] = useState<string[]>([...layers]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [codeInput, setCodeInput] = useState("");
    useEffect(() => {
        const saved = localStorage.getItem("microdesign-schema");
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (Array.isArray(data.elements)) setElements(data.elements);
                if (Array.isArray(data.macroLibrary)) setMacroLibrary(data.macroLibrary);
                console.log("✅ Загружено из localStorage:", data);
            } catch (err) {
                console.error("❌ Ошибка при парсинге localStorage:", err);
            }
        }
    }, []);

    useEffect(() => {
        const data = JSON.stringify({ elements, macroLibrary });
        localStorage.setItem("microdesign-schema", data);
    }, [elements, macroLibrary]);

    useEffect(() => {
        localStorage.setItem("microdesign-elements", JSON.stringify(elements));
    }, [elements]);
    const addElement = (type: string) => {
        setElements(prev => [...prev, { id: uuidv4(), type, x: 100, y: 100, width: 40, height: 20 }]);
        setNextId(prev => prev + 1);
    };

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
            setElements((prev) => [...prev, ...newElements]);
            setNextId((prev) => prev + newElements.length);
            setCodeInput("");
        }
    };

    return (
        <div className="items-center justify-center w-full">
            <div className="pt-4 bg-zinc-900 pb-10">
                <h1 className="text-4xl  font-extrabold flex-wrap ml-10 text-white">MicroDesignWeb</h1>
            </div>

            <button
                onClick={() => {
                    setElements([]);
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
                className="ml-2 px-4 py-2 text-sm rounded bg-yellow-600 hover:bg-yellow-700 text-white shadow"
            >
                Сохранить схему
            </button>
            <div className="ml-2 relative inline-block">
                <label
                    htmlFor="import-scheme"
                    className="cursor-pointer px-4 py-2 text-sm rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow"
                >
                    Импорт схемы
                </label>
                <input
                    id="import-scheme"
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const text = await file.text();
                        try {
                            const data = JSON.parse(text);
                            if (Array.isArray(data.elements)) setElements(data.elements);
                            if (Array.isArray(data.macroLibrary)) setMacroLibrary(data.macroLibrary);
                            alert("Схема успешно загружена!");
                        } catch (err) {
                            alert("Ошибка при загрузке схемы: " + err);
                        }
                    }}
                    className="hidden"
                />
            </div>


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

                        setElements(prev => [...prev, ...pasted]);
                    }}
                    className=" bg-zinc-900 rounded px-2 py-1 text-sm"
                >
                    <option>Выберите макроблок</option>
                    {macroLibrary.map(block => (
                        <option key={block.name} value={block.name}>{block.name}</option>
                    ))}
                </select>
            </div>

            <div className="w-full flex justify-center bg-zinc-900">
                <div className="border border-zinc-300 bg-zinc-900 rounded-lg p-2 shadow-md">
                    <CanvasElementLayer
                        canvasRef={canvasRef}
                        elements={elements}
                        visibleLayers={visibleLayers}
                        draggingId={draggingId}
                        setDraggingId={setDraggingId}
                        setElements={setElements}
                        layerColors={layerColors}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
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
            </div>
        </div>
    );
}