import React from "react";
import { useDomainRouting } from "@/hooks/use-domain-routing";

interface Stat {
  label: string;
  value?: string; // Optional for backward compatibility
}

interface StatGroup {
  description: string;
  stats: Stat[];
}

interface StatsHighlightsProps {
  headerText: string;
  description?: string; // Optional for backward compatibility
  stats?: Stat[]; // Optional for backward compatibility
  groups?: StatGroup[]; // New structure for multiple groups
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
  style,
  styles = {},
}) => {
  const domainRouting = useDomainRouting();
  const {
    backgroundColor = "#ffffff",
    textColor = "#111827",
    hoverEffect = "scale",
  } = styles;

  // Get primary color for numeric parts
  const primaryColor = domainRouting.instituteThemeCode ? `hsl(var(--primary))` : "#3b82f6";
  
  // Debug logging
  console.log("[StatsHighlightsComponent] Primary color debug:", {
    domainRouting: domainRouting.instituteThemeCode,
    primaryColor,
    groups: groups?.length || 0
  });

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

  // Helper function to parse label and extract numeric part
  const parseLabel = (label: string) => {
    const spaceIndex = label.indexOf(' ');
    if (spaceIndex === -1) {
      // No space found, return the whole label as text
      return { numericPart: '', textPart: label };
    }
    
    const numericPart = label.substring(0, spaceIndex);
    const textPart = label.substring(spaceIndex + 1);
    
    return { numericPart, textPart };
  };

  const renderStat = (stat: Stat, index: number) => {
    const { numericPart, textPart } = parseLabel(stat.label);
    
    if (style === "circle") {
      return (
        <div
          key={index}
          className={`text-center p-8 rounded-2xl bg-white shadow-md transition-all duration-300 ${getHoverClass()}`}
        >
          {stat.value && (
            <div className="text-3xl font-bold mb-2" style={{ color: primaryColor }}>
              {stat.value}
            </div>
          )}
          <div className="text-sm font-medium text-gray-600">
            {numericPart && (
              <div className="text-2xl font-bold mb-1" style={{ color: primaryColor }}>
                {numericPart}
              </div>
            )}
            <div className="text-sm text-gray-600">
              {textPart}
            </div>
          </div>
        </div>
      );
    } else if (style === "card") {
      return (
        <div
          key={index}
          className={`text-center p-8 bg-white rounded-2xl shadow-md transition-all duration-300 ${getHoverClass()}`}
        >
          {stat.value && (
            <div className="text-3xl font-bold mb-2" style={{ color: primaryColor }}>
              {stat.value}
            </div>
          )}
          <div className="text-sm font-medium text-gray-600">
            {numericPart && (
              <div className="text-2xl font-bold mb-1" style={{ color: primaryColor }}>
                {numericPart}
              </div>
            )}
            <div className="text-sm text-gray-600">
              {textPart}
            </div>
          </div>
        </div>
      );
    } else {
      // minimal style
      return (
        <div
          key={index}
          className={`text-center p-6 rounded-2xl bg-white shadow-sm transition-all duration-300 ${getHoverClass()}`}
        >
          {stat.value && (
            <div className="text-2xl font-bold mb-1" style={{ color: primaryColor }}>
              {stat.value}
            </div>
          )}
          <div className="text-sm text-gray-600">
            {numericPart && (
              <div className="text-xl font-bold style={{ color: primaryColor }} mb-1">
                {numericPart}
              </div>
            )}
            <div className="text-sm text-gray-600">
              {textPart}
            </div>
          </div>
        </div>
      );
    }
  };

  // Determine if we're using the new groups format or the old single format
  const useGroupsFormat = groups && groups.length > 0;
  const displayStats = useGroupsFormat ? groups.flatMap(group => group.stats) : (stats || []);

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
          {!useGroupsFormat && description && (
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>

        {/* Render Groups or Single Stats */}
        {useGroupsFormat ? (
          <div className="space-y-8">
            {groups.map((group, groupIndex) => {
              // Different light background colors for each group
              const groupBackgrounds = [
                "bg-blue-50", // Light blue
                "bg-green-50", // Light green  
                "bg-purple-50", // Light purple
                "bg-yellow-50", // Light yellow
                "bg-pink-50", // Light pink
                "bg-indigo-50", // Light indigo
              ];
              const groupBackground = groupBackgrounds[groupIndex % groupBackgrounds.length];
              
              return (
                <div key={groupIndex} className={`${groupBackground} rounded-2xl p-8 space-y-8`}>
                  {/* Group Description */}
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">
                      {group.description}
                    </h3>
                  </div>
                  
                  {/* Group Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.stats.map((stat, index) => renderStat(stat, index))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Legacy Single Stats Format */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayStats.map((stat, index) => renderStat(stat, index))}
          </div>
        )}
      </div>
    </section>
  );
};
