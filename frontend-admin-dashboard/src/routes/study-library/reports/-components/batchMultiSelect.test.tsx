import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import type {
    BatchForSessionType,
    InstituteDetailsType,
} from '@/schemas/student/student-list/institute-schema';
import BatchMultiSelect, { toBatchOption } from './batchMultiSelect';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts?.count !== undefined ? `${key}:${opts.count}` : key,
    }),
}));
vi.mock('@/components/common/layout-container/sidebar/utils', () => ({
    getTerminology: () => 'Batch',
    getTerminologyPlural: () => 'Batches',
}));

const batch = (
    id: string,
    course: string,
    level: string,
    session: string,
    name: string | null = null
) =>
    ({
        id,
        name,
        status: 'ACTIVE',
        start_time: null,
        package_dto: { id: `c-${course}`, package_name: course },
        level: { id: level === 'DEFAULT' ? 'DEFAULT' : `l-${level}`, level_name: level },
        session: {
            id: session === 'DEFAULT' ? 'DEFAULT' : `s-${session}`,
            session_name: session,
        },
    }) as unknown as BatchForSessionType;

const seedStore = () =>
    useInstituteDetailsStore.setState({
        instituteDetails: {
            batches_for_sessions: [
                batch('ps-2', 'JEE FOUNDATION', 'Grade 10', '2026-27'),
                batch('ps-1', 'JEE FOUNDATION', 'Grade 9', '2026-27'),
                batch('ps-3', 'YOGA BASICS', 'DEFAULT', 'DEFAULT'),
                batch('ps-4', 'YOGA BASICS', 'DEFAULT', 'DEFAULT', 'Evening cohort'),
            ],
        } as unknown as InstituteDetailsType,
    });

describe('toBatchOption', () => {
    it('labels "Course · Level · Session" verbatim and skips DEFAULT placeholders', () => {
        expect(toBatchOption(batch('x', 'JEE FOUNDATION', 'Grade 9', '2026-27')).label).toBe(
            'JEE FOUNDATION · Grade 9 · 2026-27'
        );
        const plain = toBatchOption(batch('y', 'YOGA BASICS', 'DEFAULT', 'DEFAULT'));
        expect(plain.label).toBe('YOGA BASICS');
        expect(plain.batchLabel).toBe('');
        expect(plain.sessionName).toBe('');
        expect(plain.levelName).toBe('');
        // A child batch's display name is appended so siblings stay distinct.
        expect(
            toBatchOption(batch('z', 'YOGA BASICS', 'DEFAULT', 'DEFAULT', 'Evening cohort')).label
        ).toBe('YOGA BASICS · Evening cohort');
    });
});

describe('BatchMultiSelect', () => {
    it('lists every batch of the institute and reports toggles as package_session_ids', () => {
        seedStore();
        const onChange = vi.fn();
        render(<BatchMultiSelect selected={[]} onChange={onChange} />);

        expect(screen.getByText('label')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('combobox'));

        // Sorted by label; the two Yoga batches remain distinguishable.
        const items = screen.getAllByRole('option').map((el) => el.textContent?.trim());
        expect(items).toEqual([
            'JEE FOUNDATION · Grade 10 · 2026-27',
            'JEE FOUNDATION · Grade 9 · 2026-27',
            'YOGA BASICS',
            'YOGA BASICS · Evening cohort',
        ]);

        fireEvent.click(screen.getByText('JEE FOUNDATION · Grade 9 · 2026-27'));
        expect(onChange).toHaveBeenCalledWith(['ps-1']);
    });

    it('shows the selection count, an error, and clears on demand', () => {
        seedStore();
        const onChange = vi.fn();
        const { rerender } = render(
            <BatchMultiSelect selected={['ps-1', 'ps-2']} onChange={onChange} />
        );
        expect(screen.getByText('selectedCount:2')).toBeInTheDocument();
        fireEvent.click(screen.getByText('clear'));
        expect(onChange).toHaveBeenCalledWith([]);

        rerender(<BatchMultiSelect selected={[]} onChange={onChange} error="Pick one" />);
        expect(screen.getByText('Pick one')).toBeInTheDocument();
        expect(screen.queryByText('clear')).not.toBeInTheDocument();
    });
});
