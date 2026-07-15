import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    AI_PAGE_BUILDER_GENERATE,
    AI_PAGE_BUILDER_ESTIMATE,
    AI_PAGE_BUILDER_EDIT,
    AI_PAGE_BUILDER_BRAND_KIT,
} from '@/constants/urls';
import { CatalogueConfig, Component, Page } from '../-types/editor-types';
import { CATALOGUE_FONTS } from '../-utils/catalogue-fonts';

export interface AiPageImage {
    url: string;
    caption?: string;
    kind?: 'logo' | 'photo' | 'banner';
}

export interface AiCourseSnapshotItem {
    name: string;
    price?: string;
    level?: string;
    description?: string;
    tags?: string[];
}

export interface GeneratePagePayload {
    brief: string;
    page_type?: string;
    route_slug?: string;
    institute_name?: string;
    images?: AiPageImage[];
    courses?: AiCourseSnapshotItem[];
    terminology?: Record<string, string>;
    direction?: string;
    run_id?: string;
}

export interface GeneratedPage {
    id: string;
    title?: string;
    route: string;
    components: Component[];
}

export interface GeneratePageResponse {
    page: GeneratedPage;
    run_id: string;
    model: string;
    warnings: string[];
}

export interface PageCreditEstimate {
    estimated_credits?: number;
    current_balance?: number;
    sufficient?: boolean;
}

export const generateAiPage = async (payload: GeneratePagePayload): Promise<GeneratePageResponse> => {
    const response = await authenticatedAxiosInstance.post<GeneratePageResponse>(
        AI_PAGE_BUILDER_GENERATE(),
        payload,
        { timeout: 240000 } // page composition is one large LLM call
    );
    return response.data;
};

export const estimateAiPageCredits = async (): Promise<PageCreditEstimate> => {
    const response = await authenticatedAxiosInstance.get<PageCreditEstimate>(
        AI_PAGE_BUILDER_ESTIMATE()
    );
    return response.data;
};

/* ─── Copilot (conversational edit) ────────────────────────────────────── */

export type EditOp =
    | { op: 'insert'; component: Component; afterId: string | null; note?: string }
    | { op: 'update'; id: string; propsPatch?: Record<string, any>; stylePatch?: Record<string, any>; note?: string }
    | { op: 'remove'; id: string; note?: string }
    | { op: 'move'; id: string; afterId: string | null; note?: string }
    | { op: 'updateGlobalSettings'; patch: Record<string, any>; note?: string };

export interface EditChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

export interface EditPagePayload {
    page: { id: string; components: Component[] };
    instruction: string;
    selected_component_id?: string;
    institute_name?: string;
    images?: AiPageImage[];
    terminology?: Record<string, string>;
    history?: EditChatTurn[];
}

export interface EditPageResponse {
    ops: EditOp[];
    reply: string;
    run_id: string;
    model: string;
    warnings: string[];
}

export const editAiPage = async (payload: EditPagePayload): Promise<EditPageResponse> => {
    const response = await authenticatedAxiosInstance.post<EditPageResponse>(
        AI_PAGE_BUILDER_EDIT(),
        payload,
        { timeout: 180000 }
    );
    return response.data;
};

/* ─── Brand kit (theme proposals) ──────────────────────────────────────── */

export interface BrandKit {
    label: string;
    themePreset: string;
    atmosphere: { canvas: string; intensity: string };
    headingScale: string;
    borderRadius: string;
    motion: string;
    fontFamily: string;
    rationale: string;
}

export interface BrandKitResponse {
    kits: BrandKit[];
    run_id: string;
    model: string;
}

export const deriveBrandKit = async (payload: {
    institute_name?: string;
    brief?: string;
    brand_notes?: string;
}): Promise<BrandKitResponse> => {
    const response = await authenticatedAxiosInstance.post<BrandKitResponse>(
        AI_PAGE_BUILDER_BRAND_KIT(),
        payload,
        { timeout: 120000 }
    );
    return response.data;
};

/** Maps a BrandKit into the globalSettings patch the renderers consume
 *  (theme.preset + atmosphere + radius + heading scale, motion, font stack). */
