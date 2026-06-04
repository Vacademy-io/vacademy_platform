import { StatusChips } from '@/components/design-system/chips';
import { StudentTable } from '@/types/student-table-types';
import { cn } from '@/lib/utils';

/**
 * Snapshot Hero — sits at the top of every learner profile's Overview tab.
 *
 * Phase 0.5 (this version): renders only the fields available directly on
 * `selectedStudent` (StudentTable) — no extra API calls. Days-left on plan,
 * overdue ₹, last-active, lead score, and the Next-Best-Action CTA are added
 * in later phases once we have the data hoisted into the Overview tab.
 *
 * High-signal at a glance: name + status + enrollment + payment status — all
 * the identity context a counsellor needs without scrolling past the
 * General Details card.
 */
export const SnapshotHero = ({ student }: { student: StudentTable | null }) => {
    if (!student) return null;

    const paymentStatus = student.payment_status?.toUpperCase();
    const isPaid = paymentStatus === 'PAID';
    const isOverdue =
        paymentStatus === 'OVERDUE' ||
        paymentStatus === 'UNPAID' ||
        paymentStatus === 'PARTIAL';

    return (
        <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
            {/* Identity row: name (truncates) + status pill */}
            <div className="flex flex-wrap items-center gap-2">
                <h2
                    className="min-w-0 flex-1 truncate text-h3 font-semibold text-card-foreground"
                    title={student.full_name}
                >
                    {student.full_name || 'Unknown learner'}
                </h2>
                {student.status && <StatusChips status={student.status} />}
            </div>

            {/* Sub-identity row: enrollment id + payment status badge */}
            {(student.institute_enrollment_number || paymentStatus) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                    {student.institute_enrollment_number && (
                        <span>
                            <span className="font-medium text-card-foreground">ID</span>{' '}
                            {student.institute_enrollment_number}
                        </span>
                    )}
                    {student.institute_enrollment_number && paymentStatus && (
                        <span className="text-muted-foreground/60">·</span>
                    )}
                    {paymentStatus && (
                        <span
                            className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold ring-1',
                                isPaid &&
                                    'bg-success-50 text-success-700 ring-success-200',
                                isOverdue &&
                                    'bg-danger-50 text-danger-700 ring-danger-200',
                                !isPaid &&
                                    !isOverdue &&
                                    'bg-neutral-100 text-neutral-700 ring-neutral-200'
                            )}
                        >
                            {paymentStatus.replace(/_/g, ' ')}
                        </span>
                    )}
                </div>
            )}
        </section>
    );
};
