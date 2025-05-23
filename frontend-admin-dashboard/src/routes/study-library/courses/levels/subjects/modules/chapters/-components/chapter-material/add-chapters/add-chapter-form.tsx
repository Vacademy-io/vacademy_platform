import { ControllerRenderProps, useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { ChapterWithSlides } from '@/stores/study-library/use-modules-with-chapters-store';
import { useAddChapter } from '@/routes/study-library/courses/levels/subjects/modules/chapters/-services/add-chapter';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useUpdateChapter } from '@/routes/study-library/courses/levels/subjects/modules/chapters/-services/update-chapter';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { levelsWithPackageDetails } from '@/schemas/student/student-list/institute-schema';
import { Checkbox } from '@/components/ui/checkbox';
import { useGetPackageSessionId } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getPackageSessionId';

const formSchema = z.object({
    chapterName: z.string().min(1, 'Chapter name is required'),
    visibility: z.record(z.string(), z.array(z.string())),
});

type FormValues = z.infer<typeof formSchema>;

interface AddChapterFormProps {
    initialValues?: ChapterWithSlides;
    onSubmitSuccess: () => void;
    mode: 'create' | 'edit';
    module_id?: string;
    session_id?: string;
}

export const AddChapterForm = ({
    initialValues,
    onSubmitSuccess,
    mode,
    module_id,
    session_id,
}: AddChapterFormProps) => {
    const router = useRouter();
    const courseId: string = router.state.location.search.courseId || '';
    const levelId: string = router.state.location.search.levelId || '';
    const sessionId: string = router.state.location.search.sessionId || session_id || '';
    const moduleId: string = router.state.location.search.moduleId || module_id || '';
    const addChapterMutation = useAddChapter();
    const updateChapterMutation = useUpdateChapter();
    const package_session_id = useGetPackageSessionId(courseId, sessionId, levelId) || '';
    const { getPackageWiseLevels, getPackageSessionId } = useInstituteDetailsStore();

    // Get courses from current sessionId
    const currentSessionCourses = getPackageWiseLevels({
        sessionId: sessionId,
    });

    // Get courses from DEFAULT sessionId
    const defaultSessionCourses =
        sessionId !== 'DEFAULT'
            ? getPackageWiseLevels({
                  sessionId: 'DEFAULT',
              })
            : [];

    // Combine both sets of courses while avoiding duplicates by package ID
    const combinedCourses = [...currentSessionCourses];

    // Add default courses only if they don't already exist in current session
    defaultSessionCourses.forEach((defaultCourse) => {
        if (
            !combinedCourses.some(
                (course) => course.package_dto.id === defaultCourse.package_dto.id
            )
        ) {
            combinedCourses.push(defaultCourse);
        }
    });

    // Use the combined courses list for everything
    const coursesWithLevels = combinedCourses;

    // Create default visibility object
    const defaultVisibility = coursesWithLevels.reduce(
        (acc, course) => {
            acc[course.package_dto.id] = [];
            return acc;
        },
        {} as Record<string, string[]>
    );

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            chapterName: initialValues?.chapter.chapter_name || '',
            visibility: initialValues?.chapter_in_package_sessions
                ? initialValues.chapter_in_package_sessions.reduce(
                      (acc, psId) => {
                          // Find which course this packageSessionId belongs to
                          for (const course of coursesWithLevels) {
                              const isDefaultSessionCourse = defaultSessionCourses.some(
                                  (defaultCourse) =>
                                      defaultCourse.package_dto.id === course.package_dto.id
                              );
                              const courseSessionId = isDefaultSessionCourse
                                  ? 'DEFAULT'
                                  : sessionId;

                              for (const level of course.level) {
                                  const coursePackageSessionId = getPackageSessionId({
                                      courseId: course.package_dto.id,
                                      sessionId: courseSessionId,
                                      levelId: level.level_dto.id,
                                  });

                                  if (coursePackageSessionId === psId) {
                                      // Add to that course's array
                                      acc[course.package_dto.id] = [
                                          ...(acc[course.package_dto.id] || []),
                                          psId,
                                      ];
                                      break;
                                  }
                              }
                          }
                          return acc;
                      },
                      { ...defaultVisibility }
                  )
                : {
                      ...defaultVisibility,
                      [courseId]: package_session_id ? [package_session_id] : [],
                  },
        },
    });

    const handleSelectAllForCourse = (
        courseId: string,
        levels: levelsWithPackageDetails,
        field: ControllerRenderProps<FormValues, `visibility.${string}`>,
        isDefaultSessionCourse: boolean
    ) => {
        const courseSessionId = isDefaultSessionCourse ? 'DEFAULT' : sessionId;

        const allPackageSessionIds = levels
            .map((level) => {
                const psId = getPackageSessionId({
                    courseId: courseId,
                    sessionId: courseSessionId,
                    levelId: level.level_dto.id,
                });
                return psId;
            })
            .filter((id): id is string => id !== null);

        const areAllSelected = allPackageSessionIds.every((psId) => field.value?.includes(psId));

        field.onChange(areAllSelected ? [] : allPackageSessionIds);
    };

    const onSubmit = async (data: FormValues) => {
        try {
            const selectedPackageSessionIds = Object.values(data.visibility).flat().join(',');
            if (!selectedPackageSessionIds) {
                toast.error('Please select at least one package for visibility');
                return;
            }

            if (mode === 'create') {
                const newChapter = {
                    id: crypto.randomUUID(),
                    chapter_name: data.chapterName,
                    status: 'true',
                    file_id: '',
                    description:
                        'Click to view and access eBooks and video lectures for this chapter.',
                    chapter_order: 0,
                };

                await addChapterMutation.mutateAsync({
                    moduleId,
                    commaSeparatedPackageSessionIds: selectedPackageSessionIds,
                    chapter: newChapter,
                });

                toast.success('Chapter added successfully');
            } else {
                if (!initialValues) {
                    toast.error('No chapter to update');
                    return;
                }

                const updatedChapter = {
                    ...initialValues.chapter,
                    chapter_name: data.chapterName,
                };

                await updateChapterMutation.mutateAsync({
                    chapterId: initialValues.chapter.id,
                    moduleId: moduleId,
                    commaSeparatedPackageSessionIds: selectedPackageSessionIds,
                    chapter: updatedChapter,
                });

                toast.success('Chapter updated successfully');
            }

            onSubmitSuccess();
        } catch (error) {
            console.error('Error handling chapter:', error);
            toast.error(`Failed to ${mode} chapter. Please try again.`);
        }
    };

    const isPending =
        mode === 'create' ? addChapterMutation.isPending : updateChapterMutation.isPending;

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex max-h-[80vh] w-full flex-col gap-6 p-3 text-neutral-600"
            >
                {/* Chapter Name field */}
                <FormField
                    control={form.control}
                    name="chapterName"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    label="Chapter Name"
                                    required={true}
                                    inputType="text"
                                    className="w-full"
                                    input={field.value}
                                    onChangeFunction={(e) => field.onChange(e.target.value)}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <div className="flex flex-col gap-2 overflow-y-auto">
                    <div className="text-subtitle font-semibold">Chapter Visibility</div>
                    <div className="text-body text-neutral-500">
                        Select the levels you want to grant access to this chapter. Only the chosen
                        levels will be able to view the content. You can update visibility at any
                        time.
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {coursesWithLevels.map((course) => {
                            // Determine if this course is from DEFAULT session
                            const isDefaultSessionCourse = defaultSessionCourses.some(
                                (defaultCourse) =>
                                    defaultCourse.package_dto.id === course.package_dto.id
                            );

                            return (
                                <FormField
                                    key={course.package_dto.id}
                                    control={form.control}
                                    name={`visibility.${course.package_dto.id}`}
                                    render={({ field }) => {
                                        // Use the appropriate sessionId based on course source
                                        const courseSessionId = isDefaultSessionCourse
                                            ? 'DEFAULT'
                                            : sessionId;

                                        const levelPackageSessionIds = course.level
                                            .map((level) =>
                                                getPackageSessionId({
                                                    courseId: course.package_dto.id,
                                                    sessionId: courseSessionId,
                                                    levelId: level.level_dto.id,
                                                })
                                            )
                                            .filter((id): id is string => id !== null);

                                        const allSelected = levelPackageSessionIds.every((psId) =>
                                            field.value?.includes(psId)
                                        );

                                        return (
                                            <FormItem
                                                key={course.package_dto.id}
                                                className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        className="bg-white"
                                                        checked={allSelected}
                                                        onCheckedChange={() => {
                                                            handleSelectAllForCourse(
                                                                course.package_dto.id,
                                                                course.level,
                                                                field,
                                                                isDefaultSessionCourse
                                                            );
                                                        }}
                                                        aria-label="Select all"
                                                    />
                                                    <span className="font-semibold">
                                                        {course.package_dto.package_name}
                                                        {isDefaultSessionCourse && ' (Default)'}
                                                    </span>
                                                </div>

                                                {/* Only show level checkboxes for non-DEFAULT session courses */}
                                                {!isDefaultSessionCourse && (
                                                    <FormControl>
                                                        <div className="flex flex-col gap-2 pl-6">
                                                            {course.level.map((level) => {
                                                                const packageSessionId =
                                                                    getPackageSessionId({
                                                                        courseId:
                                                                            course.package_dto.id,
                                                                        sessionId: courseSessionId,
                                                                        levelId: level.level_dto.id,
                                                                    });

                                                                return (
                                                                    <label
                                                                        key={level.level_dto.id}
                                                                        className="flex items-center gap-2"
                                                                    >
                                                                        <Checkbox
                                                                            checked={
                                                                                packageSessionId
                                                                                    ? (
                                                                                          field.value ||
                                                                                          []
                                                                                      ).includes(
                                                                                          packageSessionId
                                                                                      )
                                                                                    : false
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked: boolean
                                                                            ) => {
                                                                                if (
                                                                                    !packageSessionId
                                                                                )
                                                                                    return;

                                                                                const newValue =
                                                                                    checked
                                                                                        ? [
                                                                                              ...(field.value ||
                                                                                                  []),
                                                                                              packageSessionId,
                                                                                          ]
                                                                                        : (
                                                                                              field.value ||
                                                                                              []
                                                                                          ).filter(
                                                                                              (
                                                                                                  id
                                                                                              ) =>
                                                                                                  id !==
                                                                                                  packageSessionId
                                                                                          );

                                                                                field.onChange(
                                                                                    newValue
                                                                                );
                                                                            }}
                                                                        />
                                                                        <span className="text-sm">
                                                                            {
                                                                                level.level_dto
                                                                                    .level_name
                                                                            }
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </FormControl>
                                                )}
                                            </FormItem>
                                        );
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Submit button */}
                <div className="flex w-full items-center justify-end bg-white">
                    <MyButton
                        type="submit"
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        className="w-fit"
                        disabled={isPending}
                    >
                        {isPending
                            ? `${mode === 'create' ? 'Adding' : 'Updating'}...`
                            : mode === 'create'
                              ? 'Add Chapter'
                              : 'Edit Chapter'}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
