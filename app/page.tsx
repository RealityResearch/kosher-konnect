"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import pointData from "@/data/points.json";
import type { Feature } from "@/components/MapboxMap";

// Dynamic import to avoid SSR issues with Mapbox
const MapboxMap = dynamic(() => import("@/components/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0f1117]">
      <div className="text-gray-400">Loading map...</div>
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
];

// Check if it's Shabbat (Friday sunset to Saturday sunset)
function isShabbat(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // Friday after 6pm (approximate sunset)
  if (day === 5 && hour >= 18) return true;
  // All day Saturday until 9pm (approximate havdalah)
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
  const audioRef = useRef<HTMLAudioElement>(null);

  // Check for Shabbat on mount
  useEffect(() => {
    setShabbatMode(isShabbat());
    // Check every minute
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
    <div className={`h-screen bg-[#0f1117] flex flex-col overflow-hidden ${shabbatMode ? 'rtl' : 'ltr'}`} dir={shabbatMode ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-gray-800 bg-[#0f1117]/95 backdrop-blur z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Kosher Konnect"
              className="w-9 h-9 rounded-lg object-cover"
            />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{hebrewUI.title}</h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                {shabbatMode ? hebrewUI.subtitle : "Jewish Positioning System"}
              </p>
            </div>
          </div>

          {/* Stats + Controls */}
          <div className="flex items-center gap-3">
            {/* Shabbat mode toggle */}
            <button
              onClick={() => setShabbatMode(!shabbatMode)}
              className={`p-2 rounded-lg border transition-colors ${shabbatMode ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'}`}
              title={shabbatMode ? "Exit Shabbat Mode" : "Enter Shabbat Mode"}
            >
              <span className="text-sm">✡️</span>
            </button>

            {/* Music toggle */}
            <button
              onClick={toggleMusic}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-white hover:bg-gray-700 transition-colors"
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

            <div className={shabbatMode ? "text-left" : "text-right"}>
              <div className="text-xl font-bold text-white">{totalLocations.toLocaleString()}</div>
              <div className="text-xs text-gray-400">{shabbatMode ? hebrewUI.locations : "locations"}</div>
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

      {/* Announcement bar */}
      <div className={`flex-shrink-0 border-b ${shabbatMode ? 'bg-gradient-to-r from-amber-900/50 via-amber-800/50 to-amber-900/50 border-amber-700/50' : 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-cyan-900/50'}`}>
        <div className="flex items-center justify-center py-2 text-xs tracking-widest">
          <span className={shabbatMode ? "text-amber-400 text-sm" : "text-cyan-400"}>
            {shabbatMode ? `✡️ ${hebrewUI.shabbatShalom} ${hebrewUI.shabbatMessage} ✡️` : "COMING SOON"}
          </span>
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
          />

          {/* Legend - bottom left */}
          <div className={`absolute bottom-4 ${shabbatMode ? 'right-4' : 'left-4'} z-[1000] flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 text-xs safe-bottom`}>
            <span className="text-gray-400">{shabbatMode ? hebrewUI.less : "Less"}</span>
            <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${shabbatMode ? 'from-white via-white/50 to-transparent' : 'from-transparent via-white/50 to-white'}`} />
            <span className="text-gray-400">{shabbatMode ? hebrewUI.more : "More"}</span>
          </div>
        </main>

        {/* Sidebar - desktop always visible, mobile as overlay */}
        <>
          {/* Mobile overlay backdrop */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/60 z-[1100]"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`
            fixed lg:relative top-0 right-0 h-full z-[1200]
            w-72 lg:w-64 flex-shrink-0
            bg-[#0f1117] lg:bg-gray-900/80 backdrop-blur
            border-l border-gray-800
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            flex flex-col
          `}>
            {/* Mobile close button */}
            <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800">
              <span className="text-white font-semibold">{shabbatMode ? hebrewUI.filters : "Filters"}</span>
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
                  {shabbatMode ? hebrewUI.categories : "Categories"}
                </h2>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAll} className="text-blue-400 hover:text-blue-300">{shabbatMode ? hebrewUI.all : "All"}</button>
                  <span className="text-gray-600">|</span>
                  <button onClick={selectNone} className="text-gray-400 hover:text-gray-300">{shabbatMode ? hebrewUI.reset : "Reset"}</button>
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
                        <span className="text-sm text-white">{shabbatMode ? category.nameHe : category.name}</span>
                        <span className={`text-xs text-gray-500 ${shabbatMode ? 'mr-2' : 'ml-2'}`}>{total.toLocaleString()}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Population Density Toggle */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <label className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all hover:bg-gray-800/40">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all flex-shrink-0
                      ${showPopulation ? "border-transparent bg-amber-500" : "border-2 border-gray-600"}`}
                  >
                    {showPopulation && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={showPopulation}
                    onChange={() => setShowPopulation(!showPopulation)}
                    className="sr-only"
                  />
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-amber-500" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{shabbatMode ? hebrewUI.jewishPopulation : "Jewish Population"}</span>
                    <div className="text-xs text-gray-500">{shabbatMode ? hebrewUI.metroArea : "Metro area density"}</div>
                  </div>
                </label>
              </div>

              {/* Selected summary */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-500 mb-2">
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ backgroundColor: `${cat?.color}30`, color: cat?.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color }} />
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
