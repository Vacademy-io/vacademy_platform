import React from "react";

interface Stat {
  label: string;
  value: string;
}

interface StatsHighlightsProps {
  headerText: string;
  description: string;
  stats: Stat[];
  style: "circle" | "card" | "minimal";
  styles?: {
    backgroundColor?: string;
    textColor?: string;
    hoverEffect?: "scale" | "shadow" | "none";
  };
}

export const StatsHighlightsComponent: React.FC<StatsHighlightsProps> = ({
  headerText,
  description,
  stats,
  style,
  styles = {},
}) => {
  const {
    backgroundColor = "#ffffff",
    textColor = "#111827",
    hoverEffect = "scale",
  } = styles;

  const getHoverClass = () => {
    switch (hoverEffect) {
      case "scale":
        return "hover:scale-105";
      case "shadow":
        return "hover:shadow-lg";
      default:
        return "";
    }
  };

  const renderStat = (stat: Stat, index: number) => {
    if (style === "circle") {
      return (
        <div
          key={index}
          className={`text-center p-6 rounded-full bg-white shadow-md transition-all duration-300 ${getHoverClass()}`}
        >
          <div className="text-3xl font-bold text-primary-600 mb-2">
            {stat.value}
          </div>
          <div className="text-sm font-medium text-gray-600">
            {stat.label}
          </div>
        </div>
      );
    } else if (style === "card") {
      return (
        <div
          key={index}
          className={`text-center p-6 bg-white rounded-lg shadow-md transition-all duration-300 ${getHoverClass()}`}
        >
          <div className="text-3xl font-bold text-primary-600 mb-2">
            {stat.value}
          </div>
          <div className="text-sm font-medium text-gray-600">
            {stat.label}
          </div>
        </div>
      );
    } else {
      // minimal style
      return (
        <div
          key={index}
          className={`text-center p-4 transition-all duration-300 ${getHoverClass()}`}
        >
          <div className="text-2xl font-bold text-primary-600 mb-1">
            {stat.value}
          </div>
          <div className="text-sm text-gray-600">
            {stat.label}
          </div>
        </div>
      );
    }
  };

  return (
    <section
      className="w-full py-12"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4" style={{ color: textColor }}>
            {headerText}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, index) => renderStat(stat, index))}
        </div>
      </div>
    </section>
  );
};
