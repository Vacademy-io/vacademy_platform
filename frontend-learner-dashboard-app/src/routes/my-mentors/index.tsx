import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass, Star, UserPlus, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";
import { reportApiError } from "@/lib/report-api-error";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/design-system/states";
import { getInstituteId } from "@/constants/helper";
import {
    cancelMentorRequest,
    handleGetMentorDirectory,
    handleGetMyMentorRequests,
    handleGetMyMentors,
    handleGetPendingFeedback,
    type DirectoryMentor,
    type MyMentor,
    type MyMentorRequest,
    type PendingFeedback,
} from "./-services/my-mentors-service";
import { filterDirectory, isWithdrawable, requestStatusLabel } from "./-utils/directory";
import { nextSessionToRate } from "./-utils/feedback";
import { RateSessionDialog } from "./-components/RateSessionDialog";
import { MentorCard } from "./-components/MentorCard";
import { DirectoryMentorCard } from "./-components/DirectoryMentorCard";
import { RequestMentorDialog } from "./-components/RequestMentorDialog";
import { MentorAvatar } from "./-components/MentorAvatar";

export const Route = createFileRoute("/my-mentors/")({
    component: MyMentorsRoute,
});

function MyMentorsRoute() {
    return (
        <LayoutContainer>
            <MyMentorsPage />
        </LayoutContainer>
    );
}

type TabKey = "mine" | "find" | "requests";

