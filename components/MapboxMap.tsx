"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import detailedData from "@/data/locations-detailed.json";
import pointData from "@/data/points.json";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export interface Feature {
  type?: string;
  properties: {
    category: string;
    name: string;
    address?: string | null;
    weight: number;
  };
  geometry: {
    type?: string;
    coordinates: number[];
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface MapboxMapProps {
  features: Feature[];
  activeCategories: string[];
  categories: Category[];
}

export default function MapboxMap({
  features,
  activeCategories,
  categories,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98.5795, 39.8283],
      zoom: 4,
      minZoom: 3,
      maxZoom: 18,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.current.on("load", () => {
      setMapLoaded(true);

      // Add heatmap source
      map.current!.addSource("heatmap-data", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Add heatmap layer
      map.current!.addLayer({
        id: "heatmap-layer",
        type: "heatmap",
        source: "heatmap-data",
        maxzoom: 12,
        paint: {
          "heatmap-weight": ["get", "weight"],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 0.5,
            12, 1.5,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "rgba(78,168,222,0.4)",
            0.4, "rgba(78,168,222,0.6)",
            0.6, "rgba(78,168,222,0.8)",
            0.8, "rgba(78,168,222,1)",
            1, "rgba(150,200,255,1)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 15,
            12, 30,
          ],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9, 0.8,
            12, 0,
          ],
        },
      });
    });

    map.current.on("zoom", () => {
      if (map.current) {
        setZoomLevel(map.current.getZoom());
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update heatmap data based on active categories
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource("heatmap-data") as mapboxgl.GeoJSONSource;
    if (!source) return;

    const filteredFeatures = pointData.features.filter((f) =>
      activeCategories.includes(f.properties.category)
    );

    // Create blended color based on active categories
    const activeColors = categories
      .filter((c) => activeCategories.includes(c.id))
      .map((c) => c.color);

    // Update heatmap color if we have active categories
    if (activeColors.length > 0) {
      const primaryColor = activeColors[0];
      const r = parseInt(primaryColor.slice(1, 3), 16);
      const g = parseInt(primaryColor.slice(3, 5), 16);
      const b = parseInt(primaryColor.slice(5, 7), 16);

      map.current.setPaintProperty("heatmap-layer", "heatmap-color", [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0, "rgba(0,0,0,0)",
        0.2, `rgba(${r},${g},${b},0.3)`,
        0.4, `rgba(${r},${g},${b},0.5)`,
        0.6, `rgba(${r},${g},${b},0.7)`,
        0.8, `rgba(${r},${g},${b},0.9)`,
        1, `rgba(${Math.min(255, r + 50)},${Math.min(255, g + 50)},${Math.min(255, b + 50)},1)`,
      ]);
    }

    source.setData({
      type: "FeatureCollection",
      features: filteredFeatures.map((f) => ({
        type: "Feature" as const,
        properties: {
          weight: Math.min(f.properties.weight / 10, 1),
        },
        geometry: {
          type: "Point" as const,
          coordinates: f.geometry.coordinates,
        },
      })),
    });
  }, [activeCategories, categories, mapLoaded]);

  // Update markers
  const updateMarkers = useCallback(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Only show markers at higher zoom
    if (zoomLevel < 10) return;

    const bounds = map.current.getBounds();

    const visibleLocations = detailedData.features.filter((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const inBounds = bounds.contains([lng, lat]);
      const inCategory = activeCategories.includes(f.properties.category);
      return inBounds && inCategory;
    });

    // Limit markers for performance
    const maxMarkers = 200;
    const locationsToShow = visibleLocations.slice(0, maxMarkers);

    locationsToShow.forEach((location) => {
      const category = categories.find((c) => c.id === location.properties.category);
      if (!category) return;

      const [lng, lat] = location.geometry.coordinates;

      // Create marker element
      const el = document.createElement("div");
      el.className = "mapbox-marker";
      el.style.cssText = `
        width: 28px;
        height: 28px;
        background: ${category.color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const inner = document.createElement("div");
      inner.style.cssText = `
        width: 10px;
        height: 10px;
        background: white;
        border-radius: 50%;
      `;
      el.appendChild(inner);

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: "dark-popup",
      }).setHTML(`
        <div style="font-family: system-ui; min-width: 180px; padding: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #fff;">
            ${location.properties.name}
          </div>
          <div style="font-size: 12px; color: ${category.color}; margin-bottom: 4px;">
            ${category.name}
          </div>
          ${location.properties.address ? `
            <div style="font-size: 11px; color: #9ca3af;">
              ${location.properties.address}
            </div>
          ` : ""}
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [activeCategories, categories, zoomLevel]);

  // Update markers when zoom or categories change
  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  // Update markers on map move
  useEffect(() => {
    if (!map.current) return;

    const onMoveEnd = () => {
      if (zoomLevel >= 10) {
        updateMarkers();
      }
    };

    map.current.on("moveend", onMoveEnd);

    return () => {
      map.current?.off("moveend", onMoveEnd);
    };
  }, [zoomLevel, updateMarkers]);

  return (
    <>
      <style jsx global>{`
        .mapboxgl-popup-content {
          background: #1f2937 !important;
          color: white !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
          padding: 12px !important;
        }
        .mapboxgl-popup-tip {
          border-top-color: #1f2937 !important;
        }
        .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
          border-top-color: #1f2937 !important;
        }
        .mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
          border-bottom-color: #1f2937 !important;
        }
        .mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
          border-right-color: #1f2937 !important;
        }
        .mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
          border-left-color: #1f2937 !important;
        }
        .mapboxgl-ctrl-group {
          background: #1f2937 !important;
          border: 1px solid #374151 !important;
        }
        .mapboxgl-ctrl-group button {
          background-color: #1f2937 !important;
          border-color: #374151 !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background-color: #374151 !important;
        }
        .mapboxgl-ctrl-group button span {
          filter: invert(1);
        }
      `}</style>
      <div ref={mapContainer} className="w-full h-full" />

      {zoomLevel >= 10 && (
        <div className="absolute top-4 left-14 z-[1000] px-3 py-1.5 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 text-xs text-gray-300">
          Showing individual locations
        </div>
      )}
    </>
  );
}
