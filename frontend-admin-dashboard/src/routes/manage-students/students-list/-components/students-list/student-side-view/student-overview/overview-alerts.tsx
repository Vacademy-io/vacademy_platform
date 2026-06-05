import { StudentTable } from '@/types/student-table-types';
import { WarningCircle, FileX, PhoneSlash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type Tone = 'danger' | 'warning' | 'info';

interface AlertItem {
    id: string;
    tone: Tone;
    icon: React.ComponentType<{ className?: string }>;
    text: string;
}

const TONE_CLASSES: Record<Tone, string> = {
    danger: 'border-danger-200 bg-danger-50 text-danger-700',
    warning: 'border-warning-200 bg-warning-50 text-warning-700',
    info: 'border-info-200 bg-info-50 text-info-700',
};

/**
 * Overview Alerts strip — a row of compact, tone-coded chips that surface
 * problems a school admin should notice IMMEDIATELY on opening a learner
 * profile, without scrolling to the relevant tab.
 *
 * Renders nothing when there are no alerts (silent green path), so this
 * doesn't add visual weight to a healthy learner's overview.
 *
 * Each chip is derived from data already on `selectedStudent` — no new
 * API calls in this commit.
 */
export const OverviewAlerts = ({
    student,
    tncAccepted,
}: {
    student: StudentTable | null;
    tncAccepted: boolean | undefined;
}) => {
    if (!student) return null;

    const alerts: AlertItem[] = [];

    // T&C not signed — common compliance gap.
    if (tncAccepted === false) {
        alerts.push({
            id: 'tnc',
            tone: 'warning',
            icon: FileX,
            text: 'Terms & Conditions not signed',
        });
    }

    // Payment overdue — financial red flag, top priority for admin.
    const paymentStatus = student.payment_status?.toUpperCase();
    if (
        paymentStatus === 'OVERDUE' ||
        paymentStatus === 'UNPAID' ||
        paymentStatus === 'PARTIAL'
    ) {
        alerts.push({
            id: 'payment',
            tone: 'danger',
            icon: WarningCircle,
            text:
                paymentStatus === 'OVERDUE'
                    ? 'Fee payment is overdue'
                    : paymentStatus === 'PARTIAL'
                      ? 'Payment is partial'
                      : 'Fee payment is unpaid',
        });
    }

    // No way to reach the learner — blocks every comm action.
    if (!student.mobile_number && !student.email) {
        alerts.push({
            id: 'no-contact',
            tone: 'warning',
            icon: PhoneSlash,
            text: 'No contact info on file',
        });
    }

    if (alerts.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {alerts.map((a) => {
                const Icon = a.icon;
                return (
                    <span
                        key={a.id}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-caption font-medium',
                            TONE_CLASSES[a.tone]
                        )}
                    >
                        <Icon className="size-3.5" />
                        {a.text}
                    </span>
                );
            })}
        </div>
    );
};
