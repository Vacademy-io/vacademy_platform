import axios from 'axios';
import { toast } from 'sonner';
import { BASE_URL } from '@/constants/urls';
import type {
  UserMessage,
  UserMessagesResponse,
  UnreadCountResponse,
  MessageReply,
  MessageRepliesResponse,
  CreateReplyRequest,
  MessageInteractionRequest,
  SystemAlertsFilters,
  StreamMessagesFilters,
  CommunityMessagesFilters,
  RepliesFilters,
  ModeType,
  InteractionType,
} from '@/types/announcement';

// Base configuration for notification service API
const NOTIFICATION_SERVICE_BASE = `${BASE_URL}/notification-service/v1`;

// Create axios instance for notification service (no JWT required)
const notificationApi = axios.create({
  baseURL: NOTIFICATION_SERVICE_BASE,
  timeout: 10000,
});

// Helper function to get user context
const getUserContext = async () => {
  const { Preferences } = await import('@capacitor/preferences');
  
  const [studentDetails, instituteDetails] = await Promise.all([
    Preferences.get({ key: 'StudentDetails' }),
    Preferences.get({ key: 'InstituteDetails' }),
  ]);

  const student = studentDetails.value ? JSON.parse(studentDetails.value) : null;
  const institute = instituteDetails.value ? JSON.parse(instituteDetails.value) : null;

  return {
    userId: student?.user_id,
    instituteId: institute?.id,
  };
};

// Helper function to handle API errors
const handleApiError = (error: unknown, operation: string) => {
  console.error(`Error in ${operation}:`, error);
  const message = error instanceof Error ? error.message : 
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 
    `Failed to ${operation}`;
  toast.error(message);
  throw error;
};

// System Alerts API
export const getSystemAlerts = async (filters: SystemAlertsFilters = {}) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const params = new URLSearchParams();
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.size !== undefined) params.append('size', filters.size.toString());

    const response = await notificationApi.get<UserMessagesResponse>(
      `/user-messages/user/${userId}/system-alerts?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch system alerts');
  }
};

export const getSystemAlertUnreadCount = async () => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const response = await notificationApi.get<UnreadCountResponse>(
      `/user-messages/user/${userId}/unread-count?modeType=SYSTEM_ALERT`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch unread count');
  }
};

// Dashboard Pins API
export const getDashboardPins = async () => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const response = await notificationApi.get<UserMessage[]>(
      `/user-messages/user/${userId}/dashboard-pins`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch dashboard pins');
  }
};

// Stream Messages API
export const getStreamMessages = async (
  packageSessionId: string,
  filters: StreamMessagesFilters = {}
) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const params = new URLSearchParams();
    if (filters.streamType) params.append('streamType', filters.streamType);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.size !== undefined) params.append('size', filters.size.toString());

    const response = await notificationApi.get<UserMessagesResponse>(
      `/user-messages/user/${userId}/streams/${packageSessionId}?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch stream messages');
  }
};

// Community Messages API
export const getCommunityMessages = async (filters: CommunityMessagesFilters = {}) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const params = new URLSearchParams();
    if (filters.communityType) params.append('communityType', filters.communityType);
    if (filters.tag) params.append('tag', filters.tag);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.size !== undefined) params.append('size', filters.size.toString());

    const response = await notificationApi.get<UserMessagesResponse>(
      `/user-messages/user/${userId}/community?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch community messages');
  }
};

// Message Interactions API
export const markAsRead = async (recipientMessageId: string) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const payload: MessageInteractionRequest = {
      recipientMessageId,
      userId,
      interactionType: 'READ',
    };

    await notificationApi.post('/user-messages/interactions', payload);
    toast.success('Marked as read');
  } catch (error) {
    handleApiError(error, 'mark as read');
  }
};

export const dismissMessage = async (recipientMessageId: string) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const payload: MessageInteractionRequest = {
      recipientMessageId,
      userId,
      interactionType: 'DISMISSED',
    };

    await notificationApi.post('/user-messages/interactions', payload);
    toast.success('Message dismissed');
  } catch (error) {
    handleApiError(error, 'dismiss message');
  }
};

export const recordInteraction = async (
  recipientMessageId: string,
  interactionType: InteractionType,
  additionalData?: Record<string, unknown>
) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const payload: MessageInteractionRequest = {
      recipientMessageId,
      userId,
      interactionType,
      additionalData,
    };

    await notificationApi.post('/user-messages/interactions', payload);
  } catch (error) {
    // Don't show toast for interaction tracking errors
    console.error('Error recording interaction:', error);
  }
};

// Message Replies API
export const getAnnouncementReplies = async (
  announcementId: string,
  filters: RepliesFilters = {}
) => {
  try {
    const params = new URLSearchParams();
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.size !== undefined) params.append('size', filters.size.toString());

    const response = await notificationApi.get<MessageRepliesResponse>(
      `/message-replies/announcement/${announcementId}?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch replies');
  }
};

