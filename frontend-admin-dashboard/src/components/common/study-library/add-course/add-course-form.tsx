import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
// add-course-form.tsx
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { AddCourseStep1, step1Schema } from './add-course-steps/add-course-step1';
import { AddCourseStep2, step2Schema } from './add-course-steps/add-course-step2';
import { toast } from 'sonner';
import {
    convertToApiCourseFormat,
    convertToApiCourseFormatUpdate,
    SessionDetails,
    transformCourseData,
} from '../-utils/helper';
import { useAddCourse } from '@/services/study-library/course-operations/add-course';
import { useNavigate } from '@tanstack/react-router';
import { useAddSubject } from '@/routes/study-library/courses/course-details/subjects/-services/addSubject';
import { useAddModule } from '@/routes/study-library/courses/course-details/subjects/modules/-services/add-module';
import { useAddChapter } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/-services/add-chapter';
import { SubjectType } from '@/routes/study-library/courses/course-details/-components/course-details-page';
import { fetchInstituteDetails } from '@/services/student-list-section/getInstituteDetails';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '../../layout-container/sidebar/utils';
import { CourseDetailsFormValues } from '@/routes/study-library/courses/course-details/-components/course-details-schema';
import { useUpdateCourse } from '@/services/study-library/course-operations/update-course';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useCourseSettings } from '@/hooks/useCourseSettings';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
} from '@/types/display-settings';
import {
    getDisplaySettingsFromCache,
    getDisplaySettingsWithFallback,
} from '@/services/display-settings';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_COURSE_BATCHES } from '@/constants/urls';

export interface Level {
    id: string;
    name: string;
}

export interface Session {
    id: string;
    name: string;
    startDate: string;
    levels: Level[];
}

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;

// Combined form data type
export interface CourseFormData extends Step1Data, Step2Data {
    status?: string;
    created_by_user_id?: string;
    original_course_id?: string | null;
    version_number?: number;
}

