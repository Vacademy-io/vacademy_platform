import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Crown, Users } from '@phosphor-icons/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getBadgeIcon } from '@/routes/settings/-constants/badge-icon-map';
import {
    getBadgeStats,
    getCourseLeaderboardAdmin,
    type LeaderboardEntry,
} from '@/services/leaderboard';

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

function BadgesStatsPanel() {
    const { data, isLoading } = useQuery({
        queryKey: ['badge-stats'],
        queryFn: getBadgeStats,
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-caption text-muted-foreground">
                Loading badge stats…
            </div>
        );
    }
    if (!data) return null;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <Trophy weight="fill" className="size-5 text-primary-500" />
                <h3 className="text-subtitle font-semibold text-neutral-700">Badges Awarded</h3>
            </div>
            <div className="mb-4 flex flex-wrap gap-3">
                <div className="rounded-lg bg-primary-50 px-4 py-2">
                    <p className="text-h3 font-bold text-primary-600">{data.totalAwarded}</p>
                    <p className="text-caption text-neutral-500">Total awarded</p>
                </div>
                <div className="rounded-lg bg-neutral-50 px-4 py-2">
                    <p className="text-h3 font-bold text-neutral-700">{data.learnersWithBadge}</p>
                    <p className="text-caption text-neutral-500">Learners recognised</p>
                </div>
            </div>
            {data.badges.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {data.badges.map((b) => {
                        const Icon = getBadgeIcon(b.badgeIcon || 'Trophy');
                        return (
                            <div key={b.badgeId} className="flex items-center gap-3">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50">
                                    <Icon weight="fill" className="size-4 text-primary-500" />
                                </div>
                                <span className="flex-1 truncate text-body text-neutral-700">
                                    {b.badgeName || b.badgeId}
                                </span>
                                <span className="text-caption font-semibold text-neutral-600">
                                    {b.count}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-caption italic text-muted-foreground">
                    No badges awarded yet.
                </p>
            )}
        </div>
    );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
    return (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50">
            <div className="flex w-6 shrink-0 justify-center">
                <RankCell rank={entry.rank} />
            </div>
            <span className="flex-1 truncate text-body font-medium text-neutral-700">
                {entry.name}
            </span>
            {entry.badgeCount > 0 && (
                <span className="inline-flex items-center gap-1 text-caption font-semibold text-warning-600">
                    <Trophy weight="fill" className="size-3.5" />
                    {entry.badgeCount}
                </span>
            )}
            <span className="w-20 text-right text-caption font-semibold tabular-nums text-neutral-600">
                {entry.points} pts
            </span>
        </div>
    );
}

export default function LeaderboardReports() {
    const { getCourseFromPackage, getSessionFromPackage, getLevelsFromPackage2, getPackageSessionId } =
        useInstituteDetailsStore();
    const courseList = getCourseFromPackage();

    const [courseId, setCourseId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [levelId, setLevelId] = useState('');
    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<{ id: string; level_name: string }[]>([]);

    useEffect(() => {
        if (courseId) {
            const s = getSessionFromPackage({ courseId });
            setSessionList(s);
            setSessionId(s.length === 1 && s[0] ? s[0].id : '');
        } else {
            setSessionList([]);
            setSessionId('');
        }
        setLevelId('');
    }, [courseId]);

    useEffect(() => {
        if (courseId && sessionId) {
            const l = getLevelsFromPackage2({ courseId, sessionId }) as {
                id: string;
                level_name: string;
            }[];
            setLevelList(l);
            if (l.length === 1 && l[0]) setLevelId(l[0].id);
            else if (sessionId === 'DEFAULT') setLevelId('DEFAULT');
            else setLevelId('');
        } else {
            setLevelList([]);
            setLevelId('');
        }
    }, [courseId, sessionId]);

    const packageSessionId = useMemo(
        () =>
            courseId && sessionId && levelId
                ? getPackageSessionId({ courseId, sessionId, levelId })
                : null,
        [courseId, sessionId, levelId]
    );

    const { data: leaderboard, isLoading: lbLoading } = useQuery({
        queryKey: ['admin-course-leaderboard', packageSessionId],
        queryFn: () => getCourseLeaderboardAdmin(packageSessionId as string),
        enabled: Boolean(packageSessionId),
        staleTime: 60 * 1000,
    });

    return (
        <div className="flex flex-col gap-4 p-6">
            <BadgesStatsPanel />

            {/* Batch selector */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            Course
                        </label>
                        <SearchableSelect
                            options={courseList.map((c) => ({ label: c.name, value: c.id }))}
                            value={courseId}
                            onChange={(v) => setCourseId(v)}
                            placeholder="Select a course"
                            searchPlaceholder="Search course..."
                            triggerClassName="h-9 text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            Session
                        </label>
                        <Select
                            value={sessionId}
                            onValueChange={setSessionId}
                            disabled={!sessionList.length}
                        >
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select a session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessionList.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            Level
                        </label>
                        <Select value={levelId} onValueChange={setLevelId} disabled={!levelList.length}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select a level" />
                            </SelectTrigger>
                            <SelectContent>
                                {levelList.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.level_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Crown weight="fill" className="size-5 text-warning-500" />
                        <h3 className="text-subtitle font-semibold text-neutral-700">
                            Course Leaderboard
                        </h3>
                    </div>
                    {leaderboard && (
                        <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
                            <Users className="size-4" />
                            {leaderboard.totalLearners} learners
                        </span>
                    )}
                </div>

                {!packageSessionId ? (
                    <p className="py-6 text-center text-caption text-muted-foreground">
                        Select a course, session and level to view its leaderboard.
                    </p>
                ) : lbLoading ? (
                    <p className="py-6 text-center text-caption text-muted-foreground">
                        Loading leaderboard…
                    </p>
                ) : !leaderboard || leaderboard.entries.length === 0 ? (
                    <p className="py-6 text-center text-caption text-muted-foreground">
                        No activity recorded for this batch yet.
                    </p>
                ) : (
                    <div className="flex flex-col gap-1">
                        {leaderboard.entries.map((entry, i) => (
                            <LeaderboardRow key={i} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
