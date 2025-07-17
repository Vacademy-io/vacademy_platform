import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, Send, Settings, Check, X, AlertCircle, Hash, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { pushNotificationService } from '@/services/push-notifications/push-notification-service';

export const NotificationTestPanel: React.FC = () => {
  const {
    settings,
    isPermissionGranted,
    token,
    requestPermissions,
    sendLocalNotification,
    getNotificationStatus,
    updateSettings
  } = usePushNotifications();

  const [isTestingLocal, setIsTestingLocal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  const platform = Capacitor.getPlatform();
  const status = getNotificationStatus();

  const handleRequestPermissions = async () => {
    setIsRequestingPermission(true);
    try {
      const result = await requestPermissions();
      if (result) {
        toast.success('✅ Notification permissions granted!');
      } else {
        toast.error('❌ Notification permissions denied');
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      toast.error('Failed to request permissions');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleTestLocalNotification = async () => {
    setIsTestingLocal(true);
    try {
      await sendLocalNotification({
        title: '🎉 Test Notification',
        body: 'Push notifications are working correctly!',
        data: { type: 'test', timestamp: new Date().toISOString() }
      });
      toast.success('Test notification sent!');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast.error('Failed to send test notification');
    } finally {
      setIsTestingLocal(false);
    }
  };

  const handleToggleNotifications = async () => {
    try {
      await updateSettings({ enabled: !settings.enabled });
      toast.success(`Notifications ${settings.enabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update notification settings');
    }
  };

  const handleTestBadge = async () => {
    try {
      const newCount = badgeCount + 1;
      setBadgeCount(newCount);
      await pushNotificationService.updateBadgeCount(newCount);
      toast.success(`Badge count set to ${newCount}`);
    } catch (error) {
      console.error('Failed to update badge count:', error);
      toast.error('Failed to update badge count');
    }
  };

  const handleClearBadge = async () => {
    try {
      setBadgeCount(0);
      await pushNotificationService.clearBadgeCount();
      toast.success('Badge cleared');
    } catch (error) {
      console.error('Failed to clear badge:', error);
      toast.error('Failed to clear badge');
    }
  };

  const handleTestElectronNotification = async () => {
    if (platform === 'electron' && window.electronAPI) {
      try {
        await window.electronAPI.showNotification({
          title: '🖥️ Electron Test',
          body: 'Native desktop notification working!',
          actionUrl: '/dashboard'
        });
        toast.success('Electron notification sent!');
      } catch (error) {
        console.error('Failed to send Electron notification:', error);
        toast.error('Failed to send Electron notification');
      }
    } else {
      toast.error('Not running on Electron platform');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'enabled': return 'bg-green-100 text-green-800 border-green-300';
      case 'disabled': return 'bg-red-100 text-red-800 border-red-300';
      case 'denied': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'enabled': return <Check size={16} />;
      case 'disabled': return <BellOff size={16} />;
      case 'denied': return <X size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell size={20} className="text-primary-600" />
              Push Notification Test Panel
            </CardTitle>
            <CardDescription>
              Test and configure push notifications for {platform} platform
            </CardDescription>
          </div>
          <Badge className={getStatusColor()}>
            {getStatusIcon()}
            <span className="ml-1 capitalize">{status}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Platform</h4>
            <Badge variant="outline" className="capitalize">
              {platform}
            </Badge>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Permission Status</h4>
            <Badge className={isPermissionGranted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {isPermissionGranted ? 'Granted' : 'Not Granted'}
            </Badge>
          </div>
        </div>

        {/* Token Information */}
        {token && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">FCM Token</h4>
            <code className="text-xs bg-white p-2 rounded border block break-all">
              {token}
            </code>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isPermissionGranted && (
            <Button 
              onClick={handleRequestPermissions}
              disabled={isRequestingPermission}
              className="w-full"
              size="lg"
            >
              <Bell size={16} className="mr-2" />
              {isRequestingPermission ? 'Requesting...' : 'Request Notification Permissions'}
            </Button>
          )}

          {isPermissionGranted && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                onClick={handleTestLocalNotification}
                disabled={isTestingLocal}
                variant="outline"
                size="lg"
              >
                <Send size={16} className="mr-2" />
                {isTestingLocal ? 'Sending...' : 'Test Local Notification'}
              </Button>

              <Button 
                onClick={handleToggleNotifications}
                variant={settings.enabled ? "destructive" : "default"}
                size="lg"
              >
                {settings.enabled ? <BellOff size={16} className="mr-2" /> : <Bell size={16} className="mr-2" />}
                {settings.enabled ? 'Disable' : 'Enable'} Notifications
              </Button>
            </div>
          )}

          {/* Badge Testing */}
          {isPermissionGranted && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Hash size={16} />
                Badge Testing
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button 
                  onClick={handleTestBadge}
                  variant="outline"
                  size="lg"
                >
                  <Hash size={16} className="mr-2" />
                  Set Badge ({badgeCount})
                </Button>
                
                <Button 
                  onClick={handleClearBadge}
                  variant="outline"
                  size="lg"
                >
                  <X size={16} className="mr-2" />
                  Clear Badge
                </Button>
                
                {platform === 'electron' && (
                  <Button 
                    onClick={handleTestElectronNotification}
                    variant="outline"
                    size="lg"
                  >
                    <Monitor size={16} className="mr-2" />
                    Test Electron
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings Preview */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Settings size={16} />
            Current Settings
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span>Enabled:</span>
              <Badge variant={settings.enabled ? "default" : "secondary"}>
                {settings.enabled ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Sound:</span>
              <Badge variant={settings.sound ? "default" : "secondary"}>
                {settings.sound ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Badge:</span>
              <Badge variant={settings.badge ? "default" : "secondary"}>
                {settings.badge ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Assignments:</span>
              <Badge variant={settings.categories.assignments ? "default" : "secondary"}>
                {settings.categories.assignments ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Testing Instructions:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>First, request notification permissions</li>
            <li>Test local notifications to verify the system works</li>
            <li>Check the console for FCM token (needed for server-side sending)</li>
            <li>For mobile testing, build and install the app on device</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}; 