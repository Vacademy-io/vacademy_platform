import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CapacityChip, RatingChip } from '@/routes/mentorship/-components/MentorChips';
import type { MentorDTO } from '@/routes/mentorship/-types/mentorship-types';

const mentor = (over: Partial<MentorDTO> = {}): MentorDTO => ({
    id: 'm1',
    institute_id: 'inst-1',
    user_id: 'u1',
    display_name: 'Asha Nair',
    status: 'ACTIVE',
    assigned_student_count: 0,
    ...over,
});

describe('CapacityChip', () => {
    it('shows a bare count when the mentor has no limit', () => {
        render(<CapacityChip mentor={mentor({ assigned_student_count: 42, max_mentees: null })} />);
        expect(screen.getByText('42 students')).toBeInTheDocument();
    });

    it('shows load against the cap when one is set', () => {
        render(<CapacityChip mentor={mentor({ assigned_student_count: 3, max_mentees: 10 })} />);
        expect(screen.getByText('3/10 students')).toBeInTheDocument();
    });

    it('calls out a full mentor, since assignment will skip them', () => {
        render(
            <CapacityChip
                mentor={mentor({ assigned_student_count: 10, max_mentees: 10, at_capacity: true })}
            />
        );
        expect(screen.getByText('10/10 · full')).toBeInTheDocument();
    });

    it('derives fullness from the numbers when the server omits the flag', () => {
        render(<CapacityChip mentor={mentor({ assigned_student_count: 5, max_mentees: 5 })} />);
        expect(screen.getByText('5/5 · full')).toBeInTheDocument();
    });

    it('warns before a mentor is full, not only once they are', () => {
        // 9/10 is past the 80% mark, so it should not read as a neutral chip.
        const { container } = render(
            <CapacityChip mentor={mentor({ assigned_student_count: 9, max_mentees: 10 })} />
        );
        expect(container.querySelector('.text-warning-600')).not.toBeNull();

        cleanup();
        const calm = render(
            <CapacityChip mentor={mentor({ assigned_student_count: 2, max_mentees: 10 })} />
        );
        expect(calm.container.querySelector('.text-warning-600')).toBeNull();
    });

    it('a mentee count of zero still renders rather than blanking out', () => {
        render(<CapacityChip mentor={mentor({ assigned_student_count: 0, max_mentees: 5 })} />);
        expect(screen.getByText('0/5 students')).toBeInTheDocument();
    });
});

describe('RatingChip', () => {
    it('shows the average and how many ratings back it', () => {
        render(
            <RatingChip
                mentor={mentor({ average_rating: 4.6, rating_count: 9 })}
                onClick={vi.fn()}
            />
        );
        expect(screen.getByText('4.6')).toBeInTheDocument();
        expect(screen.getByText('(9)')).toBeInTheDocument();
    });

    it('always shows one decimal, so 5 reads as 5.0', () => {
        render(
            <RatingChip mentor={mentor({ average_rating: 5, rating_count: 2 })} onClick={vi.fn()} />
        );
        expect(screen.getByText('5.0')).toBeInTheDocument();
    });

    it('renders nothing at all for an unrated mentor', () => {
        // A row of greyed "Not rated" chips is noise; absence says the same thing.
        const { container } = render(<RatingChip mentor={mentor()} onClick={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('treats an average with no ratings behind it as unrated', () => {
        const { container } = render(
            <RatingChip
                mentor={mentor({ average_rating: 4.2, rating_count: 0 })}
                onClick={vi.fn()}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('opens the feedback list when there is something to read', () => {
        const onClick = vi.fn();
        render(
            <RatingChip
                mentor={mentor({ average_rating: 4.6, rating_count: 9 })}
                onClick={onClick}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('is not clickable when there is no feedback to show', () => {
        render(<RatingChip mentor={mentor()} onClick={vi.fn()} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
