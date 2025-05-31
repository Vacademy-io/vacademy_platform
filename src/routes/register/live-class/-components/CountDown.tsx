import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';

interface TimerProps {
  startTime: string; // e.g., "2025-05-22T14:30:00"
}

const CountdownTimer: React.FC<TimerProps> = ({ startTime }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = dayjs();
      const start = dayjs(startTime); // or dayjs(`${startTime}Z`) if UTC
      const diff = start.diff(now);

      if (diff <= 0) {
        setTimeLeft("Class has started");
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className='flex flex-row gap-2'>
      <div className="text-primary-500">Class starts in</div>
      <div>{timeLeft}</div>
    </div>
  );
};

export default CountdownTimer;
