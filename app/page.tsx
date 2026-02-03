"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import pointData from "@/data/points.json";
import type { Feature } from "@/components/LeafletHeatmap";

// Dynamic import to avoid SSR issues with Leaflet
const LeafletHeatmap = dynamic(() => import("@/components/LeafletHeatmap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0f1117]">
      <div className="text-gray-400">Loading map...</div>
    </div>
  ),
});

const categories = [
  { id: "synagogues", name: "Synagogues", color: "#4ea8de" },
  { id: "restaurants", name: "Kosher Restaurants", color: "#48bb78" },
  { id: "chabad", name: "Chabad Houses", color: "#f6ad55" },
  { id: "jcc", name: "JCCs", color: "#ed64a6" },
  { id: "schools", name: "Day Schools", color: "#9f7aea" },
  { id: "mikvahs", name: "Mikvahs", color: "#4fd1c5" },
  { id: "groceries", name: "Kosher Groceries", color: "#68d391" },
  { id: "judaica", name: "Judaica Shops", color: "#fc8181" },
];

export default function Home() {
  const [activeCategories, setActiveCategories] = useState<string[]>(["synagogues"]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    setActiveCategories((prev) => {
      if (prev.includes(categoryId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const selectAll = () => setActiveCategories(categories.map((c) => c.id));
  const selectNone = () => setActiveCategories(["synagogues"]);

  // Calculate totals
  const categoryTotals = categories.reduce((acc, cat) => {
    acc[cat.id] = pointData.features
      .filter((f) => f.properties.category === cat.id)
      .reduce((sum, f) => sum + f.properties.weight, 0);
    return acc;
  }, {} as Record<string, number>);

  const totalLocations = activeCategories.reduce(
    (sum, catId) => sum + (categoryTotals[catId] || 0),
    0
  );

  return (
    <div className="h-screen bg-[#0f1117] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-gray-800 bg-[#0f1117]/95 backdrop-blur z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Kosher Konnect</h1>
              <p className="text-xs text-gray-400 hidden sm:block">Find your community</p>
            </div>
          </div>

          {/* Stats + Filter toggle for mobile */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xl font-bold text-white">{totalLocations.toLocaleString()}</div>
              <div className="text-xs text-gray-400">locations</div>
            </div>

            {/* Mobile filter toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <main className="flex-1 relative">
          <LeafletHeatmap
            features={pointData.features as Feature[]}
            activeCategories={activeCategories}
            categories={categories}
          />

          {/* Legend - bottom left */}
          <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 text-xs">
            <span className="text-gray-400">Less</span>
            <div className="h-2 w-16 rounded-full bg-gradient-to-r from-transparent via-white/50 to-white" />
            <span className="text-gray-400">More</span>
          </div>
        </main>

        {/* Sidebar - desktop always visible, mobile as overlay */}
        <>
          {/* Mobile overlay backdrop */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/60 z-30"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`
            fixed lg:relative top-0 right-0 h-full z-40
            w-72 lg:w-64 flex-shrink-0
            bg-[#0f1117] lg:bg-gray-900/80 backdrop-blur
            border-l border-gray-800
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            flex flex-col
          `}>
            {/* Mobile close button */}
            <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800">
              <span className="text-white font-semibold">Filters</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Categories
                </h2>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAll} className="text-blue-400 hover:text-blue-300">All</button>
                  <span className="text-gray-600">|</span>
                  <button onClick={selectNone} className="text-gray-400 hover:text-gray-300">Reset</button>
                </div>
              </div>

              {/* Category list */}
              <div className="space-y-1">
                {categories.map((category) => {
                  const isActive = activeCategories.includes(category.id);
                  const total = categoryTotals[category.id] || 0;

                  return (
                    <label
                      key={category.id}
                      className={`
                        flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all
                        ${isActive ? "bg-gray-800/80" : "bg-transparent hover:bg-gray-800/40"}
                      `}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center transition-all flex-shrink-0
                          ${isActive ? "border-transparent" : "border-2 border-gray-600"}`}
                        style={{ backgroundColor: isActive ? category.color : "transparent" }}
                      >
                        {isActive && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleCategory(category.id)}
                        className="sr-only"
                      />
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <span className="text-sm text-white">{category.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{total.toLocaleString()}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Selected summary */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-500 mb-2">
                  {activeCategories.length} of {categories.length} selected
                </div>
                <div className="flex flex-wrap gap-1">
                  {activeCategories.map((catId) => {
                    const cat = categories.find((c) => c.id === catId);
                    return (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ backgroundColor: `${cat?.color}30`, color: cat?.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color }} />
                        {cat?.name.split(" ")[0]}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </>
      </div>
    </div>
  );
}
