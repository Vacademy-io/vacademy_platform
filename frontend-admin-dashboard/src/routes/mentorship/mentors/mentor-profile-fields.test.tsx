import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
    MentorProfileFields,
    type MentorProfileValues,
} from '@/routes/mentorship/-components/MentorProfileFields';

const base: MentorProfileValues = { expertiseTags: [], maxMentees: '', isDiscoverable: false };

/** Renders with real state so multi-step interactions (type → Enter) behave as they do live. */
function Harness({ initial = base }: { initial?: MentorProfileValues }) {
    const [values, setValues] = useState(initial);
    return <MentorProfileFields values={values} onChange={setValues} />;
}

describe('MentorProfileFields', () => {
    it('commits an expertise tag on Enter and removes it again', () => {
        render(<Harness />);
        const input = screen.getByPlaceholderText('e.g. JEE Physics — press Enter to add');

        fireEvent.change(input, { target: { value: 'JEE Physics' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByText('JEE Physics')).toBeInTheDocument();
        expect((input as HTMLInputElement).value).toBe('');

        fireEvent.click(screen.getByLabelText('Remove JEE Physics'));
        expect(screen.queryByText('JEE Physics')).not.toBeInTheDocument();
    });

    it('splits a pasted comma-separated list into separate tags', () => {
        render(<Harness />);
        const input = screen.getByPlaceholderText('e.g. JEE Physics — press Enter to add');

        fireEvent.change(input, { target: { value: 'Physics, Career guidance ,Interview prep' } });
        fireEvent.blur(input);

        expect(screen.getByText('Physics')).toBeInTheDocument();
        expect(screen.getByText('Career guidance')).toBeInTheDocument();
        expect(screen.getByText('Interview prep')).toBeInTheDocument();
    });

    it('ignores a duplicate tag regardless of case', () => {
        render(<Harness initial={{ ...base, expertiseTags: ['Physics'] }} />);
        const input = screen.getByPlaceholderText('e.g. JEE Physics — press Enter to add');

        fireEvent.change(input, { target: { value: 'physics' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.getAllByText(/^physics$/i)).toHaveLength(1);
    });

    it('offers starter suggestions only while there are no tags', () => {
        render(<Harness />);
        expect(screen.getByRole('button', { name: '+ Career guidance' })).toBeInTheDocument();

        cleanup();
        render(<Harness initial={{ ...base, expertiseTags: ['Physics'] }} />);
        expect(screen.queryByRole('button', { name: '+ Career guidance' })).not.toBeInTheDocument();
    });

    it('keeps the capacity field numeric', () => {
        const onChange = vi.fn();
        render(<MentorProfileFields values={base} onChange={onChange} />);

        fireEvent.change(screen.getByPlaceholderText('Leave blank for no limit'), {
            target: { value: '2a0' },
        });
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxMentees: '20' }));
    });

    it('warns when a new cap sits below the mentor’s current mentee count', () => {
        render(
            <MentorProfileFields
                values={{ ...base, maxMentees: '3' }}
                onChange={vi.fn()}
                assignedCount={8}
            />
        );
        expect(screen.getByText(/already have 8 mentees/)).toBeInTheDocument();
    });

    it('does not warn when the cap is at or above the current count', () => {
        render(
            <MentorProfileFields
                values={{ ...base, maxMentees: '8' }}
                onChange={vi.fn()}
                assignedCount={8}
            />
        );
        expect(screen.queryByText(/already have/)).not.toBeInTheDocument();
    });

    it('directory listing is off by default and toggles on', () => {
        const onChange = vi.fn();
        render(<MentorProfileFields values={base} onChange={onChange} />);

        const toggle = screen.getByRole('switch', { name: 'List this mentor in Find a mentor' });
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(toggle);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isDiscoverable: true }));
    });
});
