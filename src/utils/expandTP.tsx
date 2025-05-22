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


export function expandTPElement(base: Element): Element[] {
    const groupId = uuidv4();
    const elements: Element[] = [];
    const combinedElementId = uuidv4();
    // Тело транзистора (канал)
    const channel: Element = {
        id: uuidv4(),
        groupId,
        name: "TP_BODY",
        type: "P", // p-MOS канал
        x: base.x,
        y: base.y,
        width: base.width,
        height: base.height,
        orientation: base.orientation,
        combinedElementId
    };
    elements.push(channel);

    // Затвор (POLY) – перпендикулярен направлению ширины
    const gateWidth = 2;
    let gateX = base.x;
    let gateY = base.y;
    let gateW = gateWidth;
    let gateH = gateWidth;

    if (["EAST", "WEST"].includes(base.orientation)) {
        gateX = base.x + base.width / 2 - gateWidth / 2;
        gateW = gateWidth;
        gateH = base.height;
    } else {
        gateY = base.y + base.height / 2 - gateWidth / 2;
        gateW = base.width;
        gateH = gateWidth;
    }

    const gate: Element = {
        id: uuidv4(),
        groupId,
        name: "TP_GATE",
        type: "POLY",
        x: gateX,
        y: gateY,
        width: gateW,
        height: gateH,
        orientation: base.orientation,
        combinedElementId
    };
    elements.push(gate);

    // Исток и сток (CPA) – по краям вдоль направления ширины
    const contactWidth = 2;
    let srcX = base.x;
    let srcY = base.y;
    let dstX = base.x;
    let dstY = base.y;

    if (["EAST", "WEST"].includes(base.orientation)) {
        srcX = base.x;
        dstX = base.x + base.width - contactWidth;
        srcY = dstY = base.y;
    } else {
        srcY = base.y;
        dstY = base.y + base.height - contactWidth;
        srcX = dstX = base.x;
    }

    const source: Element = {
        id: uuidv4(),
        groupId,
        name: "TP_SRC",
        type: "CPA",
        x: srcX,
        y: srcY,
        width: ["EAST", "WEST"].includes(base.orientation) ? contactWidth : base.width,
        height: ["EAST", "WEST"].includes(base.orientation) ? base.height : contactWidth,
        orientation: base.orientation,
        combinedElementId
    };

    const drain: Element = {
        id: uuidv4(),
        groupId,
        name: "TP_DST",
        type: "CPA",
        x: dstX,
        y: dstY,
        width: source.width,
        height: source.height,
        orientation: base.orientation,
        combinedElementId
    };

    elements.push(source, drain);

    return elements;
}
