import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ChatsCircle, X } from '@phosphor-icons/react';
import {
    dismissLearnerProfileSignal,
    getLearnerProfileSignals,
    type LearnerProfileSignal,
    type LearnerSignalKind,
} from '@/services/learner-profile';
import { cn } from '@/lib/utils';
import { ProfileSectionCard } from '../profile-ui';

const KIND_ORDER: LearnerSignalKind[] = [
    'GOAL',
    'PREFERENCE',
    'STRENGTH',
    'WEAKNESS',
    'MISCONCEPTION',
    'INTEREST',
];

const KIND_TONE: Record<LearnerSignalKind, string> = {
    GOAL: 'bg-primary-50 text-primary-700',
    PREFERENCE: 'bg-info-50 text-info-700',
    STRENGTH: 'bg-success-50 text-success-700',
    WEAKNESS: 'bg-warning-50 text-warning-700',
    MISCONCEPTION: 'bg-danger-50 text-danger-700',
    INTEREST: 'bg-neutral-100 text-neutral-700',
};

/** Observations about the same thing (kind + topic), newest first. */
interface SignalGroup {
    key: string;
    kind: LearnerSignalKind;
    topic: string | null;
    signals: LearnerProfileSignal[];
}

const groupSignals = (signals: LearnerProfileSignal[]): SignalGroup[] => {
    const groups = new Map<string, SignalGroup>();
    for (const s of signals) {
        const key = `${s.kind}:${(s.topic ?? '').trim().toLowerCase()}`;
        const group = groups.get(key) ?? { key, kind: s.kind, topic: s.topic, signals: [] };
        group.signals.push(s);
        groups.set(key, group);
    }
    return [...groups.values()].sort(
        (a, b) =>
            KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
            b.signals.length - a.signals.length
    );
};

/**
 * What the Student AI noticed about this learner in their chats (pilot). Each row is
 * one thing it noticed, with how often and the learner's own words behind the latest
 * note; staff can dismiss a wrong one. Renders nothing until there is something to show.
 */
export const LearnedFromChatsPanel = ({ userId }: { userId: string }) => {
    const { t } = useTranslation('manageStudentsReports');
    const queryClient = useQueryClient();
    const queryKey = ['learner-profile-signals', userId];

    const { data: signals = [] } = useQuery({
        queryKey,
        queryFn: () => getLearnerProfileSignals(userId),
        enabled: !!userId,
        staleTime: 60_000,
        retry: false,
    });

    const dismiss = useMutation({
        mutationFn: async (group: SignalGroup) => {
            await Promise.all(group.signals.map((s) => dismissLearnerProfileSignal(s.id)));
        },
        onSuccess: () => {
            toast.success(t('learned.dismissed'));
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => toast.error(t('learned.dismissFailed')),
    });

    if (signals.length === 0) return null;
    const groups = groupSignals(signals);

    return (
        <ProfileSectionCard icon={ChatsCircle} heading={t('learned.heading')}>
            <p className="mb-2 text-caption text-neutral-500">{t('learned.subtitle')}</p>
            <ul className="flex flex-col divide-y divide-border">
                {groups.map((group) => {
                    const latest = group.signals[0]!;
                    const seen = group.signals.length;
                    return (
                        <li key={group.key} className="flex items-start gap-2 py-2">
                            <span
                                className={cn(
                                    'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-caption font-medium',
                                    KIND_TONE[group.kind]
                                )}
                            >
                                {t(`learned.kind.${group.kind}`)}
                            </span>
                            <div className="min-w-0 flex-1">
                                {group.topic && (
                                    <p className="text-body font-medium text-card-foreground">
                                        {group.topic}
                                    </p>
                                )}
                                <p className="text-caption text-neutral-600">{latest.detail}</p>
                                {latest.evidenceQuote && (
                                    <p className="mt-0.5 line-clamp-2 text-caption italic text-neutral-400">
                                        “{latest.evidenceQuote}”
                                    </p>
                                )}
                                <p className="mt-0.5 text-caption text-neutral-400">
                                    {[
                                        seen > 1 ? t('learned.seenTimes', { count: seen }) : null,
                                        latest.stated ? t('learned.stated') : null,
                                        latest.observedAt
                                            ? format(new Date(latest.observedAt), 'd MMM yyyy')
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label={t('learned.dismiss')}
                                title={t('learned.dismiss')}
                                disabled={dismiss.isPending}
                                onClick={() => dismiss.mutate(group)}
                                className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50"
                            >
                                <X className="size-3.5" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </ProfileSectionCard>
    );
};
