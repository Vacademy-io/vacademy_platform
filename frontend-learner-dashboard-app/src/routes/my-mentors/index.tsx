import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UsersThree } from "@phosphor-icons/react";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { EmptyState, ErrorState, LoadingState } from "@/components/design-system/states";
import { getInstituteId } from "@/constants/helper";
import { handleGetMyMentors } from "./-services/my-mentors-service";
import { MentorCard } from "./-components/MentorCard";

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

function MyMentorsPage() {
    const [instituteId, setInstituteId] = useState<string | undefined>();

    useEffect(() => {
        getInstituteId().then((id) => setInstituteId(id ?? undefined));
    }, []);

    const { data, isLoading, isError, refetch } = useQuery(handleGetMyMentors(instituteId));
    const mentors = data ?? [];

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
                        <MentorCard key={m.id} mentor={m} instituteId={instituteId} />
                    ))}
                </div>
            )}
        </div>
    );
}
