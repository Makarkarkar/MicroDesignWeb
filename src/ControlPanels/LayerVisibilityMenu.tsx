import React from "react";

interface Props {
    layers: string[];
    visibleLayers: string[];
    toggleLayer: (layer: string) => void;
}

const LayerVisibilityMenu: React.FC<Props> = ({ layers, visibleLayers, toggleLayer }) => (
    <div className="flex flex-wrap justify-center gap-4 px-2 mb-4 pt-10">
        <div className="flex w-full">
            <h1 className="text-xl font-medium flex-wrap text-white w-full ml-10">Отображение слоев:</h1>
        </div>
        {layers.map(layer => (
            <div key={layer} className="flex items-center">
                <input
                    id={`checkbox-${layer}`}
                    type="checkbox"
                    checked={visibleLayers.includes(layer)}
                    onChange={() => toggleLayer(layer)}
                    className="me-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-700 dark:focus:ring-offset-gray-700 focus:ring-2 dark:bg-gray-600 dark:border-gray-500"
                />
                <span className="ms-2 text-sm font-medium text-white">{layer}</span>
            </div>
        ))}

    </div>
);

export default LayerVisibilityMenu;
