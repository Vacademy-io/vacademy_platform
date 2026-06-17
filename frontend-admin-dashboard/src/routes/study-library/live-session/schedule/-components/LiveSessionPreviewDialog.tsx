import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Article,
    BellRinging,
    Globe,
    Lightning,
    UsersThree as UsersThreeIcon,
    Warning,
} from '@phosphor-icons/react';
import { STREAMING_OPTIONS } from '../-constants/options';

export type PreviewSelectedLevel = {
    courseId: string;
    sessionId: string;
    levelId: string;
};

export type PreviewCourseInfo = {
    courseName: string;
    courseId: string;
    sessionId: string;
    levels: Array<{ name: string; id: string }>;
};

export type PreviewSessionRow = {
    title?: string;
    subject?: string;
    startDate?: string;
    startTime?: string;
    /** Overrides date+time rendering in the When column. Use for recurring labels like "Every Monday · 10:00". */
    whenLabel?: string;
    /** Optional secondary line under whenLabel (e.g., "Until 30 Jun 2026"). */
    whenSubLabel?: string;
    durationHours?: string | number;
    durationMinutes?: string | number;
    link?: string;
    platform?: string;
    selectedLevels?: PreviewSelectedLevel[];
    /** Per-row description HTML (used for bulk where each row may differ). */
    description?: string;
};

export type PreviewSessionFeatures = {
    enableWaitingRoom?: boolean;
    waitingRoomMinutes?: string | number;
    allowRewind?: boolean;
    allowPause?: boolean;
    enableFeedback?: boolean;
    recordSession?: boolean;
};

export type PreviewNotifications = {
    notifyBy?: {
        mail?: boolean;
        whatsapp?: boolean;
        push_notification?: boolean;
        system_notification?: boolean;
    };
    notifySettings?: {
        onCreate?: boolean;
        beforeLiveTime?: Array<{ time: string }>;
        onLive?: boolean;
        onAttendance?: boolean;
    };
};

export type PreviewRecurrenceBanner = {
    /** Short pattern label, e.g. "Recurring weekly". */
    pattern: string;
    /** Selected day chips (e.g., ["Mon", "Wed", "Fri"]). */
    days?: string[];
    /** Optional end-date label (e.g., "Until 30 Jun 2026"). */
    until?: string;
    /** Optional total slot count (e.g., "6 sessions/week"). */
    totalLabel?: string;
};

interface LiveSessionPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    submitting: boolean;
    onConfirm: () => void | Promise<void>;
    timeZone?: string;
    accessType?: string;
    sessionFeatures?: PreviewSessionFeatures;
    notifications?: PreviewNotifications;
    sessions: PreviewSessionRow[];
    /** Only meaningful in bulk mode. When undefined the validity badge / warning are hidden. */
    validCount?: number;
    courses: PreviewCourseInfo[];
    sessionList: Array<{ id: string; name: string }>;
    /** When set, renders a recurrence summary banner above the sessions table. */
    recurrenceBanner?: PreviewRecurrenceBanner;
    /**
     * Class-level description HTML rendered as its own section above the sessions
     * table. Use for single-class and recurring previews where every "row"
     * shares the same description. For bulk where rows differ, set
     * `description` per row instead.
     */
    topLevelDescription?: string;
    title?: string;
    description?: string;
    confirmLabel?: string;
    submittingLabel?: string;
    backLabel?: string;
    footerNote?: string;
}

