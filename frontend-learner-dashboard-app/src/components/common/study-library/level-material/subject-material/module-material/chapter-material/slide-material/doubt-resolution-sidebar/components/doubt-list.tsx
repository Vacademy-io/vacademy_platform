import { Doubt as DoubtType } from "../types/get-doubts-type";
import { Doubt } from "./doubt";
import { ChatText, CheckCircle, Clock, CircleNotch } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { DoubtAuthorMap } from "../hooks/useDoubtAuthors";

interface DoubtListProps {
    allDoubts: DoubtType[];
    isLoading: boolean;
    lastDoubtElementRef: (node: HTMLDivElement) => void;
    refetch: () => void;
    isFetchingNextPage: boolean;
    /** Active tab — drives which empty state copy is shown. */
    status: "ALL" | "RESOLVED" | "ACTIVE";
    authors: DoubtAuthorMap;
    viewerUserId: string | null;
    sourceType?: string;
    onJumpToPosition?: (position: number) => void;
    getPositionLabel: (doubt: DoubtType) => string | undefined;
}

const DoubtSkeleton = () => (
    <div className="animate-pulse rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-neutral-100" />
            <div className="flex flex-1 flex-col gap-1">
                <div className="h-3 w-24 rounded-sm bg-neutral-100" />
                <div className="h-2 w-16 rounded-sm bg-neutral-100" />
            </div>
        </div>
        <div className="mt-3 space-y-1.5">
            <div className="h-2.5 w-full rounded-sm bg-neutral-100" />
            <div className="h-2.5 w-4/5 rounded-sm bg-neutral-100" />
        </div>
    </div>
);

export const DoubtList = ({
    allDoubts,
    isLoading,
    lastDoubtElementRef,
    refetch,
    isFetchingNextPage,
    status,
    authors,
    viewerUserId,
    sourceType,
    onJumpToPosition,
    getPositionLabel,
}: DoubtListProps) => {
    const { t } = useTranslation("studyContent");

    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                <DoubtSkeleton />
                <DoubtSkeleton />
                <DoubtSkeleton />
            </div>
        );
    }

    if (allDoubts.length === 0) {
        const empty =
            status === "RESOLVED"
                ? {
                      icon: <CheckCircle size={22} className="text-success-600" />,
                      title: t("doubts.emptyResolvedTitle"),
                      subtitle: t("doubts.emptyResolvedSubtitle"),
                  }
                : status === "ACTIVE"
                  ? {
                        icon: <Clock size={22} className="text-warning-600" />,
                        title: t("doubts.emptyPendingTitle"),
                        subtitle: t("doubts.emptyPendingSubtitle"),
                    }
                  : {
                        icon: <ChatText size={22} className="text-neutral-400" />,
                        title: t("doubts.emptyAllTitle"),
                        subtitle: t("doubts.emptyAllSubtitle"),
                    };

        return (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-neutral-100">
                    {empty.icon}
                </div>
                <p className="text-subtitle font-semibold text-neutral-800">{empty.title}</p>
                <p className="max-w-reg-250 text-caption text-neutral-500">{empty.subtitle}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {allDoubts.map((doubt, index) => (
                <div
                    key={doubt.id || index}
                    ref={index === allDoubts.length - 1 ? lastDoubtElementRef : undefined}
                >
                    <Doubt
                        doubt={doubt}
                        refetch={refetch}
                        authors={authors}
                        viewerUserId={viewerUserId}
                        sourceType={sourceType}
                        onJumpToPosition={onJumpToPosition}
                        positionLabel={getPositionLabel(doubt)}
                    />
                </div>
            ))}

            {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 py-3 text-caption text-neutral-500">
                    <CircleNotch size={14} className="animate-spin" />
                    {t("doubts.loadingMore")}
                </div>
            )}
        </div>
    );
};
