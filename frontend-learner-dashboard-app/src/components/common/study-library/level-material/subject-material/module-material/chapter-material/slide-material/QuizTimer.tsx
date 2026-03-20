import React, { useEffect, useRef, useState } from "react";

interface QuizTimerProps {
  totalSeconds: number;
  onExpire: () => void;
  onWarn: () => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const QuizTimer: React.FC<QuizTimerProps> = ({ totalSeconds, onExpire, onWarn }) => {
  const [remaining, setRemaining] = useState(totalSeconds);
  const warnFiredRef = useRef(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (totalSeconds <= 0) return;
    setRemaining(totalSeconds);
    warnFiredRef.current = false;
    expiredRef.current = false;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;

        if (next === 30 && !warnFiredRef.current) {
          warnFiredRef.current = true;
          onWarn();
        }

        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          clearInterval(interval);
          onExpire();
          return 0;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeconds]);

  const isWarning = remaining <= 120; // orange when ≤ 2 min

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-semibold ${
        isWarning
          ? "border-orange-300 bg-orange-50 text-orange-700"
          : "border-gray-200 bg-white text-slate-700"
      }`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {formatTime(remaining)}
    </div>
  );
};

export default QuizTimer;
