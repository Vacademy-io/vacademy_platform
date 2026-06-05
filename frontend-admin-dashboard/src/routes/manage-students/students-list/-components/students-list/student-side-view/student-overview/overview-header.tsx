import { StatusChips } from '@/components/design-system/chips';
import { StudentTable } from '@/types/student-table-types';
import { cn } from '@/lib/utils';
import {
    GraduationCap,
    BookOpen,
    Calendar,
    Hash,
    Clock,
    Exam,
    Wallet,
    CalendarBlank,
} from '@phosphor-icons/react';

interface OverviewHeaderProps {
    student: StudentTable | null;
    /** Course name, e.g. "Paid courses" */
    course?: string | null;
    /** Level name, e.g. "Basic" */
    level?: string | null;
    /** Session name, e.g. "May" */
    session?: string | null;
    /** Joined date (already formatted, e.g. "Jun 4, 2026") */
    joinedDate?: string | null;
    /** Attendance % (0–100). Pass undefined to render "—". */
    attendancePercent?: number;
    /** Progress % (0–100). Pass undefined to render "—". */
    progressPercent?: number;
    /** Tests attempted/total. Pass undefined to render "—". */
    testsAttempted?: { attempted: number; total: number };
    /** Outstanding amount in INR. Pass undefined to render "—". */
    outstandingAmount?: number;
}

/**
 * Overview Header — the at-a-glance identity + enrollment + health card
 * that sits at the very top of every learner's Overview tab.
 *
 * Replaces the basic snapshot-hero (which only restated name + ID + status,
 * duplicating the sticky sidebar header). This card answers the four
 * questions a school admin asks on every profile open:
 *   1. Who is this learner? → name + status (in sidebar header)
 *   2. What are they enrolled in? → Course · Level · Session chip line
 *   3. How are they doing? → Attendance · Progress · Tests · Outstanding strip
 *   4. When did they join? → Joined date in metadata
 *
 * Stat tiles render "—" when their underlying query hasn't loaded yet.
 * A later phase wires the placeholders to live data without changing this
 * component's API.
 */
export const OverviewHeader = ({
    student,
    course,
    level,
    session,
    joinedDate,
    attendancePercent,
    progressPercent,
    testsAttempted,
    outstandingAmount,
}: OverviewHeaderProps) => {
    if (!student) return null;

    const enrollmentNo = student.institute_enrollment_number;
    const hasMetadata = !!(course || level || session || enrollmentNo || joinedDate);

    // Only show stat tiles we actually have data for. An empty/all-undefined
    // strip is removed entirely — no walls of em-dashes for unloaded data.
    const tiles: Array<{ label: string; icon: typeof Clock; value: string; tone: Tone }> = [];
    if (attendancePercent != null) {
        tiles.push({
            label: 'Attendance',
            icon: Clock,
            value: `${Math.round(attendancePercent)}%`,
            tone:
                attendancePercent >= 75
                    ? 'success'
                    : attendancePercent >= 50
                      ? 'warning'
                      : 'danger',
        });
    }
    if (progressPercent != null) {
        tiles.push({
            label: 'Progress',
            icon: GraduationCap,
            value: `${Math.round(progressPercent)}%`,
            tone:
                progressPercent >= 75
                    ? 'success'
                    : progressPercent >= 25
                      ? 'warning'
                      : 'danger',
        });
    }
    if (testsAttempted) {
        tiles.push({
            label: 'Tests',
            icon: Exam,
            value: `${testsAttempted.attempted}/${testsAttempted.total}`,
            tone: 'neutral',
        });
    }
    if (outstandingAmount != null) {
        tiles.push({
            label: 'Outstanding',
            icon: Wallet,
            value:
                outstandingAmount > 0
                    ? `₹${outstandingAmount.toLocaleString('en-IN')}`
                    : '₹0',
            tone: outstandingAmount > 0 ? 'danger' : 'success',
        });
    }

    // Don't render an empty card. If we have no metadata AND no tiles, skip.
    if (!hasMetadata && tiles.length === 0) return null;

    return (
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {/* Hero band — top of the card, primary-tinted, hosts the course name
                as the visual anchor. Modern LMS feel: course name is BIG, the
                level/session/enrollment are a subtle metadata strip below it. */}
            {hasMetadata && (
                <div className="border-b border-border bg-primary-50/40 px-4 py-3">
                    <div className="text-caption font-semibold uppercase tracking-widest text-primary-600">
                        Currently Enrolled
                    </div>
                    {course && (
                        <div className="mt-1 flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                                <GraduationCap className="size-5" weight="duotone" />
                            </span>
                            <h3 className="truncate text-subtitle font-semibold text-card-foreground">
                                {course}
                            </h3>
                        </div>
                    )}
                    {(level || session || enrollmentNo || joinedDate) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                            {level && (
                                <span className="inline-flex items-center gap-1">
                                    <BookOpen className="size-3.5" />
                                    {level}
                                </span>
                            )}
                            {session && (
                                <span className="inline-flex items-center gap-1">
                                    <Calendar className="size-3.5" />
                                    {session}
                                </span>
                            )}
                            {enrollmentNo && (
                                <span className="inline-flex items-center gap-1">
                                    <Hash className="size-3.5" />
                                    {enrollmentNo}
                                </span>
                            )}
                            {joinedDate && (
                                <span className="inline-flex items-center gap-1">
                                    <CalendarBlank className="size-3.5" />
                                    Joined {joinedDate}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Health-stat strip — only renders the tiles we have data for. */}
            {tiles.length > 0 && (
                <div
                    className={cn(
                        'grid gap-1 px-4 py-3',
                        tiles.length === 1 && 'grid-cols-1',
                        tiles.length === 2 && 'grid-cols-2',
                        tiles.length === 3 && 'grid-cols-3',
                        tiles.length === 4 && 'grid-cols-4'
                    )}
                >
                    {tiles.map((t) => (
                        <StatTile
                            key={t.label}
                            label={t.label}
                            icon={t.icon}
                            value={t.value}
                            tone={t.tone}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<Tone, { value: string; icon: string }> = {
    neutral: { value: 'text-card-foreground', icon: 'text-muted-foreground' },
    success: { value: 'text-success-700', icon: 'text-success-600' },
    warning: { value: 'text-warning-700', icon: 'text-warning-600' },
    danger: { value: 'text-danger-700', icon: 'text-danger-600' },
};

const StatTile = ({
    label,
    icon: Icon,
    value,
    tone,
}: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string;
    tone: Tone;
}) => {
    const c = TONE_CLASSES[tone];
    return (
        <div className="flex flex-col items-center justify-center gap-0.5 text-center">
            <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
                <Icon className={cn('size-3', c.icon)} />
                {label}
            </span>
            <span className={cn('text-subtitle font-semibold', c.value)}>{value}</span>
        </div>
    );
};

// Re-export StatusChips for convenience; consumed by callers that want to
// surface the status pill near the header (e.g. inside the sticky sidebar
// header, which already does that).
export { StatusChips };
