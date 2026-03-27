import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
    MagnifyingGlass,
    BookOpen,
    FunnelSimple,
    X,
    CaretDown,
    CaretLeft,
    CaretRight,
    Warning,
} from '@phosphor-icons/react';
import { SelectedPackageSession } from '../../../../-types/bulk-assign-types';
import { cn } from '@/lib/utils';
import { getAllCoursesWithFilters } from '@/routes/study-library/courses/-services/courses-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { GET_LEVELS_BY_INSTITUTE, GET_SESSION_DETAILS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import type { CourseItem } from '@/routes/study-library/courses/-components/course-material';

interface Props {
    selectedPackageSessions: SelectedPackageSession[];
    onSelectedPackageSessionsChange: (sessions: SelectedPackageSession[]) => void;
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

const PAGE_SIZE = 20;

export const Step2CourseSelector = ({
    selectedPackageSessions,
    onSelectedPackageSessionsChange,
}: Props) => {
    const instituteId = getCurrentInstituteId();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
    const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const debouncedSearch = useDebounce(searchQuery, 400);

    // Reset page when filters change
    useEffect(() => {
        setPage(0);
    }, [debouncedSearch, selectedLevelIds, selectedSessionIds]);

    // Fetch levels from dedicated API
    const { data: levelOptions = [], isLoading: isLevelsLoading } = useQuery<
        { id: string; level_name: string }[]
    >({
        queryKey: ['STEP2_LEVELS', instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(GET_LEVELS_BY_INSTITUTE, {
                params: { instituteId },
            });
            return response.data;
        },
        staleTime: 300000,
        enabled: !!instituteId,
    });

    // Fetch sessions from dedicated API
    // The API returns [{ session: { id, session_name, ... }, packages: [...] }]
    const { data: sessionOptions = [], isLoading: isSessionsLoading } = useQuery<
        { id: string; session_name: string }[]
    >({
        queryKey: ['STEP2_SESSIONS', instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(GET_SESSION_DETAILS, {
                params: { instituteId },
            });
            return (response.data ?? []).map(
                (item: { session: { id: string; session_name: string } }) => ({
                    id: item.session.id,
                    session_name: item.session.session_name,
                })
            );
        },
        staleTime: 300000,
        enabled: !!instituteId,
    });

    // Fetch courses with all filters applied server-side
    const {
        data: courseData,
        isLoading: isCoursesLoading,
        isError,
        error,
    } = useQuery({
        queryKey: [
            'STEP2_COURSES',
            instituteId,
            debouncedSearch,
            selectedLevelIds,
            selectedSessionIds,
            page,
        ],
        queryFn: () =>
            getAllCoursesWithFilters(page, PAGE_SIZE, instituteId, {
                status: ['ACTIVE'],
                level_ids: selectedLevelIds,
                session_ids: selectedSessionIds,
                tag: [],
                faculty_ids: [],
                search_by_name: debouncedSearch || '',
                min_percentage_completed: 0,
                max_percentage_completed: 0,
                sort_columns: { created_at: 'DESC' },
                package_ids: [],
                package_session_ids: [],
            }),
        enabled: !!instituteId,
        staleTime: 1000 * 30,
    });

    const items: CourseItem[] = courseData?.content ?? [];
    const totalPages: number = courseData?.totalPages ?? 0;
    const totalElements: number = courseData?.totalElements ?? 0;

    // Group by package for display
    const groups = useMemo(() => {
        const map: Record<string, { packageName: string; items: CourseItem[] }> = {};
        items.forEach((item) => {
            if (!map[item.id]) {
                map[item.id] = { packageName: item.package_name, items: [] };
            }
            map[item.id]!.items.push(item);
        });
        return Object.entries(map).map(([pkgId, group]) => ({
            id: pkgId,
            packageName: group.packageName,
            batches: group.items,
        }));
    }, [items]);

    const isSelected = useCallback(
        (packageSessionId: string) =>
            selectedPackageSessions.some((s) => s.packageSessionId === packageSessionId),
        [selectedPackageSessions]
    );

    const toggle = useCallback(
        (item: CourseItem) => {
            const psId = item.package_session_id;
            if (isSelected(psId)) {
                onSelectedPackageSessionsChange(
                    selectedPackageSessions.filter((s) => s.packageSessionId !== psId)
                );
            } else {
                onSelectedPackageSessionsChange([
                    ...selectedPackageSessions,
                    {
                        packageSessionId: psId,
                        courseName: item.package_name,
                        sessionName: item.session_name ?? '',
                        levelName: item.level_name,
                        enrollInviteId: null,
                        accessDays: null,
                    },
                ]);
            }
        },
        [isSelected, selectedPackageSessions, onSelectedPackageSessionsChange]
    );

    const activeFilterCount = selectedLevelIds.length + selectedSessionIds.length;

    const clearFilters = () => {
        setSelectedLevelIds([]);
        setSelectedSessionIds([]);
    };

    const isDropdownLoading = isLevelsLoading || isSessionsLoading;

    return (
        <div className="flex flex-col gap-4 px-6 py-5">
            {/* Selection summary */}
            {selectedPackageSessions.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-700">
                    <span className="font-semibold">{selectedPackageSessions.length}</span>{' '}
                    batch{selectedPackageSessions.length !== 1 ? 'es' : ''} selected — students
                    will be enrolled in all selected.
                </div>
            )}

            {/* Search + Filter row */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlass
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search courses, levels..."
                        className="h-9 pl-9 text-sm"
                    />
                </div>

                {/* Level filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                'h-9 gap-1.5 text-xs font-medium',
                                selectedLevelIds.length > 0 &&
                                    'border-primary-300 bg-primary-50 text-primary-700'
                            )}
                        >
                            <FunnelSimple size={13} />
                            Level
                            {selectedLevelIds.length > 0 && (
                                <Badge className="ml-0.5 h-4 min-w-4 rounded-full px-1 py-0 text-[10px] leading-none">
                                    {selectedLevelIds.length}
                                </Badge>
                            )}
                            <CaretDown size={11} className="text-neutral-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-60 w-48 overflow-y-auto">
                        <DropdownMenuLabel className="text-xs text-neutral-500">
                            Filter by Level
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {isDropdownLoading ? (
                            <div className="space-y-1 p-2">
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-5 w-3/4" />
                            </div>
                        ) : levelOptions.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-neutral-400">No levels found</p>
                        ) : (
                            levelOptions.map((lvl) => (
                                <DropdownMenuCheckboxItem
                                    key={lvl.id}
                                    checked={selectedLevelIds.includes(lvl.id)}
                                    onCheckedChange={(checked) =>
                                        setSelectedLevelIds((prev) =>
                                            checked
                                                ? [...prev, lvl.id]
                                                : prev.filter((id) => id !== lvl.id)
                                        )
                                    }
                                    className="text-xs"
                                >
                                    {lvl.level_name}
                                </DropdownMenuCheckboxItem>
                            ))
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Session filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                'h-9 gap-1.5 text-xs font-medium',
                                selectedSessionIds.length > 0 &&
                                    'border-primary-300 bg-primary-50 text-primary-700'
                            )}
                        >
                            <FunnelSimple size={13} />
                            Session
                            {selectedSessionIds.length > 0 && (
                                <Badge className="ml-0.5 h-4 min-w-4 rounded-full px-1 py-0 text-[10px] leading-none">
                                    {selectedSessionIds.length}
                                </Badge>
                            )}
                            <CaretDown size={11} className="text-neutral-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-60 w-48 overflow-y-auto">
                        <DropdownMenuLabel className="text-xs text-neutral-500">
                            Filter by Session
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {isDropdownLoading ? (
                            <div className="space-y-1 p-2">
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-5 w-3/4" />
                            </div>
                        ) : sessionOptions.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-neutral-400">
                                No sessions found
                            </p>
                        ) : (
                            sessionOptions.map((ses) => (
                                <DropdownMenuCheckboxItem
                                    key={ses.id}
                                    checked={selectedSessionIds.includes(ses.id)}
                                    onCheckedChange={(checked) =>
                                        setSelectedSessionIds((prev) =>
                                            checked
                                                ? [...prev, ses.id]
                                                : prev.filter((id) => id !== ses.id)
                                        )
                                    }
                                    className="text-xs"
                                >
                                    {ses.session_name}
                                </DropdownMenuCheckboxItem>
                            ))
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedLevelIds.map((id) => {
                        const lvl = levelOptions.find((l) => l.id === id);
                        return (
                            <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                            >
                                Level: {lvl?.level_name ?? id}
                                <button
                                    onClick={() =>
                                        setSelectedLevelIds((prev) =>
                                            prev.filter((x) => x !== id)
                                        )
                                    }
                                    className="ml-0.5 rounded-full hover:text-primary-900"
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        );
                    })}
                    {selectedSessionIds.map((id) => {
                        const ses = sessionOptions.find((s) => s.id === id);
                        return (
                            <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700"
                            >
                                Session: {ses?.session_name ?? id}
                                <button
                                    onClick={() =>
                                        setSelectedSessionIds((prev) =>
                                            prev.filter((x) => x !== id)
                                        )
                                    }
                                    className="ml-0.5 rounded-full hover:text-violet-900"
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        );
                    })}
                    <button
                        onClick={clearFilters}
                        className="text-xs text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Error state */}
            {isError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <Warning size={16} weight="fill" className="shrink-0" />
                    <span>
                        Failed to load courses.{' '}
                        {error instanceof Error ? error.message : 'Please try again.'}
                    </span>
                </div>
            )}

            {/* Course list */}
            <div className="flex flex-col gap-3">
                {isCoursesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-neutral-200 bg-white">
                            <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
                                <Skeleton className="size-4 rounded" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                            <div className="space-y-2 px-4 py-3">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        </div>
                    ))
                ) : groups.length === 0 && !isError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <BookOpen
                            size={36}
                            className="mb-3 text-neutral-300"
                            weight="duotone"
                        />
                        <p className="text-sm font-medium text-neutral-500">No courses found</p>
                        <p className="mt-1 text-xs text-neutral-400">
                            Try adjusting your search or filters.
                        </p>
                    </div>
                ) : (
                    groups.map((group) => (
                        <div
                            key={group.id}
                            className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
                        >
                            {/* Course header */}
                            <div className="flex items-center gap-2.5 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                                <BookOpen
                                    size={15}
                                    className="shrink-0 text-primary-500"
                                    weight="duotone"
                                />
                                <span className="text-sm font-semibold leading-tight text-neutral-800">
                                    {group.packageName}
                                </span>
                                <span className="ml-auto text-xs text-neutral-400">
                                    {group.batches.length} batch
                                    {group.batches.length !== 1 ? 'es' : ''}
                                </span>
                            </div>

                            {/* Batch rows */}
                            <div className="divide-y divide-neutral-50">
                                {group.batches.map((batch) => {
                                    const selected = isSelected(batch.package_session_id);
                                    return (
                                        <button
                                            key={batch.package_session_id}
                                            onClick={() => toggle(batch)}
                                            className={cn(
                                                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-primary-50/60',
                                                selected && 'bg-primary-50'
                                            )}
                                        >
                                            <Checkbox
                                                checked={selected}
                                                onCheckedChange={() => toggle(batch)}
                                                className="pointer-events-none shrink-0"
                                            />
                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                <span className="truncate text-xs font-medium text-neutral-700">
                                                    {batch.level_name}
                                                </span>
                                                {batch.session_name && (
                                                    <>
                                                        <span className="text-neutral-300">·</span>
                                                        <span className="truncate text-xs text-neutral-500">
                                                            {batch.session_name}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <span
                                                className={cn(
                                                    'shrink-0 text-xs font-medium',
                                                    selected
                                                        ? 'text-primary-600'
                                                        : 'text-neutral-300'
                                                )}
                                            >
                                                {selected ? '✓' : '+'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                    <span className="text-xs text-neutral-400">
                        Showing {page * PAGE_SIZE + 1}–
                        {Math.min((page + 1) * PAGE_SIZE, totalElements)} of {totalElements}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={page === 0}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <CaretLeft size={13} />
                        </Button>
                        <span className="px-2 text-xs text-neutral-600">
                            {page + 1} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <CaretRight size={13} />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
