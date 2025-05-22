import { v4 as uuidv4 } from "uuid";
import type { Element } from "./expandTP"; // использует тот же интерфейс

export function expandTNElement(base: Element): Element[] {
  const combinedElementId = uuidv4();
  const elements: Element[] = [];

  // 1. Тело транзистора — канал
  elements.push({
    id: uuidv4(),
    combinedElementId,
    name: "TN_BODY",
    type: "N",
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    orientation: base.orientation
  });

  // 2. Затвор (POLY)
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

  elements.push({
    id: uuidv4(),
    combinedElementId,
    name: "TN_GATE",
    type: "POLY",
    x: gateX,
    y: gateY,
    width: gateW,
    height: gateH,
    orientation: base.orientation
  });

  // 3. Контакты (CNA)
  const contactWidth = 2;
  const horizontal = ["EAST", "WEST"].includes(base.orientation);

  const srcX = base.x;
  const dstX = base.x + base.width - contactWidth;
  const srcY = base.y;
  const dstY = base.y + base.height - contactWidth;

  elements.push({
    id: uuidv4(),
    combinedElementId,
    name: "TN_SRC",
    type: "CNA",
    x: horizontal ? srcX : base.x,
    y: horizontal ? base.y : srcY,
    width: horizontal ? contactWidth : base.width,
    height: horizontal ? base.height : contactWidth,
    orientation: base.orientation
  });

  elements.push({
    id: uuidv4(),
    combinedElementId,
    name: "TN_DST",
    type: "CNA",
    x: horizontal ? dstX : base.x,
    y: horizontal ? base.y : dstY,
    width: horizontal ? contactWidth : base.width,
    height: horizontal ? base.height : contactWidth,
    orientation: base.orientation
  });

  return elements;
}
