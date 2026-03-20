import React from "react";

interface Stat {
  label: string;
  value?: string;
}

interface StatGroup {
  description: string;
  stats: Stat[];
}

interface StatsHighlightsProps {
  headerText: string;
  description?: string;
  stats?: Stat[];
  groups?: StatGroup[];
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
  groups,
  styles = {},
}) => {
  const { hoverEffect = "none" } = styles;

  const getHoverClass = () => {
    switch (hoverEffect) {
      case "scale":
        return "hover:scale-[1.02]";
      case "shadow":
        return "hover:border-gray-300";
      default:
        return "";
    }
  };

  // Helper function to parse label and extract numeric part
  const parseLabel = (label: string) => {
    const spaceIndex = label.indexOf(' ');
    if (spaceIndex === -1) {
      return { numericPart: '', textPart: label };
    }
    const numericPart = label.substring(0, spaceIndex);
    const textPart = label.substring(spaceIndex + 1);
    return { numericPart, textPart };
  };

  const renderStat = (stat: Stat, index: number) => {
    const { numericPart, textPart } = parseLabel(stat.label);
    
    // NEUTRAL background with PRIMARY accent for numbers
    const baseClasses = `text-center p-4 sm:p-5 bg-white border border-gray-200 rounded-lg transition-all duration-200 ${getHoverClass()}`;

    return (
      <div key={index} className={baseClasses}>
        {/* PRIMARY ACCENT: Stat value/number */}
        {stat.value && (
          <div className="text-xl sm:text-2xl font-bold text-primary-600 mb-1">
            {stat.value}
          </div>
        )}
        {numericPart && (
          <div className="text-lg sm:text-xl font-bold text-primary-600 mb-0.5">
            {numericPart}
          </div>
        )}
        {/* NEUTRAL: Description text */}
        <div className="text-xs sm:text-sm text-gray-600">
          {textPart}
        </div>
      </div>
    );
  };

  const useGroupsFormat = groups && groups.length > 0;
  const displayStats = useGroupsFormat ? groups.flatMap(group => group.stats) : (stats || []);

  return (
    // NEUTRAL: Section background
    <section className="w-full py-6 sm:py-8 bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6">
          {/* PRIMARY ACCENT: Section heading */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2">
            {headerText}
          </h2>
          {/* NEUTRAL: Description */}
          {!useGroupsFormat && description && (
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>

        {/* Render Groups or Single Stats */}
        {useGroupsFormat ? (
          <div className="space-y-6">
            {groups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6"
              >
                {/* Group Description */}
                <div className="text-center mb-4">
                  {/* PRIMARY ACCENT: Group heading */}
                  <h3 className="text-sm sm:text-base font-medium text-primary-700">
                    {group.description}
                  </h3>
                </div>
                
                {/* Group Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {group.stats.map((stat, index) => renderStat(stat, index))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Legacy Single Stats Format */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {displayStats.map((stat, index) => renderStat(stat, index))}
          </div>
        )}
      </div>
    </section>
  );
};