export function LiveSessionPreviewDialog({
    open,
    onOpenChange,
    submitting,
    onConfirm,
    timeZone,
    accessType,
    sessionFeatures,
    notifications,
    sessions,
    validCount,
    courses,
    sessionList,
    recurrenceBanner,
    topLevelDescription,
    title = 'Review & confirm',
    description = 'Make sure everything looks right. Confirm to create — or go back and edit.',
    confirmLabel = 'Confirm & create',
    submittingLabel = 'Creating…',
    backLabel = 'Back to edit',
    footerNote,
}: LiveSessionPreviewDialogProps) {
    const totalSessions = sessions.length;
    const features = sessionFeatures ?? {};
    const notifyBy = notifications?.notifyBy ?? {};
    const notifySettings = notifications?.notifySettings ?? {};

    const channelLabels = [
        notifyBy.mail ? 'Email' : null,
        notifyBy.whatsapp ? 'WhatsApp' : null,
        notifyBy.push_notification ? 'Push' : null,
        notifyBy.system_notification ? 'System' : null,
    ].filter(Boolean) as string[];

    const triggerLabels: string[] = [];
    if (notifySettings.onCreate) triggerLabels.push('On create');
    // This dialog re-renders on every notification toggle (its props are
    // watch()ed), so guard against any malformed reminder entry (null / missing
    // `time`) reaching here — accessing `.time` on a bad element would throw
    // during render and trip the route-level "System Crashed" page.
    const beforeTimes = (notifySettings.beforeLiveTime ?? []).filter(
        (t): t is { time: string } => !!t && typeof t.time === 'string' && t.time.length > 0
    );
    if (beforeTimes.length > 0) {
        triggerLabels.push(`Before live (${beforeTimes.map((t) => t.time).join(', ')})`);
    }
    if (notifySettings.onLive) triggerLabels.push('On live');
    if (notifySettings.onAttendance) triggerLabels.push('On attendance');

    const playbackLabel = (() => {
        const blocked = [
            features.allowRewind ? null : 'rewind',
            features.allowPause ? null : 'pause',
        ].filter(Boolean);
        return blocked.length === 0 ? 'Unrestricted' : `Blocked: ${blocked.join(', ')}`;
    })();

    const showValidBadge = typeof validCount === 'number' && validCount < totalSessions;
    const missingCount =
        typeof validCount === 'number' ? Math.max(0, totalSessions - validCount) : 0;

    // RichTextEditor produces HTML even for empty content (e.g. "<p></p>"), so
    // strip tags before deciding whether a description is "really" present.
    const hasContent = (html?: string) => !!(html ?? '').replace(/<[^>]*>/g, '').trim();
    const showTopLevelDescription = hasContent(topLevelDescription);
    const perRowDescriptions = sessions
        .map((row, idx) => ({ idx, row, html: row.description ?? '' }))
        .filter(({ html }) => hasContent(html));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-[1200px] flex-col gap-0 p-0 sm:w-[95vw]">
                {/* Header */}
                <div className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                                <Lightning size={20} />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-semibold text-neutral-800">
                                    {title}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-neutral-500">
                                    {description}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant="secondary"
                                className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
                            >
                                {totalSessions} session{totalSessions === 1 ? '' : 's'}
                            </Badge>
                            {showValidBadge && (
                                <Badge
                                    variant="outline"
                                    className="rounded-full px-3 py-1 text-xs font-normal text-neutral-500"
                                >
                                    {validCount} fully filled
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="grid gap-3 lg:grid-cols-3">
                        {/* Schedule */}
                        <div className="rounded-lg border border-neutral-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                <Globe size={14} />
                                Schedule
                            </div>
                            <dl className="mt-3 space-y-2 text-sm">
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-neutral-500">Timezone</dt>
                                    <dd className="font-medium text-neutral-800">
                                        {timeZone || '—'}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-neutral-500">Access</dt>
                                    <dd className="font-medium capitalize text-neutral-800">
                                        {accessType || '—'}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Session features */}
                        <div className="rounded-lg border border-neutral-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                <UsersThreeIcon size={14} />
                                Session features
                            </div>
                            <dl className="mt-3 space-y-2 text-sm">
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-neutral-500">Waiting room</dt>
                                    <dd className="font-medium text-neutral-800">
                                        {features.enableWaitingRoom
                                            ? `Opens ${features.waitingRoomMinutes ?? '—'}m before`
                                            : 'Disabled'}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-neutral-500">Playback</dt>
                                    <dd className="font-medium text-neutral-800">
                                        {playbackLabel}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-neutral-500">Feedback</dt>
                                    <dd className="font-medium text-neutral-800">
                                        {features.enableFeedback ? 'Default form' : 'Off'}
                                    </dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                    <dt className="text-neutral-500">Recording</dt>
                                    <dd className="font-medium text-neutral-800">
                                        {features.recordSession ? 'On' : 'Off'}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Notifications */}
                        <div className="rounded-lg border border-neutral-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                <BellRinging size={14} />
                                Notifications
                            </div>
                            <div className="mt-3 space-y-3 text-sm">
                                <div>
                                    <div className="text-xs text-neutral-500">Channels</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {channelLabels.length === 0 ? (
                                            <span className="text-xs text-neutral-400">None</span>
                                        ) : (
                                            channelLabels.map((c) => (
                                                <Badge
                                                    key={c}
                                                    variant="secondary"
                                                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-normal text-neutral-700"
                                                >
                                                    {c}
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-neutral-500">Triggers</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {triggerLabels.length === 0 ? (
                                            <span className="text-xs text-neutral-400">None</span>
                                        ) : (
                                            triggerLabels.map((t) => (
                                                <Badge
                                                    key={t}
                                                    variant="secondary"
                                                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-normal text-neutral-700"
                                                >
                                                    {t}
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {showTopLevelDescription && (
                        <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                <Article size={14} />
                                Description
                            </div>
                            <div
                                className="prose prose-sm max-w-none text-sm text-neutral-700"
                                dangerouslySetInnerHTML={{ __html: topLevelDescription ?? '' }}
                            />
                        </div>
                    )}

                    {recurrenceBanner && (
                        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-neutral-800">
                                    {recurrenceBanner.pattern}
                                </div>
                                {recurrenceBanner.totalLabel && (
                                    <span className="text-xs font-medium text-neutral-600">
                                        {recurrenceBanner.totalLabel}
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                                {recurrenceBanner.days && recurrenceBanner.days.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-neutral-500">Days:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {recurrenceBanner.days.map((d) => (
                                                <span
                                                    key={d}
                                                    className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-300"
                                                >
                                                    {d}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {recurrenceBanner.until && (
                                    <span className="text-neutral-600">
                                        <span className="font-medium text-neutral-500">Ends:</span>{' '}
                                        {recurrenceBanner.until}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sessions table */}
                    <div className="mt-5 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-neutral-800">
                            {recurrenceBanner
                                ? 'Weekly schedule'
                                : totalSessions === 1
                                  ? 'Session to be created'
                                  : 'Sessions to be created'}
                        </h3>
                        <span className="text-xs text-neutral-500">
                            {totalSessions} {recurrenceBanner ? 'slot' : 'row'}
                            {totalSessions === 1 ? '' : 's'}
                        </span>
                    </div>
                    <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200">
                        <div className="max-h-[360px] overflow-auto">
                            <Table className="min-w-[900px]">
                                <TableHeader className="sticky top-0 z-10 bg-neutral-50">
                                    <TableRow className="border-neutral-200">
                                        <TableHead className="w-10 text-[11px] uppercase tracking-wide text-neutral-500">
                                            #
                                        </TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wide text-neutral-500">
                                            Title
                                        </TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wide text-neutral-500">
                                            Subject
                                        </TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wide text-neutral-500">
                                            When
                                        </TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wide text-neutral-500">
                                            Duration
                                        </TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wide text-neutral-500">
                                            Platform
                                        </TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wide text-neutral-500">
                                            Link
                                        </TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wide text-neutral-500">
                                            Batches
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sessions.map((row, idx) => {
                                        const platformLabel =
                                            STREAMING_OPTIONS.find((p) => p.value === row.platform)
                                                ?.label ??
                                            row.platform ??
                                            '—';
                                        const totalMins =
                                            Number(row.durationHours || '0') * 60 +
                                            Number(row.durationMinutes || '0');
                                        const durationLabel =
                                            totalMins >= 60
                                                ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
                                                : `${totalMins}m`;
                                        const rowLevels = row.selectedLevels ?? [];
                                        const batchLabels = rowLevels.map((sl) => {
                                            const course = courses.find(
                                                (c) =>
                                                    c.courseId === sl.courseId &&
                                                    c.sessionId === sl.sessionId
                                            );
                                            const sessionEntry = sessionList.find(
                                                (s) => s.id === sl.sessionId
                                            );
                                            const levelName = course?.levels
                                                .find((l) => l.id === sl.levelId)
                                                ?.name?.trim();
                                            const courseName =
                                                course?.courseName?.trim() || 'Course';
                                            const sessionName = sessionEntry?.name?.trim();
                                            const levelIsGeneric =
                                                !levelName || levelName.toLowerCase() === 'default';
                                            const pill = levelIsGeneric
                                                ? courseName
                                                : `${courseName} · ${levelName}`;
                                            const tooltip = [courseName, sessionName, levelName]
                                                .filter(Boolean)
                                                .join(' / ');
                                            return { pill, tooltip };
                                        });
                                        const formattedDate = (() => {
                                            if (!row.startDate) return '—';
                                            try {
                                                const d = new Date(
                                                    `${row.startDate}T${row.startTime || '00:00'}`
                                                );
                                                return d.toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                });
                                            } catch {
                                                return row.startDate;
                                            }
                                        })();
                                        return (
                                            <TableRow
                                                key={idx}
                                                className="text-xs hover:bg-neutral-50"
                                            >
                                                <TableCell className="text-center text-neutral-500">
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell className="font-medium text-neutral-800">
                                                    {row.title || (
                                                        <span className="text-danger-500">
                                                            (empty)
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-neutral-600">
                                                    {row.subject || '—'}
                                                </TableCell>
                                                <TableCell className="text-neutral-600">
                                                    <div className="flex flex-col">
                                                        <span className="text-neutral-800">
                                                            {row.whenLabel ?? formattedDate}
                                                        </span>
                                                        <span className="text-[11px] text-neutral-500">
                                                            {row.whenLabel
                                                                ? row.whenSubLabel ?? ''
                                                                : row.startTime || '—'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-neutral-600">
                                                    {durationLabel}
                                                </TableCell>
                                                <TableCell className="text-neutral-600">
                                                    {platformLabel}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-neutral-600">
                                                    {row.link ? (
                                                        <span title={row.link}>{row.link}</span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-[260px]">
                                                    {batchLabels.length === 0 ? (
                                                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                                                            No batches
                                                        </span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {batchLabels.map((b, i) => (
                                                                <span
                                                                    key={`${rowLevels[i]!.courseId}-${rowLevels[i]!.sessionId}-${rowLevels[i]!.levelId}`}
                                                                    title={b.tooltip}
                                                                    className="inline-flex max-w-[180px] items-center truncate rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
                                                                >
                                                                    {b.pill}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {perRowDescriptions.length > 0 && (
                        <div className="mt-5">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                <Article size={14} />
                                {perRowDescriptions.length === 1
                                    ? 'Description'
                                    : 'Per-class descriptions'}
                            </div>
                            <div className="flex flex-col gap-2">
                                {perRowDescriptions.map(({ idx, row, html }) => (
                                    <div
                                        key={idx}
                                        className="rounded-lg border border-neutral-200 bg-white p-3"
                                    >
                                        {perRowDescriptions.length > 1 && (
                                            <div className="mb-1 text-[11px] font-medium text-neutral-500">
                                                #{idx + 1}
                                                {row.title?.trim() ? ` · ${row.title.trim()}` : ''}
                                            </div>
                                        )}
                                        <div
                                            className="prose prose-sm max-w-none text-sm text-neutral-700"
                                            dangerouslySetInnerHTML={{ __html: html }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {showValidBadge && missingCount > 0 && (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <Warning size={14} className="mt-0.5 shrink-0" />
                            <span>
                                {missingCount} row{missingCount === 1 ? '' : 's'} still missing
                                required fields. Sessions will still be created for fully-filled
                                rows; failed rows will appear in the result dialog.
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/60 px-6 py-3">
                    <span className="text-xs text-neutral-500">
                        {footerNote ??
                            (recurrenceBanner
                                ? `By confirming, the system creates this recurring class with ${totalSessions} weekly slot${totalSessions === 1 ? '' : 's'} and applies access & notification settings.`
                                : totalSessions === 1
                                  ? 'By confirming, the system creates this live class and applies access & notification settings.'
                                  : `By confirming, the system creates ${totalSessions} sessions and applies access & notification settings to each.`)}
                    </span>
                    <div className="flex gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            onClick={() => onOpenChange(false)}
                            disable={submitting}
                        >
                            {backLabel}
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="primary"
                            disable={submitting}
                            onClick={() => {
                                void onConfirm();
                            }}
                        >
                            {submitting ? submittingLabel : confirmLabel}
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
