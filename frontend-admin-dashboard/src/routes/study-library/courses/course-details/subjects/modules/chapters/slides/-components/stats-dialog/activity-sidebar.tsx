import { MyPagination } from '@/components/design-system/pagination';
import { usePaginationState } from '@/hooks/pagination';
import { useMemo, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { StudentSearchBox } from '@/components/common/student-search-box';
import { ActivityLogDialog } from '@/components/common/student-slide-tracking/activity-log-dialog';
import { Dialog, DialogHeader, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChartBar, Clock, CalendarBlank, Users, ArrowRight } from '@phosphor-icons/react';
import { useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getSlideActivityStats } from '@/services/study-library/slide-operations/slide-activity-stats';
import { UserActivity } from '@/types/study-library/activity-stats-response-type';
import { useActivityStatsStore } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-stores/activity-stats-store';

export const ActivityStatsSidebar = () => {
    const [searchInput, setSearchInput] = useState('');

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    };
    const router = useRouter();
    const { slideId } = router.state.location.search;

    const { page, pageSize, handlePageChange } = usePaginationState({
        initialPage: 0,
        initialPageSize: 4,
    });

    const {
        data: activityStats,
        isLoading,
        error,
    } = useQuery(
        getSlideActivityStats({
            slideId: slideId as string,
            page,
            size: pageSize,
        })
    );

    const formatTimeSpent = (timeInSeconds: number) => {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = timeInSeconds % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    };

    const formatLastActive = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getInitials = (name: string) =>
        name
            .split(' ')
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();

    const avatarColors = [
        'bg-rose-100 text-rose-700',
        'bg-amber-100 text-amber-700',
        'bg-emerald-100 text-emerald-700',
        'bg-sky-100 text-sky-700',
        'bg-violet-100 text-violet-700',
        'bg-fuchsia-100 text-fuchsia-700',
    ];
    const colorForName = (name: string) =>
        avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];

    type StudentRow = {
        id: string;
        user_id: string;
        full_name: string;
        time_spent_seconds: number;
        time_spent: string;
        last_active: string;
        last_active_raw: string;
    };

    const students: StudentRow[] = useMemo(() => {
        if (!activityStats?.content) return [];
        return activityStats.content.map((item: UserActivity) => ({
            id: item.userId,
            user_id: item.userId,
            full_name: item.fullName,
            time_spent_seconds: item.totalTimeSpent,
            time_spent: formatTimeSpent(item.totalTimeSpent),
            last_active: formatLastActive(item.lastActive),
            last_active_raw: item.lastActive,
        }));
    }, [activityStats]);

    const filteredStudents: StudentRow[] = useMemo(() => {
        const q = searchInput.trim().toLowerCase();
        if (!q) return students;
        return students.filter((s: StudentRow) => s.full_name.toLowerCase().includes(q));
    }, [students, searchInput]);

    const totalParticipants = activityStats?.totalElements ?? 0;
    const avgTimeSeconds = students.length
        ? Math.round(
              students.reduce((acc: number, s: StudentRow) => acc + s.time_spent_seconds, 0) /
                  students.length
          )
        : 0;
    const totalPages = activityStats?.totalPages ?? 0;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    title="Activity Stats"
                >
                    <ChartBar className="size-4 md:hidden" />
                    <span className="hidden md:inline">Activity Stats</span>
                </MyButton>
            </DialogTrigger>
            <DialogContent className="flex h-[680px] max-h-[92vh] w-[760px] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 font-normal">
                {/* Hero header */}
                <DialogHeader className="flex shrink-0 flex-col gap-0 space-y-0">
                    <div className="flex items-center gap-3 border-b border-neutral-200 bg-gradient-to-r from-primary-50 to-white px-6 py-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 text-white shadow-sm">
                            <ChartBar size={20} weight="duotone" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                Activity Stats
                            </h2>
                            <p className="text-xs text-neutral-500">
                                Track student engagement and submissions
                            </p>
                        </div>
                    </div>

                    {/* Stat strip */}
                    <div className="grid grid-cols-2 gap-px border-b border-neutral-200 bg-neutral-100 sm:grid-cols-3">
                        <div className="flex items-center gap-3 bg-white px-6 py-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                                <Users size={16} weight="bold" />
                            </div>
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                                    Participants
                                </p>
                                <p className="text-sm font-semibold text-neutral-900">
                                    {totalParticipants}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white px-6 py-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                                <Clock size={16} weight="bold" />
                            </div>
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                                    Avg. Time
                                </p>
                                <p className="text-sm font-semibold text-neutral-900">
                                    {formatTimeSpent(avgTimeSeconds)}
                                </p>
                            </div>
                        </div>
                        <div className="hidden items-center gap-3 bg-white px-6 py-3 sm:flex">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                                <CalendarBlank size={16} weight="bold" />
                            </div>
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                                    On This Page
                                </p>
                                <p className="text-sm font-semibold text-neutral-900">
                                    {filteredStudents.length}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="border-b border-neutral-200 bg-white px-6 py-3">
                        <StudentSearchBox
                            searchInput={searchInput}
                            searchFilter={''}
                            onSearchChange={handleSearchChange}
                            onSearchEnter={() => {}}
                            onClearSearch={() => setSearchInput('')}
                        />
                    </div>
                </DialogHeader>

                {/* Body — student list */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50">
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <div
                                        key={idx}
                                        className="h-16 animate-pulse rounded-lg border border-neutral-200 bg-white"
                                    />
                                ))}
                            </div>
                        ) : error ? (
                            <div className="flex h-32 items-center justify-center text-sm text-red-500">
                                Failed to load activity data
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="flex h-48 flex-col items-center justify-center gap-2 text-neutral-500">
                                <Users size={32} className="text-neutral-300" />
                                <p className="text-sm font-medium">
                                    {searchInput ? 'No matches found' : 'No student activity yet'}
                                </p>
                                <p className="text-xs">
                                    {searchInput
                                        ? 'Try a different search term'
                                        : 'Activity will appear once students start engaging'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredStudents.map((student: StudentRow) => (
                                    <button
                                        key={student.id}
                                        onClick={() =>
                                            useActivityStatsStore
                                                .getState()
                                                .openDialog(student.user_id, student.full_name)
                                        }
                                        className="group flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-all hover:border-primary-300 hover:shadow-sm"
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback
                                                className={`text-sm font-semibold ${colorForName(
                                                    student.full_name
                                                )}`}
                                            >
                                                {getInitials(student.full_name)}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <p className="truncate text-sm font-semibold text-neutral-900">
                                                {student.full_name}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {student.time_spent}
                                                </span>
                                                <span className="text-neutral-300">·</span>
                                                <span className="flex items-center gap-1">
                                                    <CalendarBlank size={12} />
                                                    {student.last_active}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-primary-600 transition-colors group-hover:border-primary-200 group-hover:bg-primary-50">
                                            View Activity
                                            <ArrowRight size={12} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="border-t border-neutral-200 bg-white px-4 py-3">
                            <MyPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    )}

                    <ActivityLogDialog />
                </div>
            </DialogContent>
        </Dialog>
    );
};
