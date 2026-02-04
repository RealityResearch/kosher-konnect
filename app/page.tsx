"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import pointData from "@/data/points.json";
import type { Feature } from "@/components/MapboxMap";
import { useNoticers } from "@/hooks/useNoticers";

// Dynamic import to avoid SSR issues with Mapbox
const MapboxMap = dynamic(() => import("@/components/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a12]">
      {/* Animated Star of David loader */}
      <div className="relative w-16 h-16 animate-gentle-spin">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon
            points="50,10 90,75 10,75"
            fill="none"
            stroke="#4ea8de"
            strokeWidth="2"
            opacity="0.6"
          />
          <polygon
            points="50,90 10,25 90,25"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            opacity="0.6"
          />
        </svg>
      </div>
      <div className="mt-4 text-sm text-gray-500 animate-pulse">Loading map...</div>
    </div>
  ),
});

const categories = [
  { id: "synagogues", name: "Synagogues", nameHe: "בתי כנסת", color: "#4ea8de" },
  { id: "restaurants", name: "Kosher Restaurants", nameHe: "מסעדות כשרות", color: "#48bb78" },
  { id: "chabad", name: "Chabad Houses", nameHe: "בתי חב״ד", color: "#f6ad55" },
  { id: "jcc", name: "JCCs", nameHe: "מרכזים קהילתיים", color: "#ed64a6" },
  { id: "schools", name: "Day Schools", nameHe: "בתי ספר", color: "#9f7aea" },
  { id: "mikvahs", name: "Mikvahs", nameHe: "מקוואות", color: "#4fd1c5" },
  { id: "groceries", name: "Kosher Groceries", nameHe: "מכולות כשרות", color: "#68d391" },
  { id: "judaica", name: "Judaica Shops", nameHe: "חנויות יודאיקה", color: "#fc8181" },
  { id: "Tunnels", name: "Entry Points", nameHe: "נקודות כניסה", color: "#fbbf24" },
  { id: "mints", name: "US Mints", nameHe: "מטבעות ארה״ב", color: "#22c55e" },
];

// Surname heatmap categories from Census data
const surnameCategories = [
  { id: "cohen", names: "Cohen, Kohn, Cohn", color: "#FFD700", count: 108218 },
  { id: "levy", names: "Levy, Levi, Levin, Levine", color: "#00BFFF", count: 108063 },
  { id: "gold", names: "Goldstein, Goldberg, Goldman", color: "#FF8C00", count: 171365 },
  { id: "silver", names: "Silver, Silverman, Silverstein", color: "#C0C0C0", count: 43264 },
  { id: "schwartz_weiss", names: "Schwartz, Weiss", color: "#FF4500", count: 172817 },
  { id: "witz", names: "Horowitz, Moskowitz, Berkowitz", color: "#DA70D6", count: 37967 },
  { id: "berg", names: "Goldberg, Greenberg, Rosenberg", color: "#00FF7F", count: 100629 },
  { id: "stein", names: "Goldstein, Bernstein, Epstein", color: "#4169E1", count: 82143 },
];

// Check if it's Shabbat (Friday sunset to Saturday sunset)
function isShabbat(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 5 && hour >= 18) return true;
  if (day === 6 && hour < 21) return true;
  return false;
}

const hebrewUI = {
  title: "JPS",
  subtitle: "מערכת מיקום יהודית",
  locations: "מיקומים",
  categories: "קטגוריות",
  all: "הכל",
  reset: "איפוס",
  jewishPopulation: "אוכלוסייה יהודית",
  metroArea: "צפיפות במטרופולין",
  selected: "נבחרו",
  of: "מתוך",
  less: "פחות",
  more: "יותר",
  filters: "מסננים",
  shabbatShalom: "שבת שלום!",
  shabbatMessage: "מנוחה טובה",
  showingLocations: "מציג מיקומים בודדים",
};

