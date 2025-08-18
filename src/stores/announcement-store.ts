import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  UserMessage,
  MessageReply,
  SystemAlertsState,
  DashboardPinsState,
  PackageSessionMessagesState,
  MessageRepliesState,
} from '@/types/announcement';
import * as announcementApi from '@/services/announcementApi';

interface AnnouncementStore {
  // System Alerts
  systemAlerts: SystemAlertsState;
  fetchSystemAlerts: (filters?: { priority?: 'HIGH' | 'MEDIUM' | 'LOW'; page?: number; size?: number }) => Promise<void>;
  fetchSystemAlertUnreadCount: () => Promise<void>;
  markAlertAsRead: (messageId: string) => Promise<void>;
  dismissAlert: (messageId: string) => Promise<void>;
  addSystemAlert: (alert: UserMessage) => void;
  updateSystemAlert: (messageId: string, updates: Partial<UserMessage>) => void;
  removeSystemAlert: (messageId: string) => void;

  // Dashboard Pins
  dashboardPins: DashboardPinsState;
  fetchDashboardPins: () => Promise<void>;
  markPinAsRead: (messageId: string) => Promise<void>;
  addDashboardPin: (pin: UserMessage) => void;
  removeDashboardPin: (messageId: string) => void;

  // Package Session Messages
  packageSessionMessages: Record<string, PackageSessionMessagesState>;
  fetchStreamMessages: (packageSessionId: string, filters?: { streamType?: 'LIVE' | 'RECORDED'; page?: number; size?: number }) => Promise<void>;
        fetchCommunityMessages: (filters?: { communityType?: 'SCHOOL' | 'CLASS'; tag?: string; page?: number; size?: number }) => Promise<void>;
  markStreamMessageAsRead: (packageSessionId: string, messageId: string) => Promise<void>;
  markCommunityMessageAsRead: (packageSessionId: string, messageId: string) => Promise<void>;
  addStreamMessage: (packageSessionId: string, message: UserMessage) => void;
  addCommunityMessage: (packageSessionId: string, message: UserMessage) => void;

  // Message Replies
  messageReplies: Record<string, MessageRepliesState>;
  fetchMessageReplies: (announcementId: string, filters?: { page?: number; size?: number }) => Promise<void>;
  fetchChildReplies: (parentReplyId: string) => Promise<MessageReply[]>;
  createReply: (announcementId: string, content: string, parentReplyId?: string) => Promise<void>;
  addReply: (announcementId: string, reply: MessageReply) => void;

  // Utility functions
  clearAllData: () => void;
  clearPackageSessionData: (packageSessionId: string) => void;
}

const initialSystemAlertsState: SystemAlertsState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,
  hasMore: true,
  currentPage: 0,
};

const initialDashboardPinsState: DashboardPinsState = {
  items: [],
  loading: false,
  error: null,
};

const initialPackageSessionMessagesState: PackageSessionMessagesState = {
  stream: {
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 0,
  },
  discussion: {
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 0,
  },
};

const initialMessageRepliesState: MessageRepliesState = {
  items: [],
  loading: false,
  error: null,
  hasMore: true,
  currentPage: 0,
};

