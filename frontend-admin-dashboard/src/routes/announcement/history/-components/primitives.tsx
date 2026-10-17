import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { StatusChip, type StatusType } from '@/components/design-system/status-chips';
import { cn } from '@/lib/utils';
import type { Announcement } from '../-types';
import { humanize, initials, joinParts, wallClockParts, type DateParts } from '../-utils/format';

const ANNOUNCEMENT_TONE: Record<string, StatusType> = {
    ACTIVE: 'SUCCESS',
    DELIVERED: 'SUCCESS',
    SCHEDULED: 'WARNING',
    PENDING_APPROVAL: 'WARNING',
    REJECTED: 'DANGER',
    CANCELLED: 'DANGER',
};

export function AnnouncementStatusChip({ status }: { status?: string }) {
    const { t } = useTranslation('announcementHistoryIndex');
    if (!status) return <span className="text-neutral-400">-</span>;
    return (
        <StatusChip
            text={t(`status.${status}`, { defaultValue: humanize(status) })}
            textSize="text-caption"
            status={ANNOUNCEMENT_TONE[status] ?? 'INFO'}
            showIcon={false}
        />
    );
}

const MESSAGE_TONE: Record<string, StatusType> = {
    DELIVERED: 'SUCCESS',
    READ: 'SUCCESS',
    PENDING: 'WARNING',
    FAILED: 'DANGER',
};

export function MessageStatusChip({ status }: { status?: string }) {
    const { t } = useTranslation('announcementHistoryIndex');
    if (!status) return <span className="text-neutral-400">-</span>;
    return (
        <StatusChip
            text={t(`messageStatus.${status}`, { defaultValue: humanize(status) })}
            textSize="text-caption"
            status={MESSAGE_TONE[status] ?? 'INFO'}
            showIcon={false}
        />
    );
}

/** Mode / medium enums as readable chips ("System alert", "WhatsApp"). */
export function EnumChips({
    values,
    group,
    variant = 'secondary',
}: {
    values: string[];
    group: 'modes' | 'mediums';
    variant?: 'secondary' | 'outline';
}) {
    const { t } = useTranslation('announcementHistoryIndex');
    if (values.length === 0) return <span className="text-neutral-400">-</span>;
    return (
        <div className="flex flex-wrap gap-1">
            {values.map((v) => (
                <Badge key={v} variant={variant} className="whitespace-nowrap font-regular">
                    {t(`${group}.${v}`, { defaultValue: humanize(v) })}
                </Badge>
            ))}
        </div>
    );
}

/** Date on top, 12-hour time underneath. */
export function DateTimeStack({ parts }: { parts: DateParts | null }) {
    if (!parts) return <span className="text-neutral-400">-</span>;
    return (
        <div className="whitespace-nowrap">
            <div className="text-body text-neutral-700">{parts.date}</div>
            <div className="text-caption text-neutral-500">{parts.time}</div>
        </div>
    );
}

export function NameAvatar({
    name,
    muted = false,
    className,
}: {
    name: string;
    muted?: boolean;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold',
                muted ? 'bg-neutral-100 text-neutral-500' : 'bg-primary-50 text-primary-600',
                className
            )}
        >
            {initials(name)}
        </span>
    );
}

export function ScheduleSummary({ scheduling }: { scheduling: Announcement['scheduling'] }) {
    const { t } = useTranslation('announcementHistoryIndex');
    const type = scheduling?.scheduleType;
    if (!type) return <span className="text-neutral-400">-</span>;
    if (type === 'IMMEDIATE') return <span>{t('schedule.immediate')}</span>;
    if (type === 'ONE_TIME') {
        return (
            <div>
                <div>{t('schedule.oneTime')}</div>
                <div className="text-caption text-neutral-500">
                    {joinParts(wallClockParts(scheduling?.startDate))}
                </div>
            </div>
        );
    }
    const next = wallClockParts(scheduling?.nextRunTime);
    return (
        <div>
            <div>{t('schedule.recurring')}</div>
            <div className="text-caption text-neutral-500">
                {next
                    ? t('schedule.nextRun', { when: joinParts(next) })
                    : t('schedule.cron', { expr: scheduling?.cronExpression || '-' })}
            </div>
        </div>
    );
}
