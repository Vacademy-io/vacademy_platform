import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React, { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import RootErrorComponent from "./components/core/deafult-error";
import RootNotFoundComponent from "./components/core/default-not-found";
import RootPendingComponent from "./components/core/default-pending";
import "./index.css";
import { ThemeProvider as ColorThemeProvider } from "./providers/theme/theme-provider";
import { ThemeProvider as ModeThemeProvider } from "./providers/theme-provider";
import { SidebarProvider } from "./components/ui/sidebar";
import { routeTree } from "./routeTree.gen";
import "./i18n";
import { Toaster } from "./components/ui/sonner";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { initializeAnalytics, identifyUser } from "./lib/analytics";
import { getDecodedAccessTokenFromStorage } from "@/lib/auth/sessionUtility";

// Initialize Amplitude analytics
initializeAnalytics();

// Attempt to identify returning user on app start
(async () => {
  try {
    const decoded = await getDecodedAccessTokenFromStorage();
    const uid = decoded?.user;
    if (uid) {
      identifyUser(uid, { username: decoded?.username, email: decoded?.email });
    }
  } catch {}
})();

const queryClient = new QueryClient();

// Notification initialization wrapper
const NotificationInitializer = ({ children }: { children: React.ReactNode }) => {
  // Initialize push notifications when app starts
  usePushNotifications();
  
  // Listen for messages forwarded by the service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    
    type SwForwardedMessage = { type?: string; payload?: {
      messageId?: string;
      notification?: { title?: string; body?: string };
      data?: Record<string, unknown>;
    }};

    const handleSwMessage = (event: MessageEvent<SwForwardedMessage>) => {
      const data = event.data as SwForwardedMessage;
      if (!data || data.type !== 'FCM_BACKGROUND_MESSAGE') return;

      // Convert to app notification shape and dispatch to store
      import('./services/push-notifications/push-notification-service').then(({ pushNotificationService }) => {
        const payload = data.payload || {};
        const title = payload?.notification?.title || payload?.data?.title || 'New notification';
        const body = payload?.notification?.body || payload?.data?.body || '';
        const id = payload?.messageId || String(Date.now());
        pushNotificationService.dispatch({
          title,
          body,
          id,
          data: payload?.data || {}
        } as unknown as import('@capacitor/push-notifications').PushNotificationSchema);
      });
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, []);
  return <>{children}</>;
};

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultNotFoundComponent: RootNotFoundComponent,
  defaultErrorComponent: RootErrorComponent,
  defaultPendingComponent: RootPendingComponent,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ModeThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <ColorThemeProvider>
        <QueryClientProvider client={queryClient}>
          <NotificationInitializer>
            <SidebarProvider>
              <RouterProvider router={router} />
              <Toaster />
            </SidebarProvider>
          </NotificationInitializer>
        </QueryClientProvider>
      </ColorThemeProvider>
      </ModeThemeProvider>
    </StrictMode>
  );
}