export const useAnnouncementStore = create<AnnouncementStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      systemAlerts: initialSystemAlertsState,
      dashboardPins: initialDashboardPinsState,
      packageSessionMessages: {},
      messageReplies: {},

      // System Alerts actions
      fetchSystemAlerts: async (filters = {}) => {
        set((state) => ({
          systemAlerts: { ...state.systemAlerts, loading: true, error: null }
        }));

        try {
          const response = await announcementApi.getSystemAlerts(filters);
          if (response) {
            set((state) => ({
              systemAlerts: {
                ...state.systemAlerts,
                items: filters.page === 0 ? response.content : [...state.systemAlerts.items, ...response.content],
                hasMore: response.number < response.totalPages - 1,
                currentPage: response.number,
                loading: false,
              }
            }));
          }
        } catch (error) {
          set((state) => ({
            systemAlerts: {
              ...state.systemAlerts,
              loading: false,
              error: error instanceof Error ? error.message : 'Failed to fetch system alerts',
            }
          }));
        }
      },

      fetchSystemAlertUnreadCount: async () => {
        try {
          const response = await announcementApi.getSystemAlertUnreadCount();
          if (response) {
            set((state) => ({
              systemAlerts: {
                ...state.systemAlerts,
                unreadCount: response.count,
              }
            }));
          }
        } catch (error) {
          console.error('Failed to fetch unread count:', error);
        }
      },

      markAlertAsRead: async (messageId: string) => {
        try {
          await announcementApi.markAsRead(messageId);
          set((state) => ({
            systemAlerts: {
              ...state.systemAlerts,
              items: state.systemAlerts.items.map(item =>
                item.messageId === messageId ? { ...item, isRead: true } : item
              ),
              unreadCount: Math.max(0, state.systemAlerts.unreadCount - 1),
            }
          }));
        } catch (error) {
          console.error('Failed to mark alert as read:', error);
        }
      },

      dismissAlert: async (messageId: string) => {
        try {
          await announcementApi.dismissMessage(messageId);
          set((state) => ({
            systemAlerts: {
              ...state.systemAlerts,
              items: state.systemAlerts.items.filter(item => item.messageId !== messageId),
            }
          }));
        } catch (error) {
          console.error('Failed to dismiss alert:', error);
        }
      },

      addSystemAlert: (alert: UserMessage) => {
        set((state) => ({
          systemAlerts: {
            ...state.systemAlerts,
            items: [alert, ...state.systemAlerts.items],
            unreadCount: state.systemAlerts.unreadCount + 1,
          }
        }));
      },

      updateSystemAlert: (messageId: string, updates: Partial<UserMessage>) => {
        set((state) => ({
          systemAlerts: {
            ...state.systemAlerts,
            items: state.systemAlerts.items.map(item =>
              item.messageId === messageId ? { ...item, ...updates } : item
            ),
          }
        }));
      },

      removeSystemAlert: (messageId: string) => {
        set((state) => ({
          systemAlerts: {
            ...state.systemAlerts,
            items: state.systemAlerts.items.filter(item => item.messageId !== messageId),
          }
        }));
      },

      // Dashboard Pins actions
      fetchDashboardPins: async () => {
        set((state) => ({
          dashboardPins: { ...state.dashboardPins, loading: true, error: null }
        }));

        try {
          const response = await announcementApi.getDashboardPins();
          if (response) {
            set((state) => ({
              dashboardPins: {
                ...state.dashboardPins,
                items: response,
                loading: false,
              }
            }));
          }
        } catch (error) {
          set((state) => ({
            dashboardPins: {
              ...state.dashboardPins,
              loading: false,
              error: error instanceof Error ? error.message : 'Failed to fetch dashboard pins',
            }
          }));
        }
      },

      markPinAsRead: async (messageId: string) => {
        try {
          await announcementApi.markAsRead(messageId);
          set((state) => ({
            dashboardPins: {
              ...state.dashboardPins,
              items: state.dashboardPins.items.map(item =>
                item.messageId === messageId ? { ...item, isRead: true } : item
              ),
            }
          }));
        } catch (error) {
          console.error('Failed to mark pin as read:', error);
        }
      },

      addDashboardPin: (pin: UserMessage) => {
        set((state) => ({
          dashboardPins: {
            ...state.dashboardPins,
            items: [pin, ...state.dashboardPins.items],
          }
        }));
      },

      removeDashboardPin: (messageId: string) => {
        set((state) => ({
          dashboardPins: {
            ...state.dashboardPins,
            items: state.dashboardPins.items.filter(item => item.messageId !== messageId),
          }
        }));
      },

      // Package Session Messages actions
      fetchStreamMessages: async (packageSessionId: string, filters = {}) => {
        const state = get();
        const currentState = state.packageSessionMessages[packageSessionId] || initialPackageSessionMessagesState;
        
        set((state) => ({
          packageSessionMessages: {
            ...state.packageSessionMessages,
            [packageSessionId]: {
              ...currentState,
              stream: { ...currentState.stream, loading: true, error: null }
            }
          }
        }));

        try {
          const response = await announcementApi.getStreamMessages(packageSessionId, filters);
          if (response) {
            set((state) => ({
              packageSessionMessages: {
                ...state.packageSessionMessages,
                [packageSessionId]: {
                  ...currentState,
                  stream: {
                    items: filters.page === 0 ? response.content : [...currentState.stream.items, ...response.content],
                    hasMore: response.number < response.totalPages - 1,
                    currentPage: response.number,
                    loading: false,
                    error: null,
                  }
                }
              }
            }));
          }
        } catch (error) {
          set((state) => ({
            packageSessionMessages: {
              ...state.packageSessionMessages,
              [packageSessionId]: {
                ...currentState,
                stream: {
                  ...currentState.stream,
                  loading: false,
                  error: error instanceof Error ? error.message : 'Failed to fetch stream messages',
                }
              }
            }
          }));
        }
      },

      fetchCommunityMessages: async (filters = {}) => {
        const state = get();
        // For community messages, we'll use a global key since they're not package-specific
        const globalKey = 'global';
        const currentState = state.packageSessionMessages[globalKey] || initialPackageSessionMessagesState;
        
        set((state) => ({
          packageSessionMessages: {
            ...state.packageSessionMessages,
            [globalKey]: {
              ...currentState,
              discussion: { ...currentState.discussion, loading: true, error: null }
            }
          }
        }));

        try {
          const response = await announcementApi.getCommunityMessages(filters);
          if (response) {
            set((state) => ({
              packageSessionMessages: {
                ...state.packageSessionMessages,
                [globalKey]: {
                  ...currentState,
                  discussion: {
                    items: filters.page === 0 ? response.content : [...currentState.discussion.items, ...response.content],
                    hasMore: response.number < response.totalPages - 1,
                    currentPage: response.number,
                    loading: false,
                    error: null,
                  }
                }
              }
            }));
          }
        } catch (error) {
          set((state) => ({
            packageSessionMessages: {
              ...state.packageSessionMessages,
              [globalKey]: {
                ...currentState,
                discussion: {
                  ...currentState.discussion,
                  loading: false,
                  error: error instanceof Error ? error.message : 'Failed to fetch community messages',
                }
              }
            }
          }));
        }
      },

      markStreamMessageAsRead: async (packageSessionId: string, messageId: string) => {
        try {
          await announcementApi.markAsRead(messageId);
          set((state) => ({
            packageSessionMessages: {
              ...state.packageSessionMessages,
              [packageSessionId]: {
                ...state.packageSessionMessages[packageSessionId],
                stream: {
                  ...state.packageSessionMessages[packageSessionId]?.stream,
                  items: state.packageSessionMessages[packageSessionId]?.stream.items.map(item =>
                    item.messageId === messageId ? { ...item, isRead: true } : item
                  ) || [],
                }
              }
            }
          }));
        } catch (error) {
          console.error('Failed to mark stream message as read:', error);
        }
      },

      markCommunityMessageAsRead: async (packageSessionId: string, messageId: string) => {
        try {
          await announcementApi.markAsRead(messageId);
          set((state) => ({
            packageSessionMessages: {
              ...state.packageSessionMessages,
              [packageSessionId]: {
                ...state.packageSessionMessages[packageSessionId],
                discussion: {
                  ...state.packageSessionMessages[packageSessionId]?.discussion,
                  items: state.packageSessionMessages[packageSessionId]?.discussion.items.map(item =>
                    item.messageId === messageId ? { ...item, isRead: true } : item
                  ) || [],
                }
              }
            }
          }));
        } catch (error) {
          console.error('Failed to mark community message as read:', error);
        }
      },

      addStreamMessage: (packageSessionId: string, message: UserMessage) => {
        set((state) => ({
          packageSessionMessages: {
            ...state.packageSessionMessages,
            [packageSessionId]: {
              ...state.packageSessionMessages[packageSessionId],
              stream: {
                ...state.packageSessionMessages[packageSessionId]?.stream,
                items: [message, ...(state.packageSessionMessages[packageSessionId]?.stream.items || [])],
              }
            }
          }
        }));
      },

      addCommunityMessage: (packageSessionId: string, message: UserMessage) => {
        set((state) => ({
          packageSessionMessages: {
            ...state.packageSessionMessages,
            [packageSessionId]: {
              ...state.packageSessionMessages[packageSessionId],
              discussion: {
                ...state.packageSessionMessages[packageSessionId]?.discussion,
                items: [message, ...(state.packageSessionMessages[packageSessionId]?.discussion.items || [])],
              }
            }
          }
        }));
      },

      // Message Replies actions
      fetchMessageReplies: async (announcementId: string, filters = {}) => {
        set((state) => ({
          messageReplies: {
            ...state.messageReplies,
            [announcementId]: {
              ...state.messageReplies[announcementId] || initialMessageRepliesState,
              loading: true,
              error: null,
            }
          }
        }));

        try {
          const response = await announcementApi.getAnnouncementReplies(announcementId, filters);
          if (response) {
            set((state) => ({
              messageReplies: {
                ...state.messageReplies,
                [announcementId]: {
                  items: filters.page === 0 ? response.content : [...(state.messageReplies[announcementId]?.items || []), ...response.content],
                  hasMore: response.number < response.totalPages - 1,
                  currentPage: response.number,
                  loading: false,
                  error: null,
                }
              }
            }));
          }
        } catch (error) {
          set((state) => ({
            messageReplies: {
              ...state.messageReplies,
              [announcementId]: {
                ...state.messageReplies[announcementId] || initialMessageRepliesState,
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to fetch replies',
              }
            }
          }));
        }
      },

      fetchChildReplies: async (parentReplyId: string) => {
        try {
          const response = await announcementApi.getChildReplies(parentReplyId);
          return response || [];
        } catch (error) {
          console.error('Failed to fetch child replies:', error);
          return [];
        }
      },

      createReply: async (announcementId: string, content: string, parentReplyId?: string) => {
        try {
          const { Preferences } = await import('@capacitor/preferences');
          const studentDetails = await Preferences.get({ key: 'StudentDetails' });
          const student = studentDetails.value ? JSON.parse(studentDetails.value) : null;

          if (!student?.user_id) throw new Error('User ID not found');

          const payload = {
            announcementId,
            parentMessageId: parentReplyId,
            userId: student.user_id,
            userName: student.full_name,
            userRole: 'STUDENT',
            content: {
              type: 'text' as const,
              content,
            },
          };

          const reply = await announcementApi.createReply(payload);
          if (reply) {
            get().addReply(announcementId, reply);
          }
        } catch (error) {
          console.error('Failed to create reply:', error);
        }
      },

      addReply: (announcementId: string, reply: MessageReply) => {
        set((state) => ({
          messageReplies: {
            ...state.messageReplies,
            [announcementId]: {
              ...state.messageReplies[announcementId] || initialMessageRepliesState,
              items: [reply, ...(state.messageReplies[announcementId]?.items || [])],
            }
          }
        }));
      },

      // Utility functions
      clearAllData: () => {
        set({
          systemAlerts: initialSystemAlertsState,
          dashboardPins: initialDashboardPinsState,
          packageSessionMessages: {},
          messageReplies: {},
        });
      },

      clearPackageSessionData: (packageSessionId: string) => {
        set((state) => {
          const newState = { ...state };
          delete newState.packageSessionMessages[packageSessionId];
          return newState;
        });
      },
    }),
    {
      name: 'announcement-store',
    }
  )
);
