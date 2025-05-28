import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import RootErrorComponent from './components/core/deafult-error';
import RootNotFoundComponent from './components/core/default-not-found';
import RootPendingComponent from './components/core/default-pending';
import './index.css';
// import { ThemeProvider } from "./providers/theme-provider";
import { SidebarProvider } from './components/ui/sidebar';
import { routeTree } from './routeTree.gen';
import './i18n';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './providers/theme/theme-provider';

const queryClient = new QueryClient();

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
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <StrictMode>
            {/* <ThemeProvider defaultTheme="light" storageKey="ui-theme"> */}
            <ThemeProvider>
                <QueryClientProvider client={queryClient}>
                    <SidebarProvider>
                        <RouterProvider router={router} />
                        <Toaster />
                    </SidebarProvider>
                </QueryClientProvider>
            </ThemeProvider>
            {/* </ThemeProvider> */}
        </StrictMode>
    );
}
