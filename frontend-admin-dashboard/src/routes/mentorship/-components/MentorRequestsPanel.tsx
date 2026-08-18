import { useEffect, useState } from 'react';
import {
    Check,
    ChatCenteredDots,
    Clock,
    MagnifyingGlass,
    TrayArrowDown,
    UsersThree,
    WarningCircle,
    X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { MyPagination } from '@/components/design-system/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useDecideMentorRequest, useMentorRequests, useMentors } from '../-hooks/use-mentorship';
import type { MentorDTO, MentorRequestDTO } from '../-types/mentorship-types';
import { MentorAvatar } from './MentorAvatar';

const PAGE_SIZE = 20;

const TABS = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'DECLINED', label: 'Declined' },
    { key: 'CANCELLED', label: 'Withdrawn' },
] as const;

function fmtDate(v?: number | null): string {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function initials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (
        (parts[0]?.[0] ?? '').concat(parts.length > 1 ? (parts[1]?.[0] ?? '') : '').toUpperCase() ||
        '?'
    );
}

/**
 * The admin review queue for learner-raised mentor requests. Approving pairs the
 * learner with a mentor (creating the same assignment an admin-made pairing would);
 * declining sends the learner a note back.
 *
 * Split out of the route so it can be rendered — and tested — without a router.
 */
