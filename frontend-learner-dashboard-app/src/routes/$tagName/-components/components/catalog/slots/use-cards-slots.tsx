import { NO_SLOTS, type CatalogSlotContext, type CardsSlotOutputs } from "./catalog-slot-types";

/**
 * Slot hook of FEATURE 'cards' (specs/course-cards-grid.json). OWNED BY THAT FEATURE — the only
 * catalog wiring file it edits (see specs/CONTRACT.md for the slot list).
 *
 * Foundation stub: contributes nothing, so every site renders exactly as
 * before. Return outputs ONLY when the section opted in through the
 * feature's own prop; otherwise keep returning NO_SLOTS.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useCardsSlots = (_ctx: CatalogSlotContext): CardsSlotOutputs => NO_SLOTS;
