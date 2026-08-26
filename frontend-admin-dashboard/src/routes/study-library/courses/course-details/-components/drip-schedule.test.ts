import { describe, expect, it } from 'vitest';
import {
    applyDripSchedule,
    buildDripSchedule,
    clearDripSchedule,
    previewDripSchedule,
} from '@/utils/drip-conditions';
import {
    DEFAULT_COURSE_SETTINGS,
    DEFAULT_DRIP_SCHEDULE,
    type DripCondition,
} from '@/types/course-settings';
import { mergeWithDefaults } from '@/services/course-settings';

const chapters = Array.from({ length: 30 }, (_, i) => ({
    id: `ch-${i + 1}`,
    name: `Chapter ${i + 1}`,
}));

describe('previewDripSchedule', () => {
    it('puts 30 chapters on days 1..30 at the default one-a-day pace', () => {
        const preview = previewDripSchedule(chapters, { startDay: 1, intervalDays: 1 });
        expect(preview[0]).toMatchObject({ id: 'ch-1', day: 1 });
        expect(preview[29]).toMatchObject({ id: 'ch-30', day: 30 });
    });

    it('spaces items by the interval', () => {
        const preview = previewDripSchedule(chapters.slice(0, 4), {
            startDay: 1,
            intervalDays: 7,
        });
        expect(preview.map((entry) => entry.day)).toEqual([1, 8, 15, 22]);
    });

    it('honours a later start day', () => {
        const preview = previewDripSchedule(chapters.slice(0, 3), {
            startDay: 5,
            intervalDays: 1,
        });
        expect(preview.map((entry) => entry.day)).toEqual([5, 6, 7]);
    });
});

describe('buildDripSchedule', () => {
    it('writes one day-wise rule per item', () => {
        const built = buildDripSchedule(chapters, 'chapter', DEFAULT_DRIP_SCHEDULE);
        expect(built).toHaveLength(30);
        expect(built[0]?.level).toBe('chapter');
        expect(built[0]?.level_id).toBe('ch-1');
        expect(built[0]?.drip_condition[0]?.rules[0]).toMatchObject({
            type: 'relative_date',
            params: { unlock_on_day: 1, anchor: 'enrollment' },
        });
        expect(built[29]?.drip_condition[0]?.rules[0]?.params).toMatchObject({
            unlock_on_day: 30,
        });
    });

    it('targets the level it drips', () => {
        const built = buildDripSchedule(chapters.slice(0, 1), 'module', DEFAULT_DRIP_SCHEDULE);
        expect(built[0]?.drip_condition[0]?.target).toBe('module');
    });
});

describe('applyDripSchedule', () => {
    it('replaces a previous schedule instead of stacking a second one', () => {
        const first = buildDripSchedule(chapters, 'chapter', DEFAULT_DRIP_SCHEDULE);
        const second = buildDripSchedule(chapters, 'chapter', {
            ...DEFAULT_DRIP_SCHEDULE,
            intervalDays: 2,
        });
        const merged = applyDripSchedule(first, 'chapter', second);
        expect(merged).toHaveLength(30);
        expect(merged.filter((c) => c.level_id === 'ch-2')).toHaveLength(1);
    });

    it('leaves rules at other levels alone', () => {
        const moduleRule: DripCondition = {
            id: 'm1',
            level: 'module',
            level_id: 'mod-1',
            enabled: true,
            drip_condition: [
                { target: 'module', behavior: 'lock', is_enabled: true, rules: [] },
            ],
        };
        const merged = applyDripSchedule(
            [moduleRule],
            'chapter',
            buildDripSchedule(chapters.slice(0, 2), 'chapter', DEFAULT_DRIP_SCHEDULE)
        );
        expect(merged.filter((c) => c.level === 'module')).toHaveLength(1);
    });
});

describe('clearDripSchedule', () => {
    it('removes only the scheduled items at that level', () => {
        const built = buildDripSchedule(chapters, 'chapter', DEFAULT_DRIP_SCHEDULE);
        const cleared = clearDripSchedule(built, 'chapter', ['ch-1', 'ch-2']);
        expect(cleared).toHaveLength(28);
    });
});

describe('enforcement is opt-in', () => {
    it('ships off in the shipped defaults', () => {
        expect(DEFAULT_COURSE_SETTINGS.dripConditions.applyConfiguredRules).toBe(false);
    });

    it('stays off for settings saved before the flag existed', () => {
        const legacy = {
            dripConditions: {
                enabled: true,
                conditions: [{ id: 'a', level: 'chapter', level_id: 'c1' }],
            },
        } as unknown as Parameters<typeof mergeWithDefaults>[0];
        expect(mergeWithDefaults(legacy).dripConditions.applyConfiguredRules).toBe(false);
    });

    it('is never inferred from the master switch', () => {
        const onlyEnabled = {
            dripConditions: { enabled: true, conditions: [] },
        } as unknown as Parameters<typeof mergeWithDefaults>[0];
        expect(mergeWithDefaults(onlyEnabled).dripConditions.applyConfiguredRules).toBe(false);
    });

    it('turns on only when explicitly true', () => {
        const optedIn = {
            dripConditions: { enabled: true, conditions: [], applyConfiguredRules: true },
        } as unknown as Parameters<typeof mergeWithDefaults>[0];
        expect(mergeWithDefaults(optedIn).dripConditions.applyConfiguredRules).toBe(true);
    });
});
