"use client";

interface LegendProps {
  color: string;
  maxValue: number;
}

export default function Legend({ color, maxValue }: LegendProps) {
  function adjustOpacity(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const blend = (c: number) => Math.round(c * factor + 26 * (1 - factor));
    return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/80 backdrop-blur rounded-lg border border-gray-700">
      <span className="text-gray-400 text-sm">Fewer</span>
      <div
        className="h-3 w-32 rounded-full"
        style={{
          background: `linear-gradient(to right, #1a1a2e, ${adjustOpacity(color, 0.3)}, ${adjustOpacity(color, 0.6)}, ${color})`,
        }}
      />
      <span className="text-gray-400 text-sm">More</span>
      <span className="text-gray-500 text-xs ml-2">(max: {maxValue})</span>
    </div>
  );
}
