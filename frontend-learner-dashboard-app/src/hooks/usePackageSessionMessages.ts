import { useEffect, useRef, useCallback, useState } from 'react';
import { useAnnouncementStore } from '@/stores/announcement-store';
import { getStudentDisplaySettings } from '@/services/student-display-settings';
import { useAnalytics } from './useAnalytics';

interface UsePackageSessionMessagesOptions {
  packageSessionId: string;
  enablePolling?: boolean;
  pollingInterval?: number; // in milliseconds
  autoMarkAsRead?: boolean;
  markAsReadDelay?: number; // in milliseconds
}

export const usePackageSessionMessages = (options: UsePackageSessionMessagesOptions) => {
  const {
    packageSessionId,
    enablePolling = true,
    pollingInterval = 15000, // 15 seconds
    autoMarkAsRead = true,
    markAsReadDelay = 1000, // 1 second
  } = options;

  const {
    packageSessionMessages,
    fetchStreamMessages,
    fetchCommunityMessages,
    markStreamMessageAsRead,
    markCommunityMessageAsRead,
    fetchMessageReplies,
    createReply,
  } = useAnnouncementStore();

  const { track } = useAnalytics();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibleMessagesRef = useRef<Set<string>>(new Set());

  // Check if batch stream is enabled in student display settings
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const currentState = packageSessionMessages[packageSessionId];
  const globalCommunityState = packageSessionMessages['global'];

  useEffect(() => {
    const checkSettings = async () => {
      try {
        setIsLoadingSettings(true);
        const settings = await getStudentDisplaySettings();
        setIsEnabled(settings.notifications.allowBatchStream);
      } catch (error) {
        console.error('Failed to load student display settings:', error);
        setIsEnabled(true); // Default to enabled if settings fail to load
      } finally {
        setIsLoadingSettings(false);
      }
    };

    checkSettings();
  }, []);

  // Start polling for package session messages
  const startPolling = useCallback(() => {
    if (!enablePolling || !isEnabled) return;

    const poll = async () => {
      try {
        await fetchStreamMessages(packageSessionId, { page: 0, size: 20 });
      } catch (error) {
        console.error('Error polling package session messages:', error);
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
  }, [enablePolling, isEnabled, pollingInterval, packageSessionId, fetchStreamMessages, fetchCommunityMessages]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Handle message visibility for auto mark-as-read
  const handleMessageVisibility = useCallback((messageId: string, modeType: 'STREAM' | 'COMMUNITY', isVisible: boolean) => {
    if (!autoMarkAsRead) return;

    if (isVisible) {
      visibleMessagesRef.current.add(messageId);
      
      // Set timeout to mark as read after delay
      markAsReadTimeoutRef.current = setTimeout(async () => {
        try {
          if (modeType === 'STREAM') {
            await markStreamMessageAsRead(packageSessionId, messageId);
            track('Stream Message Viewed', { messageId, packageSessionId });
          } else {
            await markCommunityMessageAsRead(packageSessionId, messageId);
            track('Community Message Viewed', { messageId, packageSessionId });
          }
        } catch (error) {
          console.error('Failed to mark message as read:', error);
        }
      }, markAsReadDelay);
    } else {
      visibleMessagesRef.current.delete(messageId);
      
      // Clear timeout if message is no longer visible
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
        markAsReadTimeoutRef.current = null;
      }
    }
  }, [autoMarkAsRead, markAsReadDelay, packageSessionId, markStreamMessageAsRead, markCommunityMessageAsRead, track]);

  // Manual mark as read
  const markAsRead = useCallback(async (messageId: string, modeType: 'STREAM' | 'COMMUNITY') => {
    try {
      if (modeType === 'STREAM') {
        await markStreamMessageAsRead(packageSessionId, messageId);
        track('Stream Message Marked as Read', { messageId, packageSessionId });
      } else {
        await markCommunityMessageAsRead(packageSessionId, messageId);
        track('Community Message Marked as Read', { messageId, packageSessionId });
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  }, [packageSessionId, markStreamMessageAsRead, markCommunityMessageAsRead, track]);

  // Load more stream messages
  const loadMoreStreamMessages = useCallback(async () => {
    if (!currentState?.stream.hasMore || currentState.stream.loading) return;

    try {
      await fetchStreamMessages(packageSessionId, {
        page: currentState.stream.currentPage + 1,
        size: 20,
      });
      track('Stream Messages Load More', { packageSessionId });
    } catch (error) {
      console.error('Failed to load more stream messages:', error);
    }
  }, [currentState?.stream, packageSessionId, fetchStreamMessages, track]);

  // Load more community messages
  const loadMoreCommunityMessages = useCallback(async () => {
    if (!globalCommunityState?.discussion.hasMore || globalCommunityState.discussion.loading) return;

    try {
      await fetchCommunityMessages({
        page: globalCommunityState.discussion.currentPage + 1,
        size: 20,
      });
      track('Community Messages Load More', { packageSessionId });
    } catch (error) {
      console.error('Failed to load more community messages:', error);
    }
  }, [globalCommunityState?.discussion, packageSessionId, fetchCommunityMessages, track]);

  // Fetch stream messages with filters
  const fetchStream = useCallback(async (filters?: { streamType?: 'LIVE' | 'RECORDED'; page?: number; size?: number }) => {
    try {
      await fetchStreamMessages(packageSessionId, filters);
    } catch (error) {
      console.error('Failed to fetch stream messages:', error);
    }
  }, [packageSessionId, fetchStreamMessages]);

  // Fetch community messages with filters
  const fetchCommunity = useCallback(async (filters?: { communityType?: 'SCHOOL' | 'CLASS'; tag?: string; page?: number; size?: number }) => {
    try {
      await fetchCommunityMessages(filters);
    } catch (error) {
      console.error('Failed to fetch community messages:', error);
    }
  }, [fetchCommunityMessages]);

  // Fetch message replies
  const fetchReplies = useCallback(async (announcementId: string, filters?: { page?: number; size?: number }) => {
    try {
      await fetchMessageReplies(announcementId, filters);
    } catch (error) {
      console.error('Failed to fetch message replies:', error);
    }
  }, [fetchMessageReplies]);

  // Create reply
  const postReply = useCallback(async (announcementId: string, content: string, parentReplyId?: string) => {
    try {
      await createReply(announcementId, content, parentReplyId);
      track('Reply Posted', { announcementId, parentReplyId });
    } catch (error) {
      console.error('Failed to post reply:', error);
    }
  }, [createReply, track]);

  // Refresh all messages
  const refresh = useCallback(async () => {
    try {
      await fetchStreamMessages(packageSessionId, { page: 0, size: 20 });
    } catch (error) {
      console.error('Failed to refresh messages:', error);
    }
  }, [packageSessionId, fetchStreamMessages]);

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
    stream: currentState?.stream || { items: [], loading: false, error: null, hasMore: true, currentPage: 0 },
    discussion: globalCommunityState?.discussion || { items: [], loading: false, error: null, hasMore: true, currentPage: 0 },
    loading: isLoadingSettings,
    isEnabled,
    isLoadingSettings,

    // Actions
    markAsRead,
    handleMessageVisibility,
    loadMoreStreamMessages,
    loadMoreCommunityMessages,
    fetchStream,
    fetchCommunity,
    fetchReplies,
    postReply,
    refresh,
    startPolling,
    stopPolling,
  };
};