export default function Home() {
  const [activeCategories, setActiveCategories] = useState<string[]>(categories.map(c => c.id));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showPopulation, setShowPopulation] = useState(false);
  const [shabbatMode, setShabbatMode] = useState(false);
  const [activeSurname, setActiveSurname] = useState<string | null>(null);
  const [surnameData, setSurnameData] = useState<Record<string, unknown> | null>(null);
  const [sheetDragY, setSheetDragY] = useState(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const noticersCount = useNoticers();

  // Lazy load surname heatmap data on first surname selection
  const loadSurnameData = useCallback(async () => {
    if (surnameData) return surnameData;
    const mod = await import("@/data/surname-heatmaps.json");
    const data = mod.default;
    setSurnameData(data);
    return data;
  }, [surnameData]);

  // Mobile back button closes sidebar
  useEffect(() => {
    if (sidebarOpen) {
      window.history.pushState({ sidebar: true }, "");
    }
    const onPopState = () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [sidebarOpen]);

  // Bottom sheet swipe-to-dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
    setSheetDragY(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      setSheetDragY(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (sheetDragY > 100) {
      setSidebarOpen(false);
    }
    setSheetDragY(0);
  }, [sheetDragY]);

  // Check for Shabbat on mount
  useEffect(() => {
    setShabbatMode(isShabbat());
    const interval = setInterval(() => {
      setShabbatMode(isShabbat());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleMusic = () => {
    if (audioRef.current) {
      if (musicPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setMusicPlaying(!musicPlaying);
    }
  };

  // Autoplay music on first user interaction
  useEffect(() => {
    const playOnInteraction = () => {
      if (audioRef.current && !musicPlaying) {
        audioRef.current.play().then(() => {
          setMusicPlaying(true);
        }).catch(() => {});
      }
      document.removeEventListener("click", playOnInteraction);
      document.removeEventListener("keydown", playOnInteraction);
    };
    document.addEventListener("click", playOnInteraction);
    document.addEventListener("keydown", playOnInteraction);
    return () => {
      document.removeEventListener("click", playOnInteraction);
      document.removeEventListener("keydown", playOnInteraction);
    };
  }, [musicPlaying]);

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

  const activeFilterCount = categories.length - activeCategories.length;

  return (
    <div
      className={`h-[100dvh] bg-[#0a0a12] flex flex-col overflow-hidden transition-colors duration-700 ${shabbatMode ? 'rtl' : 'ltr'}`}
      dir={shabbatMode ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 bg-[#0a0a12]/95 backdrop-blur-xl z-20 border-b border-transparent safe-top" style={{ borderImage: 'linear-gradient(to right, transparent, #1e1e30, transparent) 1' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Image
                src="/logo.png"
                alt="JPS"
                width={40}
                height={40}
                className="w-10 h-10 rounded-xl object-cover transition-transform duration-300 group-hover:scale-110"
                priority
              />
              <div className="absolute inset-0 rounded-xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <h1 className={`text-xl font-display leading-tight ${shabbatMode ? 'font-hebrew text-amber-400' : 'text-white'}`}>
                {hebrewUI.title}
              </h1>
              <p className={`text-xs hidden sm:block ${shabbatMode ? 'font-hebrew text-amber-400/60' : 'text-gray-500'}`}>
                {shabbatMode ? hebrewUI.subtitle : "Jewish Positioning System"}
              </p>
            </div>
          </div>

          {/* Stats + Controls */}
          <div className="flex items-center gap-2.5">
            {/* Shabbat mode toggle */}
            <button
              onClick={() => setShabbatMode(!shabbatMode)}
              className={`p-2.5 lg:p-2 rounded-xl transition-all duration-300 animate-bounce-click min-w-[44px] min-h-[44px] flex items-center justify-center ${
                shabbatMode
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400 shadow-[0_0_16px_-4px_rgba(251,191,36,0.3)]'
                  : 'bg-[#12121e] border border-[#1e1e30] text-gray-400 hover:text-white hover:border-[#2a2a40]'
              }`}
              title={shabbatMode ? "Exit Shabbat Mode" : "Enter Shabbat Mode"}
            >
              <span className="text-sm">✡️</span>
            </button>

            {/* Music toggle */}
            <button
              onClick={toggleMusic}
              className={`p-2.5 lg:p-2 rounded-xl transition-all duration-300 animate-bounce-click min-w-[44px] min-h-[44px] flex items-center justify-center ${
                musicPlaying
                  ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                  : 'bg-[#12121e] border border-[#1e1e30] text-gray-400 hover:text-white hover:border-[#2a2a40]'
              }`}
              title={musicPlaying ? "Pause music" : "Play music"}
            >
              {musicPlaying ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75a.75.75 0 01-.75-.75V6a.75.75 0 011.5 0v12a.75.75 0 01-.75.75zM8.25 15V9" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              )}
            </button>

            {/* Location counter */}
            <div className={`${shabbatMode ? 'text-left' : 'text-right'} px-2`}>
              <div className="text-xl font-display text-white animate-count" key={totalLocations}>
                {totalLocations.toLocaleString()}
              </div>
              <div className={`text-[11px] lg:text-[10px] uppercase tracking-widest ${shabbatMode ? 'font-hebrew text-amber-400/50' : 'text-gray-500'}`}>
                {shabbatMode ? hebrewUI.locations : "locations"}
              </div>
            </div>

            {/* Mobile filter toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden relative p-2.5 rounded-xl bg-[#12121e] border border-[#1e1e30] text-gray-400 hover:text-white animate-bounce-click min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full text-[11px] font-bold text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Announcement bar */}
      <div className={`flex-shrink-0 transition-colors duration-700 ${
        shabbatMode
          ? 'bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40'
          : 'bg-[#0d0d18]'
      }`} style={{ borderBottom: '1px solid rgba(30,30,48,0.6)' }}>
        <div className="flex items-center justify-between px-4 py-2 gap-3">
          {/* Noticers counter with live indicator */}
          <div className="flex items-center gap-2 min-w-[100px]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="text-xs text-gray-400">
              <span className="text-cyan-400 font-semibold animate-count" key={noticersCount}>{noticersCount.toLocaleString()}</span>
              {" "}{shabbatMode ? "משגיחים" : "Noticers"}
            </span>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-2">
            <a
              href="https://x.com/i/communities/2018812340485919164"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] lg:min-h-0 lg:h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all text-xs text-gray-400 hover:text-white border border-transparent hover:border-white/10"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="hidden sm:inline">Twitter</span>
            </a>
            <a
              href="https://pump.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] lg:min-h-0 lg:h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/30"
            >
              <span className="hidden sm:inline">Pump.fun</span>
              <span className="sm:hidden">Pump</span>
            </a>
          </div>

          {/* Right side */}
          {shabbatMode ? (
            <span className="font-hebrew text-amber-400/80 text-xs whitespace-nowrap min-w-[100px] text-right">
              ✡️ {hebrewUI.shabbatShalom}
            </span>
          ) : (
            <span className="text-[11px] lg:text-[10px] text-gray-500 whitespace-nowrap min-w-[100px] text-right uppercase tracking-wider">
              Data updated daily
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <main className="flex-1 relative">
          <MapboxMap
            features={pointData.features as Feature[]}
            activeCategories={activeCategories}
            categories={categories}
            showPopulationDensity={showPopulation}
            activeSurnameHeatmap={activeSurname}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            surnameHeatmapData={activeSurname && surnameData ? (surnameData as any).metroHeatmaps?.[activeSurname] ?? null : null}
            surnameHeatmapColor={activeSurname ? surnameCategories.find(s => s.id === activeSurname)?.color ?? "#FFD700" : "#FFD700"}
          />

          {/* Legend - bottom left */}
          <div className={`absolute bottom-6 lg:bottom-4 ${shabbatMode ? 'right-4' : 'left-4'} z-30 glass flex items-center gap-2 px-3 py-2 rounded-xl text-xs safe-bottom`}>
            <span className="text-gray-500 text-[11px] lg:text-[10px] uppercase tracking-wider">{shabbatMode ? hebrewUI.less : "Less"}</span>
            <div className="h-1.5 w-20 rounded-full overflow-hidden bg-gray-800">
              <div className={`h-full rounded-full bg-gradient-to-r ${shabbatMode ? 'from-cyan-500 to-transparent' : 'from-transparent to-cyan-500'}`} />
            </div>
            <span className="text-gray-500 text-[11px] lg:text-[10px] uppercase tracking-wider">{shabbatMode ? hebrewUI.more : "More"}</span>
          </div>
        </main>

        {/* Sidebar - desktop always visible, mobile as bottom sheet on small screens */}
        <>
          {/* Mobile overlay backdrop */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={`
              fixed lg:relative z-50
              lg:top-0 lg:right-0 lg:h-full
              bottom-0 left-0 right-0 lg:left-auto
              max-h-[90dvh] lg:max-h-none
              w-full lg:w-64 flex-shrink-0
              bg-[#0a0a12] lg:bg-[#0a0a12]/90 backdrop-blur-xl
              border-t lg:border-t-0 lg:border-l border-[#1e1e30]
              rounded-t-2xl lg:rounded-none
              ${!isDragging.current ? 'transition-transform duration-300 ease-out' : ''}
              ${sidebarOpen ? 'lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-0'}
              flex flex-col
            `}
            style={sidebarOpen && sheetDragY > 0 ? { transform: `translateY(${sheetDragY}px)` } : undefined}
          >
            {/* Mobile drag handle — swipe down to dismiss */}
            <div
              className="lg:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Mobile header */}
            <div className="lg:hidden flex items-center justify-between px-4 pb-3 pt-1">
              <span className={`font-semibold ${shabbatMode ? 'font-hebrew text-amber-400' : 'text-white'}`}>
                {shabbatMode ? hebrewUI.filters : "Filters"}
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 lg:pt-4">
              {/* Categories header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-[11px] lg:text-[10px] font-semibold uppercase tracking-[0.15em] ${shabbatMode ? 'font-hebrew text-amber-400/60' : 'text-gray-500'}`}>
                  {shabbatMode ? hebrewUI.categories : "Categories"}
                </h2>
                <div className="flex gap-2 text-[11px] lg:text-[10px]">
                  <button onClick={selectAll} className="text-blue-400 hover:text-blue-300 transition-colors">{shabbatMode ? hebrewUI.all : "All"}</button>
                  <span className="text-gray-700">|</span>
                  <button onClick={selectNone} className="text-gray-500 hover:text-gray-300 transition-colors">{shabbatMode ? hebrewUI.reset : "Reset"}</button>
                </div>
              </div>

              {/* Category list */}
              <div className="space-y-0.5 stagger-in">
                {categories.map((category) => {
                  const isActive = activeCategories.includes(category.id);
                  const total = categoryTotals[category.id] || 0;

                  return (
                    <label
                      key={category.id}
                      className={`
                        flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 animate-bounce-click
                        ${isActive
                          ? "bg-white/[0.04]"
                          : "bg-transparent hover:bg-white/[0.02]"
                        }
                      `}
                      style={isActive ? {
                        borderLeft: `2px solid ${category.color}`,
                        boxShadow: `inset 2px 0 8px -4px ${category.color}40`,
                      } : { borderLeft: '2px solid transparent' }}
                    >
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center transition-all duration-200 flex-shrink-0
                          ${isActive ? "" : "border border-gray-700"}`}
                        style={{ backgroundColor: isActive ? category.color : "transparent" }}
                      >
                        {isActive && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleCategory(category.id)}
                        className="sr-only"
                        aria-label={`Toggle ${category.name}`}
                      />
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <span className={`text-sm ${isActive ? 'text-white' : 'text-gray-400'} transition-colors ${shabbatMode ? 'font-hebrew' : ''}`}>
                          {shabbatMode ? category.nameHe : category.name}
                        </span>
                        <span className={`text-[11px] lg:text-[10px] tabular-nums ${isActive ? 'text-gray-400' : 'text-gray-500'} ${shabbatMode ? 'mr-2' : 'ml-2'}`}>
                          {total.toLocaleString()}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Population Density Toggle */}
              <div className="mt-5 pt-4">
                <div className="gradient-divider mb-4" />
                <label className={`
                  flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 animate-bounce-click
                  ${showPopulation ? 'bg-amber-500/[0.08]' : 'hover:bg-white/[0.02]'}
                `}
                style={showPopulation ? {
                  borderLeft: '2px solid #f59e0b',
                  boxShadow: 'inset 2px 0 8px -4px rgba(245,158,11,0.3)',
                } : { borderLeft: '2px solid transparent' }}
                >
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center transition-all duration-200 flex-shrink-0
                      ${showPopulation ? "" : "border border-gray-700"}`}
                    style={{ backgroundColor: showPopulation ? "#f59e0b" : "transparent" }}
                  >
                    {showPopulation && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={showPopulation}
                    onChange={() => setShowPopulation(!showPopulation)}
                    className="sr-only"
                    aria-label="Toggle Jewish Population density"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${showPopulation ? 'text-white' : 'text-gray-400'} ${shabbatMode ? 'font-hebrew' : ''}`}>
                      {shabbatMode ? hebrewUI.jewishPopulation : "Jewish Population"}
                    </span>
                    <div className={`text-[11px] lg:text-[10px] ${showPopulation ? 'text-gray-400' : 'text-gray-500'} ${shabbatMode ? 'font-hebrew' : ''}`}>
                      {shabbatMode ? hebrewUI.metroArea : "Metro area density"}
                    </div>
                  </div>
                </label>
              </div>

              {/* Surname Heatmaps */}
              <div className="mt-5 pt-4">
                <div className="gradient-divider mb-4" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] lg:text-[10px] font-semibold text-gray-500 uppercase tracking-[0.15em]">
                    Surnames
                  </h2>
                  {activeSurname && (
                    <button
                      onClick={() => setActiveSurname(null)}
                      className="text-[11px] lg:text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-0.5 stagger-in">
                  {surnameCategories.map((surname) => {
                    const isActive = activeSurname === surname.id;
                    return (
                      <button
                        key={surname.id}
                        onClick={async () => {
                          if (isActive) {
                            setActiveSurname(null);
                          } else {
                            await loadSurnameData();
                            setActiveSurname(surname.id);
                          }
                        }}
                        className={`
                          w-full flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 text-left animate-bounce-click
                          ${isActive ? "bg-white/[0.04]" : "bg-transparent hover:bg-white/[0.02]"}
                        `}
                        style={isActive ? {
                          borderLeft: `2px solid ${surname.color}`,
                          boxShadow: `inset 2px 0 8px -4px ${surname.color}40`,
                        } : { borderLeft: '2px solid transparent' }}
                      >
                        <span
                          className={`w-4 h-4 rounded-full flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
                          style={{
                            backgroundColor: surname.color,
                            boxShadow: isActive ? `0 0 10px -2px ${surname.color}80` : 'none',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>{surname.names}</div>
                          <div className={`text-[11px] lg:text-[10px] tabular-nums ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>{surname.count.toLocaleString()}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-[11px] lg:text-[10px] text-gray-500 px-2 uppercase tracking-wider">
                  Source: US Census
                </div>
              </div>

              {/* Selected summary */}
              <div className="mt-5 pt-4">
                <div className="gradient-divider mb-4" />
                <div className="text-[11px] lg:text-[10px] text-gray-500 mb-2 uppercase tracking-wider">
                  {shabbatMode
                    ? `${activeCategories.length} ${hebrewUI.of} ${categories.length} ${hebrewUI.selected}`
                    : `${activeCategories.length} of ${categories.length} selected`
                  }
                </div>
                <div className="flex flex-wrap gap-1">
                  {activeCategories.map((catId) => {
                    const cat = categories.find((c) => c.id === catId);
                    return (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] lg:text-[10px] transition-all"
                        style={{ backgroundColor: `${cat?.color}15`, color: cat?.color }}
                      >
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: cat?.color }} />
                        {shabbatMode ? cat?.nameHe?.split(" ")[0] : cat?.name.split(" ")[0]}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </>
      </div>

      {/* Background music */}
      <audio ref={audioRef} src="/music.mp4" loop />
    </div>
  );
}
