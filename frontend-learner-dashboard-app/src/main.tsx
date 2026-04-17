import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React, { lazy, Suspense } from "react";
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
import { installChunkErrorHandler } from "./lib/chunk-reload";
import {
  getTokenFromCookie,
  getTokenDecodedData,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { getCachedInstituteBranding } from "@/services/domain-routing";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";

// Recover stale tabs whose cached chunk URLs 404 after a new deploy.
// Must run before React renders so failures during the first lazy import
// are intercepted at the window level instead of bubbling to an error boundary.
installChunkErrorHandler();

/**
 * Read the current access token synchronously from the fastest available
 * source. Learner dashboard stores tokens in Capacitor Preferences (async),
 * localStorage (sync), and cookies (sync) — we try the two sync sources so
 * Sentry's beforeSend can run without awaiting Capacitor.
 */
const readAccessTokenSync = (): string | null => {
  try {
    if (typeof localStorage !== "undefined") {
      const fromLs = localStorage.getItem(TokenKey.accessToken);
      if (fromLs) return fromLs;
    }
  } catch {
    // localStorage may be blocked in some WebViews — fall through
  }
  return getTokenFromCookie(TokenKey.accessToken);
};

if (import.meta.env.VITE_ENABLE_SENTRY === "true") {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: true,
    ignoreErrors: [
      // Stale-tab chunk load failures. We auto-reload via installChunkErrorHandler,
      // so these are self-healing and should not reach Sentry.
      "Failed to fetch dynamically imported module",
      "Importing a module script failed",
      "error loading dynamically imported module",
      "Unable to preload CSS",
      "ChunkLoadError",
    ],
    beforeSend(event) {
      try {
        const token = readAccessTokenSync();
        const tokenData = token ? getTokenDecodedData(token) : undefined;
        if (tokenData?.user || tokenData?.email || tokenData?.username) {
          event.user = {
            ...(event.user ?? {}),
            id: tokenData.user ?? tokenData.sub,
            username: tokenData.username,
            email: tokenData.email,
          };
        }

        const branding = getCachedInstituteBranding();
        const storeDetails =
          useInstituteDetailsStore.getState().instituteDetails;
        const instituteId =
          branding?.instituteId ?? storeDetails?.id ?? null;
        const instituteName =
          branding?.instituteName ?? storeDetails?.institute_name ?? null;

        // Domain context
        const domain = typeof window !== "undefined" ? window.location.hostname : "unknown";
        const fullUrl = typeof window !== "undefined" ? window.location.href : "unknown";

        event.tags = {
          ...(event.tags ?? {}),
          "institute.id": instituteId ?? "unknown",
          "institute.name": instituteName ?? "unknown",
          "domain": domain,
          "app": "learner-dashboard",
        };

        event.contexts = {
          ...(event.contexts ?? {}),
          navigation: {
            url: fullUrl,
            domain,
          },
        };

        const username =
          tokenData?.username ?? tokenData?.email ?? "unknown";
        const suffix = ` — user: ${username}, institute: ${
          instituteName ?? "unknown"
        }`;
        const exc = event.exception?.values?.[0];
        if (exc?.value) {
          const originalValue = exc.value;
          event.fingerprint = [exc.type ?? "Error", originalValue];
          exc.value = `${originalValue}${suffix}`;
        } else if (event.message) {
          const originalMessage = String(event.message);
          event.fingerprint = ["message", originalMessage];
          event.message = `${originalMessage}${suffix}`;
        }
      } catch {
        // never block event capture on enrichment failures
      }
      return event;
    },
  });
}

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
  import("./components/lazy/NotificationInitializer")
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
