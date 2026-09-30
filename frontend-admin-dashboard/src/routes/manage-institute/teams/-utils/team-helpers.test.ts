import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/roleUtils', () => ({
    mapRoleToCustomName: (name: string) =>
        name === 'CONTENT CREATOR'
            ? 'Course Creator'
            : name.charAt(0) + name.slice(1).toLowerCase(),
}));

import {
    buildRoleOptions,
    formatPhoneForDisplay,
    sortRoleNames,
    toPhoneInputValue,
} from './team-helpers';

const INSTITUTE = 'inst-1';
const role = (id: string, name: string, instituteId: string | null) => ({
    id,
    name,
    instituteId,
    permissions: [],
});

describe('buildRoleOptions', () => {
    const roles = [
        role('r-counsellor', 'Counsellor', INSTITUTE),
        role('r-teacher', 'TEACHER', null),
        role('r-student', 'STUDENT', null),
        role('r-admin', 'ADMIN', null),
        role('r-foreign', 'Other Institute Role', 'inst-2'),
        role('r-cc', 'CONTENT CREATOR', null),
    ];

    it('offers platform roles plus only this institute’s custom roles', () => {
        const names = buildRoleOptions(roles, INSTITUTE, () => true).map((o) => o.name);
        expect(names).toEqual(['ADMIN', 'TEACHER', 'CONTENT CREATOR', 'Counsellor']);
        expect(names).not.toContain('Other Institute Role');
        expect(names).not.toContain('STUDENT');
    });

    it('marks institute-owned roles as custom and keeps their own name', () => {
        const options = buildRoleOptions(roles, INSTITUTE, () => true);
        expect(options.find((o) => o.name === 'Counsellor')).toMatchObject({
            custom: true,
            label: 'Counsellor',
        });
        expect(options.find((o) => o.name === 'CONTENT CREATOR')).toMatchObject({
            custom: false,
            label: 'Course Creator',
        });
    });

    it('accepts the snake_case owner field too', () => {
        const options = buildRoleOptions(
            [{ id: 'x', name: 'Front Desk', institute_id: INSTITUTE, permissions: [] }],
            INSTITUTE,
            () => true
        );
        expect(options).toEqual([
            { id: 'x', name: 'Front Desk', label: 'Front Desk', custom: true },
        ]);
    });

    it('drops roles the viewer is not allowed to see', () => {
        const names = buildRoleOptions(roles, INSTITUTE, (name) => name !== 'ADMIN').map(
            (o) => o.name
        );
        expect(names).not.toContain('ADMIN');
    });

    it('sorts selected role names in picker order', () => {
        const options = buildRoleOptions(roles, INSTITUTE, () => true);
        expect(sortRoleNames(['Counsellor', 'ADMIN', 'TEACHER'], options)).toEqual([
            'ADMIN',
            'TEACHER',
            'Counsellor',
        ]);
    });
});

describe('phone helpers', () => {
    it('formats widget digits, spaced and bare national numbers', () => {
        expect(formatPhoneForDisplay('919876543210', 'in')).toBe('+91 98765 43210');
        expect(formatPhoneForDisplay('+91 98765 43210', 'in')).toBe('+91 98765 43210');
        expect(formatPhoneForDisplay('9876543210', 'in')).toBe('+91 98765 43210');
        expect(formatPhoneForDisplay(null, 'in')).toBeNull();
        expect(formatPhoneForDisplay('  ', 'in')).toBeNull();
    });

    it('gives the phone widget digits with a dial code', () => {
        expect(toPhoneInputValue('+91 98765 43210', 'in')).toBe('919876543210');
        // A bare national number must not be read as +98 (Iran) by the widget.
        expect(toPhoneInputValue('9876543210', 'in')).toBe('919876543210');
        expect(toPhoneInputValue('', 'in')).toBe('');
    });
});
