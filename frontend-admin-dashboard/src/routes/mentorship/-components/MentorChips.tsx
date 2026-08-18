import { Star } from '@phosphor-icons/react';
import type { MentorDTO } from '../-types/mentorship-types';

/**
 * A mentor's rating, or a quiet prompt when nobody has rated them yet. Clicking
 * opens the feedback list — the number is only useful next to what learners said.
 */
export function RatingChip({ mentor, onClick }: { mentor: MentorDTO; onClick: () => void }) {
    const avg = mentor.average_rating;
    const count = mentor.rating_count ?? 0;

    if (avg == null || count === 0) {
        return (
            <span
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-neutral-400"
                title="No sessions rated yet — learners are asked after a session takes place"
            >
                Not rated
            </span>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            title={`Average of ${count} rated session${count === 1 ? '' : 's'} — click to read the feedback`}
            className="flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-caption text-warning-700 hover:bg-warning-100"
        >
            <Star size={13} weight="fill" className="text-warning-500" />
            {avg.toFixed(1)}
            <span className="text-warning-600/70">({count})</span>
        </button>
    );
}

/**
 * Mentee count against the mentor's cap. An uncapped mentor just shows the count;
 * a capped one shows load, and turns amber then red as they fill up — so an admin
 * can see who has room before opening the assign dialog.
 */
export function CapacityChip({ mentor }: { mentor: MentorDTO }) {
    const count = mentor.assigned_student_count ?? 0;
    const cap = mentor.max_mentees ?? null;

    if (!cap) {
        return (
            <span
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-neutral-500"
                title="Students currently assigned to this mentor (no limit set)"
            >
                {count} students
            </span>
        );
    }

    const full = mentor.at_capacity ?? count >= cap;
    const nearlyFull = !full && count / cap >= 0.8;
    const tone = full
        ? 'bg-danger-50 text-danger-600'
        : nearlyFull
          ? 'bg-warning-50 text-warning-600'
          : 'bg-neutral-100 text-neutral-500';

    return (
        <span
            className={`rounded-full px-2.5 py-1 text-caption ${tone}`}
            title={
                full
                    ? `At capacity — no new students can be assigned until the limit is raised or a mentee is unassigned`
                    : `${cap - count} of ${cap} places still open`
            }
        >
            {count}/{cap} students{full ? ' · Full' : ''}
        </span>
    );
}
