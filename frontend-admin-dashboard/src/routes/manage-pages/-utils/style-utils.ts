/**
 * Thin compatibility shim — the real implementation is the shared
 * catalogue style engine (see style-engine.ts, byte-synced with the learner
 * copy via scripts/check-style-engine-sync.mjs).
 *
 * NOTE: ComponentStyle here re-exports the ENGINE type so the admin editor
 * and the learner renderer can never disagree about the style schema.
 */
export * from './style-engine';
