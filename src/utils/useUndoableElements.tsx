import { useState, useEffect } from "react";

const MAX_HISTORY = 100;

type ElementsUpdater = Element[] | ((prev: Element[]) => Element[]);

export function useUndoableElements(initial: Element[]) {
    const [elements, setElements] = useState<Element[]>(initial);
    const [history, setHistory] = useState<Element[][]>([initial.map(e => ({ ...e }))]); // 👈 здесь!
    const [future, setFuture] = useState<Element[][]>([]);

    const updateElements = (next: ElementsUpdater, forceSave = false) => {
        setElements(prev => {
            const updated = typeof next === "function" ? next(prev) : next;

            const hasChanged = JSON.stringify(prev) !== JSON.stringify(updated);

            if (hasChanged || forceSave) {
                console.log(hasChanged ? "📝 Change detected — pushing to history" : "📢 Forcing push to history");
                setHistory(h => {
                    const nextHistory = [...h, prev.map(e => ({ ...e }))];
                    console.log("🧾 Updated history:", nextHistory);
                    return nextHistory.length > MAX_HISTORY ? nextHistory.slice(-MAX_HISTORY) : nextHistory;
                });
                setFuture([]);
            } else {
                console.log("⛔ No changes detected — history not updated");
            }

            return updated;
        });
    };






    const undo = () => {
        setHistory(h => {
            if (h.length < 2) {
                console.warn("❌ undo: history too short");
                return h;
            }

            setFuture(f => [elements.map(e => ({ ...e })), ...f]);
            const previous = h[h.length - 2];
            setElements(previous.map(e => ({ ...e })));
            return h.slice(0, h.length - 1);
        });
    };

    const redo = () => {
        setFuture(f => {
            if (f.length === 0) {
                console.warn("❌ redo: future is empty");
                return f;
            }

            const [next, ...rest] = f;
            setHistory(h => [...h, elements.map(e => ({ ...e }))]);
            setElements(next.map(e => ({ ...e })));
            return rest;
        });
    };

    return {
        elements,
        setElements,
        updateElements,
        undo,
        redo,
        canUndo: history.length > 1,
        canRedo: future.length > 0,
    };
}

