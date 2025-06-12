import React, { useEffect, useState } from "react";
import dayjs from "dayjs";

interface TimerProps {
  startTime: string; // e.g., "2025-06-16T11:00:00"
}

const CountdownTimer: React.FC<TimerProps> = ({ startTime }) => {
  const calculateTimeLeft = () => {
    if (!startTime) {
      return null;
    }
    const now = dayjs();
    const start = dayjs(startTime);

    if (!start.isValid() || now.isAfter(start)) {
      return null;
    }

    const diff = start.diff(now);

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  if (!timeLeft) {
    return (
      <div className="flex flex-row gap-2">
        <div className="text-primary-500">Class has started</div>
      </div>
    );
  }

  return (
    <div className="flex flex-row items-center gap-3">
      <div className="text-primary-500 text-lg">Class starts in</div>
      <div className="flex flex-row items-baseline justify-center gap-1 text-center">
        {timeLeft.days > 0 && (
          <>
            <span className="font-bold">{String(timeLeft.days)}</span>
            <span className="text-xs text-gray-500 mr-2">Days</span>
          </>
        )}
        <span className="font-bold">
          {String(timeLeft.hours).padStart(2, "0")}
        </span>
        <span className="text-xs text-gray-500 mr-2">Hours</span>
        <span className="font-bold">
          {String(timeLeft.minutes).padStart(2, "0")}
        </span>
        <span className="text-xs text-gray-500 mr-2">Mins</span>
        <span className="font-bold">
          {String(timeLeft.seconds).padStart(2, "0")}
        </span>
        <span className="text-xs text-gray-500">Secs</span>
      </div>
    </div>
  );
};

export default CountdownTimer;
