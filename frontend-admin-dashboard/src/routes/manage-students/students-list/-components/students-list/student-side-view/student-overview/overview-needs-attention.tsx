import { StudentTable } from '@/types/student-table-types';
import { MyButton } from '@/components/design-system/button';
import {
    Lightning,
    CheckCircle,
    FileX,
    PaperPlaneTilt,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type Tone = 'danger' | 'warning' | 'info' | 'success';

interface AttentionItem {
    id: string;
    tone: Tone;
    icon: PhosphorIcon;
    title: string;
    description: string;
    actionLabel: string;
    actionIcon?: PhosphorIcon;
    onAction?: () => void;
}

/** Maps tone → icon-chip background + foreground token classes. */
const TONE_CHIP_CLASSES: Record<Tone, string> = {
    danger: 'bg-danger-50 text-danger-600',
    warning: 'bg-warning-50 text-warning-600',
    info: 'bg-info-50 text-info-600',
    success: 'bg-success-50 text-success-600',
};

/**
 * Needs Attention card — the action-first hero strip on the Overview tab.
 *
 * Per Vacademy design handoff. Replaces the previous compact alert chip
 * with a structured card: header row (⚡ + "Needs attention" + count badge)
 * + one row per issue: icon chip + title + description + soft action button.
 *
 * When there's nothing wrong, renders a single green "All clear" bar instead.
 *
 * Per the handoff spec, the action button on each row jumps the admin to the
 * relevant tab (T&C → Send dialog, Outstanding → Payment, Behind → Progress,
 * Follow-up → Lead). For this v1 only T&C is wired (the only condition
 * derivable from the data already loaded on Overview). Outstanding ₹,
 * behind-subjects, and lead inactivity light up once Phase A-2 wires their
 * react-query loaders.
 */
export const OverviewNeedsAttention = ({
    student,
    tncAccepted,
    onSendTncReminder,
}: {
    student: StudentTable | null;
    tncAccepted: boolean | undefined;
    /** Optional callback for the "Send" action on the T&C row. */
    onSendTncReminder?: () => void;
}) => {
    if (!student) return null;

    const items: AttentionItem[] = [];

    // Condition 1: Terms & Conditions not signed → "Send" reminder.
    if (tncAccepted === false) {
        items.push({
            id: 'tnc',
            tone: 'warning',
            icon: FileX,
            title: 'Terms & Conditions not signed',
            description: 'Required before the first class',
            actionLabel: 'Send',
            actionIcon: PaperPlaneTilt,
            onAction: onSendTncReminder,
        });
    }

    // TODO (Phase A-2): outstanding > 0, behindSubjects > 0, lead inactivity.

    // Empty state — green "all clear" bar.
    if (items.length === 0) {
        return (
            <div className="flex items-center gap-2.5 rounded-lg border border-success-200 bg-success-50 px-4 py-3">
                <CheckCircle className="size-5 shrink-0 text-success-600" weight="fill" />
                <span className="text-body font-semibold text-success-700">
                    All clear — nothing needs attention right now.
                </span>
            </div>
        );
    }

    return (
        <section className="overflow-hidden rounded-lg border border-border shadow-sm">
            {/* Header row: ⚡ + label + count badge */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                <Lightning
                    className="size-4 text-warning-600"
                    weight="fill"
                />
                <span className="text-body font-bold text-card-foreground">
                    Needs attention
                </span>
                <span className="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-caption font-bold text-warning-700">
                    {items.length}
                </span>
            </div>

            {/* Rows */}
            <ul className="divide-y divide-border">
                {items.map((it) => {
                    const IconCmp = it.icon;
                    const ActionIcon = it.actionIcon;
                    return (
                        <li
                            key={it.id}
                            className="flex items-center gap-3 px-4 py-3"
                        >
                            <span
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-md',
                                    TONE_CHIP_CLASSES[it.tone]
                                )}
                            >
                                <IconCmp className="size-4" weight="fill" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-body font-semibold text-card-foreground">
                                    {it.title}
                                </div>
                                <div className="truncate text-caption text-muted-foreground">
                                    {it.description}
                                </div>
                            </div>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={it.onAction}
                                disable={!it.onAction}
                                className="shrink-0"
                            >
                                {ActionIcon && <ActionIcon className="size-3.5" />}
                                {it.actionLabel}
                            </MyButton>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};
