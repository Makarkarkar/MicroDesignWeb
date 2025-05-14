import React, { useEffect, useRef, useState } from "react";

interface Props {
  layers: string[];
  layerColors: Record<string, string>;
  addElement: (layer: string) => void;
}

const LayerButtonPanel: React.FC<Props> = ({ layers, layerColors, addElement }) => {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mb-6 px-2">
      <div className="flex w-full">
        <h1 className="text-xl font-medium flex-wrap text-white w-full ml-10">Создание элемента:</h1>
      </div>
      {layers.map(layer => (
        <button
          key={layer}
          onClick={() => addElement(layer)}
          className="font-semibold py-2 px-4 rounded-full border transition-colors duration-200"
          style={{
            borderColor: layerColors[layer],
            color: layerColors[layer],
            backgroundColor: "transparent"
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = layerColors[layer], e.currentTarget.style.color = "white")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent", e.currentTarget.style.color = layerColors[layer])}
          title={layer}
        >
          {layer}
        </button>
      ))}
    </div>
  );
};

export default LayerButtonPanel;
