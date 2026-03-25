import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getUserId } from '@/utils/userDetails';
import { getSystemAlertsQuery, stripHtml } from '@/services/notifications/system-alerts';
import { BellSimple } from '@phosphor-icons/react';

export default function RecentNotificationsWidget({ onSeeAll }: { onSeeAll?: () => void }) {
    const userId = getUserId();
    const { data, isLoading } = useSuspenseQuery(getSystemAlertsQuery(userId, 5));

    return (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-none">
            <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BellSimple size={20} className="text-purple-700" weight="duotone" />
                        <CardTitle className="text-sm font-semibold text-purple-900">
                            Recent Notifications
                        </CardTitle>
                    </div>
                    <button
                        className="text-xs text-purple-700 hover:underline"
                        onClick={() => onSeeAll?.()}
                    >
                        See all
                    </button>
                </div>
                <CardDescription className="text-xs text-purple-800">
                    Latest system alerts for your account
                </CardDescription>
            </CardHeader>
            <div className="px-4 pb-3">
                <div className="space-y-2">
                    {isLoading ? (
                        <div className="text-xs text-purple-700">Loading...</div>
                    ) : data?.content?.length ? (
                        data.content.map((item) => (
                            <div key={item.messageId} className="rounded-md bg-white/70 p-2">
                                <div className="text-[13px] font-semibold text-neutral-800">
                                    {item.title}
                                </div>
                                <div className="line-clamp-2 text-[12px] text-neutral-700">
                                    {item.content?.type === 'html'
                                        ? stripHtml(item.content?.content)
                                        : item.content?.content}
                                </div>
                                <div className="mt-1 text-[11px] text-neutral-500">
                                    {new Date(item.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-md bg-white/70 p-2 text-center text-xs text-neutral-600">
                            No recent notifications
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
