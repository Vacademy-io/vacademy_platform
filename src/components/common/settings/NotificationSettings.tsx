import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, Volume2, VolumeX, Shield, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export const NotificationSettings: React.FC = () => {
  const {
    settings,
    isPermissionGranted,
    unreadCount,
    requestPermissions,
    updateSettings,
    sendLocalNotification,
    getNotificationStatus
  } = usePushNotifications();

  const status = getNotificationStatus();

  const handlePermissionToggle = async () => {
    if (!isPermissionGranted) {
      await requestPermissions();
    } else {
      toast.info('Notifications are currently enabled. To disable, please use your device settings.');
    }
  };

  const handleTestNotification = async () => {
    await sendLocalNotification(
      'Test Notification',
      'This is a test notification from Vacademy Learner!',
      { type: 'test' }
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isPermissionGranted ? (
                <Bell className="h-5 w-5 text-green-600" />
              ) : (
                <BellOff className="h-5 w-5 text-gray-400" />
              )}
              <CardTitle>Notification Status</CardTitle>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount} unread</Badge>
            )}
          </div>
          <CardDescription>
            Manage your push notification preferences across all devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Platform</div>
              <div className="text-sm text-muted-foreground flex items-center space-x-2">
                <Smartphone className="h-4 w-4" />
                <span className="capitalize">{status.platform}</span>
              </div>
            </div>
            <Badge variant={status.isSupported ? 'default' : 'secondary'}>
              {status.isSupported ? 'Supported' : 'Not Supported'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Permission Status</div>
              <div className="text-sm text-muted-foreground">
                {isPermissionGranted ? 'Notifications are enabled' : 'Notifications are disabled'}
              </div>
            </div>
            <Button
              variant={isPermissionGranted ? 'outline' : 'default'}
              size="sm"
              onClick={handlePermissionToggle}
              disabled={!status.isSupported}
            >
              {isPermissionGranted ? 'Enabled' : 'Enable Notifications'}
            </Button>
          </div>

          {isPermissionGranted && (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">Test Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Send a test notification to verify everything is working
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleTestNotification}>
                Send Test
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose what types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Enable Notifications</div>
              <div className="text-sm text-muted-foreground">
                Turn all notifications on or off
              </div>
            </div>
            <Switch
              checked={settings.enabled && isPermissionGranted}
              onCheckedChange={(checked) => updateSettings({ enabled: checked })}
              disabled={!isPermissionGranted}
            />
          </div>

          {/* Sound Settings */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium flex items-center space-x-2">
                {settings.sound ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
                <span>Sound</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Play sound when notifications arrive
              </div>
            </div>
            <Switch
              checked={settings.sound}
              onCheckedChange={(checked) => updateSettings({ sound: checked })}
              disabled={!settings.enabled || !isPermissionGranted}
            />
          </div>

          {/* Badge Settings */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>App Badge</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Show notification count on app icon
              </div>
            </div>
            <Switch
              checked={settings.badge}
              onCheckedChange={(checked) => updateSettings({ badge: checked })}
              disabled={!settings.enabled || !isPermissionGranted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Categories</CardTitle>
          <CardDescription>
            Choose which types of content you want to be notified about
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Assignments</div>
              <div className="text-sm text-muted-foreground">
                New assignments and submission reminders
              </div>
            </div>
            <Switch
              checked={settings.categories.assignments}
              onCheckedChange={(checked) =>
                updateSettings({
                  categories: { ...settings.categories, assignments: checked }
                })
              }
              disabled={!settings.enabled || !isPermissionGranted}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Announcements</div>
              <div className="text-sm text-muted-foreground">
                Important announcements from your institute
              </div>
            </div>
            <Switch
              checked={settings.categories.announcements}
              onCheckedChange={(checked) =>
                updateSettings({
                  categories: { ...settings.categories, announcements: checked }
                })
              }
              disabled={!settings.enabled || !isPermissionGranted}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Live Classes</div>
              <div className="text-sm text-muted-foreground">
                Live class reminders and updates
              </div>
            </div>
            <Switch
              checked={settings.categories.liveClasses}
              onCheckedChange={(checked) =>
                updateSettings({
                  categories: { ...settings.categories, liveClasses: checked }
                })
              }
              disabled={!settings.enabled || !isPermissionGranted}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">General</div>
              <div className="text-sm text-muted-foreground">
                General app updates and information
              </div>
            </div>
            <Switch
              checked={settings.categories.general}
              onCheckedChange={(checked) =>
                updateSettings({
                  categories: { ...settings.categories, general: checked }
                })
              }
              disabled={!settings.enabled || !isPermissionGranted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      {!isPermissionGranted && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Bell className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-orange-900">Enable Notifications</h3>
                <p className="text-sm text-orange-700 mt-1">
                  To receive push notifications, you need to grant permission. 
                  Click "Enable Notifications" above to get started. You can always 
                  change these settings later in your device's notification settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 