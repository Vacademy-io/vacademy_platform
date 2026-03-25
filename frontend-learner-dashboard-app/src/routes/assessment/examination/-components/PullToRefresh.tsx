import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const THRESHOLD = 80; // Distance required to trigger refresh

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Only enable pull-to-refresh when scrolled to top
    if (containerRef?.current?.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setIsDragging(true);
    }
  };

  interface TouchMoveEvent extends React.TouchEvent<HTMLDivElement> {
    touches: React.TouchList & { [index: number]: Touch };
  }

  const handleTouchMove = (e: TouchMoveEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    // Only allow pulling down, not up
    if (distance > 0) {
      // Add resistance to the pull
      setPullDistance(Math.min(distance * 0.4, THRESHOLD));
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging) return;

    setIsDragging(false);
    
    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
  };

  // Calculate rotation based on pull distance
  const rotation = (pullDistance / THRESHOLD) * 360;
  
  return (
    <div 
      ref={containerRef}
      className="h-full overflow-auto touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="relative transition-transform duration-200 ease-out"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {/* Loader */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 -top-8 transition-opacity duration-200"
          style={{ 
            opacity: pullDistance / THRESHOLD,
          }}
        >
          <Loader2 
            className="transition-transform"
            style={{ 
              transform: `rotate(${rotation}deg)`,
            }}
          />
        </div>
        
        {/* Content */}
        <div className={isRefreshing ? 'opacity-50' : ''}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default PullToRefresh;