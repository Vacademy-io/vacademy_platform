import { useEffect, useState } from "react";

interface CountdownTimerProps {
  startTime: string;
  waitingRoomTime: number;
}

export function CountdownTimer({
  startTime,
  waitingRoomTime,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const sessionStart = new Date(startTime);
      const waitingRoomStart = new Date(sessionStart);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - waitingRoomTime
      );

      // If we're before the waiting room starts
      if (now < waitingRoomStart) {
        return null;
      }

      // If we're past the session start
      if (now >= sessionStart) {
        return null;
      }

      const difference = sessionStart.getTime() - now.getTime();

      return {
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      // If time is up, clear the interval
      if (!newTimeLeft) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, waitingRoomTime]);

  if (!timeLeft) {
    return null;
  }

  return (
    <div className="text-center">
      <div className="flex justify-center gap-4">
        <div className="flex flex-col items-center">
          <div className="text-3xl font-bold border-2 p-3 px-4 rounded">
            {String(timeLeft.hours).padStart(2, "0")}
          </div>
          <div className="text-sm text-gray-500 mt-2">Hours</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-3xl font-bold border-2 p-3 px-4 rounded">
            {String(timeLeft.minutes).padStart(2, "0")}
          </div>
          <div className="text-sm text-gray-500 mt-2">Minutes</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-3xl font-bold border-2 p-3 px-4 rounded">
            {String(timeLeft.seconds).padStart(2, "0")}
          </div>
          <div className="text-sm text-gray-500 mt-2">Seconds</div>
        </div>
      </div>
    </div>
  );
}
