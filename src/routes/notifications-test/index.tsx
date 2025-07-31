import { createFileRoute } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { NotificationTestPanel } from "@/components/common/notifications/NotificationTestPanel";
import { useEffect } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";

export const Route = createFileRoute("/notifications-test/")({
  component: () => {
    return (
      <LayoutContainer>
        <NotificationsTestPage />
      </LayoutContainer>
    );
  },
});

function NotificationsTestPage() {
  const { setNavHeading } = useNavHeadingStore();

  useEffect(() => {
    setNavHeading("Notifications Test");
  }, [setNavHeading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Push Notifications Test
          </h1>
          <p className="text-gray-600">
            Test and verify push notification functionality across platforms
          </p>
        </div>
        
        <NotificationTestPanel />
      </div>
    </div>
  );
} 