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

    return (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
            {/* Enrollment chip line (Course / Level / Session) — the #1 question */}
            {hasMetadata && (
                <div className="flex flex-wrap items-center gap-2 text-caption">
                    {course && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-caption font-semibold text-primary-700 ring-1 ring-primary-200">
                            <GraduationCap className="size-3.5" weight="duotone" />
                            {course}
                        </span>
                    )}
                    {level && (
                        <span className="inline-flex items-center gap-1 text-card-foreground">
                            <BookOpen className="size-3.5 text-muted-foreground" />
                            {level}
                        </span>
                    )}
                    {session && (
                        <span className="inline-flex items-center gap-1 text-card-foreground">
                            <Calendar className="size-3.5 text-muted-foreground" />
                            {session}
                        </span>
                    )}
                    {enrollmentNo && (
                        <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Hash className="size-3.5" />
                                {enrollmentNo}
                            </span>
                        </>
                    )}
                    {joinedDate && (
                        <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <CalendarBlank className="size-3.5" />
                                Joined {joinedDate}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* 4-stat health strip — the #2 question */}
            <div className="grid grid-cols-4 gap-1 border-t border-border pt-3">
                <StatTile
                    label="Attendance"
                    icon={Clock}
                    value={
                        attendancePercent != null
                            ? `${Math.round(attendancePercent)}%`
                            : '—'
                    }
                    tone={
                        attendancePercent == null
                            ? 'neutral'
                            : attendancePercent >= 75
                              ? 'success'
                              : attendancePercent >= 50
                                ? 'warning'
                                : 'danger'
                    }
                />
                <StatTile
                    label="Progress"
                    icon={GraduationCap}
                    value={
                        progressPercent != null
                            ? `${Math.round(progressPercent)}%`
                            : '—'
                    }
                    tone={
                        progressPercent == null
                            ? 'neutral'
                            : progressPercent >= 75
                              ? 'success'
                              : progressPercent >= 25
                                ? 'warning'
                                : 'danger'
                    }
                />
                <StatTile
                    label="Tests"
                    icon={Exam}
                    value={
                        testsAttempted
                            ? `${testsAttempted.attempted}/${testsAttempted.total}`
                            : '—'
                    }
                    tone="neutral"
                />
                <StatTile
                    label="Outstanding"
                    icon={Wallet}
                    value={
                        outstandingAmount != null
                            ? outstandingAmount > 0
                                ? `₹${outstandingAmount.toLocaleString('en-IN')}`
                                : '₹0'
                            : '—'
                    }
                    tone={
                        outstandingAmount == null
                            ? 'neutral'
                            : outstandingAmount > 0
                              ? 'danger'
                              : 'success'
                    }
                />
            </div>
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
