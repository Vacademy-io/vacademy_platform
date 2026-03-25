import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState, Suspense } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle } from '@phosphor-icons/react';
import { addParticipantsSchema } from '../-schema/schema';
import { LiveSessionStudentListTab } from './LiveSessionStudentListTab';
import { FormField, FormItem, FormControl, FormLabel } from '@/components/ui/form';
import { DashboardLoader } from '@/components/core/dashboard-loader';

type FormData = z.infer<typeof addParticipantsSchema>;

interface Course {
    courseName: string;
    courseId: string;
    sessionId: string;
    levels: Array<{
        name: string;
        id: string;
    }>;
}

export function LiveSessionParticipantsTab({
    form,
    courses,
    currentSession,
}: {
    form: UseFormReturn<FormData>;
    courses: Course[] | undefined;
    currentSession: { id: string; name: string } | undefined;
}) {
    const [selectedTab, setSelectedTab] = useState(
        form.getValues('batchSelectionType') === 'individual' ? 'Individually' : 'Batch'
    );

    const handleChange = (value: string) => {
        setSelectedTab(value);
    };

    useEffect(() => {
        if (selectedTab === 'Batch') {
            form.setValue('batchSelectionType', 'batch');
        } else {
            form.setValue('batchSelectionType', 'individual');
        }
    }, [selectedTab, form]);

    return (
        <>
            <Tabs value={selectedTab} onValueChange={handleChange}>
                <TabsList className="mt-4 flex h-auto w-full flex-wrap justify-start border border-neutral-500 !bg-transparent p-0 sm:w-fit">
                    <TabsTrigger
                        value="Batch"
                        className={`flex gap-1.5 rounded-l-lg rounded-r-none p-2 pr-4 ${selectedTab === 'Batch'
                                ? '!bg-primary-100 !text-neutral-500'
                                : 'bg-transparent px-4'
                            }`}
                    >
                        {selectedTab === 'Batch' && (
                            <CheckCircle size={18} className="text-teal-800 dark:text-teal-400" />
                        )}
                        <span className={`${selectedTab === 'Batch' ? 'text-neutral-600' : ''}`}>
                            Select Batch
                        </span>
                    </TabsTrigger>
                    <Separator className="!h-9 bg-neutral-600" orientation="vertical" />
                    <TabsTrigger
                        value="Individually"
                        className={`flex gap-1.5 rounded-l-none rounded-r-lg p-2 ${selectedTab === 'Individually'
                                ? '!bg-primary-100 pr-4'
                                : 'bg-transparent px-4'
                            }`}
                    >
                        {selectedTab === 'Individually' && (
                            <CheckCircle size={18} className="text-teal-800 dark:text-teal-400" />
                        )}
                        <span
                            className={`${selectedTab === 'Individually' ? 'text-neutral-600' : ''
                                }`}
                        >
                            Select Individually
                        </span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="Batch" className="mt-6 flex justify-between">
                    <LiveSessionBatchList
                        courses={courses}
                        form={form}
                        currentSession={currentSession}
                    />
                </TabsContent>
                <TabsContent value="Individually">
                    <Suspense fallback={<DashboardLoader />}>
                        <LiveSessionStudentListTab form={form} />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </>
    );
}

const LiveSessionBatchList = ({
    courses,
    form,
    currentSession,
}: {
    courses: Course[] | undefined;
    form: UseFormReturn<FormData>;
    currentSession: { id: string; name: string } | undefined;
}) => {
    const { control, watch } = form;

    return (
        <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-10">
            {courses
                ?.filter((course) => course.sessionId === currentSession?.id)
                .map((course) => {
                    const fieldName = 'selectedLevels' as const;

                    // All level IDs for this course
                    const courseLevels = course.levels.map((level) => ({
                        courseId: course.courseId,
                        sessionId: course.sessionId,
                        levelId: level.id,
                    }));

                    // Is every level in this course selected?
                    const allSelected = courseLevels.every((levelItem) =>
                        watch(fieldName)?.some(
                            (selected) =>
                                selected.courseId === levelItem.courseId &&
                                selected.sessionId === levelItem.sessionId &&
                                selected.levelId === levelItem.levelId
                        )
                    );

                    return (
                        <div key={course.courseId} className="mb-6">
                            <FormField
                                control={control}
                                name={fieldName}
                                render={({ field }) => (
                                    <FormItem className="mb-2 flex flex-row items-center gap-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={(checked) => {
                                                    const updated = [...(field.value || [])];

                                                    if (checked) {
                                                        // Add all missing levels for this course
                                                        courseLevels.forEach((levelItem) => {
                                                            const exists = updated.some(
                                                                (item) =>
                                                                    item.courseId ===
                                                                    levelItem.courseId &&
                                                                    item.sessionId ===
                                                                    levelItem.sessionId &&
                                                                    item.levelId ===
                                                                    levelItem.levelId
                                                            );
                                                            if (!exists) updated.push(levelItem);
                                                        });
                                                    } else {
                                                        // Remove all levels for this course
                                                        for (const levelItem of courseLevels) {
                                                            const index = updated.findIndex(
                                                                (item) =>
                                                                    item.courseId ===
                                                                    levelItem.courseId &&
                                                                    item.sessionId ===
                                                                    levelItem.sessionId &&
                                                                    item.levelId ===
                                                                    levelItem.levelId
                                                            );
                                                            if (index > -1)
                                                                updated.splice(index, 1);
                                                        }
                                                    }

                                                    field.onChange(updated);
                                                }}
                                                className={`size-4 rounded-sm border-2 shadow-none ${allSelected
                                                        ? 'border-none bg-primary-500 text-white'
                                                        : ''
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-semibold">
                                            {course.courseName}
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />

                            <div className="ml-4 space-y-2">
                                {course.levels.map((level) => {
                                    const levelData = {
                                        courseId: course.courseId,
                                        sessionId: course.sessionId,
                                        levelId: level.id,
                                    };

                                    const isChecked = watch(fieldName)?.some(
                                        (item) =>
                                            item.courseId === levelData.courseId &&
                                            item.sessionId === levelData.sessionId &&
                                            item.levelId === levelData.levelId
                                    );

                                    return (
                                        <FormField
                                            key={`${course.courseId}-${level.id}`}
                                            control={control}
                                            name={fieldName}
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => {
                                                                const updated = [
                                                                    ...(field.value || []),
                                                                ];

                                                                if (checked) {
                                                                    updated.push(levelData);
                                                                } else {
                                                                    const index = updated.findIndex(
                                                                        (item) =>
                                                                            item.courseId ===
                                                                            levelData.courseId &&
                                                                            item.sessionId ===
                                                                            levelData.sessionId &&
                                                                            item.levelId ===
                                                                            levelData.levelId
                                                                    );
                                                                    if (index > -1)
                                                                        updated.splice(index, 1);
                                                                }

                                                                field.onChange(updated);
                                                            }}
                                                            className={`size-4 rounded-sm border-2 shadow-none ${isChecked
                                                                    ? 'border-none bg-primary-500 text-white'
                                                                    : ''
                                                                }`}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                        {level.name}
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
};
