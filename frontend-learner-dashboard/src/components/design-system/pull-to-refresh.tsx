// components/ui/PullToRefreshWrapper.tsx
import { ReactNode, useRef, useState } from "react";
import { DashboardLoader } from "../core/dashboard-loader";

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export const PullToRefreshWrapper = ({
  onRefresh,
  children,
}: PullToRefreshWrapperProps) => {
  const startY = useRef<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = async (e: React.TouchEvent) => {
    if (startY.current !== null && !isRefreshing) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 80) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            startY.current = null;
          }, 1000); // give a tiny delay for smooth UX
        }
      }
    }
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      {isRefreshing && <DashboardLoader />}
      {children}
    </div>
  );
};
