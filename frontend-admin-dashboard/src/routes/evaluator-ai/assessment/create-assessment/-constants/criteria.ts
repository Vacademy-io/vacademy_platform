import type { TFunction } from 'i18next';

/**
 * These marking-scheme criteria lists are shown as selectable rows inside
 * CriteriaDialog.tsx (their only consumer in this codebase). Converted to a
 * `buildMarkingCriteria(t)` factory per the i18n rollout's module-scope-constant
 * convention: CriteriaDialog calls this with its own `t` instead of importing
 * static objects.
 */
export const buildMarkingCriteria = (t: TFunction) => ({
    marking_10: {
        criteria: [
            { name: t('marking10.criterion1'), marks: 10 },
            { name: t('marking10.criterion2'), marks: 8 },
            { name: t('marking10.criterion3'), marks: 7 },
            { name: t('marking10.criterion4'), marks: 6 },
            { name: t('marking10.criterion5'), marks: 5 },
        ],
    },
    marking_1: {
        criteria: [
            { name: t('marking1.criterion1'), marks: 1 },
            { name: t('marking1.criterion2'), marks: 1 },
            { name: t('marking1.criterion3'), marks: 0.5 },
            { name: t('marking1.criterion4'), marks: 0 },
            { name: t('marking1.criterion5'), marks: 0 },
        ],
    },
    marking_2: {
        criteria: [
            { name: t('marking2.criterion1'), marks: 2 },
            { name: t('marking2.criterion2'), marks: 1.5 },
            { name: t('marking2.criterion3'), marks: 1 },
            { name: t('marking2.criterion4'), marks: 1 },
            { name: t('marking2.criterion5'), marks: 1 },
            { name: t('marking2.criterion6'), marks: 0 },
        ],
    },
    marking_8: {
        criteria: [
            { name: t('marking8.criterion1'), marks: 8 },
            { name: t('marking8.criterion2'), marks: 7 },
            { name: t('marking8.criterion3'), marks: 5 },
            { name: t('marking8.criterion4'), marks: 4 },
            { name: t('marking8.criterion5'), marks: 3 },
            { name: t('marking8.criterion6'), marks: 2 },
            { name: t('marking8.criterion7'), marks: 1.5 },
            { name: t('marking8.criterion8'), marks: 0.5 },
            { name: t('marking8.criterion9'), marks: 0 },
        ],
    },
    marking_5: {
        criteria: [
            { name: t('marking5.criterion1'), marks: 5 },
            { name: t('marking5.criterion2'), marks: 4.5 },
            { name: t('marking5.criterion3'), marks: 4 },
            { name: t('marking5.criterion4'), marks: 3 },
            { name: t('marking5.criterion5'), marks: 2 },
            { name: t('marking5.criterion6'), marks: 1.5 },
            { name: t('marking5.criterion7'), marks: 1.5 },
            { name: t('marking5.criterion8'), marks: 1 },
            { name: t('marking5.criterion9'), marks: 0 },
        ],
    },
    marking_4: {
        criteria: [
            { name: t('marking4.criterion1'), marks: 4 },
            { name: t('marking4.criterion2'), marks: 3 },
            { name: t('marking4.criterion3'), marks: 2.5 },
            { name: t('marking4.criterion4'), marks: 2 },
            { name: t('marking4.criterion5'), marks: 1.5 },
            { name: t('marking4.criterion6'), marks: 1 },
            { name: t('marking4.criterion7'), marks: 1 },
            { name: t('marking4.criterion8'), marks: 0.5 },
            { name: t('marking4.criterion9'), marks: 0 },
        ],
    },
});