function MyMentorsPage() {
    const [instituteId, setInstituteId] = useState<string | undefined>();
    const [tab, setTab] = useState<TabKey>("mine");
    const [search, setSearch] = useState("");
    const [requestTarget, setRequestTarget] = useState<DirectoryMentor | null>(null);
    const [requestOpen, setRequestOpen] = useState(false);
    const [rateSession, setRateSession] = useState<PendingFeedback | null>(null);

    useEffect(() => {
        getInstituteId().then((id) => setInstituteId(id ?? undefined));
    }, []);

    const mentorsQuery = useQuery(handleGetMyMentors(instituteId));
    const directoryQuery = useQuery(handleGetMentorDirectory(instituteId));
    const requestsQuery = useQuery(handleGetMyMentorRequests(instituteId));
    const feedbackQuery = useQuery(handleGetPendingFeedback(instituteId));

    const mentors = useMemo(() => mentorsQuery.data ?? [], [mentorsQuery.data]);
    const directory = useMemo(() => directoryQuery.data ?? [], [directoryQuery.data]);
    const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
    const pendingCount = requests.filter((r) => r.status === "PENDING").length;
    // The directory only exists once an admin lists at least one mentor, so the
    // whole Find-a-mentor surface stays hidden for institutes that don't use it.
    const directoryAvailable = directory.length > 0;
    // Only ever prompt for one session at a time — the most recent unrated one.
    const sessionToRate = nextSessionToRate(feedbackQuery.data ?? []);

    // A learner with no mentor yet lands on Find a mentor — the empty "My mentors"
    // list is a dead end otherwise.
    useEffect(() => {
        if (!mentorsQuery.isSuccess || !directoryQuery.isSuccess) return;
        if (mentors.length === 0 && directoryAvailable) setTab("find");
    }, [mentorsQuery.isSuccess, directoryQuery.isSuccess, mentors.length, directoryAvailable]);

    const query = search.trim();
    const filteredDirectory = filterDirectory(directory, query);

    const openRequest = (mentor: DirectoryMentor | null) => {
        setRequestTarget(mentor);
        setRequestOpen(true);
    };

    const tabs: { key: TabKey; label: string; badge?: number }[] = [
        { key: "mine", label: "My mentors", badge: mentors.length || undefined },
        ...(directoryAvailable ? [{ key: "find" as const, label: "Find a mentor" }] : []),
        ...(directoryAvailable || requests.length
            ? [{ key: "requests" as const, label: "My requests", badge: pendingCount || undefined }]
            : []),
    ];

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col">
                    <h1 className="text-h3 font-semibold text-neutral-700">My Mentors</h1>
                    <p className="text-body text-neutral-500">
                        Book sessions and message your assigned mentors.
                    </p>
                </div>
                {directoryAvailable && tab !== "find" && (
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => setTab("find")}
                    >
                        <UserPlus size={16} /> Find a mentor
                    </MyButton>
                )}
            </div>

            {tabs.length > 1 && (
                <div className="flex flex-wrap gap-1 border-b border-neutral-200">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`-mb-px border-b-2 px-3 py-2 text-body transition-colors ${
                                tab === t.key
                                    ? "border-primary-500 font-medium text-primary-600"
                                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                            }`}
                        >
                            {t.label}
                            {t.badge ? (
                                <span className="ms-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-500">
                                    {t.badge}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            )}

            {sessionToRate && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-100">
                            <Star size={18} weight="fill" className="text-warning-600" />
                        </span>
                        <div className="flex flex-col">
                            <span className="text-body font-medium text-neutral-700">
                                How was your session with{" "}
                                {sessionToRate.mentor_name || "your mentor"}?
                            </span>
                            <span className="text-caption text-neutral-500">
                                A quick rating helps your institute keep mentoring useful.
                            </span>
                        </div>
                    </div>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onClick={() => setRateSession(sessionToRate)}
                    >
                        Rate session
                    </MyButton>
                </div>
            )}

            {tab === "mine" && (
                <MyMentorsTab
                    instituteId={instituteId}
                    mentors={mentors}
                    isLoading={mentorsQuery.isLoading}
                    isError={mentorsQuery.isError}
                    onRetry={() => mentorsQuery.refetch()}
                    canFind={directoryAvailable}
                    onFind={() => setTab("find")}
                />
            )}

            {tab === "find" && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative w-full sm:w-80">
                            <MagnifyingGlass
                                size={16}
                                className="pointer-events-none absolute start-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400"
                            />
                            <MyInput
                                input={search}
                                onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setSearch(e.target.value)
                                }
                                inputType="text"
                                inputPlaceholder="Search by name or topic"
                                className="w-full ps-9"
                            />
                        </div>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => openRequest(null)}
                            title="Let your admin pick a mentor for you"
                        >
                            Not sure? Ask for any mentor
                        </MyButton>
                    </div>

                    {directoryQuery.isLoading ? (
                        <LoadingState variant="list" count={3} />
                    ) : directoryQuery.isError ? (
                        <ErrorState
                            message="Couldn't load mentors."
                            onRetry={() => directoryQuery.refetch()}
                        />
                    ) : filteredDirectory.length === 0 ? (
                        <EmptyState
                            icon={MagnifyingGlass}
                            title={query ? "No mentors match your search" : "No mentors listed yet"}
                            description={
                                query
                                    ? "Try a different topic, or ask your admin to match you with any mentor."
                                    : "Your institute hasn't listed any mentors for browsing yet."
                            }
                            action={
                                query
                                    ? { label: "Clear search", onClick: () => setSearch("") }
                                    : undefined
                            }
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredDirectory.map((m) => (
                                <DirectoryMentorCard
                                    key={m.id}
                                    mentor={m}
                                    onRequest={() => openRequest(m)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === "requests" && (
                <MyRequestsTab
                    instituteId={instituteId}
                    requests={requests}
                    isLoading={requestsQuery.isLoading}
                    isError={requestsQuery.isError}
                    onRetry={() => requestsQuery.refetch()}
                    onBrowse={() => setTab("find")}
                />
            )}

            <RateSessionDialog
                session={rateSession}
                instituteId={instituteId}
                open={!!rateSession}
                onOpenChange={(open) => {
                    if (!open) setRateSession(null);
                }}
            />

            <RequestMentorDialog
                mentor={requestTarget}
                instituteId={instituteId}
                open={requestOpen}
                onOpenChange={(open) => {
                    setRequestOpen(open);
                    if (!open) setRequestTarget(null);
                }}
            />
        </div>
    );
}

function MyMentorsTab({
    instituteId,
    mentors,
    isLoading,
    isError,
    onRetry,
    canFind,
    onFind,
}: {
    instituteId: string | undefined;
    mentors: MyMentor[];
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    canFind: boolean;
    onFind: () => void;
}) {
    if (isLoading || !instituteId) return <LoadingState variant="list" count={3} />;
    if (isError) {
        return <ErrorState message="Couldn't load your mentors." onRetry={onRetry} />;
    }
    if (mentors.length === 0) {
        return (
            <EmptyState
                icon={UsersThree}
                title="No mentors yet"
                description={
                    canFind
                        ? "Browse the mentors your institute offers and request the one that fits."
                        : "Once a mentor is assigned to you, they'll appear here."
                }
                action={canFind ? { label: "Find a mentor", onClick: onFind } : undefined}
            />
        );
    }
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map((m) => (
                <MentorCard key={m.id} mentor={m} instituteId={instituteId} />
            ))}
        </div>
    );
}

