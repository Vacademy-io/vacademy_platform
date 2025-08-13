import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React, { StrictMode } from "react";
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
import { initializeAnalytics } from "./lib/analytics";

// Initialize Amplitude analytics
initializeAnalytics();

const queryClient = new QueryClient();

// Notification initialization wrapper
const NotificationInitializer = ({ children }: { children: React.ReactNode }) => {
  // Initialize push notifications when app starts
  usePushNotifications();
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
      <ModeThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
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