// Main wrapper component
export const AddCourseForm = ({
    isEdit,
    initialCourseData,
    getParentPackageSessionId,
}: {
    isEdit?: boolean;
    initialCourseData?: CourseDetailsFormValues;
    /** When editing, use this to send the parent batch id per (session, level) for update-course-details. */
    getParentPackageSessionId?: (params: {
        courseId: string;
        sessionId: string;
        levelId: string;
    }) => string;
}) => {
    const { getPackageSessionId } = useInstituteDetailsStore();
    const addSubjectMutation = useAddSubject();
    const addModuleMutation = useAddModule();
    const addChapterMutation = useAddChapter();
    const { settings: courseSettings, loading: settingsLoading } = useCourseSettings();
    const [roleDisplaySettings, setRoleDisplaySettings] = useState<DisplaySettingsData | null>(
        null
    );

    useEffect(() => {
        let isMounted = true;

        const loadDisplaySettings = async () => {
            try {
                const accessToken = getTokenFromCookie(TokenKey.accessToken);
                const roles = getUserRoles(accessToken);
                const hasFaculty = hasFacultyAssignedPermission(getInstituteId());
    const roleKey = getActiveRoleDisplaySettingsKey();

                const cached = getDisplaySettingsFromCache(roleKey);
                if (cached && isMounted) {
                    setRoleDisplaySettings(cached);
                }

                const latest = await getDisplaySettingsWithFallback(roleKey);
                if (isMounted) {
                    setRoleDisplaySettings(latest);
                }
            } catch (error) {
                console.error('Failed to load display settings for course creation', error);
            }
        };

        loadDisplaySettings();

        return () => {
            isMounted = false;
        };
    }, []);

    const navigate = useNavigate();
    const addCourseMutation = useAddCourse();
    const updateCourseMutation = useUpdateCourse();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<CourseFormData>>(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        initialCourseData ? transformCourseData(initialCourseData) : {}
    );

    const oldFormData = useRef<Partial<CourseFormData>>(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        initialCourseData ? transformCourseData(initialCourseData) : {}
    );
    const lastLoadedCourseIdRef = useRef<string | undefined>(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        initialCourseData?.courseData?.id
    );

    const [isOpen, setIsOpen] = useState(!isEdit);
    const [isCreating, setIsCreating] = useState(false);

    // When editing, ensure the internal step-2 state is refreshed whenever the
    // user opens Edit Course on a different course. Previously, the state was
    // initialised only once, so the dialog could show data for a previously
    // visited course.
    useEffect(() => {
        if (!isEdit || !initialCourseData) return;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        const currentCourseId: string | undefined = initialCourseData.courseData?.id;
        if (!currentCourseId || lastLoadedCourseIdRef.current === currentCourseId) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const transformed = transformCourseData(initialCourseData) as CourseFormData;
        lastLoadedCourseIdRef.current = currentCourseId;
        setFormData(transformed);
        oldFormData.current = transformed;
        setStep(1);
    }, [isEdit, initialCourseData]);

    const handleStep1Submit = (data: Step1Data) => {
        setFormData((prev) => ({ ...prev, ...data }));
        setStep(2);
    };

    function findIdByPackageId(data: BatchForSessionType[], packageId: string): string {
        return data
            .filter((item) => item.package_dto?.id === packageId)
            .map((item) => item.id)
            .join(',');
    }

    function retainNewActiveLevels(sessions: SessionDetails[]) {
        return sessions.map((session) => ({
            ...session,
            levels: (session.levels ?? []).filter(
                (level) => level.new_level === false && level.package_session_status === 'ACTIVE'
            ),
        }));
    }

    function findUnmatchedBatchIds(
        sessionsData: SessionDetails[],
        batchesData: BatchForSessionType[],
        courseId?: string
    ): string[] {
        /* ------- build a fast‑lookup map: sessionId → Set(levelIds) ------- */
        const sessionLevelMap = new Map<string, Set<string>>();

        sessionsData.forEach((session) => {
            const levels = session.levels ?? [];
            sessionLevelMap.set(session.id, new Set(levels.map((l) => l.id)));
        });

        /* ------- walk the batches and collect the “missing” ones ------- */
        return batchesData
            .filter((batch) => {
                if (courseId && batch.package_dto?.id !== courseId) return false; // course filter
                const levelSet = sessionLevelMap.get(batch.session.id);
                return !levelSet || !levelSet.has(batch.level.id); // session missing OR level missing
            })
            .map((batch) => batch.id);
    }

    const handleStep2Submit = (data: Step2Data) => {
        setIsCreating(true);
        const newSubject: SubjectType = {
            id: '', // Let backend assign ID
            subject_name: 'DEFAULT',
            subject_code: '',
            credit: 0,
            thumbnail_id: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            modules: [], // Add empty modules array
        };

        const newModule = {
            id: '',
            module_name: 'DEFAULT',
            description: '',
            status: '',
            thumbnail_id: '',
        };

        const newChapter = {
            id: '', // Let backend assign ID
            chapter_name: 'DEFAULT',
            status: 'ACTIVE',
            file_id: '',
            description: '',
            chapter_order: 0,
        };

        const finalData = { ...formData, ...data };

        // Format the data using the helper function
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const formattedData = convertToApiCourseFormat(finalData);
        const formattedDataUpdate = convertToApiCourseFormatUpdate(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            oldFormData.current,
            finalData,
            isEdit && getParentPackageSessionId
                ? getParentPackageSessionId
                : getPackageSessionId
        );

        const previousSessions = retainNewActiveLevels(formattedDataUpdate.sessions);

        if (isEdit) {
            updateCourseMutation.mutate(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                { requestData: formattedDataUpdate },
                {
                    onSuccess: async () => {
                        try {
                            const instituteDetails = await fetchInstituteDetails();

                            // Wait for institute details and validate
                            if (!instituteDetails?.batches_for_sessions) {
                                console.warn(
                                    'Institute details not loaded, skipping structure creation'
                                );
                                toast.success(
                                    `${getTerminology(ContentTerms.Course, SystemTerms.Course)} updated successfully`
                                );
                                setIsOpen(false);
                                setStep(1);
                                setFormData({});
                                return;
                            }

                            const unmatchedPackageSessionIds = findUnmatchedBatchIds(
                                previousSessions,
                                instituteDetails.batches_for_sessions,
                                formattedDataUpdate.id
                            );

                            // Only create structure if there are unmatched batches
                            if (unmatchedPackageSessionIds.length > 0) {
                                const packageSessionIdsStr = unmatchedPackageSessionIds.join(',');

                                if (formattedData.course_depth === 2) {
                                    const subjectResponse = await addSubjectMutation.mutateAsync({
                                        subject: newSubject,
                                        packageSessionIds: packageSessionIdsStr,
                                    });

                                    const moduleResponse = await addModuleMutation.mutateAsync({
                                        subjectId: subjectResponse.data.id,
                                        packageSessionIds: packageSessionIdsStr,
                                        module: newModule,
                                    });

                                    await addChapterMutation.mutateAsync({
                                        subjectId: subjectResponse.data.id,
                                        moduleId: moduleResponse.data.id,
                                        commaSeparatedPackageSessionIds: packageSessionIdsStr,
                                        chapter: newChapter,
                                    });
                                } else if (formattedData.course_depth === 3) {
                                    const subjectResponse = await addSubjectMutation.mutateAsync({
                                        subject: newSubject,
                                        packageSessionIds: packageSessionIdsStr,
                                    });

                                    await addModuleMutation.mutateAsync({
                                        subjectId: subjectResponse.data.id,
                                        packageSessionIds: packageSessionIdsStr,
                                        module: newModule,
                                    });
                                } else if (formattedData.course_depth === 4) {
                                    await addSubjectMutation.mutateAsync({
                                        subject: newSubject,
                                        packageSessionIds: packageSessionIdsStr,
                                    });
                                }
                            } else {
                                console.log(
                                    'No unmatched batches found - skipping structure creation'
                                );
                            }

                            toast.success(
                                `${getTerminology(ContentTerms.Course, SystemTerms.Course)} updated successfully`
                            );
                            setIsOpen(false);
                            setStep(1);
                            setFormData({});
                        } catch (err) {
                            console.error('Error in course update flow:', err);
                            toast.error(
                                `Failed to update ${getTerminology(ContentTerms.Course, SystemTerms.Course)}`
                            );
                        }
                    },
                    onError: () => {
                        toast.error(
                            `Failed to update ${getTerminology(ContentTerms.Course, SystemTerms.Course)}`
                        );
                        setIsCreating(false);
                    },
                }
            );
        } else {
            addCourseMutation.mutate(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                { requestData: formattedData },
                {
                    onSuccess: async (response) => {
                        try {
                            let packageSessionId = '';

                            try {
                                await new Promise((resolve) => setTimeout(resolve, 1500));
                                const batchesResponse = await authenticatedAxiosInstance.get(
                                    `${GET_COURSE_BATCHES}/${response.data}/batches`
                                );

                                if (batchesResponse.data && batchesResponse.data.length > 0) {
                                    packageSessionId = batchesResponse.data.map((batch: any) => batch.id).join(',');
                                }
                            } catch (error) {
                                console.warn('Failed to get course batches directly:', error);
                            }

                            if (!packageSessionId) {
                                const instituteDetails = await fetchInstituteDetails();
                                if (!instituteDetails?.batches_for_sessions) {
                                    throw new Error('Institute details not loaded');
                                }
                                packageSessionId = findIdByPackageId(
                                    instituteDetails.batches_for_sessions,
                                    response.data
                                );
                                if (!packageSessionId) {
                                    throw new Error(
                                        'Package session ID not found for the created course'
                                    );
                                }
                            }

                            if (formattedData.course_depth === 2) {
                                const subjectResponse = await addSubjectMutation.mutateAsync({
                                    subject: newSubject,
                                    packageSessionIds: packageSessionId,
                                });

                                const moduleResponse = await addModuleMutation.mutateAsync({
                                    subjectId: subjectResponse.data.id,
                                    packageSessionIds: packageSessionId,
                                    module: newModule,
                                });

                                await addChapterMutation.mutateAsync({
                                    subjectId: subjectResponse.data.id,
                                    moduleId: moduleResponse.data.id,
                                    commaSeparatedPackageSessionIds: packageSessionId,
                                    chapter: newChapter,
                                });
                            } else if (formattedData.course_depth === 3) {
                                const subjectResponse = await addSubjectMutation.mutateAsync({
                                    subject: newSubject,
                                    packageSessionIds: packageSessionId,
                                });

                                await addModuleMutation.mutateAsync({
                                    subjectId: subjectResponse.data.id,
                                    packageSessionIds: packageSessionId,
                                    module: newModule,
                                });
                            } else if (formattedData.course_depth === 4) {
                                await addSubjectMutation.mutateAsync({
                                    subject: newSubject,
                                    packageSessionIds: packageSessionId,
                                });
                            }

                            toast.success(
                                `${getTerminology(ContentTerms.Course, SystemTerms.Course)}` +
                                ' created successfully'
                            );
                            setIsOpen(false);
                            setStep(1);
                            setFormData({});
                            navigate({
                                to: `/study-library/courses/course-details?courseId=${response.data}`,
                            });
                        } catch (err) {
                            console.error('Error in course creation flow:', err);
                            toast.error(
                                err instanceof Error
                                    ? err.message
                                    : `Error creating ${getTerminology(ContentTerms.Course, SystemTerms.Course)}`
                            );
                        } finally {
                            setIsCreating(false);
                        }
                    },
                    onError: () => {
                        toast.error(
                            `Failed to create ${getTerminology(ContentTerms.Course, SystemTerms.Course)}`
                        );
                        setIsCreating(false);
                    },
                }
            );
        }
    };

    const handleBack = () => {
        setStep(1);
    };

    // For non-edit mode, render the form directly without dialog
    if (!isEdit) {
        return (
            <div className="flex h-full flex-col">
                <h1 className="bg-primary-50 p-4 font-semibold text-primary-500">
                    Create {getTerminology(ContentTerms.Course, SystemTerms.Course)} - Step {step}{' '}
                    of 2
                </h1>
                {step === 1 ? (
                    <AddCourseStep1
                        onNext={handleStep1Submit}
                        initialData={formData as Step1Data}
                        courseSettings={courseSettings}
                        settingsLoading={settingsLoading}
                    />
                ) : (
                    <AddCourseStep2
                        onBack={handleBack}
                        onSubmit={handleStep2Submit}
                        initialData={formData as Step2Data}
                        isLoading={isCreating}
                        disableCreate={isCreating}
                        isEdit={isEdit}
                        courseSettings={courseSettings}
                        settingsLoading={settingsLoading}
                        courseCreationDisplay={roleDisplaySettings?.courseCreation}
                    />
                )}
            </div>
        );
    }

    // For edit mode, use the dialog
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger className="flex w-full ">
                <MyButton
                    type="button"
                    buttonType="secondary"
                    layoutVariant="default"
                    scale="small"
                    className="my-6 bg-white py-5 !font-semibold hover:bg-white"
                >
                    Edit {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                </MyButton>
            </DialogTrigger>
            <DialogContent className="z-[10000] flex !h-[97%] !max-h-[97%] w-[97%] flex-col overflow-hidden p-0">
                <div className="flex h-full flex-col">
                    <h1 className="bg-primary-50 p-4 font-semibold text-primary-500">
                        Create {getTerminology(ContentTerms.Course, SystemTerms.Course)} - Step{' '}
                        {step} of 2
                    </h1>
                    {step === 1 ? (
                        <AddCourseStep1
                            onNext={handleStep1Submit}
                            initialData={formData as Step1Data}
                            courseSettings={courseSettings}
                            settingsLoading={settingsLoading}
                        />
                    ) : (
                        <AddCourseStep2
                            onBack={handleBack}
                            onSubmit={handleStep2Submit}
                            initialData={formData as Step2Data}
                            isLoading={isCreating}
                            disableCreate={isCreating}
                            isEdit={isEdit}
                            courseSettings={courseSettings}
                            settingsLoading={settingsLoading}
                            courseCreationDisplay={roleDisplaySettings?.courseCreation}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
