import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserEmailTracking, type EmailTrackingItem } from '@/services/email-tracking-service';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { formatDistanceToNow } from 'date-fns';
import { 
    CheckCircle, 
    Clock, 
    XCircle, 
    Mail, 
    Eye, 
    MousePointer,
    AlertCircle,
    RefreshCw,
    Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Envelope, WhatsappLogo } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';

const getStatusIcon = (eventType: string) => {
    switch (eventType.toLowerCase()) {
        case 'delivery':
            return <CheckCircle className="size-4 text-green-500" />;
        case 'open':
            return <Eye className="size-4 text-blue-500" />;
        case 'click':
            return <MousePointer className="size-4 text-purple-500" />;
        case 'send':
            return <Mail className="size-4 text-blue-600" />;
        case 'pending':
            return <Clock className="size-4 text-yellow-500" />;
        case 'bounce':
        case 'reject':
            return <XCircle className="size-4 text-red-500" />;
        case 'complaint':
            return <AlertCircle className="size-4 text-orange-500" />;
        default:
            return <RefreshCw className="size-4 text-gray-500" />;
    }
};

const getStatusColor = (eventType: string) => {
    switch (eventType.toLowerCase()) {
        case 'delivery':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'open':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'click':
            return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'send':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'bounce':
        case 'reject':
            return 'bg-red-100 text-red-800 border-red-200';
        case 'complaint':
            return 'bg-orange-100 text-orange-800 border-orange-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const formatEventType = (eventType: string) => {
    const et = eventType.toLowerCase();
    if (et === 'delivery') return 'Delivered';
    if (et === 'open') return 'Opened';
    // Optional: normalize other common ones
    if (et === 'send') return 'Sent';
    return eventType.charAt(0).toUpperCase() + eventType.slice(1).toLowerCase();
};

const formatLocalDateTime = (isoOrLocal: string) => {
    // Prefer ISO if provided
    const date = new Date(isoOrLocal);
    // Fall back if invalid
    if (isNaN(date.getTime())) return isoOrLocal;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
};

export const StudentEmailNotifications = () => {
    const { selectedStudent } = useStudentSidebar();
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const [expandedMsg, setExpandedMsg] = useState<Record<string, boolean>>({});
    const {
        openIndividualSendEmailDialog,
        openIndividualSendMessageDialog,
    } = useDialogStore();

    const {
        data: emailData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['user-email-tracking', selectedStudent?.user_id, page],
        queryFn: () => getUserEmailTracking(selectedStudent?.user_id || '', page, pageSize),
        enabled: !!selectedStudent?.user_id,
        staleTime: 30000, // 30 seconds
    });

    if (!selectedStudent?.user_id) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-neutral-100 p-4 mb-3">
                    <Mail className="size-8 text-neutral-400" />
                </div>
                <p className="text-sm font-medium text-neutral-600">No student selected</p>
                <p className="text-xs text-neutral-500 mt-1">Select a student to view their notifications</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-6 w-16" />
                </div>
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-red-100 p-4 mb-4">
                    <AlertCircle className="size-8 text-red-500" />
                </div>
                <p className="text-sm font-medium text-red-600 mb-2">Failed to load notifications</p>
                <p className="text-xs text-red-500 mb-4 text-center">There was an error loading the email notifications</p>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const notifications = emailData?.content || [];

    return (
        <div className="space-y-6">
            {/* Send Notification Section */}
            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                <div className="mb-2 flex items-center gap-2.5">
                    <div className="rounded-md bg-gradient-to-br from-blue-50 to-blue-100 p-1.5">
                        <Bell className="size-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-xs font-medium text-neutral-700">Send Notification</h4>
                        <p className="text-[10px] text-neutral-500">Email or WhatsApp message</p>
                    </div>
                </div>

                {/* Notification action buttons */}
                <div className="flex gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={false}
                        onClick={() => {
                            if (selectedStudent) {
                                openIndividualSendEmailDialog(selectedStudent);
                            }
                        }}
                        className="group flex flex-1 cursor-pointer items-center justify-center gap-1.5 border border-blue-200 bg-white text-xs text-blue-700 transition-all duration-200 hover:scale-100 hover:border-blue-300 hover:bg-blue-50"
                        style={{ pointerEvents: 'auto', zIndex: 10 }}
                    >
                        <Envelope className="size-3 transition-transform duration-200 group-hover:scale-110" />
                        Email
                    </MyButton>

                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={false}
                        onClick={() => {
                            if (selectedStudent) {
                                openIndividualSendMessageDialog(selectedStudent);
                            }
                        }}
                        className="group flex flex-1 cursor-pointer items-center justify-center gap-1.5 border border-green-200 bg-white text-xs text-green-700 transition-all duration-200 hover:scale-100 hover:border-green-300 hover:bg-green-50"
                        style={{ pointerEvents: 'auto', zIndex: 10 }}
                    >
                        <WhatsappLogo className="size-3 transition-transform duration-200 group-hover:scale-110" />
                        WhatsApp
                    </MyButton>
                </div>
            </div>

            {/* Recent Notifications */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"></div>
                    <h3 className="text-lg font-semibold text-neutral-800">Recent Notifications</h3>
                </div>
                <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                    {emailData?.totalElements || 0} total
                </Badge>
            </div>

            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-neutral-100 p-6 mb-4">
                        <Mail className="size-12 text-neutral-400" />
                    </div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">No notifications found</p>
                    <p className="text-xs text-neutral-500 text-center">This student hasn't received any email notifications yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notification: EmailTrackingItem) => (
                        <div key={notification.emailId} className="group rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-neutral-300">
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getStatusIcon(notification.latestStatus.eventType)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm text-neutral-900 truncate mb-1">
                                            {notification.emailSubject}
                                        </h4>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge 
                                                variant="outline" 
                                                className={`text-xs font-medium ${getStatusColor(notification.latestStatus.eventType)}`}
                                            >
                                                {formatEventType(notification.latestStatus.eventType)}
                                            </Badge>
                                            <span className="text-xs text-neutral-500 font-medium">
                                                {formatDistanceToNow(new Date(notification.sentAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="pl-7 space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                                        <span className="font-medium">To:</span>
                                        <span className="truncate">{notification.recipientEmail}</span>
                                    </div>

                                    {/* All Events Timeline */}
                                    <div className="mt-1 space-y-1.5">
                                        {(notification.events || [notification.latestStatus]).map((ev, i) => {
                                            const key = `${notification.emailId}-${ev.eventType}-${ev.eventTimestamp}-${i}`;
                                            const details = ev.eventDetails || '';
                                            const msgMatch = details.match(/Message ID:\s*([^\n]+)/i);
                                            const messageId = msgMatch?.[1]?.trim();
                                            const detailsWithoutMsgId = details.replace(/Message ID:[^\n]*\n?/i, '');
                                            const emailEventMatch = detailsWithoutMsgId.match(/Email\s*Event:\s*([^\n]+)/i);
                                            const subjectMatch = detailsWithoutMsgId.match(/Subject:\s*([^\n]+)/i);
                                            const fromMatch = detailsWithoutMsgId.match(/From:\s*([^\n]+)/i);
                                            const toMatch = detailsWithoutMsgId.match(/To:\s*([^\n]+)/i);
                                            const emailEvent = emailEventMatch?.[1]?.trim();
                                            const subject = subjectMatch?.[1]?.trim();
                                            const fromAddr = fromMatch?.[1]?.trim();
                                            const toAddr = toMatch?.[1]?.trim();
                                            const cleanedDetails = detailsWithoutMsgId
                                                .replace(/Email\s*Event:[^\n]*\n?/i, '')
                                                .replace(/Subject:[^\n]*\n?/i, '')
                                                .replace(/From:[^\n]*\n?/i, '')
                                                .replace(/To:[^\n]*\n?/i, '')
                                                .split('\n')
                                                .map((s) => s.trim())
                                                .filter(Boolean);
                                            const isExpanded = !!expandedMsg[key];
                                            return (
                                            <div key={key} className="flex items-start gap-2 text-xs">
                                                <div className="mt-0.5">
                                                    {getStatusIcon(ev.eventType)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className={`font-medium ${getStatusColor(ev.eventType)}`}>
                                                            {formatEventType(ev.eventType)}
                                                        </Badge>
                                                        <span className="text-neutral-500">
                                                            {formatLocalDateTime(ev.eventTimestampIso || ev.eventTimestamp)}
                                                        </span>
                                                    </div>
                                                    {(emailEvent || fromAddr || toAddr || subject || cleanedDetails.length > 0) && (
                                                        <div className="text-neutral-600 mt-0.5 break-words space-y-0.5">
                                                            {emailEvent && (
                                                                <div><span className="font-medium">Email Event:</span> {emailEvent}</div>
                                                            )}
                                                            {fromAddr && (
                                                                <div><span className="font-medium">From:</span> {fromAddr}</div>
                                                            )}
                                                            {toAddr && (
                                                                <div><span className="font-medium">To:</span> {toAddr}</div>
                                                            )}
                                                            {subject && (
                                                                <div><span className="font-medium">Subject:</span> {subject}</div>
                                                            )}
                                                            {cleanedDetails.map((line, idx2) => (
                                                                <div key={`${key}-rest-${idx2}`}>{line}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {messageId && (
                                                        <div className="mt-1 flex items-center gap-2 text-neutral-600">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedMsg((prev) => ({ ...prev, [key]: !isExpanded }))}
                                                                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800"
                                                                aria-expanded={isExpanded}
                                                                aria-label="Toggle message id"
                                                            >
                                                                <Info className="size-3" />
                                                                <span>Message ID</span>
                                                            </button>
                                                            {isExpanded && (
                                                                <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
                                                                    {messageId}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {ev.clickedLink && (
                                                        <div className="text-neutral-600 mt-0.5 break-words">
                                                            Clicked: {ev.clickedLink}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {emailData && emailData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-6 border-t border-neutral-200">
                    <button
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="px-4 py-2 text-xs font-medium bg-white text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 hover:border-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        Previous
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-lg">
                        <span className="text-xs font-medium text-neutral-600">
                            Page {page + 1} of {emailData.totalPages}
                        </span>
                    </div>
                    <button
                        onClick={() => setPage(Math.min(emailData.totalPages - 1, page + 1))}
                        disabled={page >= emailData.totalPages - 1}
                        className="px-4 py-2 text-xs font-medium bg-white text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 hover:border-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};