export function MentorRequestsPanel({ instituteId }: { instituteId: string | undefined }) {
    const [status, setStatus] = useState<string>('PENDING');
    const [page, setPage] = useState(0);
    const [decide, setDecide] = useState<{ request: MentorRequestDTO; approve: boolean } | null>(
        null
    );

    const { data, isLoading, isError, refetch } = useMentorRequests(
        instituteId,
        status,
        page,
        PAGE_SIZE
    );
    const requests = data?.content ?? [];

    const switchTab = (next: string) => {
        setStatus(next);
        setPage(0);
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col">
                <h2 className="text-title font-semibold text-neutral-700">Mentor requests</h2>
                <p className="text-body text-neutral-500">
                    Learners who asked for a mentor. Approving pairs them and notifies both sides.
                </p>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-neutral-200">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => switchTab(tab.key)}
                        className={`-mb-px border-b-2 px-3 py-2 text-body transition-colors ${
                            status === tab.key
                                ? 'border-primary-500 font-medium text-primary-600'
                                : 'border-transparent text-neutral-500 hover:text-neutral-700'
                        }`}
                    >
                        {tab.label}
                        {tab.key === status && (data?.total_elements ?? 0) > 0 && (
                            <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-500">
                                {data?.total_elements}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                        >
                            <div className="flex items-center gap-3">
                                <Skeleton className="size-10 rounded-full" />
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-3.5 w-40" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                            </div>
                            <Skeleton className="h-8 w-40" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                    <div className="flex items-center gap-2">
                        <WarningCircle size={18} weight="fill" className="text-danger-600" />
                        <p className="text-body text-danger-600">Couldn&apos;t load requests.</p>
                    </div>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => refetch()}
                    >
                        Retry
                    </MyButton>
                </div>
            ) : requests.length === 0 ? (
                <EmptyRequests status={status} />
            ) : (
                <div className="flex flex-col gap-3">
                    {requests.map((r) => (
                        <RequestRow
                            key={r.id}
                            request={r}
                            onApprove={() => setDecide({ request: r, approve: true })}
                            onDecline={() => setDecide({ request: r, approve: false })}
                        />
                    ))}
                    {(data?.total_pages ?? 0) > 1 && (
                        <MyPagination
                            currentPage={page}
                            totalPages={data?.total_pages ?? 1}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            )}

            <DecisionDialog
                instituteId={instituteId}
                decision={decide}
                onOpenChange={(open) => {
                    if (!open) setDecide(null);
                }}
            />
        </div>
    );
}

function RequestRow({
    request,
    onApprove,
    onDecline,
}: {
    request: MentorRequestDTO;
    onApprove: () => void;
    onDecline: () => void;
}) {
    const pending = request.status === 'PENDING';
    const anyMentor = !request.mentor_id;

    return (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-body font-semibold text-primary-600">
                    {initials(request.student_name)}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-body font-medium text-neutral-700">
                        {request.student_name || request.student_user_id}
                    </span>
                    {request.student_email && (
                        <span className="text-caption text-neutral-400">
                            {request.student_email}
                        </span>
                    )}

                    <span className="flex flex-wrap items-center gap-1.5 text-caption text-neutral-500">
                        {anyMentor ? (
                            <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                                <UsersThree size={13} /> Any available mentor
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                Requested
                                <MentorAvatar
                                    fileId={request.mentor_profile_image_file_id}
                                    name={request.mentor_name}
                                    className="size-5 text-caption"
                                />
                                <b className="font-medium text-neutral-700">
                                    {request.mentor_name || 'a mentor'}
                                </b>
                                {typeof request.mentor_available_slots === 'number' && (
                                    <span
                                        className={
                                            request.mentor_available_slots === 0
                                                ? 'text-danger-600'
                                                : 'text-neutral-400'
                                        }
                                    >
                                        ·{' '}
                                        {request.mentor_available_slots === 0
                                            ? 'full'
                                            : `${request.mentor_available_slots} places left`}
                                    </span>
                                )}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-neutral-400">
                            <Clock size={12} /> {fmtDate(request.created_at)}
                        </span>
                    </span>

                    {request.message && (
                        <p className="mt-1 flex items-start gap-1.5 rounded-md bg-neutral-50 p-2 text-caption text-neutral-600">
                            <ChatCenteredDots
                                size={14}
                                className="mt-0.5 shrink-0 text-neutral-400"
                            />
                            {request.message}
                        </p>
                    )}

                    {!pending && request.decision_note && (
                        <span className="text-caption text-neutral-400">
                            Note: {request.decision_note}
                        </span>
                    )}
                </div>
            </div>

            {pending ? (
                <div className="flex items-center gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={onDecline}
                        title="Decline with an optional reason the learner sees"
                    >
                        <X size={16} /> Decline
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="small"
                        onClick={onApprove}
                        title="Pair this learner with a mentor"
                    >
                        <Check size={16} /> Approve
                    </MyButton>
                </div>
            ) : (
                <StatusBadge status={request.status} decidedAt={request.decided_at} />
            )}
        </div>
    );
}

function StatusBadge({ status, decidedAt }: { status: string; decidedAt?: number | null }) {
    const tone =
        status === 'APPROVED'
            ? 'bg-success-50 text-success-600'
            : status === 'DECLINED'
              ? 'bg-danger-50 text-danger-600'
              : 'bg-neutral-100 text-neutral-500';
    const label =
        status === 'APPROVED' ? 'Approved' : status === 'DECLINED' ? 'Declined' : 'Withdrawn';
    return (
        <span className="flex flex-col items-end gap-1">
            <span className={`rounded-full px-2.5 py-1 text-caption ${tone}`}>{label}</span>
            {decidedAt && (
                <span className="text-caption text-neutral-400">{fmtDate(decidedAt)}</span>
            )}
        </span>
    );
}

function EmptyRequests({ status }: { status: string }) {
    const copy =
        status === 'PENDING'
            ? {
                  title: 'No requests waiting',
                  body: 'When a learner asks for a mentor from Find a mentor, it lands here for approval.',
              }
            : {
                  title: 'Nothing here yet',
                  body: 'Requests you decide on will show up under this tab.',
              };
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
            <TrayArrowDown size={40} className="text-neutral-300" />
            <div className="flex flex-col gap-1">
                <p className="text-body font-medium text-neutral-700">{copy.title}</p>
                <p className="max-w-md text-caption text-neutral-500">{copy.body}</p>
            </div>
        </div>
    );
}

/**
 * Confirms a decision. Approving an open-ended ("any mentor") request needs a
 * mentor picked here — the server refuses one without it — and full mentors are
 * shown as unpickable rather than failing after the click.
 */
function DecisionDialog({
    instituteId,
    decision,
    onOpenChange,
}: {
    instituteId: string | undefined;
    decision: { request: MentorRequestDTO; approve: boolean } | null;
    onOpenChange: (open: boolean) => void;
}) {
    const decide = useDecideMentorRequest();
    const mentorsQuery = useMentors(decision?.approve ? instituteId : undefined);
    const [note, setNote] = useState('');
    const [mentorId, setMentorId] = useState('');
    const [mentorSearch, setMentorSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const request = decision?.request;
    const approve = decision?.approve ?? false;
    // An open-ended request has no mentor on it, so the admin must choose one.
    const needsMentorPick = approve && !request?.mentor_id;

    useEffect(() => {
        setNote('');
        setMentorId('');
        setMentorSearch('');
    }, [decision]);

    const q = mentorSearch.trim().toLowerCase();
    const mentors = (mentorsQuery.data ?? []).filter(
        (m) =>
            !q ||
            [m.display_name, m.name, m.title, ...(m.expertise_tags ?? [])].some((f) =>
                (f ?? '').toLowerCase().includes(q)
            )
    );

    const submit = async () => {
        if (!request || !instituteId) return;
        if (needsMentorPick && !mentorId) {
            toast.error('Pick a mentor to approve this request');
            return;
        }
        setSubmitting(true);
        try {
            await decide.mutateAsync({
                id: request.id,
                instituteId,
                approve,
                decision: {
                    mentor_id: mentorId || undefined,
                    note: note.trim() || undefined,
                },
            });
            toast.success(approve ? 'Request approved — mentor assigned' : 'Request declined');
            onOpenChange(false);
        } catch (e) {
            // The server rejects capacity overflows and already-decided requests with a
            // readable reason; surfacing it beats a generic failure toast.
            const message =
                (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                (approve ? 'Failed to approve the request' : 'Failed to decline the request');
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!request) return null;

    return (
        <MyDialog
            heading={approve ? 'Approve mentor request' : 'Decline mentor request'}
            open={!!decision}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onClick={submit}
                        disable={submitting || (needsMentorPick && !mentorId)}
                    >
                        {submitting
                            ? approve
                                ? 'Approving…'
                                : 'Declining…'
                            : approve
                              ? 'Approve & assign'
                              : 'Decline request'}
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-body text-neutral-600">
                    {approve ? (
                        <>
                            <b>{request.student_name || 'This learner'}</b> will be paired with{' '}
                            {request.mentor_id ? (
                                <b>{request.mentor_name || 'the requested mentor'}</b>
                            ) : (
                                'the mentor you pick'
                            )}
                            , and both are notified.
                        </>
                    ) : (
                        <>
                            <b>{request.student_name || 'This learner'}</b> will be told their
                            request wasn&apos;t taken forward. They can request another mentor
                            afterwards.
                        </>
                    )}
                </p>

                {needsMentorPick && (
                    <div className="flex flex-col gap-2">
                        <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Choose a mentor
                        </span>
                        <div className="relative">
                            <MagnifyingGlass
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400"
                            />
                            <MyInput
                                input={mentorSearch}
                                onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setMentorSearch(e.target.value)
                                }
                                inputType="text"
                                inputPlaceholder="Search by name or expertise"
                                className="pl-9 sm:w-full"
                            />
                        </div>
                        <div className="max-h-56 overflow-y-auto rounded-md border border-neutral-200">
                            {mentorsQuery.isLoading ? (
                                <div className="p-4 text-body text-neutral-400">
                                    Loading mentors…
                                </div>
                            ) : mentors.length === 0 ? (
                                <div className="p-4 text-body text-neutral-400">
                                    No mentors match.
                                </div>
                            ) : (
                                mentors.map((m) => (
                                    <MentorOption
                                        key={m.id}
                                        mentor={m}
                                        selected={mentorId === m.id}
                                        onSelect={() => setMentorId(m.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}

                <MyInput
                    input={note}
                    onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNote(e.target.value)
                    }
                    inputType="text"
                    inputPlaceholder={
                        approve ? 'Optional note for your records' : 'e.g. Try Bhavya for Biology'
                    }
                    label={approve ? 'Internal note (optional)' : 'Reason shown to the learner'}
                    className="sm:w-full"
                />
            </div>
        </MyDialog>
    );
}

function MentorOption({
    mentor,
    selected,
    onSelect,
}: {
    mentor: MentorDTO;
    selected: boolean;
    onSelect: () => void;
}) {
    const full = !!mentor.at_capacity;
    return (
        <button
            type="button"
            disabled={full}
            onClick={onSelect}
            title={full ? 'This mentor is at capacity' : undefined}
            className={`flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 ${
                full
                    ? 'cursor-not-allowed opacity-50'
                    : selected
                      ? 'bg-primary-50'
                      : 'hover:bg-neutral-50'
            }`}
        >
            <span className="flex min-w-0 items-center gap-2">
                <MentorAvatar
                    fileId={mentor.profile_image_file_id}
                    name={mentor.display_name || mentor.name}
                    className="size-7 text-caption"
                />
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body text-neutral-700">
                        {mentor.display_name || mentor.name || 'Mentor'}
                    </span>
                    <span className="truncate text-caption text-neutral-400">
                        {(mentor.expertise_tags ?? []).slice(0, 3).join(' · ') ||
                            mentor.title ||
                            ''}
                    </span>
                </span>
            </span>
            <span className="shrink-0 text-caption text-neutral-500">
                {full
                    ? 'Full'
                    : mentor.max_mentees
                      ? `${mentor.assigned_student_count ?? 0}/${mentor.max_mentees}`
                      : `${mentor.assigned_student_count ?? 0} students`}
            </span>
        </button>
    );
}
