import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { useSystemAlerts } from '@/hooks/useSystemAlerts';
import { isAfter, subDays } from 'date-fns';
import { formatLocalDateTime } from '@/helpers/formatISOTime';
import type { UserMessage } from '@/types/announcement';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface RecentSystemNotificationsProps {
  className?: string;
}

export const RecentSystemNotifications: React.FC<RecentSystemNotificationsProps> = ({ 
  className = '' 
}) => {
  const { alerts, loading, error, isEnabled, isLoadingSettings, dismissAll } = useSystemAlerts({
    enablePolling: false, // Don't poll in dashboard widget
    autoMarkAsRead: false, // Don't auto-mark as read in dashboard
  });

  // Filter notifications from last 7 days and limit to 5
  const getRecentNotifications = (): UserMessage[] => {
    const sevenDaysAgo = subDays(new Date(), 7);
    
    return alerts
      .filter(alert => {
        const createdAt = new Date(alert.createdAt);
        return isAfter(createdAt, sevenDaysAgo) && !alert.isDismissed;
      })
      .slice(0, 5); // Limit to max 5 notifications
  };

  const recentNotifications = getRecentNotifications();

  // Don't render if not enabled, loading settings, or no recent notifications
  if (isLoadingSettings || !isEnabled || recentNotifications.length === 0) {
    return null;
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-500 text-white';
      case 'MEDIUM':
        return 'bg-yellow-500 text-white';
      case 'LOW':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getPriorityText = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return 'High';
      case 'MEDIUM':
        return 'Medium';
      case 'LOW':
        return 'Low';
      default:
        return 'Normal';
    }
  };

  const renderNotificationContent = (alert: UserMessage) => {
    if (alert.content.type === 'html') {
      // Strip HTML tags for dashboard preview
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = alert.content.content;
      return tempDiv.textContent || tempDiv.innerText || '';
    }
    return alert.content.content;
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Recent System Notifications
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {recentNotifications.length} recent
            </Badge>
            {alerts.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Notifications</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to dismiss all {alerts.length} notification{alerts.length === 1 ? '' : 's'}?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={dismissAll}
                      className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                    >
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {error && (
          <div className="text-sm text-red-600 p-3 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {recentNotifications.map((alert) => (
                <div
                  key={alert.messageId}
                  className={`p-3 border rounded-lg transition-all hover:shadow-sm cursor-pointer group ${
                    !alert.isRead 
                      ? 'border-l-4 border-l-blue-500 bg-blue-50/50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator */}
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      !alert.isRead ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                    
                    <div className="flex-1 min-w-0">
                      {/* Title and Priority */}
                      <div className="flex items-center gap-2 mb-1">
                        {alert.title && (
                          <h4 className="font-medium text-gray-900 text-sm truncate">
                            {alert.title}
                          </h4>
                        )}
                        {alert.priority && (
                          <Badge 
                            variant="secondary" 
                            className={`text-xs px-1.5 py-0.5 ${getPriorityColor(alert.priority)}`}
                          >
                            {getPriorityText(alert.priority)}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Content Preview */}
                      <p className="text-sm text-gray-600 mb-2 leading-relaxed">
                        {truncateText(renderNotificationContent(alert))}
                      </p>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatLocalDateTime(alert.createdAt)}
                          </span>
                          {alert.createdByName && (
                            <>
                              <span>•</span>
                              <span>By {alert.createdByName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Arrow indicator */}
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            
            {/* View All Button */}
            <div className="pt-2 border-t border-gray-100">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-center text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                View All Notifications
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
