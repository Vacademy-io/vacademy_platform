import { create } from 'zustand';
import { PushNotificationSchema } from '@capacitor/push-notifications';

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  badge: boolean;
  categories: {
    assignments: boolean;
    announcements: boolean;
    liveClasses: boolean;
    general: boolean;
  };
}

export interface PushNotificationState {
  // Settings
  settings: NotificationSettings;
  isPermissionGranted: boolean;
  token: string | null;
  
  // Notifications
  notifications: PushNotificationSchema[];
  unreadCount: number;
  
  // Actions
  setSettings: (settings: Partial<NotificationSettings>) => void;
  setPermissionGranted: (granted: boolean) => void;
  setToken: (token: string | null) => void;
  addNotification: (notification: PushNotificationSchema) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  
  // Initialization
  initialize: () => Promise<void>;
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  sound: true,
  badge: true,
  categories: {
    assignments: true,
    announcements: true,
    liveClasses: true,
    general: true,
  }
};

export const usePushNotificationStore = create<PushNotificationState>((set, get) => ({
  // Initial state
  settings: defaultSettings,
  isPermissionGranted: false,
  token: null,
  notifications: [],
  unreadCount: 0,

  // Actions
  setSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    }));
  },

  setPermissionGranted: (granted) => {
    set({ isPermissionGranted: granted });
  },

  setToken: (token) => {
    set({ token });
  },

  addNotification: (notification) => {
    set((state) => {
      const newNotifications = [notification, ...state.notifications];
      const newUnreadCount = state.unreadCount + 1;
      
      // Update badge count asynchronously
      import('@/services/push-notifications/push-notification-service').then(({ pushNotificationService }) => {
        pushNotificationService.updateBadgeCount(newUnreadCount);
      });
      
      return {
        notifications: newNotifications,
        unreadCount: newUnreadCount
      };
    });
  },

  markAsRead: (notificationId) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === notificationId);
      if (notification && !notification.data?.read) {
        const updatedNotifications = state.notifications.map(n =>
          n.id === notificationId
            ? { ...n, data: { ...n.data, read: true } }
            : n
        );
        
        const newUnreadCount = Math.max(0, state.unreadCount - 1);
        
        // Update badge count asynchronously
        import('@/services/push-notifications/push-notification-service').then(({ pushNotificationService }) => {
          pushNotificationService.updateBadgeCount(newUnreadCount);
        });
        
        return {
          notifications: updatedNotifications,
          unreadCount: newUnreadCount
        };
      }
      return state;
    });
  },

    markAllAsRead: () => {
    set((state) => {
      // Update badge count asynchronously
      import('@/services/push-notifications/push-notification-service').then(({ pushNotificationService }) => {
        pushNotificationService.clearBadgeCount();
      });
      
      return {
        notifications: state.notifications.map(n => ({ 
          ...n, 
          data: { ...n.data, read: true } 
        })),
        unreadCount: 0
      };
    });
  },

  removeNotification: (notificationId) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === notificationId);
      const wasUnread = notification && !notification.data?.read;
      
      return {
        notifications: state.notifications.filter(n => n.id !== notificationId),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    });
  },

  clearAllNotifications: () => {
    // Update badge count asynchronously
    import('@/services/push-notifications/push-notification-service').then(({ pushNotificationService }) => {
      pushNotificationService.clearBadgeCount();
    });
    
    set({
      notifications: [],
      unreadCount: 0
    });
  },

  initialize: async () => {
    try {
      // Load settings from storage or API
      // This would typically load user preferences from your backend
      console.log('Initializing push notification store...');
      
      // You can add logic here to:
      // 1. Load notification settings from backend
      // 2. Load recent notifications
      // 3. Sync with push notification service
      
    } catch (error) {
      console.error('Error initializing push notification store:', error);
    }
  }
})); 