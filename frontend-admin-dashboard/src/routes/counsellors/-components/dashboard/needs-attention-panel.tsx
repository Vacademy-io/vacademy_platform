import { Alarm, CheckCircle, UserSwitch } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import type { AttentionItem } from '../../-utils/dashboard-stats';

/**
 * A short, plain-language to-do list for the manager: who is behind on
 * follow-ups, and which inactive counsellors are still sitting on leads.
 * Each row has exactly one action that opens an existing flow (the Follow-ups
 * page, or the existing reassign dialog). Renders nothing while loading.
 */
export function NeedsAttentionPanel({
    items,
    loading,
    onViewFollowUps,
    onReassign,
}: {
    items: AttentionItem[];
    loading: boolean;
    onViewFollowUps: (userId: string) => void;
    onReassign: (userId: string, name: string) => void;
}) {
    const { t } = useTranslation('counsellorsIndex');
    if (loading) return null;

    if (items.length === 0) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-body text-success-700">
                <CheckCircle size={18} weight="fill" className="shrink-0" />
                {t('attention.allClear')}
            </div>
        );
    }

    return (
        <section className="rounded-lg border border-neutral-200 bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                <h2 className="text-subtitle font-semibold text-neutral-900">
                    {t('attention.title')}
                </h2>
                <span className="text-caption text-neutral-500">
                    {t('attention.count', { count: items.length })}
                </span>
            </header>
            <ul className="divide-y divide-neutral-100">
                {items.map((item) => {
                    const name = item.name || t('card.unnamed');
                    const isOverdue = item.kind === 'overdue';
                    return (
                        <li
                            key={`${item.kind}-${item.userId}`}
                            className="flex flex-wrap items-center gap-3 px-4 py-3"
                        >
                            <span
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-md',
                                    isOverdue
                                        ? 'bg-danger-50 text-danger-600'
                                        : 'bg-warning-50 text-warning-600'
                                )}
                            >
                                {isOverdue ? (
                                    <Alarm size={18} weight="duotone" />
                                ) : (
                                    <UserSwitch size={18} weight="duotone" />
                                )}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-body text-neutral-900">
                                    {isOverdue
                                        ? t('attention.overdue', { name, count: item.count })
                                        : t('attention.inactive', { name, count: item.count })}
                                </p>
                                <p className="text-caption text-neutral-500">
                                    {isOverdue
                                        ? item.oldestDays != null && item.oldestDays > 0
                                            ? t('attention.overdueOldest', {
                                                  count: item.oldestDays,
                                              })
                                            : t('attention.overdueHint')
                                        : t('attention.inactiveHint')}
                                </p>
                            </div>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() =>
                                    isOverdue
                                        ? onViewFollowUps(item.userId)
                                        : onReassign(item.userId, name)
                                }
                            >
                                {isOverdue ? t('attention.viewFollowUps') : t('attention.reassign')}
                            </MyButton>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
