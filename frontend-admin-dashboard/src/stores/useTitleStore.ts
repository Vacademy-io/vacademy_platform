import { create } from 'zustand';
import { getCachedInstituteBranding } from '@/services/domain-routing';

interface TitleStore {
    globalTitle: string | null;
    globalFavicon: string | null;
    setGlobalTitle: (title: string | null) => void;
    setGlobalFavicon: (faviconUrl: string | null) => void;
    updateTitleFromCache: () => void;
    ensureCorrectTitle: () => void;
    ensureCorrectFavicon: () => void;
}

export const useTitleStore = create<TitleStore>((set, get) => ({
    globalTitle: null,
    globalFavicon: null,

    setGlobalTitle: (title: string | null) => {
        set({ globalTitle: title });
        get().ensureCorrectTitle();
    },

    setGlobalFavicon: (faviconUrl: string | null) => {
        set({ globalFavicon: faviconUrl });
        get().ensureCorrectFavicon();
    },

    updateTitleFromCache: () => {
        try {
            const cached = getCachedInstituteBranding();
            const tabText = cached?.tabText;
            const title = tabText && tabText.trim() ? tabText.trim() : 'Admin Dashboard';
            set({ globalTitle: title });
            document.title = title;

            // Also update favicon from cache
            const faviconUrl = cached?.tabIconUrl;
            if (faviconUrl) {
                set({ globalFavicon: faviconUrl });
                get().ensureCorrectFavicon();
            }
        } catch (error) {
            set({ globalTitle: 'Admin Dashboard' });
            document.title = 'Admin Dashboard';
        }
    },

    ensureCorrectTitle: () => {
        const { globalTitle } = get();
        const finalTitle = globalTitle || 'Admin Dashboard';
        document.title = finalTitle;
    },

    ensureCorrectFavicon: () => {
        const { globalFavicon } = get();
        if (globalFavicon) {
            const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
            if (link && link.href !== globalFavicon) {
                link.href = globalFavicon;
            }
        }
    },
}));

// Override Helmet's title changes and protect favicon
if (typeof window !== 'undefined') {
    const originalTitleSetter = Object.getOwnPropertyDescriptor(Document.prototype, 'title')?.set;

    if (originalTitleSetter) {
        Object.defineProperty(document, 'title', {
            set: function (newTitle: string) {
                // Allow the title to be set initially, but then override with our global title
                originalTitleSetter?.call(this, newTitle);

                // Small delay to ensure our title takes precedence over Helmet
                setTimeout(() => {
                    const store = useTitleStore.getState();
                    store.ensureCorrectTitle();
                }, 10);
            },
            get: function () {
                return document.getElementsByTagName('title')[0]?.textContent || '';
            },
            configurable: true,
        });
    }

    // Set up MutationObserver to protect favicon from being changed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
                const target = mutation.target as HTMLLinkElement;
                if (target.rel === 'icon') {
                    // Favicon href was changed, restore our global favicon
                    setTimeout(() => {
                        const store = useTitleStore.getState();
                        store.ensureCorrectFavicon();
                    }, 10);
                }
            }
        });
    });

    // Start observing favicon changes
    const faviconLink = document.querySelector("link[rel='icon']");
    if (faviconLink) {
        observer.observe(faviconLink, {
            attributes: true,
            attributeFilter: ['href'],
        });
    }

    // Also observe for new favicon links being added
    const headObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as Element;
                    if (element.tagName === 'LINK' && element.getAttribute('rel') === 'icon') {
                        // New favicon link added, start observing it and restore our favicon
                        observer.observe(element, {
                            attributes: true,
                            attributeFilter: ['href'],
                        });
                        setTimeout(() => {
                            const store = useTitleStore.getState();
                            store.ensureCorrectFavicon();
                        }, 10);
                    }
                }
            });
        });
    });

    headObserver.observe(document.head, {
        childList: true,
    });
}
