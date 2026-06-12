import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CaretRight, Clock, Trash } from '@phosphor-icons/react';
import { useSystemAlerts } from '@/hooks/useSystemAlerts';
import { isAfter, subDays } from 'date-fns';
import { parseApiDate } from '@/helpers/formatISOTime';
import type { UserMessage } from '@/types/announcement';
import {
  formatNotificationDate,
  groupNotifications,
  type GroupedNotification,
} from '@/lib/notifications';
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
  const navigate = useNavigate();
  const { alerts, loading, error, isEnabled, isLoadingSettings, dismissAll } = useSystemAlerts({
    enablePolling: false, // Don't poll in dashboard widget
    autoMarkAsRead: false, // Don't auto-mark as read in dashboard
  });

  const goToInbox = () => {
    navigate({ to: '/dashboard/notifications' });
  };

  // Filter notifications from last 7 days, dedupe identical ones, limit to 5 rows
  const recentNotifications = React.useMemo((): GroupedNotification[] => {
    const sevenDaysAgo = subDays(new Date(), 7);

    const recent = alerts.filter(alert => {
      const createdAt = parseApiDate(alert.createdAt);
      return !!createdAt && isAfter(createdAt, sevenDaysAgo) && !alert.isDismissed;
    });

    return groupNotifications(recent).slice(0, 5); // Limit to max 5 rows
  }, [alerts]);

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
      "[.ui-play_&]:bg-play-warn [.ui-play_&]:border-2 [.ui-play_&]:border-play-warn-deep [.ui-play_&]:rounded-2xl [.ui-play_&]:shadow-play-4d-warn",
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
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {recentNotifications.length} recent
          </Badge>
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
              {recentNotifications.map(({ alert, count, isRead }) => (
                <div
                  key={alert.messageId}
                  role="button"
                  tabIndex={0}
                  aria-label="Open notifications inbox"
                  onClick={goToInbox}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      goToInbox();
                    }
                  }}
                  className={cn(
                    "p-3 border rounded-lg transition-all hover:shadow-sm cursor-pointer group",
                    !isRead
                      ? "border-l-4 border-l-primary bg-primary/5 [.ui-vibrant_&]:bg-fuchsia-100/30 dark:[.ui-vibrant_&]:bg-fuchsia-900/20"
                      : "border-border hover:border-primary/50",
                    // Vibrant Styles - Flat Pastel
                    "[.ui-vibrant_&]:hover:bg-fuchsia-100/40 [.ui-vibrant_&]:hover:border-fuchsia-200/60 dark:[.ui-vibrant_&]:hover:bg-fuchsia-900/30",
                    // Play Styles - Solid Bold Duolingo
                    "[.ui-play_&]:bg-white/20 [.ui-play_&]:border-2 [.ui-play_&]:border-white/30 [.ui-play_&]:rounded-xl [.ui-play_&]:hover:bg-white/30",
                    !isRead && "[.ui-play_&]:border-l-4 [.ui-play_&]:border-l-white [.ui-play_&]:bg-white/25"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator */}
                    <div className={`w-2 h-2 rounded-full mt-2 ${!isRead ? 'bg-primary' : 'bg-muted'
                      }`} />

                    <div className="flex-1 min-w-0">
                      {/* Title, count, and priority */}
                      <div className="flex items-center gap-2 mb-1">
                        {alert.title && (
                          <h4 className="font-medium text-foreground text-sm truncate">
                            {alert.title}
                          </h4>
                        )}
                        {count > 1 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5 flex-shrink-0">
                            ×{count}
                          </Badge>
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
                            {formatNotificationDate(alert.createdAt)}
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
                    <CaretRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer: quiet clear-all + view all */}
            <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
              {alerts.length > 0 ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={loading}
                    >
                      <Trash className="h-3.5 w-3.5 mr-1" />
                      Clear all
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="z-50">
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
              ) : (
                <span />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={goToInbox}
                className="text-sm text-primary hover:text-primary hover:bg-primary/10"
              >
                View All Notifications
                <CaretRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
      </div>
    </Card>
  );
};

