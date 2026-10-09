import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/auth/axiosInstance', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
vi.mock('@/constants/helper', () => ({ getInstituteId: () => 'inst-1' }));
vi.mock('@/constants/urls', () => ({ BASE_URL: 'http://x' }));

import { fetchStudentDisplaySettingsForEdit } from './student-display-settings';

/**
 * The settings editor saves the whole blob back. Two things must hold for that
 * to be safe: custom Courses-page tabs survive the merge with defaults (it
 * rebuilds `allCourses` field by field), and a failed read never hands the
 * editor defaults it could save over the institute's real settings.
 */
describe('fetchStudentDisplaySettingsForEdit', () => {
    beforeEach(() => {
        get.mockReset();
    });

    it('keeps custom course tabs and the built-in tabs through the merge', async () => {
        get.mockResolvedValue({
            data: {
                data: {
                    allCourses: {
                        tabs: [{ id: 'AllCourses', order: 1, visible: true }],
                        customTabs: [
                            { id: 'custom-1', label: 'Free', tags: ['free'], order: 2, visible: true },
                            { label: 'no id', tags: ['x'], order: 3, visible: true },
                        ],
                        defaultTab: 'AllCourses',
                    },
                    liveClasses: { showUnassignedPublicSessions: true },
                },
            },
        });

        const s = await fetchStudentDisplaySettingsForEdit();

        expect(s.allCourses.customTabs).toEqual([
            { id: 'custom-1', label: 'Free', tags: ['free'], order: 2, visible: true },
        ]);
        expect(s.allCourses.tabs.map((t) => t.id).sort()).toEqual([
            'AllCourses',
            'Completed',
            'InProgress',
        ]);
        expect(s.allCourses.defaultTab).toBe('AllCourses');
    });

    it('gives an empty list for blobs saved before custom tabs existed', async () => {
        get.mockResolvedValue({
            data: { data: { allCourses: { tabs: [], defaultTab: 'InProgress' } } },
        });
        const s = await fetchStudentDisplaySettingsForEdit();
        expect(s.allCourses.customTabs).toEqual([]);
    });

    it('throws instead of returning defaults when the read fails', async () => {
        get.mockRejectedValue(new Error('network'));
        await expect(fetchStudentDisplaySettingsForEdit()).rejects.toThrow('network');
    });
});
