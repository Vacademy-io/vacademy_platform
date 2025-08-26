import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
  actionUrl?: string;
}

// Extended type for Electron API
declare global {
  interface Window {
    electronAPI?: {
      showNotification: (notification: NotificationPayload) => void;
      checkNotificationPermission: () => Promise<string>;
      getNotificationSettings: () => Promise<unknown>;
      setBadgeCount: (count: number) => Promise<boolean>;
      clearBadge: () => Promise<boolean>;
      onNotification: (callback: (notification: NotificationPayload) => void) => void;
      onNotificationClicked: (callback: (data: Record<string, unknown>) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export interface PushNotificationToken {
  token: string;
  platform: 'android' | 'ios' | 'web' | 'electron';
  deviceId: string;
}

class PushNotificationService {
  private isInitialized = false;
  private currentToken: string | null = null;
  private listeners: Array<(notification: PushNotificationSchema) => void> = [];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const platform = Capacitor.getPlatform();
    
    if (platform === 'web') {
      // Handle web push notifications
      await this.initializeWebPush();
    } else if (platform === 'android' || platform === 'ios') {
      // Handle native mobile push notifications
      await this.initializeNativePush();
    } else {
      // Handle Electron (desktop) notifications
      await this.initializeElectronPush();
    }

    this.isInitialized = true;
  }

  private async initializeNativePush(): Promise<void> {
    // Request permissions
    const permStatus = await PushNotifications.requestPermissions();
    
    if (permStatus.receive === 'granted') {
      // Register for push notifications
      await PushNotifications.register();

      // Listen for registration success
      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('Push registration success, token: ' + token.value);
        this.currentToken = token.value;
        await this.saveTokenToStorage(token.value);
        await this.registerStoredToken();
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error: unknown) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      // Listen for incoming notifications
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received: ', notification);
        this.notifyListeners(notification);
      });

      // Listen for notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('Push notification action performed', notification);
        this.handleNotificationAction(notification);
        
        // Mark notification as read when action is performed
        this.markNotificationAsRead(notification.notification.id);
      });
    } else {
      console.warn('Push notification permissions not granted');
    }
  }

  private async initializeWebPush(): Promise<void> {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        // Register Firebase messaging service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          
          // Get FCM token using Firebase
          const { getFirebaseToken } = await import('@/services/firebase-config');
          const token = await getFirebaseToken();
          
          if (token) {
            this.currentToken = token;
            await this.saveTokenToStorage(token);
            await this.registerStoredToken();
            
            // Setup foreground message listener
            const { onFirebaseMessage } = await import('@/services/firebase-config');
            onFirebaseMessage((payload) => {
              this.notifyListeners({
                title: payload.notification?.title || 'New notification',
                body: payload.notification?.body || '',
                id: payload.messageId || Date.now().toString(),
                data: payload.data || {}
              });
            });
          } else {
            console.warn('No FCM token available');
          }
        }
        
        // Also register the service worker function from firebase-config
        const { registerServiceWorker } = await import('@/services/firebase-config');
        await registerServiceWorker();
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  private async initializeElectronPush(): Promise<void> {
    // For Electron, we'll use IPC to communicate with main process
    if (window.electronAPI) {
      try {
        // Check permissions (always granted on desktop)
        const permission = await window.electronAPI.checkNotificationPermission();
        
        // Setup notification click handler
        window.electronAPI.onNotificationClicked((data: Record<string, unknown>) => {
          this.notifyListeners({
            title: 'Notification clicked',
            body: '',
            id: Date.now().toString(),
            data: data
          });
        });

        // Setup listener for notifications from main process
        window.electronAPI.onNotification((notification: NotificationPayload) => {
          this.showElectronNotification(notification);
        });

        // Clear any existing badge count on startup
        await window.electronAPI.clearBadge();
        
      } catch (error) {
        console.error('Error initializing Electron push notifications:', error);
      }
    }
  }

  private async saveTokenToStorage(token: string): Promise<void> {
    await Preferences.set({
      key: 'pushNotificationToken',
      value: token
    });
  }

  private async sendTokenToServer(token: string): Promise<void> {
    try {
      const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web' | 'electron';
      const deviceId = await this.getDeviceId();

      // Resolve user and institute
      const [{ getUserId }, { PUSH_REGISTER_URL }, appInfoOrNull, webSenderIdOrNull] = await Promise.all([
        import('@/constants/getUserId'),
        import('@/constants/urls'),
        // Attempt to fetch app info (native only)
        (async () => {
          try {
            const { App } = await import('@capacitor/app');
            const info = await App.getInfo();
            return info;
          } catch {
            return null;
          }
        })(),
        // Provide sender id for web to help server select FCM project
        (async () => {
          try {
            if (platform === 'web') {
              const { FIREBASE_MESSAGING_SENDER_ID } = await import('@/services/firebase-config');
              return FIREBASE_MESSAGING_SENDER_ID as string;
            }
            return null;
          } catch {
            return null;
          }
        })()
      ]);

      const [userId, instituteIdPref] = await Promise.all([
        getUserId(),
        Preferences.get({ key: 'InstituteId' }),
      ]);

      const instituteId = instituteIdPref.value || null;

      // Guard: ensure we have both userId and instituteId before registering
      if (!userId || !instituteId) {
        return;
      }

      const body = {
        instituteId,
        userId,
        token,
        platform: platform === 'electron' ? 'web' : platform,
        deviceId,
        clientContext: {
          appId: appInfoOrNull?.id || null, // bundleId/packageName on native
          appName: appInfoOrNull?.name || null,
          version: appInfoOrNull?.version || null,
          build: appInfoOrNull?.build || null,
          webHost: platform === 'web' ? (typeof window !== 'undefined' ? window.location.host : null) : null,
          webOrigin: platform === 'web' ? (typeof window !== 'undefined' ? window.location.origin : null) : null,
          firebaseSenderId: webSenderIdOrNull || null,
        }
      };

      // Use plain fetch: do not send auth token for push endpoints
      const response = await fetch(PUSH_REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Push token registration failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  }

  async deactivateToken(token?: string): Promise<void> {
    try {
      const { PUSH_DEACTIVATE_URL } = await import('@/constants/urls');
      const tokenToDeactivate = token || this.currentToken || (await this.getStoredToken());
      if (!tokenToDeactivate) return;
      // Use plain fetch: do not send auth token for push endpoints
      await fetch(`${PUSH_DEACTIVATE_URL}?token=${encodeURIComponent(tokenToDeactivate)}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to deactivate push token', err);
    }
  }

  // Public method to upsert currently stored token (useful after institute switch)
  async registerStoredToken(): Promise<void> {
    const stored = await this.getStoredToken();
    if (stored) {
      await this.sendTokenToServer(stored);
    }
  }

  private async getDeviceId(): Promise<string> {
    const stored = await Preferences.get({ key: 'deviceId' });
    if (stored.value) {
      return stored.value;
    }

    // Generate a unique device ID
    const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    await Preferences.set({ key: 'deviceId', value: deviceId });
    return deviceId;
  }

  private notifyListeners(notification: PushNotificationSchema): void {
    this.listeners.forEach(listener => listener(notification));
  }



  private showElectronNotification(notification: NotificationPayload): void {
    // Show notification in Electron using the main process
    if (window.electronAPI) {
      window.electronAPI.showNotification(notification);
    }
  }

  // Public methods
  async getStoredToken(): Promise<string | null> {
    const stored = await Preferences.get({ key: 'pushNotificationToken' });
    return stored.value;
  }

  addListener(callback: (notification: PushNotificationSchema) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (notification: PushNotificationSchema) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Update badge count (platform specific)
  async updateBadgeCount(count: number): Promise<void> {
    try {
      const platform = Capacitor.getPlatform();
      
      if (platform === 'electron' && window.electronAPI) {
        await window.electronAPI.setBadgeCount(count);
      } else if (platform === 'ios') {
        // iOS badge count is handled by Capacitor Push Notifications plugin
        // This would typically be set on the server side when sending push notifications
        console.log('Badge count update requested for iOS:', count);
      } else if (platform === 'android') {
        // Android doesn't support badge counts natively, but some launchers do
        console.log('Badge count update requested for Android:', count);
      } else if (platform === 'web') {
        // Web browsers don't support badge counts in the same way
        // Could update document title or show in UI
        document.title = count > 0 ? `(${count}) Vacademy Learner` : 'Vacademy Learner';
      }
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  // Clear badge count
  async clearBadgeCount(): Promise<void> {
    await this.updateBadgeCount(0);
  }

  // Mark notification as read
  private markNotificationAsRead(notificationId: string): void {
    try {
      // Import and use the notification store to mark as read
      import('@/stores/push-notification-store').then(({ usePushNotificationStore }) => {
        const { markAsRead } = usePushNotificationStore.getState();
        markAsRead(notificationId);
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Enhanced notification action handler
  private handleNotificationAction(actionPerformed: ActionPerformed): void {
    const { notification, actionId } = actionPerformed;
    
    console.log('Handling notification action:', {
      notificationId: notification.id,
      actionId,
      data: notification.data
    });

    // Handle different action types
    switch (actionId) {
      case 'view':
      case 'open':
        // Navigate to relevant content
        this.navigateToNotificationContent(notification);
        break;
      case 'dismiss':
        // Just mark as read, no navigation
        break;
      case 'reply':
        // Handle reply action if implemented
        console.log('Reply action triggered for notification:', notification.id);
        break;
      default:
        // Default action - navigate to content
        this.navigateToNotificationContent(notification);
        break;
    }
  }

  // Navigate to notification content based on data
  private navigateToNotificationContent(notification: PushNotificationSchema): void {
    try {
      const data = notification.data;
      
      if (data?.actionUrl) {
        // For web, navigate to the URL
        if (Capacitor.getPlatform() === 'web') {
          window.location.href = data.actionUrl;
        } else {
          // For mobile apps, use router navigation
          // This would need to be integrated with your app's navigation system
          console.log('Navigate to:', data.actionUrl);
        }
      } else if (data?.type) {
        // Handle different notification types
        switch (data.type) {
          case 'assignment':
            console.log('Navigate to assignments');
            break;
          case 'live_class':
            console.log('Navigate to live classes');
            break;
          case 'announcement':
            console.log('Navigate to announcements');
            break;
          default:
            console.log('Navigate to dashboard');
            break;
        }
      }
    } catch (error) {
      console.error('Error navigating to notification content:', error);
    }
  }

  async sendLocalNotification(notification: NotificationPayload): Promise<void> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: notification.imageUrl || '/icon-192.webp'
        });
      }
    } else if (platform === 'android' || platform === 'ios') {
      // Use local notifications plugin if needed
      console.log('Local notification for mobile:', notification);
    } else {
      // Electron
      this.showElectronNotification(notification);
    }
  }

  async checkPermissions(): Promise<{ receive: string }> {
    const platform = Capacitor.getPlatform();
    
    if (platform === 'android' || platform === 'ios') {
      return await PushNotifications.checkPermissions();
    } else if (platform === 'web') {
      return { receive: Notification.permission };
    } else {
      // Electron - assume granted for now
      return { receive: 'granted' };
    }
  }

  async requestPermissions(): Promise<{ receive: string }> {
    const platform = Capacitor.getPlatform();
    
    if (platform === 'android' || platform === 'ios') {
      return await PushNotifications.requestPermissions();
    } else if (platform === 'web') {
      const permission = await Notification.requestPermission();
      return { receive: permission };
    } else {
      // Electron
      return { receive: 'granted' };
    }
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();

 