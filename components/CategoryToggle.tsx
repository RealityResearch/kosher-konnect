"use client";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryToggleProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  stateData: Record<string, { [key: string]: string | number }>;
}

export default function CategoryToggle({
  categories,
  activeCategory,
  onCategoryChange,
  stateData,
}: CategoryToggleProps) {
  // Calculate totals for each category
  const getTotalForCategory = (categoryId: string) => {
    return Object.values(stateData).reduce(
      (sum, state) => sum + ((state[categoryId] as number) || 0),
      0
    );
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {categories.map((category) => {
        const isActive = activeCategory === category.id;
        const total = getTotalForCategory(category.id);

        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
              border-2 flex items-center gap-2
              ${isActive
                ? "text-white shadow-lg scale-105"
                : "text-gray-300 bg-gray-800/50 border-gray-700 hover:border-gray-500"
              }
            `}
            style={{
              borderColor: isActive ? category.color : undefined,
              backgroundColor: isActive ? `${category.color}20` : undefined,
              boxShadow: isActive ? `0 0 20px ${category.color}40` : undefined,
            }}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span>{category.name}</span>
            <span className="text-xs opacity-70">({total.toLocaleString()})</span>
          </button>
        );
      })}
    </div>
  );
}
