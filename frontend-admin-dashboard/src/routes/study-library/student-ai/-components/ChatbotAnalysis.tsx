import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
    ChatCircleDots,
    ChatsCircle,
    Lightning,
    Question,
    Student,
    Target,
    Users,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyPagination } from '@/components/design-system/pagination';
import { MyTable } from '@/components/design-system/table';
import { StatusChip } from '@/components/design-system/status-chips';
import { cn } from '@/lib/utils';
import { ChatTranscriptDialog } from './ChatTranscriptDialog';
import {
    CONTEXT_TYPE_LABELS,
    DAY_RANGE_OPTIONS,
    SESSION_MODE_LABELS,
    formatDateTime,
    prettifyLabel,
    useChatbotSessionsQuery,
    useChatbotSummaryQuery,
    type ChatbotSessionRow,
    type CountByValue,
    type DailyActivityRow,
} from '../-services/chatbot-analytics';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

/**
 * MyDropdown highlights the selected row by matching `currentValue` against the
 * list entries, so the lists are plain label arrays and the label is translated
 * back to the API value here.
 */
const DAY_RANGE_LABELS = DAY_RANGE_OPTIONS.map((o) => o.label);
const DAYS_BY_LABEL = new Map(DAY_RANGE_OPTIONS.map((o) => [o.label, o.value]));

const STATUS_BY_LABEL = new Map<string, string | undefined>([
    ['All chats', undefined],
    ['Active', 'ACTIVE'],
    ['Closed', 'CLOSED'],
]);

const MODE_BY_LABEL = new Map<string, string | undefined>([
    ['All modes', undefined],
    ['Text chat', 'text'],
    ['Mock interview', 'voice_interview'],
    ['Voice doubt', 'voice_doubt'],
    ['Oral test', 'voice_oral_test'],
]);

// ── summary pieces ─────────────────────────────────────────────────────────

function StatTile({
    icon: Icon,
    label,
    value,
    hint,
}: {
    icon: typeof ChatCircleDots;
    label: string;
    value: string | number;
    hint?: string;
}) {
    return (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-card p-4">
            <span className="flex items-center gap-1.5 text-caption text-neutral-500">
                <Icon className="size-4 text-primary-500" />
                {label}
            </span>
            <span className="text-h2-semibold text-neutral-700">{value}</span>
            {hint && <span className="text-caption text-neutral-400">{hint}</span>}
        </div>
    );
}

/**
 * Single-series proportion bars: one hue, share-of-total width, value read from
 * the direct label rather than the axis. No legend — the row label is the name.
 */