export const brandKitToGlobalPatch = (kit: BrandKit): Record<string, any> => {
    const fontStack =
        CATALOGUE_FONTS.find((f) => f.label === kit.fontFamily)?.stack || 'Inter, sans-serif';
    return {
        theme: {
            preset: kit.themePreset,
            atmosphere: { canvas: kit.atmosphere.canvas, intensity: kit.atmosphere.intensity },
            headingScale: kit.headingScale,
            borderRadius: kit.borderRadius,
        },
        motion: { personality: kit.motion },
        fonts: { enabled: true, family: fontStack },
    };
};

/** Shallow-merge a patch into an existing object (undefined values delete). */
const mergePatch = <T extends Record<string, any>>(base: T | undefined, patch: Record<string, any>): T => {
    const out: Record<string, any> = { ...(base || {}) };
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null) delete out[k];
        else out[k] = v;
    }
    return out as T;
};

/** Recursively patch/remove a component by id (covers columnLayout slot children). */
const patchById = (
    components: Component[],
    id: string,
    fn: (c: Component) => Component | null
): { components: Component[]; hit: boolean } => {
    let hit = false;
    const next: Component[] = [];
    for (const c of components) {
        if (c.id === id) {
            hit = true;
            const res = fn(c);
            if (res) next.push(res);
            continue;
        }
        // Recurse into columnLayout slots
        const slots = c.props?.slots;
        if (Array.isArray(slots)) {
            let slotHit = false;
            const newSlots = slots.map((slot: Component[]) => {
                if (!Array.isArray(slot)) return slot;
                const r = patchById(slot, id, fn);
                if (r.hit) slotHit = true;
                return r.components;
            });
            if (slotHit) {
                hit = true;
                next.push({ ...c, props: { ...c.props, slots: newSlots } });
                continue;
            }
        }
        next.push(c);
    }
    return { components: next, hit };
};

/**
 * Applies copilot ops to a deep-cloned config, returning a new config.
 * Pure — the panel keeps this as a "shadow" for diff preview before commit.
 * insert/move resolve afterId against the TOP-LEVEL component list;
 * update/remove find the target anywhere (including slot children).
 */
export const applyOps = (config: CatalogueConfig, pageId: string, ops: EditOp[]): CatalogueConfig => {
    const clone: CatalogueConfig = JSON.parse(JSON.stringify(config));
    const page = clone.pages.find((p: Page) => p.id === pageId);
    if (!page) return clone;

    for (const op of ops) {
        switch (op.op) {
            case 'insert': {
                const comp = op.component;
                if (op.afterId === null) {
                    page.components.unshift(comp);
                } else {
                    const idx = page.components.findIndex((c) => c.id === op.afterId);
                    if (idx === -1) page.components.push(comp);
                    else page.components.splice(idx + 1, 0, comp);
                }
                break;
            }
            case 'update': {
                page.components = patchById(page.components, op.id, (c) => ({
                    ...c,
                    props: op.propsPatch ? mergePatch(c.props, op.propsPatch) : c.props,
                    style: op.stylePatch ? mergePatch(c.style, op.stylePatch) : c.style,
                })).components;
                break;
            }
            case 'remove': {
                page.components = patchById(page.components, op.id, () => null).components;
                break;
            }
            case 'move': {
                const idx = page.components.findIndex((c) => c.id === op.id);
                if (idx === -1) break; // only top-level components are movable
                const [moved] = page.components.splice(idx, 1);
                if (!moved) break;
                if (op.afterId === null) {
                    page.components.unshift(moved);
                } else {
                    const after = page.components.findIndex((c) => c.id === op.afterId);
                    if (after === -1) page.components.push(moved);
                    else page.components.splice(after + 1, 0, moved);
                }
                break;
            }
            case 'updateGlobalSettings': {
                const gs: Record<string, any> = clone.globalSettings as any;
                for (const [k, v] of Object.entries(op.patch)) {
                    gs[k] = v && typeof v === 'object' && !Array.isArray(v)
                        ? { ...(gs[k] || {}), ...v }
                        : v;
                }
                break;
            }
        }
    }
    return clone;
};
