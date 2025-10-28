import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React, { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
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

// PWA Service Worker Registration
let hasShownUpdatePrompt = false;

const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && Capacitor.getPlatform() === 'web') {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      // Only show update prompt when updatefound event fires (new version detected)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        // Track if this is a legitimate update or just initial registration
        const isUpdate = navigator.serviceWorker.controller !== null;

        newWorker.addEventListener('statechange', () => {
          // Only prompt if:
          // 1. There's already a controller (not first install)
          // 2. New worker is installed and ready
          // 3. We haven't shown the prompt yet in this session
          if (
            newWorker.state === 'installed' && 
            isUpdate && 
            !hasShownUpdatePrompt
          ) {
            hasShownUpdatePrompt = true;
            console.log('[PWA] New version available');
            window.location.reload();
          }
        });
      });

      console.log('[PWA] Service worker registered:', registration);
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  }
};

// Notification initialization wrapper
const NotificationInitializer = ({ children }: { children: React.ReactNode }) => {
  // Initialize push notifications when app starts
  usePushNotifications();

  // Register PWA service worker
  React.useEffect(() => {
    registerServiceWorker();
  }, []);
  
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
