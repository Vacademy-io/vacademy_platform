import { create } from 'zustand';
import { CatalogueConfig, Page, Component } from '../-types/editor-types';

const MAX_HISTORY_LENGTH = 50;

interface EditorState {
    config: CatalogueConfig | null;
    originalConfig: CatalogueConfig | null;

    // History for undo/redo
    history: CatalogueConfig[];
    historyIndex: number;

    selectedPageId: string | null;
    selectedComponentId: string | null;
    selectedGlobalSettings: boolean;
    selectedGlobalLayout: 'header' | 'footer' | null;
    activeTab: 'visual' | 'json';
    previewViewport: 'desktop' | 'tablet' | 'mobile';

    // Actions
    setConfig: (config: CatalogueConfig) => void;
    selectPage: (pageId: string) => void;
    selectComponent: (componentId: string | null) => void;
    selectGlobalSettings: () => void;
    selectGlobalLayout: (section: 'header' | 'footer') => void;
    setViewport: (viewport: 'desktop' | 'tablet' | 'mobile') => void;
    setActiveTab: (tab: 'visual' | 'json') => void;

    updateConfig: (newConfig: CatalogueConfig) => void;
    updateComponent: (pageId: string, componentId: string, updates: Partial<Component>) => void;
    updateGlobalSettings: (updates: any) => void;
    reorderComponents: (pageId: string, newComponents: Component[]) => void;
    addComponent: (pageId: string, component: Component) => void;
    deleteComponent: (pageId: string, componentId: string) => void;
    duplicateComponent: (pageId: string, componentId: string) => void;
    addPage: (page: Page) => void;
    deletePage: (pageId: string) => void;
    duplicatePage: (pageId: string) => void;
    togglePagePublished: (pageId: string) => void;
    updatePageSeo: (pageId: string, seo: Page['seo']) => void;

    // Layout slot actions
    addToSlot: (pageId: string, layoutId: string, slotIndex: number, component: Component) => void;
    reorderSlot: (pageId: string, layoutId: string, slotIndex: number, newComponents: Component[]) => void;
    deleteFromSlot: (pageId: string, layoutId: string, slotIndex: number, componentId: string) => void;

    // Undo/Redo
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
}

// ── Recursive tree helpers ───────────────────────────────────────────────────
// These walk the full component tree including nested slots inside layout
// components, so that updateComponent / deleteComponent work at any depth.

/** Regenerate all component IDs inside a deep-cloned layout's slots so that
 *  a duplicate layout doesn't share IDs with the original. */
