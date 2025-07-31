import { contextBridge, ipcRenderer } from 'electron';

// Expose notification APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Notification methods
  showNotification: (notificationData: any) => ipcRenderer.invoke('show-notification', notificationData),
  checkNotificationPermission: () => ipcRenderer.invoke('check-notification-permission'),
  getNotificationSettings: () => ipcRenderer.invoke('get-notification-settings'),

  // Badge methods
  setBadgeCount: (count: number) => ipcRenderer.invoke('set-badge-count', count),
  clearBadge: () => ipcRenderer.invoke('clear-badge'),
  
  // Listen for notification events
  onNotification: (callback: (notification: any) => void) => {
    ipcRenderer.on('notification-received', (event, notification) => callback(notification));
  },
  
  // Listen for notification clicks
  onNotificationClicked: (callback: (data: any) => void) => {
    ipcRenderer.on('notification-clicked', (event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
console.log('User Preload!');
