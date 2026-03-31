import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { useSystemAlerts } from '@/hooks/useSystemAlerts';
import { isAfter, subDays } from 'date-fns';
import { formatLocalDateTime } from '@/helpers/formatISOTime';
import type { UserMessage } from '@/types/announcement';
import { cn } from "@/lib/utils";
import { playIllustrations } from "@/assets/play-illustrations";
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
        return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
      case 'MEDIUM':
        return 'bg-warning/10 text-warning hover:bg-warning/20';
      case 'LOW':
        return 'bg-info/10 text-info hover:bg-info/20';
      default:
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
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
    <Card className={cn(
      "relative overflow-hidden",
      className,
      // Vibrant Styles - Flat Pastel
      "[.ui-vibrant_&]:bg-fuchsia-50/50 dark:[.ui-vibrant_&]:bg-fuchsia-950/20",
      "[.ui-vibrant_&]:border-fuchsia-200/50 dark:[.ui-vibrant_&]:border-fuchsia-800/30",
      // Play Styles - Solid Bold Duolingo
      "[.ui-play_&]:bg-[#FF9600] [.ui-play_&]:border-2 [.ui-play_&]:border-[#e08600] [.ui-play_&]:rounded-2xl [.ui-play_&]:shadow-[0_4px_0_0_#e08600]",
      "[.ui-play_&]:text-white [.ui-play_&]:font-bold",
      "[.ui-play_&]:flex [.ui-play_&]:flex-row [.ui-play_&]:md:flex-col"
    )}>
      {/* Play SVG: side on mobile, top on desktop */}
      <div className="hidden [.ui-play_&]:!flex order-2 md:order-first w-28 md:w-full items-center justify-center bg-white/10 p-2 md:px-6 md:pt-4 md:pb-2 flex-shrink-0">
        <playIllustrations.Celebration className="h-24 md:h-28 w-auto text-white" />
      </div>
      <div className="[.ui-play_&]:flex-1 [.ui-play_&]:min-w-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 min-w-0">
            <Bell className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="truncate">Recent System Notifications</span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {recentNotifications.length} recent
            </Badge>
            {alerts.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="z-[10001]">
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
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
          <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
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
                  className={cn(
                    "p-3 border rounded-lg transition-all hover:shadow-sm cursor-pointer group",
                    !alert.isRead
                      ? "border-l-4 border-l-primary bg-primary/5 [.ui-vibrant_&]:bg-fuchsia-100/30 dark:[.ui-vibrant_&]:bg-fuchsia-900/20"
                      : "border-border hover:border-primary/50",
                    // Vibrant Styles - Flat Pastel
                    "[.ui-vibrant_&]:hover:bg-fuchsia-100/40 [.ui-vibrant_&]:hover:border-fuchsia-200/60 dark:[.ui-vibrant_&]:hover:bg-fuchsia-900/30",
                    // Play Styles - Solid Bold Duolingo
                    "[.ui-play_&]:bg-white/20 [.ui-play_&]:border-2 [.ui-play_&]:border-white/30 [.ui-play_&]:rounded-xl [.ui-play_&]:hover:bg-white/30",
                    !alert.isRead && "[.ui-play_&]:border-l-4 [.ui-play_&]:border-l-white [.ui-play_&]:bg-white/25"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator */}
                    <div className={`w-2 h-2 rounded-full mt-2 ${!alert.isRead ? 'bg-primary' : 'bg-muted'
                      }`} />

                    <div className="flex-1 min-w-0">
                      {/* Title and Priority */}
                      <div className="flex items-center gap-2 mb-1">
                        {alert.title && (
                          <h4 className="font-medium text-foreground text-sm truncate">
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
                      <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                        {truncateText(renderNotificationContent(alert))}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>

            {/* View All Button */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-sm text-primary hover:text-primary hover:bg-primary/10"
              >
                View All Notifications
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
      </div>
    </Card>
  );
};