function regenerateSlotIds(component: Component): Component {
    if (!Array.isArray(component.props?.slots)) return component;
    return {
        ...component,
        props: {
            ...component.props,
            slots: (component.props.slots as Component[][]).map((slot) =>
                slot.map((child) => ({
                    ...regenerateSlotIds(child),
                    id: `${child.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                }))
            ),
        },
    };
}

function mapComponents(components: Component[], fn: (c: Component) => Component): Component[] {
    return components.map((comp) => {
        const updated = fn(comp);
        if (Array.isArray(updated.props?.slots)) {
            return {
                ...updated,
                props: {
                    ...updated.props,
                    slots: (updated.props.slots as Component[][]).map((slot) =>
                        mapComponents(slot, fn)
                    ),
                },
            };
        }
        return updated;
    });
}

function filterComponents(components: Component[], predicate: (c: Component) => boolean): Component[] {
    return components
        .filter(predicate)
        .map((comp) => {
            if (Array.isArray(comp.props?.slots)) {
                return {
                    ...comp,
                    props: {
                        ...comp.props,
                        slots: (comp.props.slots as Component[][]).map((slot) =>
                            filterComponents(slot, predicate)
                        ),
                    },
                };
            }
            return comp;
        });
}
// ─────────────────────────────────────────────────────────────────────────────

// Helper to push config to history
const pushToHistory = (state: EditorState, newConfig: CatalogueConfig): Partial<EditorState> => {
    // Slice history to current index (discard redo stack on new change)
    const newHistory = [
        ...state.history.slice(0, state.historyIndex + 1),
        JSON.parse(JSON.stringify(newConfig)),
    ];
    // Limit history length
    const trimmedHistory =
        newHistory.length > MAX_HISTORY_LENGTH
            ? newHistory.slice(newHistory.length - MAX_HISTORY_LENGTH)
            : newHistory;
    return {
        config: newConfig,
        history: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
    };
};

export const useEditorStore = create<EditorState>((set, get) => ({
    config: null,
    originalConfig: null,
    history: [],
    historyIndex: -1,
    selectedPageId: null,
    selectedComponentId: null,
    selectedGlobalSettings: false,
    selectedGlobalLayout: null,
    activeTab: 'visual',
    previewViewport: 'desktop',

    setConfig: (config) =>
        set({
            config,
            originalConfig: JSON.parse(JSON.stringify(config)),
            history: [JSON.parse(JSON.stringify(config))],
            historyIndex: 0,
            selectedPageId: config.pages[0]?.id || null,
            selectedGlobalSettings: false,
            selectedGlobalLayout: null,
        }),

    selectPage: (id) =>
        set({ selectedPageId: id, selectedComponentId: null, selectedGlobalSettings: false, selectedGlobalLayout: null }),
    selectComponent: (id) => set({ selectedComponentId: id, selectedGlobalSettings: false, selectedGlobalLayout: null }),
    selectGlobalSettings: () =>
        set({ selectedGlobalSettings: true, selectedPageId: null, selectedComponentId: null, selectedGlobalLayout: null }),
    selectGlobalLayout: (section) =>
        set((state) => ({ selectedGlobalSettings: false, selectedGlobalLayout: section, selectedPageId: state.selectedPageId, selectedComponentId: null })),
    setViewport: (v) => set({ previewViewport: v }),
    setActiveTab: (t) => set({ activeTab: t }),

    updateConfig: (newConfig) => set((state) => pushToHistory(state, newConfig)),

    updateComponent: (pageId, componentId, updates) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                return {
                    ...page,
                    components: mapComponents(page.components, (comp) =>
                        comp.id === componentId ? { ...comp, ...updates } : comp
                    ),
                };
            });
            const newConfig = { ...state.config, pages: newPages };
            return pushToHistory(state, newConfig);
        }),

    updateGlobalSettings: (updates) =>
        set((state) => {
            if (!state.config) return {};
            const newConfig = {
                ...state.config,
                globalSettings: {
                    ...state.config.globalSettings,
                    ...updates,
                },
            };
            return pushToHistory(state, newConfig);
        }),

    reorderComponents: (pageId, newComponents) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                return { ...page, components: newComponents };
            });
            const newConfig = { ...state.config, pages: newPages };
            return pushToHistory(state, newConfig);
        }),

    addComponent: (pageId, component) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                return { ...page, components: [...page.components, component] };
            });
            const newConfig = { ...state.config, pages: newPages };
            return pushToHistory(state, newConfig);
        }),

    deleteComponent: (pageId, componentId) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                return {
                    ...page,
                    components: filterComponents(page.components, (c) => c.id !== componentId),
                };
            });
            const newConfig = { ...state.config, pages: newPages };
            return { ...pushToHistory(state, newConfig), selectedComponentId: null };
        }),

    duplicateComponent: (pageId, componentId) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                const componentIndex = page.components.findIndex((c) => c.id === componentId);
                if (componentIndex === -1) return page;
                const original = page.components[componentIndex];
                if (!original) return page;
                // Deep-clone, give the top-level a new ID, and regenerate
                // IDs for any nested slot components so the duplicate is
                // fully independent of the original.
                const cloned = JSON.parse(JSON.stringify(original)) as Component;
                const duplicate = regenerateSlotIds({
                    ...cloned,
                    id: `${original.type}-${Date.now()}`,
                });
                const newComponents = [...page.components];
                newComponents.splice(componentIndex + 1, 0, duplicate);
                return { ...page, components: newComponents };
            });
            const newConfig = { ...state.config, pages: newPages };
            return pushToHistory(state, newConfig);
        }),

    addToSlot: (pageId, layoutId, slotIndex, component) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                return {
                    ...page,
                    components: mapComponents(page.components, (comp) => {
                        if (comp.id !== layoutId) return comp;
                        // Build the slots array defensively: if props.slots is missing
                        // (e.g. corrupted data), reconstruct empty slots from columns count
                        const existingSlots: Component[][] = Array.isArray(comp.props?.slots)
                            ? (comp.props.slots as Component[][])
                            : Array.from({ length: comp.props?.columns ?? 2 }, () => []);
                        const slots = existingSlots.map((s, i) =>
                            i === slotIndex ? [...s, component] : s
                        );
                        return { ...comp, props: { ...comp.props, slots } };
                    }),
                };
            });
            const newConfig = { ...state.config, pages: newPages };
            return { ...pushToHistory(state, newConfig), selectedComponentId: component.id };
        }),

    reorderSlot: (pageId, layoutId, slotIndex, newComponents) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                return {
                    ...page,
                    components: mapComponents(page.components, (comp) => {
                        if (comp.id !== layoutId) return comp;
                        const slots = (comp.props?.slots as Component[][] | undefined) ?? [];
                        const newSlots = slots.map((s, i) => (i === slotIndex ? newComponents : s));
                        return { ...comp, props: { ...comp.props, slots: newSlots } };
                    }),
                };
            });
            const newConfig = { ...state.config, pages: newPages };
            return pushToHistory(state, newConfig);
        }),

    deleteFromSlot: (pageId, layoutId, slotIndex, componentId) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((page) => {
                if (page.id !== pageId) return page;
                return {
                    ...page,
                    components: mapComponents(page.components, (comp) => {
                        if (comp.id !== layoutId) return comp;
                        const slots = (comp.props?.slots as Component[][] | undefined) ?? [];
                        const newSlots = slots.map((s, i) =>
                            i === slotIndex ? s.filter((c) => c.id !== componentId) : s
                        );
                        return { ...comp, props: { ...comp.props, slots: newSlots } };
                    }),
                };
            });
            const newConfig = { ...state.config, pages: newPages };
            return { ...pushToHistory(state, newConfig), selectedComponentId: null };
        }),

    addPage: (page) =>
        set((state) => {
            if (!state.config) return {};
            const newConfig = { ...state.config, pages: [...state.config.pages, page] };
            return {
                ...pushToHistory(state, newConfig),
                selectedPageId: page.id,
            };
        }),

    deletePage: (pageId) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.filter((p) => p.id !== pageId);
            const newSelectedPageId =
                state.selectedPageId === pageId ? newPages[0]?.id || null : state.selectedPageId;
            const newConfig = { ...state.config, pages: newPages };
            return {
                ...pushToHistory(state, newConfig),
                selectedPageId: newSelectedPageId,
                selectedComponentId: null,
            };
        }),

    togglePagePublished: (pageId) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((p) =>
                p.id === pageId ? { ...p, published: !p.published } : p
            );
            const newConfig = { ...state.config, pages: newPages };
            return pushToHistory(state, newConfig);
        }),

    updatePageSeo: (pageId, seo) =>
        set((state) => {
            if (!state.config) return {};
            const newPages = state.config.pages.map((p) =>
                p.id === pageId ? { ...p, seo: { ...p.seo, ...seo } } : p
            );
            const newConfig = { ...state.config, pages: newPages };
            return pushToHistory(state, newConfig);
        }),

    duplicatePage: (pageId) =>
        set((state) => {
            if (!state.config) return {};
            const pageIndex = state.config.pages.findIndex((p) => p.id === pageId);
            if (pageIndex === -1) return {};
            const original = state.config.pages[pageIndex];
            if (!original) return {};
            const duplicate: Page = {
                ...JSON.parse(JSON.stringify(original)),
                id: `${original.id}-copy-${Date.now()}`,
                route: `${original.route}-copy`,
                title: original.title ? `${original.title} (Copy)` : undefined,
            };
            const newPages = [...state.config.pages];
            newPages.splice(pageIndex + 1, 0, duplicate);
            const newConfig = { ...state.config, pages: newPages };
            return {
                ...pushToHistory(state, newConfig),
                selectedPageId: duplicate.id,
            };
        }),

    // Undo/Redo implementations
    undo: () =>
        set((state) => {
            if (state.historyIndex <= 0) return {};
            const newIndex = state.historyIndex - 1;
            const previousConfig = state.history[newIndex];
            return {
                historyIndex: newIndex,
                config: previousConfig ? JSON.parse(JSON.stringify(previousConfig)) : state.config,
            };
        }),

    redo: () =>
        set((state) => {
            if (state.historyIndex >= state.history.length - 1) return {};
            const newIndex = state.historyIndex + 1;
            const nextConfig = state.history[newIndex];
            return {
                historyIndex: newIndex,
                config: nextConfig ? JSON.parse(JSON.stringify(nextConfig)) : state.config,
            };
        }),

    canUndo: () => {
        const state = get();
        return state.historyIndex > 0;
    },

    canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
    },
}));
