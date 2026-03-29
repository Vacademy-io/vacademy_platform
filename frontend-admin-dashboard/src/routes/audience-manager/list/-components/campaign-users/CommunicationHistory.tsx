import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, MessageSquare, Mail, Bell, AlertCircle } from 'lucide-react';
import {
    getAudienceCommunications,
    type AudienceCommunicationItem,
} from '../../-services/send-audience-message';

interface CommunicationHistoryProps {
    campaignId: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
    WHATSAPP: <MessageSquare className="size-4 text-green-600" />,
    EMAIL: <Mail className="size-4 text-blue-600" />,
    PUSH: <Bell className="size-4 text-orange-500" />,
    SYSTEM_ALERT: <AlertCircle className="size-4 text-purple-600" />,
};

const STATUS_COLORS: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    PARTIAL: 'bg-yellow-100 text-yellow-800',
    FAILED: 'bg-red-100 text-red-800',
    PENDING: 'bg-gray-100 text-gray-800',
};

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

export function CommunicationHistory({ campaignId }: CommunicationHistoryProps) {
    const [page, setPage] = useState(0);
    const pageSize = 10;

    const { data, isLoading } = useQuery({
        queryKey: ['audienceCommunications', campaignId, page],
        queryFn: () => getAudienceCommunications(campaignId, page, pageSize),
        enabled: !!campaignId,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                Loading communication history...
            </div>
        );
    }

    if (!data || data.content.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <MessageSquare className="size-8 opacity-30" />
                <p>No messages sent to this audience yet.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">
                Communication History
            </h3>
            <div className="rounded-md border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">Channel</th>
                            <th className="px-3 py-2 text-left font-medium">Template / Subject</th>
                            <th className="px-3 py-2 text-left font-medium">Recipients</th>
                            <th className="px-3 py-2 text-left font-medium">Result</th>
                            <th className="px-3 py-2 text-left font-medium">Status</th>
                            <th className="px-3 py-2 text-left font-medium">Sent At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.content.map((item: AudienceCommunicationItem) => (
                            <tr key={item.id} className="border-t">
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                        {CHANNEL_ICONS[item.channel] || null}
                                        <span className="text-xs">{item.channel}</span>
                                    </div>
                                </td>
                                <td className="max-w-[200px] truncate px-3 py-2">
                                    {item.template_name || item.subject || '—'}
                                </td>
                                <td className="px-3 py-2">{item.recipient_count}</td>
                                <td className="px-3 py-2">
                                    <span className="text-green-600">{item.successful}</span>
                                    {item.failed > 0 && (
                                        <>
                                            {' / '}
                                            <span className="text-red-600">{item.failed} failed</span>
                                        </>
                                    )}
                                </td>
                                <td className="px-3 py-2">
                                    <span
                                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || STATUS_COLORS.PENDING}`}
                                    >
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                    {formatDate(item.created_at)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data.totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                        </PaginationItem>
                        <PaginationItem>
                            <span className="px-3 text-sm">
                                Page {page + 1} of {data.totalPages}
                            </span>
                        </PaginationItem>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setPage(Math.min(data.totalPages - 1, page + 1))}
                                disabled={page >= data.totalPages - 1}
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </div>
    );
}