export const getChildReplies = async (parentReplyId: string) => {
  try {
    const response = await notificationApi.get<MessageReply[]>(
      `/message-replies/${parentReplyId}/children`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch child replies');
  }
};

export const createReply = async (payload: CreateReplyRequest) => {
  try {
    const response = await notificationApi.post<MessageReply>('/message-replies', payload);
    toast.success('Reply posted successfully');
    return response.data;
  } catch (error) {
    handleApiError(error, 'post reply');
  }
};

// Generic User Messages API (for any mode type)
export const getUserMessages = async (
  modeType?: ModeType,
  filters: { page?: number; size?: number } = {}
) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const params = new URLSearchParams();
    if (modeType) params.append('modeType', modeType);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.size !== undefined) params.append('size', filters.size.toString());

    const response = await notificationApi.get<UserMessagesResponse>(
      `/user-messages/user/${userId}?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch user messages');
  }
};

// Unread Count API (for any mode type)
export const getUnreadCount = async (modeType?: ModeType) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const params = new URLSearchParams();
    if (modeType) params.append('modeType', modeType);

    const response = await notificationApi.get<UnreadCountResponse>(
      `/user-messages/user/${userId}/unread-count?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    handleApiError(error, 'fetch unread count');
  }
};

// Batch operations for mark-as-read (for performance)
export const batchMarkAsRead = async (recipientMessageIds: string[]) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const promises = recipientMessageIds.map(recipientMessageId =>
      notificationApi.post('/user-messages/interactions', {
        recipientMessageId,
        userId,
        interactionType: 'READ',
      } as MessageInteractionRequest)
    );

    await Promise.all(promises);
    toast.success(`Marked ${recipientMessageIds.length} messages as read`);
  } catch (error) {
    handleApiError(error, 'batch mark as read');
  }
};

// Batch operations for dismiss (for performance)
export const batchDismissMessages = async (recipientMessageIds: string[]) => {
  try {
    const { userId } = await getUserContext();
    if (!userId) throw new Error('User ID not found');

    const promises = recipientMessageIds.map(recipientMessageId =>
      notificationApi.post('/user-messages/interactions', {
        recipientMessageId,
        userId,
        interactionType: 'DISMISSED',
      } as MessageInteractionRequest)
    );

    await Promise.all(promises);
    toast.success(`Dismissed ${recipientMessageIds.length} messages`);
  } catch (error) {
    handleApiError(error, 'batch dismiss messages');
  }
};

// Export all functions
export const announcementApi = {
  // System Alerts
  getSystemAlerts,
  getSystemAlertUnreadCount,
  
  // Dashboard Pins
  getDashboardPins,
  
  // Stream Messages
  getStreamMessages,
  
  // Community Messages
  getCommunityMessages,
  
  // Message Interactions
  markAsRead,
  dismissMessage,
  recordInteraction,
  batchMarkAsRead,
  batchDismissMessages,
  
  // Message Replies
  getAnnouncementReplies,
  getChildReplies,
  createReply,
  
  // Generic
  getUserMessages,
  getUnreadCount,
};
