import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChatCircle, EnvelopeSimple } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { HubRecentItem } from '../../-services/hub-api';

interface Props {
    items: HubRecentItem[];
    loading: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
}

export function RecentActivity({ items, loading, hasMore, loadingMore, onLoadMore }: Props) {
    const { t, i18n } = useTranslation('communicationRecentActivity');

    return (
        <Card className="rounded-lg border-gray-200">
            <CardHeader className="py-3">
                <CardTitle className="text-base">{t('title')}</CardTitle>
                <p className="text-xs text-gray-400">{t('subtitle')}</p>
            </CardHeader>
            <CardContent className="p-0">
                {loading && items.length === 0 ? (
                    <div className="p-4 space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-md" />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">{t('emptyState')}</div>
                ) : (
                    <>
                        <ul className="divide-y">
                            {items.map((item) => (
                                <li key={item.id} className="px-4 py-3 hover:bg-gray-50 transition">
                                    <div className="flex items-start gap-3">
                                        <ChannelIcon channel={item.channel} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-800 truncate">
                                                    {item.fromName || item.from}
                                                </span>
                                                {item.fromName && (
                                                    <span className="text-xs text-gray-400 truncate">
                                                        {item.from}
                                                    </span>
                                                )}
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px] uppercase shrink-0"
                                                >
                                                    {item.channel}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                {item.preview || '—'}
                                            </p>
                                        </div>
                                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                            {formatTime(item.timestamp, t, i18n.language)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {(hasMore || loadingMore) && (
                            <div className="px-4 py-3 border-t flex justify-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onLoadMore}
                                    disabled={loadingMore || !hasMore}
                                    className="text-xs"
                                >
                                    {loadingMore ? t('loadingMore') : t('loadMore')}
                                </Button>
                            </div>
                        )}
                        {!hasMore && items.length > 0 && !loadingMore && (
                            <p className="text-center text-[11px] text-muted-foreground py-3 border-t">
                                {t('noMoreActivity')}
                            </p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function ChannelIcon({ channel }: { channel: HubRecentItem['channel'] }) {
    if (channel === 'EMAIL') {
        return (
            <div className="size-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <EnvelopeSimple size={16} />
            </div>
        );
    }
    return (
        <div className="size-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <ChatCircle size={16} />
        </div>
    );
}

function formatTime(timestamp: string, t: TFunction, locale: string): string {
    try {
        const d = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return t('time.now');
        if (diffMin < 60) return t('time.minutes', { count: diffMin });
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return t('time.hours', { count: diffH });
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return t('time.days', { count: diffD });
        return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}
