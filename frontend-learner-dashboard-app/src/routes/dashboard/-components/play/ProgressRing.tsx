import React from "react";

interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  className?: string;
  showLabel?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 48,
  strokeWidth = 4,
  color = "hsl(var(--play-green))",
  bgColor = "hsl(var(--primary-100))",
  className = "",
  showLabel = true,
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <span
          className="absolute text-xs font-bold"
          style={{ color, fontSize: size * 0.22 }}
        >
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
};
