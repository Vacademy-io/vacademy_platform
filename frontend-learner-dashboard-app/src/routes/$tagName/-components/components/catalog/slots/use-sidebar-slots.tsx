import { NO_SLOTS, type CatalogSlotContext, type SidebarSlotOutputs } from "./catalog-slot-types";

/**
 * Slot hook of FEATURE 'sidebar' (specs/filter-sidebar.json). OWNED BY THAT FEATURE — the only
 * catalog wiring file it edits (see specs/CONTRACT.md for the slot list).
 *
 * Foundation stub: contributes nothing, so every site renders exactly as
 * before. Return outputs ONLY when the section opted in through the
 * feature's own prop; otherwise keep returning NO_SLOTS.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useSidebarSlots = (_ctx: CatalogSlotContext): SidebarSlotOutputs => NO_SLOTS;
