'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import type * as z from 'zod';
import { Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchPaginatedBatches } from '@/routes/admin-package-management/-services/package-service';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';
import { fetchCourseStudyLibraryDetails } from '@/routes/study-library/courses/-services/getStudyLibraryDetails';
import { MultiSelect } from '@/components/design-system/multi-select';
import type { inviteUsersSchema } from './InviteUsersComponent';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

const PAGE_SIZE = 10;

interface SubjectOption {
    label: string;
    value: string;
}

interface BatchSubjectFormProps {
    initialBatchId?: string;
}

export default function BatchSubjectForm({ initialBatchId }: BatchSubjectFormProps) {
    const form = useFormContext<z.infer<typeof inviteUsersSchema>>();

    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: ['paginatedBatchesForTeacher'],
        queryFn: ({ pageParam = 0 }) =>
            fetchPaginatedBatches({
                page: pageParam,
                size: PAGE_SIZE,
                sortBy: 'created_at',
                sortDirection: 'DESC',
                statuses: ['ACTIVE'],
            }),
        getNextPageParam: (lastPage) =>
            lastPage.has_next ? lastPage.page_number + 1 : undefined,
        initialPageParam: 0,
    });

    // Flatten all pages into a stable list (only changes when data changes)
    const allBatchItems: PackageSessionDTO[] = useMemo(
        () => data?.pages?.flatMap((page) => page.content) ?? [],
        [data]
    );

    // Infinite scroll observer
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isFetchingNextPage) return;
            if (observerRef.current) observerRef.current.disconnect();
            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0]?.isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });
            if (node) observerRef.current.observe(node);
        },
        [isFetchingNextPage, hasNextPage, fetchNextPage]
    );

    // State to track which batches are selected via checkbox
    const [selectedBatches, setSelectedBatches] = useState<string[]>(
        initialBatchId ? [initialBatchId] : []
    );
    // State to track subject selections for each batch
    const [subjectSelections, setSubjectSelections] = useState<Record<string, string[]>>({});
    // Cache of fetched subjects keyed by courseId_sessionId_levelId
    const [subjectsCache, setSubjectsCache] = useState<Record<string, SubjectOption[]>>({});
    const [loadingSubjects, setLoadingSubjects] = useState<Record<string, boolean>>({});

    // Track which courseIds have already been fetched or are in-flight (stable ref, no re-renders)
    const fetchedCourseIdsRef = useRef<Set<string>>(new Set());

    // Get batches from the paginated API
    const batches = useMemo(
        () =>
            allBatchItems.map((batch) => ({
                id: batch.id,
                name:
                    batch.level.id === 'DEFAULT'
                        ? `${batch.package_dto.package_name.replace(/^default\s+/i, '')}, ${batch.session.session_name}`.trim()
                        : `${batch.level.level_name.replace(/^default\s+/i, '')} ${batch.package_dto.package_name.replace(/^default\s+/i, '')}, ${batch.session.session_name}`.trim(),
            })),
        [allBatchItems]
    );

    // Fetch subjects for a batch's course when selected
    const fetchSubjectsForBatch = useCallback(
        async (batch: PackageSessionDTO) => {
            const courseId = batch.package_dto.id;

            // Already fetched or in-flight for this course — skip
            if (fetchedCourseIdsRef.current.has(courseId)) return;
            fetchedCourseIdsRef.current.add(courseId);

            setLoadingSubjects((prev) => ({ ...prev, [batch.id]: true }));
            try {
                const courseData = await fetchCourseStudyLibraryDetails(courseId);
                const course = Array.isArray(courseData)
                    ? courseData.find((c: { course: { id: string } }) => c.course.id === courseId)
                    : courseData;

                if (!course) return;

                // Extract subjects for all session+level combos and cache them
                const newEntries: Record<string, SubjectOption[]> = {};
                for (const session of course.sessions || []) {
                    for (const level of session.level_with_details || []) {
                        const key = `${courseId}_${session.session_dto.id}_${level.id}`;
                        newEntries[key] = (level.subjects || []).map(
                            (s: { id: string; subject_name: string }) => ({
                                label: s.subject_name,
                                value: s.id,
                            })
                        );
                    }
                }
                setSubjectsCache((prev) => ({ ...prev, ...newEntries }));
            } catch {
                // Allow retry on failure
                fetchedCourseIdsRef.current.delete(courseId);
            } finally {
                setLoadingSubjects((prev) => ({ ...prev, [batch.id]: false }));
            }
        },
        [] // no reactive deps — uses ref for dedup
    );

    // Get subjects for a specific batch from cache
    const getSubjectsByBatchId = (batchId: string): SubjectOption[] => {
        const batch = allBatchItems.find((b) => b.id === batchId);
        if (!batch) return [];
        const key = `${batch.package_dto.id}_${batch.session.id}_${batch.level.id}`;
        return subjectsCache[key] || [];
    };

    // Fetch subjects when a batch is selected
    useEffect(() => {
        for (const batchId of selectedBatches) {
            const batch = allBatchItems.find((b) => b.id === batchId);
            if (!batch) continue;
            fetchSubjectsForBatch(batch);
        }
    }, [selectedBatches, allBatchItems, fetchSubjectsForBatch]);

    // Toggle batch selection
    const toggleBatchSelection = (batchId: string) => {
        setSelectedBatches((prev) => {
            if (prev.includes(batchId)) {
                const newSelected = prev.filter((id) => id !== batchId);
                const newSubjectSelections = { ...subjectSelections };
                delete newSubjectSelections[batchId];
                setSubjectSelections(newSubjectSelections);
                return newSelected;
            } else {
                return [...prev, batchId];
            }
        });
    };

    // Handle subject selection change
    const handleSubjectChange = (batchId: string, subjects: string[]) => {
        setSubjectSelections((prev) => ({
            ...prev,
            [batchId]: subjects,
        }));
    };

    // Update form values when selections change
    useEffect(() => {
        const mappings = selectedBatches.map((batchId) => ({
            batchId,
            subjectIds: subjectSelections[batchId] || [],
        }));

        form.setValue('batch_subject_mappings', mappings.length > 0 ? mappings : []);
    }, [selectedBatches, subjectSelections, form]);

    if (isLoading) {
        return <Loader className="size-6 animate-spin text-primary-500" />;
    }

    return (
        <Card className="w-full">
            <CardHeader className="px-2 py-4">
                <CardTitle>
                    Select Batch and {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}s
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-2">
                <div className="space-y-4">
                    {batches.map((batch) => (
                        <div key={batch.id} className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id={`batch-${batch.id}`}
                                    checked={selectedBatches.includes(batch.id)}
                                    onCheckedChange={() => toggleBatchSelection(batch.id)}
                                    className="size-5 border-2 data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-500"
                                />
                                <label
                                    htmlFor={`batch-${batch.id}`}
                                    className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {batch.name}
                                </label>
                            </div>

                            {selectedBatches.includes(batch.id) && (
                                <div className="ml-7">
                                    {loadingSubjects[batch.id] ? (
                                        <Loader className="size-4 animate-spin text-primary-500" />
                                    ) : (
                                        <FormField
                                            control={form.control}
                                            // @ts-expect-error  : type error
                                            name={`subject-${batch.id}`}
                                            render={() => (
                                                <FormItem>
                                                    <FormLabel className="text-primary-500">
                                                        Select Subjects
                                                    </FormLabel>
                                                    <FormControl>
                                                        <MultiSelect
                                                            selected={subjectSelections[batch.id] || []}
                                                            options={getSubjectsByBatchId(batch.id)}
                                                            onChange={(selected) =>
                                                                handleSubjectChange(batch.id, selected)
                                                            }
                                                            placeholder="Select subjects"
                                                            className="mt-1"
                                                        />
                                                    </FormControl>
                                                    <FormDescription className="mt-1">
                                                        You can select multiple subjects for this batch
                                                    </FormDescription>
                                                    {subjectSelections[batch.id]?.length === 0 && (
                                                        <FormMessage>
                                                            At least one subject is required
                                                        </FormMessage>
                                                    )}
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Infinite scroll sentinel */}
                {hasNextPage && (
                    <div ref={loadMoreRef} className="flex justify-center py-2">
                        {isFetchingNextPage && (
                            <Loader className="size-5 animate-spin text-primary-500" />
                        )}
                    </div>
                )}

                {batches.length === 0 && !isLoading && (
                    <div className="py-4 text-center text-muted-foreground">
                        No batches available
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
