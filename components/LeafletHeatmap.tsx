"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Import heat plugin
if (typeof window !== "undefined") {
  require("leaflet.heat");
}

export interface Feature {
  type?: string;
  properties: {
    category: string;
    name: string;
    address?: string;
    weight: number;
  };
  geometry: {
    type?: string;
    coordinates: number[];  // GeoJSON coordinates [lng, lat]
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface LeafletHeatmapProps {
  features: Feature[];
  activeCategories: string[];
  categories: Category[];
}

// Detailed location data for markers
import detailedData from "@/data/locations-detailed.json";

export default function LeafletHeatmap({
  features,
  activeCategories,
  categories,
}: LeafletHeatmapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatLayersRef = useRef<Map<string, L.HeatLayer>>(new Map());
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [zoomLevel, setZoomLevel] = useState(4);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = L.map(mapContainer.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: true,
      // Smooth zooming options
      zoomSnap: 0.25,           // Allow fractional zoom levels
      zoomDelta: 0.5,           // Smaller zoom increments for +/- buttons
      wheelPxPerZoomLevel: 120, // More scroll needed per zoom (smoother)
      zoomAnimation: true,
      fadeAnimation: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(mapRef.current);

    mapRef.current.zoomControl.setPosition("topleft");

    // Track zoom level
    mapRef.current.on("zoomend", () => {
      if (mapRef.current) {
        setZoomLevel(mapRef.current.getZoom());
      }
    });

    // Initialize markers layer
    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update heatmap layers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing heat layers
    heatLayersRef.current.forEach((layer) => {
      mapRef.current?.removeLayer(layer);
    });
    heatLayersRef.current.clear();

    // Only show heatmap at lower zoom levels
    if (zoomLevel < 10) {
      activeCategories.forEach((categoryId) => {
        const category = categories.find((c) => c.id === categoryId);
        if (!category) return;

        const categoryFeatures = features.filter(
          (f) => f.properties.category === categoryId
        );

        const heatData: [number, number, number][] = categoryFeatures.map((f) => [
          f.geometry.coordinates[1],
          f.geometry.coordinates[0],
          Math.min(f.properties.weight / 30, 10),
        ]);

        // @ts-ignore
        const heatLayer = L.heatLayer(heatData, {
          radius: 28,
          blur: 15,
          maxZoom: 10,
          max: 12,
          minOpacity: 0.5,
          gradient: {
            0.0: "transparent",
            0.2: hexToRgba(category.color, 0.5),
            0.4: hexToRgba(category.color, 0.7),
            0.6: category.color,
            0.8: category.color,
            1.0: lighten(category.color, 0.3),
          },
        });

        heatLayer.addTo(mapRef.current!);
        heatLayersRef.current.set(categoryId, heatLayer);
      });
    }
  }, [activeCategories, categories, features, zoomLevel]);

  // Update markers at high zoom
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    // Only show markers at higher zoom levels
    if (zoomLevel >= 10) {
      const bounds = mapRef.current.getBounds();

      // Filter detailed locations by active categories and bounds
      const visibleLocations = detailedData.features.filter((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const inBounds = bounds.contains([lat, lng]);
        const inCategory = activeCategories.includes(f.properties.category);
        return inBounds && inCategory;
      });

      visibleLocations.forEach((location) => {
        const category = categories.find((c) => c.id === location.properties.category);
        if (!category) return;

        const [lng, lat] = location.geometry.coordinates;

        // Create custom marker
        const markerHtml = `
          <div style="
            width: 24px;
            height: 24px;
            background: ${category.color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
        `;

        const icon = L.divIcon({
          html: markerHtml,
          className: "custom-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([lat, lng], { icon });

        // Popup content
        const popupContent = `
          <div style="font-family: system-ui; min-width: 180px;">
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
            ` : ''}
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: "dark-popup",
          closeButton: false,
        });

        marker.addTo(markersLayerRef.current!);
      });
    }
  }, [activeCategories, categories, zoomLevel]);

  // Re-render markers when map moves at high zoom
  useEffect(() => {
    if (!mapRef.current || zoomLevel < 10) return;

    const updateMarkers = () => {
      if (zoomLevel >= 10) {
        // Trigger re-render by updating a dummy state
        setZoomLevel((z) => z);
      }
    };

    mapRef.current.on("moveend", updateMarkers);

    return () => {
      mapRef.current?.off("moveend", updateMarkers);
    };
  }, [zoomLevel]);

  return (
    <>
      <style jsx global>{`
        .dark-popup .leaflet-popup-content-wrapper {
          background: #1f2937;
          color: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .dark-popup .leaflet-popup-tip {
          background: #1f2937;
        }
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Zoom indicator */}
      {zoomLevel >= 10 && (
        <div className="absolute top-4 left-14 z-[1000] px-3 py-1.5 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 text-xs text-gray-300">
          Showing individual locations
        </div>
      )}
    </>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lightenChannel = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `rgb(${lightenChannel(r)}, ${lightenChannel(g)}, ${lightenChannel(b)})`;
}

// Type augmentation
declare module "leaflet" {
  function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: Record<number, string>;
    }
  ): HeatLayer;

  interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: [number, number, number][]): this;
    addLatLng(latlng: [number, number, number]): this;
    setOptions(options: object): this;
  }
}
