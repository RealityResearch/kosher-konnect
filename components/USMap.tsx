"use client";

import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { useState } from "react";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface StateData {
  name: string;
  [key: string]: string | number;
}

interface USMapProps {
  stateData: Record<string, StateData>;
  activeCategory: string;
  categoryColor: string;
}

// Map state FIPS codes to postal codes
const fipsToPostal: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY"
};

export default function USMap({ stateData, activeCategory, categoryColor }: USMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; value: number; x: number; y: number } | null>(null);

  // Get max value for the active category
  const values = Object.values(stateData).map(s => (s[activeCategory] as number) || 0);
  const maxValue = Math.max(...values);

  const colorScale = scaleLinear<string>()
    .domain([0, maxValue * 0.25, maxValue * 0.5, maxValue])
    .range(["#1a1a2e", adjustOpacity(categoryColor, 0.3), adjustOpacity(categoryColor, 0.6), categoryColor]);

  function adjustOpacity(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const blend = (c: number) => Math.round(c * factor + 26 * (1 - factor));
    return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
  }

  return (
    <div className="relative w-full h-full">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1000 }}
        className="w-full h-full"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const fips = geo.id;
              const postal = fipsToPostal[fips];
              const state = postal ? stateData[postal] : null;
              const value = state ? (state[activeCategory] as number) || 0 : 0;
              const fillColor = colorScale(value);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke="#2d3748"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: categoryColor, cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                  onMouseEnter={(evt) => {
                    if (state) {
                      setTooltip({
                        name: state.name,
                        value,
                        x: evt.clientX,
                        y: evt.clientY,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(evt) => {
                    if (tooltip) {
                      setTooltip(prev => prev ? { ...prev, x: evt.clientX, y: evt.clientY } : null);
                    }
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl pointer-events-none"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y - 10,
          }}
        >
          <div className="text-white font-medium">{tooltip.name}</div>
          <div className="text-gray-300 text-sm">
            {tooltip.value.toLocaleString()} locations
          </div>
        </div>
      )}
    </div>
  );
}
