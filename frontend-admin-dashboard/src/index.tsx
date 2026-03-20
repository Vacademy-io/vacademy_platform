import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
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
import { CourseSettingsProvider } from './providers/course-settings-provider';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';
import {
    resolveInstituteForCurrentHost,
    getPublicUrl,
    cacheInstituteBranding,
    getCachedInstituteBranding,
} from '@/services/domain-routing';
import { resolveFontStack } from '@/utils/font';
import { useTitleStore } from '@/stores/useTitleStore';

// Initialize Amplitude as early as possible on client
if (typeof window !== 'undefined') {
    import('./lib/amplitude')
        .then((m) => m.initializeAmplitude())
        .catch(() => {
            // Ignore analytics failures
        });
}

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

if (import.meta.env.VITE_ENABLE_SENTRY === 'true') {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        sendDefaultPii: true,
    });
}

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
    // Dev-only: filter noisy DOMNodeInserted deprecation warning from third-party libs
    if (!import.meta.env.PROD) {
        const originalWarn = console.warn.bind(console);
        console.warn = (...args: unknown[]) => {
            const first = args?.[0];
            if (
                typeof first === 'string' &&
                first.includes("Listener added for a 'DOMNodeInserted' mutation event")
            ) {
                return;
            }
            originalWarn(...args);
        };
    }

    const initializeBranding = async () => {
        try {
            const titleStore = useTitleStore.getState();

            const cached = getCachedInstituteBranding();
            if (cached) {
                // Set title from cached data with fallback to "Admin Dashboard"
                const tabText = cached.tabText;
                const title = tabText && tabText.trim() ? tabText.trim() : 'Admin Dashboard';
                titleStore.setGlobalTitle(title);
                const themeCode = cached.instituteThemeCode ?? cached.theme;
                if (themeCode) {
                    localStorage.setItem('theme-code', themeCode);
                }
                if (cached.fontFamily) {
                    const stack = resolveFontStack(cached.fontFamily);
                    if (stack) {
                        document.documentElement.style.setProperty('--app-font-family', stack);
                        document.body.style.fontFamily = stack;
                    }
                }
                if (cached.instituteLogoUrl) {
                    const store = useInstituteLogoStore.getState();
                    if (store && store.setInstituteLogo) {
                        store.setInstituteLogo(cached.instituteLogoUrl);
                    }
                }
                if (cached.tabIconFileId && !cached.tabIconUrl) {
                    const iconUrl = await getPublicUrl(cached.tabIconFileId || '');
                    if (iconUrl) {
                        titleStore.setGlobalFavicon(iconUrl);
                    }
                } else if (cached.tabIconUrl) {
                    titleStore.setGlobalFavicon(cached.tabIconUrl);
                }
            }

            const data = await resolveInstituteForCurrentHost();
            if (!data) {
                // If no data from API, ensure we have a fallback title
                titleStore.setGlobalTitle('Admin Dashboard');
                return;
            }

            const [logoUrl, iconUrl] = await Promise.all([
                getPublicUrl(data.instituteLogoFileId),
                getPublicUrl(data.tabIconFileId),
            ]);

            cacheInstituteBranding(data.instituteId, {
                ...data,
                instituteLogoUrl: logoUrl || undefined,
                tabIconUrl: iconUrl || undefined,
            });

            // Set title from API response with fallback to "Admin Dashboard"
            const tabText = data.tabText;
            const title = tabText && tabText.trim() ? tabText.trim() : 'Admin Dashboard';
            titleStore.setGlobalTitle(title);

            // Set favicon from API response
            if (iconUrl) {
                titleStore.setGlobalFavicon(iconUrl);
            }

            if (logoUrl) {
                const store = useInstituteLogoStore.getState();
                if (store && store.setInstituteLogo) {
                    store.setInstituteLogo(logoUrl);
                }
            }

            // Apply theme code if provided
            const themeCode = data.instituteThemeCode ?? data.theme;
            if (themeCode) {
                localStorage.setItem('theme-code', themeCode);
            }

            // Apply font if provided
            if (data.fontFamily) {
                const stack = resolveFontStack(data.fontFamily);
                if (stack) {
                    document.documentElement.style.setProperty('--app-font-family', stack);
                    document.body.style.fontFamily = stack;
                }
            }
        } catch {
            // ignore branding failures - but ensure we have a fallback title
            const titleStore = useTitleStore.getState();
            titleStore.setGlobalTitle('Admin Dashboard');
        }
    };

    await initializeBranding();

    const root = ReactDOM.createRoot(rootElement);
    const app = (
        // <ThemeProvider defaultTheme="light" storageKey="ui-theme">
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <CourseSettingsProvider>
                    <SidebarProvider>
                        <RouterProvider router={router} />
                        <Toaster />
                    </SidebarProvider>
                </CourseSettingsProvider>
            </QueryClientProvider>
        </ThemeProvider>
        // </ThemeProvider>
    );

    // Disable StrictMode in development to suppress noisy library warnings (e.g., findDOMNode)
    root.render(import.meta.env.PROD ? <StrictMode>{app}</StrictMode> : app);
}
