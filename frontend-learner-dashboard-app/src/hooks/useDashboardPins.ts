import { useEffect, useRef, useCallback, useState } from 'react';
import { useAnnouncementStore } from '@/stores/announcement-store';
import { getStudentDisplaySettings } from '@/services/student-display-settings';
import { useAnalytics } from './useAnalytics';

interface UseDashboardPinsOptions {
  enablePolling?: boolean;
  pollingInterval?: number; // in milliseconds
  autoMarkAsRead?: boolean;
}

export const useDashboardPins = (options: UseDashboardPinsOptions = {}) => {
  const {
    enablePolling = true,
    pollingInterval = 15000, // 15 seconds
    autoMarkAsRead = true,
  } = options;

  const {
    dashboardPins,
    fetchDashboardPins,
    markPinAsRead,
    dismissDashboardPin,
    dismissAllDashboardPins,
  } = useAnnouncementStore();

  const { track } = useAnalytics();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Check if dashboard pins are enabled in student display settings
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    const checkSettings = async () => {
      try {
        setIsLoadingSettings(true);
        const settings = await getStudentDisplaySettings();
        setIsEnabled(settings.notifications.allowDashboardPins);
      } catch (error) {
        console.error('Failed to load student display settings:', error);
        setIsEnabled(true); // Default to enabled if settings fail to load
      } finally {
        setIsLoadingSettings(false);
      }
    };

    checkSettings();
  }, []);

  // Start polling for dashboard pins
  const startPolling = useCallback(() => {
    if (!enablePolling || !isEnabled) return;

    const poll = async () => {
      try {
        await fetchDashboardPins();
      } catch (error) {
        console.error('Error polling dashboard pins:', error);
      }
    };

    // Initial fetch
    poll();

    // Set up polling interval
    pollingRef.current = setInterval(poll, pollingInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enablePolling, isEnabled, pollingInterval, fetchDashboardPins]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Mark pin as read
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await markPinAsRead(messageId);
      track('Dashboard Pin Clicked', { messageId });
    } catch (error) {
      console.error('Failed to mark pin as read:', error);
    }
  }, [markPinAsRead, track]);

  // Refresh pins
  const refresh = useCallback(async () => {
    try {
      await fetchDashboardPins();
    } catch (error) {
      console.error('Failed to refresh dashboard pins:', error);
    }
  }, [fetchDashboardPins]);

  const dismiss = useCallback(async (messageId: string) => {
    try {
      await dismissDashboardPin(messageId);
      track('Dashboard Pin Dismissed', { messageId });
    } catch (error) {
      console.error('Failed to dismiss dashboard pin:', error);
    }
  }, [dismissDashboardPin, track]);

  const dismissAll = useCallback(async () => {
    try {
      await dismissAllDashboardPins();
      track('Dashboard Pins Cleared');
    } catch (error) {
      console.error('Failed to dismiss all dashboard pins:', error);
    }
  }, [dismissAllDashboardPins, track]);

  // Get active pins (filter out expired ones)
  const getActivePins = useCallback(() => {
    const now = new Date();
    return dashboardPins.items.filter(pin => {
      if (!pin.pinEndTime) return true;
      const endTime = new Date(pin.pinEndTime);
      return endTime > now;
    }).sort((a, b) => {
      // Sort by priority (HIGH > MEDIUM > LOW) then by creation date (newest first)
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const aPriority = priorityOrder[a.priority || 'LOW'] || 1;
      const bPriority = priorityOrder[b.priority || 'LOW'] || 1;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [dashboardPins.items]);

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (isEnabled && enablePolling) {
      const cleanup = startPolling();
      return cleanup;
    } else {
      stopPolling();
    }
  }, [isEnabled, enablePolling, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // State
    pins: getActivePins(),
    allPins: dashboardPins.items,
    loading: dashboardPins.loading || isLoadingSettings,
    error: dashboardPins.error,
    isEnabled,
    isLoadingSettings,

    // Actions
    markAsRead,
    dismiss,
    dismissAll,
    refresh,
    startPolling,
    stopPolling,
  };
};
