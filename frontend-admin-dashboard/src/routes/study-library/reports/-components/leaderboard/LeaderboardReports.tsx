import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Crown, Users, Buildings, Copy, ShareNetwork } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getBadgeIcon, BadgeVisual } from '@/routes/settings/-constants/badge-icon-map';
import {
    getBadgeStats,
    getCourseLeaderboardAdmin,
    getInstituteLeaderboardAdmin,
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
                <p className="text-caption italic text-muted-foreground">No badges awarded yet.</p>
            )}
        </div>
    );
}

/** The learner's earned badge icons (up to 3) + an overflow count. */
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

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
    return (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50">
            <div className="flex w-6 shrink-0 justify-center">
                <RankCell rank={entry.rank} />
            </div>
            <span className="flex-1 truncate text-body font-medium text-neutral-700">
                {entry.name}
            </span>
            <BadgeIcons entry={entry} />
            <span className="w-20 text-right text-caption font-semibold tabular-nums text-neutral-600">
                {entry.points} pts
            </span>
        </div>
    );
}

type LeaderboardView = 'institute' | 'course';

export default function LeaderboardReports() {
    const {
        instituteDetails,
        getCourseFromPackage,
        getSessionFromPackage,
        getLevelsFromPackage2,
        getPackageSessionId,
    } = useInstituteDetailsStore();
    const courseList = getCourseFromPackage();
    const instituteId = getCurrentInstituteId();

    const [view, setView] = useState<LeaderboardView>('institute');
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

    const { data: courseLeaderboard, isLoading: courseLoading } = useQuery({
        queryKey: ['admin-course-leaderboard', packageSessionId],
        queryFn: () => getCourseLeaderboardAdmin(packageSessionId as string),
        enabled: view === 'course' && Boolean(packageSessionId),
        staleTime: 60 * 1000,
    });

    const { data: instituteLeaderboard, isLoading: instituteLoading } = useQuery({
        queryKey: ['admin-institute-leaderboard'],
        queryFn: getInstituteLeaderboardAdmin,
        enabled: view === 'institute',
        staleTime: 60 * 1000,
    });

    const isInstitute = view === 'institute';
    const activeData = isInstitute ? instituteLeaderboard : courseLeaderboard;
    const activeLoading = isInstitute ? instituteLoading : courseLoading;

    // Public, white-labelled shareable link (institute view only) — points at the
    // institute's LEARNER portal so domain-routing resolves the institute.
    const shareUrl = useMemo(() => {
        if (!isInstitute || !instituteId) return '';
        const rawBase = instituteDetails?.learner_portal_base_url || BASE_URL_LEARNER_DASHBOARD;
        const base =
            rawBase.startsWith('http://') || rawBase.startsWith('https://')
                ? rawBase
                : `https://${rawBase}`;
        return `${base.replace(/\/+$/, '')}/leaderboard/institute/${instituteId}`;
    }, [isInstitute, instituteId, instituteDetails?.learner_portal_base_url]);

    const handleCopy = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        toast.success('Public leaderboard link copied');
    };
    const handleShare = () => {
        if (!shareUrl) return;
        if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({ title: 'Institute Leaderboard', url: shareUrl }).catch(() => {});
        } else {
            handleCopy();
        }
    };

    return (
        <div className="flex flex-col gap-4 p-6">
            <BadgesStatsPanel />

            {/* View toggle */}
            <div className="flex items-center gap-2">
                <MyButton
                    buttonType={isInstitute ? 'primary' : 'secondary'}
                    scale="small"
                    onClick={() => setView('institute')}
                    className="gap-1.5"
                >
                    <Buildings className="size-4" />
                    Institute-wide
                </MyButton>
                <MyButton
                    buttonType={!isInstitute ? 'primary' : 'secondary'}
                    scale="small"
                    onClick={() => setView('course')}
                    className="gap-1.5"
                >
                    <Crown className="size-4" />
                    By course
                </MyButton>
            </div>

            {/* Batch selector (course view only) */}
            {!isInstitute && (
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
                            <Select
                                value={levelId}
                                onValueChange={setLevelId}
                                disabled={!levelList.length}
                            >
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
            )}

            {/* Leaderboard */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {isInstitute ? (
                            <Buildings weight="fill" className="size-5 text-primary-500" />
                        ) : (
                            <Crown weight="fill" className="size-5 text-warning-500" />
                        )}
                        <h3 className="text-subtitle font-semibold text-neutral-700">
                            {isInstitute ? 'Institute-wide Leaderboard' : 'Course Leaderboard'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeData && (
                            <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
                                <Users className="size-4" />
                                {activeData.totalLearners} learners
                            </span>
                        )}
                        {shareUrl && (
                            <>
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
                                    buttonType="secondary"
                                    scale="small"
                                    layoutVariant="icon"
                                    onClick={handleShare}
                                    aria-label="Share public leaderboard link"
                                >
                                    <ShareNetwork className="size-4" />
                                </MyButton>
                            </>
                        )}
                    </div>
                </div>

                {!isInstitute && !packageSessionId ? (
                    <p className="py-6 text-center text-caption text-muted-foreground">
                        Select a course, session and level to view its leaderboard.
                    </p>
                ) : activeLoading ? (
                    <p className="py-6 text-center text-caption text-muted-foreground">
                        Loading leaderboard…
                    </p>
                ) : !activeData || activeData.entries.length === 0 ? (
                    <p className="py-6 text-center text-caption text-muted-foreground">
                        {isInstitute
                            ? 'No learner activity recorded yet.'
                            : 'No activity recorded for this batch yet.'}
                    </p>
                ) : (
                    <div className="flex flex-col gap-1">
                        {activeData.entries.map((entry, i) => (
                            <LeaderboardRow key={i} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
