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
  style?: "circle" | "card" | "minimal";
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
  style: displayStyle = "card",
  styles = {},
}) => {
  const { backgroundColor, textColor, hoverEffect = "none" } = styles;

  const hoverClass =
    hoverEffect === "scale" ? "hover:scale-[1.03] hover:shadow-lg" :
    hoverEffect === "shadow" ? "hover:shadow-lg" : "";

  const renderStat = (stat: Stat, index: number) => {
    // If stat has an explicit `value` field, use it as the big number and `label` as the description.
    // Otherwise, try to detect a leading number in the label (e.g. "5000+ Sessions Led").
    let bigValue = stat.value || "";
    let labelText = stat.label || "";

    if (!bigValue && labelText) {
      // Try to extract a leading number/metric: "5000+ Sessions Led" → value="5000+", label="Sessions Led"
      const match = labelText.match(/^([\d,.]+[+%]?)\s+(.+)$/);
      if (match) {
        bigValue = match[1]!;
        labelText = match[2]!;
      }
    }

    if (displayStyle === "minimal") {
      return (
        <div key={index} className={`text-center p-4 transition-all duration-200 ${hoverClass}`}>
          {bigValue && (
            <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ color: textColor || 'var(--primary-500, #3B82F6)' }}>
              {bigValue}
            </div>
          )}
          <div className="text-sm sm:text-base text-gray-600">{labelText}</div>
        </div>
      );
    }

    if (displayStyle === "circle") {
      return (
        <div key={index} className={`flex flex-col items-center text-center p-4 transition-all duration-200 ${hoverClass}`}>
          <div
            className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-4 mb-3"
            style={{ borderColor: textColor || 'var(--primary-500, #3B82F6)' }}
          >
            <span className="text-2xl sm:text-3xl font-bold" style={{ color: textColor || 'var(--primary-500, #3B82F6)' }}>
              {bigValue || labelText}
            </span>
          </div>
          {bigValue && <div className="text-sm sm:text-base text-gray-600">{labelText}</div>}
        </div>
      );
    }

    // Card style (default)
    return (
      <div key={index} className={`text-center p-5 sm:p-6 bg-white border border-gray-200 rounded-xl transition-all duration-200 ${hoverClass}`}>
        {bigValue && (
          <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ color: textColor || 'var(--primary-500, #3B82F6)' }}>
            {bigValue}
          </div>
        )}
        <div className="text-sm sm:text-base text-gray-600 font-medium">{labelText}</div>
      </div>
    );
  };

  const useGroupsFormat = groups && groups.length > 0;

  return (
    <section className="w-full py-10 sm:py-14" style={{ backgroundColor: backgroundColor || '#f8fafc' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {headerText}
          </h2>
          {!useGroupsFormat && description && (
            <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>

        {/* Render Groups or Single Stats */}
        {useGroupsFormat ? (
          <div className="space-y-8">
            {groups!.map((group, groupIndex) => (
              <div key={groupIndex} className="bg-white border border-gray-200 rounded-xl p-5 sm:p-8">
                <div className="text-center mb-5">
                  <h3 className="text-base sm:text-lg font-semibold" style={{ color: textColor || 'var(--primary-500, #3B82F6)' }}>
                    {group.description}
                  </h3>
                </div>
                <div className={`grid gap-4 sm:gap-5 ${
                  group.stats.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' :
                  group.stats.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' :
                  'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                }`}>
                  {group.stats.map((stat, index) => renderStat(stat, index))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid gap-4 sm:gap-6 ${
            (stats || []).length <= 3 ? 'grid-cols-1 sm:grid-cols-3 max-w-3xl mx-auto' :
            (stats || []).length <= 4 ? 'grid-cols-2 sm:grid-cols-4 max-w-4xl mx-auto' :
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          }`}>
            {(stats || []).map((stat, index) => renderStat(stat, index))}
          </div>
        )}
      </div>
    </section>
  );
};
