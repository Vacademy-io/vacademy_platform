import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React, { StrictMode, lazy, Suspense } from "react";
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
import "./lib/debug";

// Initialize Sentry immediately (synchronous import, but deferred init)

// Lazy load analytics initialization (deferred to after first paint)
const initAnalytics = async () => {
  const { initializeAnalytics, identifyUser } = await import("./lib/analytics");
  const { getDecodedAccessTokenFromStorage } = await import("@/lib/auth/sessionUtility");

  initializeAnalytics();

  try {
    const decoded = await getDecodedAccessTokenFromStorage();
    const uid = decoded?.user;
    if (uid) {
      identifyUser(uid, { username: decoded?.username, email: decoded?.email });
    }
  } catch { }
};

// Initialize analytics after initial render using requestIdleCallback
const initializeServices = () => {
  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      initAnalytics();
    });
  } else {
    setTimeout(() => {
      initAnalytics();
    }, 2000);
  }
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Optimize query behavior
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (was: cacheTime, renamed in v5)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Lazy load push notification hook to avoid Firebase initialization blocking render
const LazyNotificationInitializer = lazy(() =>
  import("./components/lazy/NotificationInitializer").then(mod => ({
    default: mod.NotificationInitializer
  }))
);

// Fallback wrapper for notifications
const NotificationWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={null}>
      <LazyNotificationInitializer />
      {children}
    </Suspense>
  );
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
  // Enable preloading for better perceived performance
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
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

  // Initialize analytics after first paint
  initializeServices();

  root.render(
    <>
      <ModeThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <ColorThemeProvider>
          <QueryClientProvider client={queryClient}>
            <NotificationWrapper>
              <SidebarProvider>
                <RouterProvider router={router} />
                <Toaster />
              </SidebarProvider>
            </NotificationWrapper>
          </QueryClientProvider>
        </ColorThemeProvider>
      </ModeThemeProvider>
    </>
  );
}