function fmtDate(v?: number | null): string {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function MyRequestsTab({
    instituteId,
    requests,
    isLoading,
    isError,
    onRetry,
    onBrowse,
}: {
    instituteId: string | undefined;
    requests: MyMentorRequest[];
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    onBrowse: () => void;
}) {
    const queryClient = useQueryClient();
    const cancel = useMutation({
        mutationFn: (requestId: string) =>
            cancelMentorRequest({ instituteId: instituteId ?? "", requestId }),
        onSuccess: () => {
            toast.success("Request withdrawn");
            queryClient.invalidateQueries({ queryKey: ["GET_MY_MENTOR_REQUESTS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_MENTOR_DIRECTORY"] });
        },
        onError: (error: unknown) =>
            reportApiError(error, {
                feature: "mentorship",
                tags: { "mentorship.action": "withdraw-request" },
                fallbackMessage: "Couldn't withdraw the request.",
            }),
    });

    if (isLoading) return <LoadingState variant="list" count={2} />;
    if (isError) return <ErrorState message="Couldn't load your requests." onRetry={onRetry} />;
    if (requests.length === 0) {
        return (
            <EmptyState
                icon={UserPlus}
                title="No requests yet"
                description="Ask for a mentor and you'll be able to track the request here."
                action={{ label: "Find a mentor", onClick: onBrowse }}
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {requests.map((r) => (
                <div
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4"
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <MentorAvatar
                            fileId={r.mentor_profile_image_file_id}
                            name={r.mentor_name}
                            className="size-10 text-body"
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-body font-medium text-neutral-700">
                                {r.mentor_name || "Any available mentor"}
                            </span>
                            {r.message && (
                                <span className="text-caption text-neutral-500">{r.message}</span>
                            )}
                            <span className="text-caption text-neutral-400">
                                Requested {fmtDate(r.created_at)}
                            </span>
                            {r.status === "DECLINED" && r.decision_note && (
                                <span className="mt-1 rounded-md bg-neutral-50 p-2 text-caption text-neutral-600">
                                    {r.decision_note}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <RequestStatusBadge status={r.status} />
                        {isWithdrawable(r) && (
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                onClick={() => cancel.mutate(r.id)}
                                disable={cancel.isPending}
                            >
                                Withdraw
                            </MyButton>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function RequestStatusBadge({ status }: { status: string }) {
    const tones: Record<string, string> = {
        PENDING: "bg-warning-50 text-warning-600",
        APPROVED: "bg-success-50 text-success-600",
        DECLINED: "bg-danger-50 text-danger-600",
        CANCELLED: "bg-neutral-100 text-neutral-500",
    };
    const tone = tones[status] ?? "bg-neutral-100 text-neutral-500";
    return (
        <span className={`rounded-full px-2.5 py-1 text-caption ${tone}`}>
            {requestStatusLabel(status)}
        </span>
    );
}
