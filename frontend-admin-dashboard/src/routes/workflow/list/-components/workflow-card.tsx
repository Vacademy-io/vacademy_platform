import { Workflow } from '@/types/workflow/workflow-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, Clock, Tag } from '@phosphor-icons/react';

interface WorkflowCardProps {
    workflow: Workflow;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
    const navigate = useNavigate();

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch (error) {
            return 'Unknown';
        }
    };

    const humanizeCronQuartz = (expr: string): string => {
        const parts = expr.trim().split(/\s+/);
        if (parts.length < 6) return expr;
        const [sec, min, hour, dom, mon, dow] = parts as [
            string,
            string,
            string,
            string,
            string,
            string,
        ];

        const to12h = (h: number, m: number) => {
            const period = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 === 0 ? 12 : h % 12;
            const mm = m.toString().padStart(2, '0');
            return `${h12}:${mm} ${period}`;
        };

        const isStar = (v: string) => v === '*' || v === '?';
        const nMin = parseInt(min, 10);
        const nHour = parseInt(hour, 10);
        if (!Number.isNaN(nMin) && !Number.isNaN(nHour) && sec === '0') {
            const timeStr = to12h(nHour, nMin);
            if (isStar(dom) && isStar(mon) && isStar(dow)) {
                return `Every day at ${timeStr}`;
            }
            const dowNames: Record<string, string> = {
                SUN: 'Sunday',
                MON: 'Monday',
                TUE: 'Tuesday',
                WED: 'Wednesday',
                THU: 'Thursday',
                FRI: 'Friday',
                SAT: 'Saturday',
                '1': 'Sunday',
                '2': 'Monday',
                '3': 'Tuesday',
                '4': 'Wednesday',
                '5': 'Thursday',
                '6': 'Friday',
                '7': 'Saturday',
            };
            if (!isStar(dow)) {
                const days = dow
                    .split(',')
                    .map((d) => dowNames[d] || d)
                    .join(', ');
                return `Every ${days} at ${timeStr}`;
            }
            if (!isStar(dom) && isStar(mon)) {
                return `On day ${dom} of every month at ${timeStr}`;
            }
            const monNames: Record<string, string> = {
                JAN: 'January',
                FEB: 'February',
                MAR: 'March',
                APR: 'April',
                MAY: 'May',
                JUN: 'June',
                JUL: 'July',
                AUG: 'August',
                SEP: 'September',
                OCT: 'October',
                NOV: 'November',
                DEC: 'December',
            };
            if (!isStar(dom) && !isStar(mon)) {
                const months = mon
                    .split(',')
                    .map((m) => monNames[m] || m)
                    .join(', ');
                return `On day ${dom} of ${months} at ${timeStr}`;
            }
            if (isStar(dom) && !isStar(mon)) {
                const months = mon
                    .split(',')
                    .map((m) => monNames[m] || m)
                    .join(', ');
                return `Every day of ${months} at ${timeStr}`;
            }
        }
        return expr;
    };

    const formatWorkflowType = (type: string) => {
        // Convert EVENT_DRIVEN to "Event Driven", SCHEDULED to "Scheduled", etc.
        return type
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    const handleCardClick = () => {
        navigate({ to: '/workflow/$workflowId', params: { workflowId: workflow.id } });
    };

    const isScheduled = workflow.workflow_type === 'SCHEDULED';
    const isEventDriven =
        workflow.workflow_type === 'EVENT_DRIVEN' || workflow.workflow_type === 'TRIGGER';

    return (
        <Card
            className="group cursor-pointer border-neutral-200 transition-all duration-200 hover:border-primary-300 hover:shadow-lg"
            onClick={handleCardClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-lg font-semibold text-neutral-900 transition-colors group-hover:text-primary-600">
                        {workflow.name}
                    </h3>
                    <Badge
                        variant={workflow.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="shrink-0 bg-green-100 text-green-800 hover:bg-green-100"
                    >
                        {workflow.status}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Description */}
                <p className="line-clamp-3 min-h-12 text-sm text-neutral-600">
                    {workflow.description || 'No description available'}
                </p>

                {/* Workflow Type */}
                <div className="flex items-center gap-2 text-sm">
                    <Tag className="text-primary-500" size={16} weight="fill" />
                    <span className="text-neutral-500">Type:</span>
                    <Badge variant="outline" className="font-medium text-primary-600">
                        {formatWorkflowType(workflow.workflow_type)}
                    </Badge>
                </div>

                {/* Schedules (only for SCHEDULED workflows) */}
                {isScheduled && (
                    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="text-xs font-medium text-neutral-600">Schedules</div>
                        {workflow.schedules && workflow.schedules.length > 0 ? (
                            <div className="space-y-2">
                                {workflow.schedules.slice(0, 3).map((s, idx) => (
                                    <div
                                        key={idx}
                                        className="flex flex-wrap items-center gap-2 text-xs text-neutral-600"
                                    >
                                        <Badge
                                            variant="secondary"
                                            className="bg-blue-50 text-blue-700"
                                        >
                                            {s.schedule_type || 'CRON'}
                                        </Badge>
                                        {s.cron_expression && (
                                            <span
                                                className="truncate"
                                                title={s.cron_expression || undefined}
                                            >
                                                {humanizeCronQuartz(s.cron_expression)}
                                            </span>
                                        )}
                                        {s.timezone && <span>({s.timezone})</span>}
                                        {s.last_run_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} className="text-neutral-400" />
                                                last: {new Date(s.last_run_at).toLocaleString()}
                                            </span>
                                        )}
                                        {s.next_run_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} className="text-neutral-400" />
                                                next: {new Date(s.next_run_at).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {workflow.schedules.length > 3 && (
                                    <div className="text-xs text-neutral-500">
                                        and {workflow.schedules.length - 3} more…
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-neutral-500">No schedule added</div>
                        )}
                    </div>
                )}

                {/* Trigger (for EVENT_DRIVEN/TRIGGER workflows) */}
                {isEventDriven && (
                    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="text-xs font-medium text-neutral-600">Trigger</div>
                        {workflow.trigger ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                                {workflow.trigger.trigger_event_name && (
                                    <Badge
                                        variant="secondary"
                                        className="bg-purple-50 text-purple-700"
                                    >
                                        {workflow.trigger.trigger_event_name}
                                    </Badge>
                                )}
                                {workflow.trigger.trigger_status && (
                                    <Badge variant="outline" className="text-green-700">
                                        {workflow.trigger.trigger_status}
                                    </Badge>
                                )}
                                {workflow.trigger.trigger_description && (
                                    <span className="truncate">
                                        {workflow.trigger.trigger_description}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-neutral-500">No trigger details</div>
                        )}
                    </div>
                )}

                {/* Metadata */}
                <div className="space-y-2 border-t border-neutral-200 pt-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Calendar size={14} weight="duotone" className="text-neutral-400" />
                        <span>Created {formatDate(workflow.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Clock size={14} weight="duotone" className="text-neutral-400" />
                        <span>Updated {formatDate(workflow.updated_at)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
