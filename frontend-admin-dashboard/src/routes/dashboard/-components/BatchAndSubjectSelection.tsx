'use client';

import { useState, useEffect } from 'react';
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
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useStudyLibraryQuery } from '@/routes/study-library/courses/-services/getStudyLibraryDetails';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getCourseSubjects } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getSubjects';
import { MultiSelect } from '@/components/design-system/multi-select';
import type { inviteUsersSchema } from './InviteUsersComponent';

export default function BatchSubjectForm() {
    const { instituteDetails, getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const { isLoading } = useSuspenseQuery(useStudyLibraryQuery());
    const form = useFormContext<z.infer<typeof inviteUsersSchema>>();

    // State to track which batches are selected via checkbox
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    // State to track subject selections for each batch
    const [subjectSelections, setSubjectSelections] = useState<Record<string, string[]>>({});

    // Get batches from the store
    const batches =
        instituteDetails?.batches_for_sessions?.map((batch) => ({
            id: batch.id,
            name: `${batch.level.level_name} ${' '} ${batch.package_dto.package_name}, ${batch.session.session_name}`,
        })) || [];

    // Get subjects for a specific batch
    const getSubjectsByBatchId = (batchId: string) => {
        const batch = getDetailsFromPackageSessionId({ packageSessionId: batchId });
        const subjects = getCourseSubjects(
            batch?.package_dto?.id ?? '',
            batch?.session?.id ?? '',
            batch?.level?.id ?? ''
        );
        return subjects.map((subject) => ({
            label: subject.subject_name,
            value: subject.id,
        }));
    };

    // Toggle batch selection
    const toggleBatchSelection = (batchId: string) => {
        setSelectedBatches((prev) => {
            if (prev.includes(batchId)) {
                // Remove batch
                const newSelected = prev.filter((id) => id !== batchId);

                // Also clean up subject selections for this batch
                const newSubjectSelections = { ...subjectSelections };
                delete newSubjectSelections[batchId];
                setSubjectSelections(newSubjectSelections);

                return newSelected;
            } else {
                // Add batch
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
        // Clear existing batch_subject_mappings
        form.setValue('batch_subject_mappings', []);

        // Create new mappings based on selected batches
        const mappings = selectedBatches.map((batchId) => ({
            batchId,
            subjectIds: subjectSelections[batchId] || [],
        }));

        // Only update if we have mappings
        if (mappings.length > 0) {
            form.setValue('batch_subject_mappings', mappings);
        }
    }, [selectedBatches, subjectSelections, form]);

    if (isLoading) {
        return <Loader className="size-6 animate-spin text-primary-500" />;
    }

    return (
        <Card className="w-full">
            <CardHeader className="px-2 py-4">
                <CardTitle>Select Batch and Subjects</CardTitle>
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
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {batches.length === 0 && (
                    <div className="py-4 text-center text-muted-foreground">
                        No batches available
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
