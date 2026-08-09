import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UsersThree } from "@phosphor-icons/react";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { EmptyState, ErrorState, LoadingState } from "@/components/design-system/states";
import { getInstituteId } from "@/constants/helper";
import { handleGetMyMentors, type MyMentor } from "./-services/my-mentors-service";
import { MentorCard } from "./-components/MentorCard";
import { MentorChatSheet } from "./-components/MentorChatSheet";

export const Route = createFileRoute("/my-mentors/")({
    // ?chat=<mentor user id> opens that mentor's chat drawer directly — the
    // sidebar's per-mentor entries deep-link here.
    validateSearch: (search: Record<string, unknown>): { chat?: string } => ({
        chat: typeof search.chat === "string" && search.chat ? search.chat : undefined,
    }),
    component: MyMentorsRoute,
});

function MyMentorsRoute() {
    return (
        <LayoutContainer>
            <MyMentorsPage />
        </LayoutContainer>
    );
}

function MyMentorsPage() {
    const [instituteId, setInstituteId] = useState<string | undefined>();
    // Mentor whose chat drawer is open — chat happens without leaving this page.
    const [chatMentor, setChatMentor] = useState<MyMentor | null>(null);
    const { chat } = Route.useSearch();
    const navigate = Route.useNavigate();

    useEffect(() => {
        getInstituteId().then((id) => setInstituteId(id ?? undefined));
    }, []);

    const { data, isLoading, isError, refetch } = useQuery(handleGetMyMentors(instituteId));
    const mentors = data ?? [];

    // Sidebar deep link: open the requested mentor's chat, then drop the param
    // so closing the drawer doesn't reopen it.
    useEffect(() => {
        if (!chat || mentors.length === 0) return;
        const target = mentors.find((m) => m.user_id === chat);
        if (target) setChatMentor(target);
        navigate({ search: {}, replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chat, mentors]);

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-col">
                <h1 className="text-h3 font-semibold text-neutral-700">My Mentors</h1>
                <p className="text-body text-neutral-500">
                    Book sessions and message your assigned mentors.
                </p>
            </div>

            {isLoading || !instituteId ? (
                <LoadingState variant="list" count={3} />
            ) : isError ? (
                <ErrorState message="Couldn't load your mentors." onRetry={() => refetch()} />
            ) : mentors.length === 0 ? (
                <EmptyState
                    icon={UsersThree}
                    title="No mentors yet"
                    description="Once a mentor is assigned to you, they'll appear here."
                />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {mentors.map((m) => (
                        <MentorCard
                            key={m.id}
                            mentor={m}
                            instituteId={instituteId}
                            onMessage={setChatMentor}
                        />
                    ))}
                </div>
            )}

            <MentorChatSheet
                mentor={chatMentor}
                open={!!chatMentor}
                onOpenChange={(o) => {
                    if (!o) setChatMentor(null);
                }}
            />
        </div>
    );
}
