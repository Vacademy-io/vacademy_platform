import { useEffect, useRef, useCallback, useState } from 'react';
import { useAnnouncementStore } from '@/stores/announcement-store';
import { getStudentDisplaySettings } from '@/services/student-display-settings';
import { useAnalytics } from './useAnalytics';

interface UseSystemAlertsOptions {
  enablePolling?: boolean;
  pollingInterval?: number; // in milliseconds
  autoMarkAsRead?: boolean;
  markAsReadDelay?: number; // in milliseconds
}

export const useSystemAlerts = (options: UseSystemAlertsOptions = {}) => {
  const {
    enablePolling = true,
    pollingInterval = 300000, // 5 minutes
    autoMarkAsRead = true,
    markAsReadDelay = 1000, // 1 second
  } = options;

  const {
    systemAlerts,
    fetchSystemAlerts,
    fetchSystemAlertUnreadCount,
    markAlertAsRead,
    dismissAlert,
    dismissAllAlerts,
  } = useAnnouncementStore();

  const { track } = useAnalytics();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibleAlertsRef = useRef<Set<string>>(new Set());

  // Check if system alerts are enabled in student display settings
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    const checkSettings = async () => {
      try {
        setIsLoadingSettings(true);
        const settings = await getStudentDisplaySettings();
        setIsEnabled(settings.notifications.allowSystemAlerts);
      } catch (error) {
        console.error('Failed to load student display settings:', error);
        setIsEnabled(true); // Default to enabled if settings fail to load
      } finally {
        setIsLoadingSettings(false);
      }
    };

    checkSettings();
  }, []);

  // Start polling for system alerts
  const startPolling = useCallback(() => {
    if (!enablePolling || !isEnabled) return;

    const poll = async () => {
      try {
        await Promise.all([
          fetchSystemAlerts({ page: 0, size: 10 }),
          fetchSystemAlertUnreadCount(),
        ]);
      } catch (error) {
        console.error('Error polling system alerts:', error);
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
  }, [enablePolling, isEnabled, pollingInterval, fetchSystemAlerts, fetchSystemAlertUnreadCount]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Handle alert visibility for auto mark-as-read
  const handleAlertVisibility = useCallback((messageId: string, isVisible: boolean) => {
    if (!autoMarkAsRead) return;

    if (isVisible) {
      visibleAlertsRef.current.add(messageId);
      
      // Set timeout to mark as read after delay
      markAsReadTimeoutRef.current = setTimeout(async () => {
        try {
          await markAlertAsRead(messageId);
          track('System Alert Viewed', { messageId, modeType: 'SYSTEM_ALERT' });
        } catch (error) {
          console.error('Failed to mark alert as read:', error);
        }
      }, markAsReadDelay);
    } else {
      visibleAlertsRef.current.delete(messageId);
      
      // Clear timeout if alert is no longer visible
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
        markAsReadTimeoutRef.current = null;
      }
    }
  }, [autoMarkAsRead, markAsReadDelay, markAlertAsRead, track]);

  // Manual mark as read
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await markAlertAsRead(messageId);
      track('System Alert Marked as Read', { messageId });
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  }, [markAlertAsRead, track]);

  // Dismiss alert
  const dismiss = useCallback(async (messageId: string) => {
    try {
      await dismissAlert(messageId);
      track('System Alert Dismissed', { messageId });
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  }, [dismissAlert, track]);

  // Dismiss all alerts
  const dismissAll = useCallback(async () => {
    try {
      await dismissAllAlerts();
      track('System Alerts Dismissed All', { count: systemAlerts.items.length });
    } catch (error) {
      console.error('Failed to dismiss all alerts:', error);
    }
  }, [dismissAllAlerts, track, systemAlerts.items.length]);

  // Load more alerts
  const loadMore = useCallback(async () => {
    if (systemAlerts.loading || !systemAlerts.hasMore) return;

    try {
      await fetchSystemAlerts({
        page: systemAlerts.currentPage + 1,
        size: 10,
      });
    } catch (error) {
      console.error('Failed to load more alerts:', error);
    }
  }, [systemAlerts.loading, systemAlerts.hasMore, systemAlerts.currentPage, fetchSystemAlerts]);

  // Refresh alerts
  const refresh = useCallback(async () => {
    try {
      await Promise.all([
        fetchSystemAlerts({ page: 0, size: 10 }),
        fetchSystemAlertUnreadCount(),
      ]);
    } catch (error) {
      console.error('Failed to refresh alerts:', error);
    }
  }, [fetchSystemAlerts, fetchSystemAlertUnreadCount]);

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
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [stopPolling]);

  return {
    // State
    alerts: systemAlerts.items,
    unreadCount: systemAlerts.unreadCount,
    loading: systemAlerts.loading || isLoadingSettings,
    error: systemAlerts.error,
    hasMore: systemAlerts.hasMore,
    isEnabled,
    isLoadingSettings,

    // Actions
    markAsRead,
    dismiss,
    dismissAll,
    loadMore,
    refresh,
    handleAlertVisibility,
    startPolling,
    stopPolling,
  };
};
