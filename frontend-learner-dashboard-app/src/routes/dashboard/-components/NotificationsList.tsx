import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Megaphone } from "@phosphor-icons/react";
import { NotifcationCard } from "./NotificationCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/design-system/states";
import { useSystemAlerts } from "@/hooks/useSystemAlerts";
import { useAnnouncementStore } from "@/stores/announcement-store";
import { format } from "date-fns";
import { parseApiDate } from "@/helpers/formatISOTime";
import type { UserMessage } from "@/types/announcement";

/** One row per unique title+content pair; `alert` is the most recent occurrence. */
interface GroupedNotification {
  alert: UserMessage;
  count: number;
  isRead: boolean;
}

/** Single date format for notifications: "Jun 10, 4:14 PM" (year only when it differs). */
function formatNotificationDate(isoString?: string | null): string {
  const date = parseApiDate(isoString);
  if (!date) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "MMM d, h:mm a" : "MMM d, yyyy, h:mm a");
}

const getCreatedAtMs = (alert: UserMessage): number =>
  parseApiDate(alert.createdAt)?.getTime() ?? 0;

/** Collapse identical notifications (same title + content) into one row with a count. */
function groupNotifications(alerts: UserMessage[]): GroupedNotification[] {
  const groups = new Map<string, GroupedNotification>();

  for (const alert of alerts) {
    const key = `${alert.title ?? ""}::${alert.content?.content ?? ""}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { alert, count: 1, isRead: alert.isRead });
    } else {
      existing.count += 1;
      existing.isRead = existing.isRead && alert.isRead;
      if (getCreatedAtMs(alert) > getCreatedAtMs(existing.alert)) {
        existing.alert = alert; // keep the latest occurrence (latest timestamp wins)
      }
    }
  }

  return [...groups.values()].sort(
    (a, b) => getCreatedAtMs(b.alert) - getCreatedAtMs(a.alert)
  );
}

/** Plain-text preview of a message body (strips HTML when needed). */
function getMessagePreview(message: UserMessage): string {
  if (message.content?.type === "html") {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = message.content.content;
    return tempDiv.textContent || tempDiv.innerText || "";
  }
  return message.content?.content ?? "";
}

interface MessageGroupListProps {
  groups: GroupedNotification[];
}

function MessageGroupList({ groups }: MessageGroupListProps) {
  return (
    <div className="space-y-4">
      {groups.map(({ alert, count, isRead }) => (
        <div key={alert.messageId} className="relative">
          {count > 1 && (
            <Badge
              variant="secondary"
              className="absolute -top-2 -end-2 z-10 border border-border bg-background text-xs shadow-sm"
            >
              ×{count}
            </Badge>
          )}
          <NotifcationCard
            title={alert.title || "Notification"}
            description={getMessagePreview(alert)}
            date={formatNotificationDate(alert.createdAt)}
            isNew={!isRead}
          />
        </div>
      ))}
    </div>
  );
}

export function NotificationList() {
  const {
    alerts,
    loading: alertsLoading,
    error: alertsError,
    hasMore,
    loadMore,
    refresh,
  } = useSystemAlerts({
    enablePolling: true,
    autoMarkAsRead: false,
  });

  const { dashboardPins, fetchDashboardPins } = useAnnouncementStore();

  useEffect(() => {
    fetchDashboardPins();
  }, [fetchDashboardPins]);

  const generalGroups = groupNotifications(
    alerts.filter((alert) => !alert.isDismissed)
  );
  const announcementGroups = groupNotifications(
    dashboardPins.items.filter((pin) => !pin.isDismissed)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary-50/20 p-3 sm:p-5 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 start-1/4 w-72 h-72 bg-gradient-to-br from-primary-100/30 to-transparent rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-gradient-to-br from-muted/40 to-transparent rounded-full blur-3xl animate-pulse"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <Tabs defaultValue="General" className="w-full">
          <div className="mb-6 animate-fade-in-down">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
                Notifications
              </h1>
              <p className="text-sm text-muted-foreground">
                Stay updated with your latest activities and announcements
              </p>
            </div>

            <TabsList className="bg-muted p-1 w-fit mx-auto shadow-sm border border-border">
              <TabsTrigger
                className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:bg-muted/80"
                value="General"
              >
                <span className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  General Notifications
                </span>
              </TabsTrigger>
              <TabsTrigger
                className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:bg-muted/80"
                value="Announcement"
              >
                <span className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Announcements
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* General notifications (system alerts) */}
          <TabsContent className="grid gap-4" value="General">
            {alertsLoading && alerts.length === 0 ? (
              <LoadingState variant="list" count={3} />
            ) : alertsError ? (
              <ErrorState
                title="Could not load notifications"
                message={alertsError}
                onRetry={refresh}
              />
            ) : generalGroups.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications yet"
                description="You are all caught up. New notifications will show up here."
              />
            ) : (
              <>
                <MessageGroupList groups={generalGroups} />
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={alertsLoading}
                    >
                      {alertsLoading ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Announcements (dashboard pins) */}
          <TabsContent className="grid gap-4" value="Announcement">
            {dashboardPins.loading && dashboardPins.items.length === 0 ? (
              <LoadingState variant="list" count={3} />
            ) : dashboardPins.error ? (
              <ErrorState
                title="Could not load announcements"
                message={dashboardPins.error}
                onRetry={fetchDashboardPins}
              />
            ) : announcementGroups.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="No announcements yet"
                description="Announcements from your institute will show up here."
              />
            ) : (
              <MessageGroupList groups={announcementGroups} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