function ProportionBars({ rows, emptyText }: { rows: CountByValue[]; emptyText: string }) {
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    if (!rows.length || total === 0) {
        return <p className="text-caption text-neutral-400">{emptyText}</p>;
    }
    return (
        <div className="flex flex-col gap-3">
            {rows.map((row) => {
                const pct = Math.round((row.count / total) * 100);
                return (
                    <div key={row.value} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-body text-neutral-600">
                                {SESSION_MODE_LABELS[row.value] ??
                                    CONTEXT_TYPE_LABELS[row.value] ??
                                    prettifyLabel(row.value)}
                            </span>
                            <span className="shrink-0 text-caption text-neutral-500">
                                {row.count} · {pct}%
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-sm bg-neutral-100">
                            <div
                                className="h-full rounded-sm bg-primary-500"
                                // Width is the datum — the only value that must be dynamic.
                                style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Compact daily bar strip: one series (student messages), hover for the day's numbers. */
function ActivityStrip({ rows }: { rows: DailyActivityRow[] }) {
    const peak = useMemo(
        () => rows.reduce((max, r) => Math.max(max, r.studentMessages), 0),
        [rows]
    );

    if (!rows.length || peak === 0) {
        return (
            <p className="text-caption text-neutral-400">No chat activity in this period yet.</p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex h-24 items-end gap-0.5 overflow-x-auto">
                {rows.map((row) => {
                    const heightPct = Math.round((row.studentMessages / peak) * 100);
                    return (
                        <div
                            key={row.date}
                            title={`${row.date}: ${row.studentMessages} student messages, ${row.sessions} chats`}
                            className="flex h-full min-w-1 max-w-6 flex-1 items-end"
                        >
                            <div
                                className={cn(
                                    'w-full rounded-t-sm',
                                    row.studentMessages > 0 ? 'bg-primary-500' : 'bg-neutral-100'
                                )}
                                // Height is the datum.
                                style={{ height: `${Math.max(heightPct, 2)}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between text-caption text-neutral-400">
                <span>{rows[0]?.date}</span>
                <span>Peak {peak} messages/day</span>
                <span>{rows[rows.length - 1]?.date}</span>
            </div>
        </div>
    );
}

// ── screen ─────────────────────────────────────────────────────────────────

export const ChatbotAnalysis = () => {
    const [dayLabel, setDayLabel] = useState('Last 30 days');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusLabel, setStatusLabel] = useState('All chats');
    const [modeLabel, setModeLabel] = useState('All modes');
    const [page, setPage] = useState(0);
    const [openSession, setOpenSession] = useState<ChatbotSessionRow | null>(null);

    // Debounce the search so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    const windowDays = Number(DAYS_BY_LABEL.get(dayLabel) ?? '30');
    const statusFilter = STATUS_BY_LABEL.get(statusLabel);
    const modeFilter = MODE_BY_LABEL.get(modeLabel);
    const hasFilters = !!debouncedSearch || !!statusFilter || !!modeFilter;

    const summaryQuery = useChatbotSummaryQuery(windowDays);
    const sessionsQuery = useChatbotSessionsQuery(page, PAGE_SIZE, {
        days: windowDays,
        search: debouncedSearch,
        status: statusFilter,
        sessionMode: modeFilter,
    });

    const summary = summaryQuery.data;

    const columns = useMemo<ColumnDef<ChatbotSessionRow>[]>(
        () => [
            {
                id: 'student',
                header: 'Student',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="truncate text-body text-neutral-700">
                            {row.original.studentName}
                        </span>
                        {row.original.studentEmail && (
                            <span className="truncate text-caption text-neutral-400">
                                {row.original.studentEmail}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'chat',
                header: 'Chat about',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="truncate text-body text-neutral-600">
                            {row.original.contextTitle ||
                                CONTEXT_TYPE_LABELS[row.original.contextType ?? ''] ||
                                prettifyLabel(row.original.contextType)}
                        </span>
                        <span className="line-clamp-1 text-caption text-neutral-400">
                            {row.original.lastStudentMessage || 'No student message'}
                        </span>
                    </div>
                ),
            },
            {
                id: 'mode',
                header: 'Mode',
                cell: ({ row }) => (
                    <span className="text-body text-neutral-600">
                        {SESSION_MODE_LABELS[row.original.sessionMode ?? 'text'] ??
                            prettifyLabel(row.original.sessionMode)}
                    </span>
                ),
            },
            {
                id: 'messages',
                header: 'Messages',
                cell: ({ row }) => (
                    <div className="text-right">
                        <span className="text-body text-neutral-700">
                            {row.original.messageCount}
                        </span>
                        <span className="block text-caption text-neutral-400">
                            {row.original.studentMessageCount} from student
                        </span>
                    </div>
                ),
            },
            {
                id: 'quizzes',
                header: 'Quizzes',
                cell: ({ row }) => (
                    <span className="block text-right text-body text-neutral-600">
                        {row.original.quizCount}
                    </span>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                cell: ({ row }) => (
                    <StatusChip
                        text={prettifyLabel(row.original.status)}
                        textSize="text-caption"
                        status={row.original.status === 'ACTIVE' ? 'SUCCESS' : 'INFO'}
                        showIcon={false}
                    />
                ),
            },
            {
                id: 'lastActive',
                header: 'Last active',
                cell: ({ row }) => (
                    <span className="text-caption text-neutral-500">
                        {formatDateTime(row.original.lastActive)}
                    </span>
                ),
            },
            {
                id: 'details',
                header: '',
                cell: ({ row }) => (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() => setOpenSession(row.original)}
                    >
                        View chat
                    </MyButton>
                ),
            },
        ],
        []
    );

    return (
        <div className="flex flex-col gap-6">
            {/* Window selector */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body text-neutral-500">
                    How students are using the AI tutor, and what they are asking about.
                </p>
                <MyDropdown
                    currentValue={dayLabel}
                    dropdownList={DAY_RANGE_LABELS}
                    handleChange={(value) => {
                        setDayLabel(value);
                        setPage(0);
                    }}
                />
            </div>

            {/* Summary data points */}
            {summaryQuery.isLoading && (
                <p className="animate-pulse text-body text-neutral-400">Loading summary…</p>
            )}
            {summaryQuery.error && (
                <div className="flex items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
                    <p className="text-body text-danger-600">Could not load the chatbot summary.</p>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => summaryQuery.refetch()}
                    >
                        Retry
                    </MyButton>
                </div>
            )}
            {summary && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatTile
                            icon={ChatsCircle}
                            label="Chats"
                            value={summary.sessions}
                            hint={`${summary.sessionsAllTime} all time`}
                        />
                        <StatTile
                            icon={Users}
                            label="Students reached"
                            value={summary.uniqueStudents}
                            hint={`${summary.uniqueStudentsAllTime} all time`}
                        />
                        <StatTile
                            icon={ChatCircleDots}
                            label="Student messages"
                            value={summary.studentMessages}
                            hint={`${summary.avgMessagesPerSession} messages per chat`}
                        />
                        <StatTile
                            icon={Question}
                            label="Doubts asked"
                            value={summary.doubtsAsked}
                        />
                        <StatTile
                            icon={Target}
                            label="Practice quizzes taken"
                            value={summary.quizzesTaken}
                            hint={
                                summary.avgQuizScorePct !== null
                                    ? `${summary.avgQuizScorePct}% average score`
                                    : 'No quiz submitted yet'
                            }
                        />
                        <StatTile
                            icon={Lightning}
                            label="AI replies"
                            value={summary.aiMessages}
                            hint={`${summary.toolCalls} tool look-ups`}
                        />
                        <StatTile
                            icon={ChatsCircle}
                            label="Active chats"
                            value={summary.activeSessions}
                            hint="Not yet closed by the student"
                        />
                        <StatTile
                            icon={Student}
                            label="Quizzes generated"
                            value={summary.quizzesGenerated}
                            hint={`${summary.quizzesSubmitted} submitted`}
                        />
                    </div>

                    {/* General analysis */}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <Card className="border-neutral-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-title">Chat modes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ProportionBars
                                    rows={summary.modeBreakdown}
                                    emptyText="No chats in this period yet."
                                />
                            </CardContent>
                        </Card>
                        <Card className="border-neutral-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-title">Where students chat</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ProportionBars
                                    rows={summary.contextBreakdown}
                                    emptyText="No chats in this period yet."
                                />
                            </CardContent>
                        </Card>
                        <Card className="border-neutral-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-title">Most asked topics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {summary.topTopics.length === 0 ? (
                                    <p className="text-caption text-neutral-400">
                                        No topics recorded yet. Topics appear once students ask
                                        doubts or take practice quizzes.
                                    </p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {summary.topTopics.slice(0, 8).map((topic) => (
                                            <li
                                                key={`${topic.topic}-${topic.eventType}`}
                                                className="flex items-baseline justify-between gap-2"
                                            >
                                                <span className="truncate text-body text-neutral-600">
                                                    {topic.topic}
                                                </span>
                                                <span className="shrink-0 text-caption text-neutral-400">
                                                    {topic.eventType === 'quiz_score'
                                                        ? 'quiz'
                                                        : 'doubt'}{' '}
                                                    · {topic.count}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-neutral-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-title">Daily activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ActivityStrip rows={summary.dailyActivity} />
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Recent chats */}
            <Card className="border-neutral-200">
                <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-title">Recent chats</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="w-56">
                            <MyInput
                                inputType="text"
                                input={search}
                                onChangeFunction={(e) => setSearch(e.target.value)}
                                inputPlaceholder="Search student name or email"
                                size="small"
                            />
                        </div>
                        <MyDropdown
                            currentValue={statusLabel}
                            dropdownList={[...STATUS_BY_LABEL.keys()]}
                            handleChange={(value) => {
                                setStatusLabel(value);
                                setPage(0);
                            }}
                        />
                        <MyDropdown
                            currentValue={modeLabel}
                            dropdownList={[...MODE_BY_LABEL.keys()]}
                            handleChange={(value) => {
                                setModeLabel(value);
                                setPage(0);
                            }}
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {sessionsQuery.error ? (
                        <div className="flex items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
                            <p className="text-body text-danger-600">
                                Could not load recent chats.
                            </p>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => sessionsQuery.refetch()}
                            >
                                Retry
                            </MyButton>
                        </div>
                    ) : sessionsQuery.data && sessionsQuery.data.content.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center">
                            <ChatsCircle className="size-8 text-neutral-300" />
                            <p className="text-body text-neutral-500">No chats found</p>
                            <p className="text-caption text-neutral-400">
                                {hasFilters
                                    ? 'Try clearing the search or filters.'
                                    : 'Chats appear here once students start using the AI tutor.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <MyTable<ChatbotSessionRow>
                                data={sessionsQuery.data}
                                columns={columns}
                                isLoading={sessionsQuery.isLoading}
                                error={sessionsQuery.error}
                                currentPage={page}
                                onCellClick={(row) => setOpenSession(row)}
                                enableColumnPinning={false}
                                scrollable
                            />
                            {(sessionsQuery.data?.total_pages ?? 0) > 1 && (
                                <MyPagination
                                    currentPage={page}
                                    totalPages={sessionsQuery.data?.total_pages ?? 1}
                                    onPageChange={setPage}
                                />
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <ChatTranscriptDialog session={openSession} onClose={() => setOpenSession(null)} />
        </div>
    );
};

export default ChatbotAnalysis;
