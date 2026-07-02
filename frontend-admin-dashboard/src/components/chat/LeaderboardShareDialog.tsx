import { useQuery } from '@tanstack/react-query';
import { Crown, Medal, Trophy, Copy, ShareNetwork, Users } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { BadgeVisual } from '@/routes/settings/-constants/badge-icon-map';
import { getCourseLeaderboardAdmin, type LeaderboardEntry } from '@/services/leaderboard';

const MEDAL_TONE: Record<number, string> = {
    1: 'text-warning-500',
    2: 'text-neutral-400',
    3: 'text-warning-700',
};

function RankCell({ rank }: { rank: number | null }) {
    if (rank != null && rank >= 1 && rank <= 3) {
        return <Medal weight="fill" className={cn('size-5', MEDAL_TONE[rank])} />;
    }
    return (
        <span className="w-6 text-center text-caption font-bold text-neutral-400">{rank ?? '–'}</span>
    );
}

function BadgeIcons({ entry }: { entry: LeaderboardEntry }) {
    const shown = entry.badges?.slice(0, 3) ?? [];
    if (entry.badgeCount <= 0) return null;
    return (
        <span className="inline-flex items-center gap-0.5">
            {shown.map((b, i) => (
                <span key={i} title={b.name} className="inline-flex">
                    <BadgeVisual icon={b.icon} size={14} className="text-warning-600" />
                </span>
            ))}
            {entry.badgeCount > shown.length && (
                <span className="text-caption font-semibold text-warning-600">
                    +{entry.badgeCount - shown.length}
                </span>
            )}
        </span>
    );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
    return (
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50">
            <div className="flex w-6 shrink-0 justify-center">
                <RankCell rank={entry.rank} />
            </div>
            <span className="flex-1 truncate text-body font-medium text-neutral-700">
                {entry.name}
            </span>
            <BadgeIcons entry={entry} />
            <span className="w-16 text-right text-caption font-semibold tabular-nums text-neutral-600">
                {entry.points} pts
            </span>
        </div>
    );
}

interface LeaderboardShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    packageSessionId: string | null;
    batchName?: string;
    /** Public, white-labelled URL for this batch's leaderboard. */
    shareUrl: string;
}

/** Preview a batch's leaderboard, then copy/share its public link — used from the chat header. */
export function LeaderboardShareDialog({
    open,
    onOpenChange,
    packageSessionId,
    batchName,
    shareUrl,
}: LeaderboardShareDialogProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['chat-course-leaderboard', packageSessionId],
        queryFn: () => getCourseLeaderboardAdmin(packageSessionId as string),
        enabled: open && Boolean(packageSessionId),
        staleTime: 60 * 1000,
    });

    const handleCopy = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        toast.success('Public leaderboard link copied');
    };
    const handleShare = () => {
        if (!shareUrl) return;
        if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({ title: 'Course Leaderboard', url: shareUrl }).catch(() => {});
        } else {
            handleCopy();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Crown weight="fill" className="size-5 text-warning-500" />
                        Course Leaderboard
                    </DialogTitle>
                </DialogHeader>

                {batchName && (
                    <p className="-mt-2 flex items-center gap-1.5 text-caption text-muted-foreground">
                        <span className="truncate">{batchName}</span>
                        {data && (
                            <span className="inline-flex shrink-0 items-center gap-1">
                                · <Users className="size-3.5" />
                                {data.totalLearners}
                            </span>
                        )}
                    </p>
                )}

                <div className="max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <p className="py-8 text-center text-caption text-muted-foreground">
                            Loading leaderboard…
                        </p>
                    ) : !data || data.entries.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <Trophy weight="fill" className="size-8 text-neutral-300" />
                            <p className="text-caption text-muted-foreground">
                                No activity recorded for this batch yet.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            {data.entries.map((entry, i) => (
                                <Row key={i} entry={entry} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 border-t border-neutral-100 pt-3">
                    <p className="flex-1 text-caption text-muted-foreground">
                        Share the public, anonymized leaderboard link.
                    </p>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={handleCopy}
                        className="gap-1.5"
                    >
                        <Copy className="size-4" />
                        Copy link
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={handleShare}
                        className="gap-1.5"
                    >
                        <ShareNetwork className="size-4" />
                        Share
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}
