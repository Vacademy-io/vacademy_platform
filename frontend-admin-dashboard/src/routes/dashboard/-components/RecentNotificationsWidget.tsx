import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getUserId } from '@/utils/userDetails';
import {
    getSystemAlertsQuery,
    stripHtml,
    formatAlertTimestamp,
} from '@/services/notifications/system-alerts';
import { BellSimple, ArrowRight } from '@phosphor-icons/react';

export default function RecentNotificationsWidget({ onSeeAll }: { onSeeAll?: () => void }) {
    const userId = getUserId();
    const { data, isLoading } = useSuspenseQuery(getSystemAlertsQuery(userId, 5));
    const items = data?.content || [];

    return (
        <Card className="flex h-full flex-col bg-white shadow-sm">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                            <BellSimple size={14} weight="duotone" />
                        </span>
                        <CardTitle className="text-sm font-semibold">
                            Recent Notifications
                        </CardTitle>
                    </div>
                    {onSeeAll && (
                        <button
                            type="button"
                            onClick={onSeeAll}
                            className="flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700"
                        >
                            See all
                            <ArrowRight size={12} weight="bold" />
                        </button>
                    )}
                </div>
                <CardDescription className="line-clamp-1 text-[11px] text-neutral-500 sm:text-xs">
                    Latest system alerts for your account
                </CardDescription>
            </CardHeader>
            <div className="flex flex-1 flex-col px-2 pb-3">
                {isLoading ? (
                    <ul className="space-y-1 px-2">
                        {[0, 1, 2].map((i) => (
                            <li key={i} className="space-y-1 rounded p-2">
                                <Skeleton className="h-3 w-2/3" />
                                <Skeleton className="h-2.5 w-1/2" />
                            </li>
                        ))}
                    </ul>
                ) : items.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                        <BellSimple size={20} weight="duotone" className="text-neutral-300" />
                        <div className="text-[11px] text-neutral-500">No recent notifications</div>
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {items.map((item) => (
                            <li
                                key={item.messageId}
                                className="rounded-md p-2 transition-colors hover:bg-neutral-50"
                            >
                                <div className="line-clamp-1 text-xs font-medium text-neutral-800">
                                    {item.title}
                                </div>
                                <div className="line-clamp-2 text-[11px] text-neutral-600">
                                    {item.content?.type === 'html'
                                        ? stripHtml(item.content?.content)
                                        : item.content?.content}
                                </div>
                                <div className="mt-1 text-[10px] text-neutral-400">
                                    {formatAlertTimestamp(item.createdAt)}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Card>
    );
}
