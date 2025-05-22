
import React from "react";

interface Props {
  layers: string[];
  layerColors: Record<string, string>;
  setLayerColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const LayerColorSettings: React.FC<Props> = ({ layers, layerColors, setLayerColors }) => {
  return (
    <div className="mt-4 bg-zinc-800 p-4 rounded text-white">
      <h2 className="text-lg mb-2">Настройка цветов слоёв</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {layers.map(layer => (
          <div key={layer} className="flex items-center gap-2">
            <label className="w-10">{layer}</label>
            <input
              type="color"
              value={layerColors[layer]}
              onChange={(e) => {
                const newColor = e.target.value;
                setLayerColors(prev => ({ ...prev, [layer]: newColor }));
              }}
              className="w-8 h-8 border rounded"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayerColorSettings;
