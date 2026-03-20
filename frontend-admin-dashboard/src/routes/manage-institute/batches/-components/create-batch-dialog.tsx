import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { useState } from 'react';
import { CreateCourseStep } from './create-course-step';
import { CreateSessionStep } from './create-session-step';
import { CreateLevelStep } from './create-level-step';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAddCourse } from '@/services/study-library/course-operations/add-course';
import { CourseFormData } from '@/components/common/study-library/add-course/add-course-form';
import { useCopyStudyMaterialFromSession } from '../../../manage-students/students-list/-services/copyStudyMaterialFromSession';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { Plus } from '@phosphor-icons/react';

interface FormData {
    // Course step
    courseCreationType: 'existing' | 'new';
    selectedCourse: { id: string; name: string } | null;

    // Session step
    sessionCreationType: 'existing' | 'new';
    selectedSession: { id: string; name: string } | null;
    selectedStartDate: string | null;

    // Level step
    levelCreationType: 'existing' | 'new';
    selectedLevel: { id: string; name: string } | null;
    selectedLevelDuration: number | null;
    duplicateStudyMaterials: boolean;
    selectedDuplicateSession: { id: string; name: string } | null;
}

export const CreateBatchDialog = () => {
    const triggerButton = (
        <MyButton scale="medium" buttonType="primary" className="flex items-center">
            <Plus size={18} className="mr-2" /> Create Batch
        </MyButton>
    );
    const [currentStep, setCurrentStep] = useState(0);
    const [openManageBatchDialog, setOpenManageBatchDialog] = useState(false);
    const addCourseMutation = useAddCourse();
    const handleOpenManageBatchDialog = (open: boolean) => setOpenManageBatchDialog(open);
    const copyStudyMaterialFromSession = useCopyStudyMaterialFromSession();
    const { getPackageSessionId } = useInstituteDetailsStore();
    // Set up the form with default values
    const methods = useForm<FormData>({
        defaultValues: {
            // Course step
            courseCreationType: 'existing',
            selectedCourse: null,

            // Session step
            sessionCreationType: 'existing',
            selectedSession: null,
            selectedStartDate: null,

            // Level step
            levelCreationType: 'existing',
            selectedLevel: null,
            selectedLevelDuration: null,
            duplicateStudyMaterials: false,
            selectedDuplicateSession: null,
        },
    });

    const nextStep = () => {
        // Validate current step before proceeding
        if (currentStep === 0) {
            methods.trigger(['courseCreationType', 'selectedCourse']).then((isValid) => {
                if (isValid) setCurrentStep(currentStep + 1);
            });
        } else if (currentStep === 1) {
            methods.trigger(['sessionCreationType', 'selectedSession']).then((isValid) => {
                if (isValid) setCurrentStep(currentStep + 1);
            });
        } else {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => setCurrentStep(currentStep - 1);

    const handleAddCourse = ({
        requestData,
        duplicateFromSession,
        duplicationSessionId,
        courseId,
        levelId,
        sessionId,
    }: {
        requestData: CourseFormData;
        duplicateFromSession: boolean;
        duplicationSessionId: string;
        courseId: string;
        levelId: string;
        sessionId: string;
    }) => {
        console.log(' inside handleAddCourse:');
        addCourseMutation.mutate(
            { requestData: requestData },
            {
                onSuccess: (responseData) => {
                    if (duplicateFromSession) {
                        setTimeout(() => {
                            const toPackageSessionId = getPackageSessionId({
                                courseId: responseData.data,
                                levelId: levelId,
                                sessionId: sessionId,
                            });
                            const fromPackageSessionId = getPackageSessionId({
                                courseId: courseId,
                                levelId: levelId,
                                sessionId: duplicationSessionId,
                            });
                            copyStudyMaterialFromSession.mutate(
                                {
                                    fromPackageSessionId: fromPackageSessionId || '',
                                    toPackageSessionId: toPackageSessionId || '',
                                },
                                {
                                    onSuccess: () => {
                                        toast.success('Study material copied successfully');
                                    },
                                    onError: (error) => {
                                        toast.error(
                                            error.message || 'Failed to copy study material'
                                        );
                                    },
                                }
                            );
                        }, 3000);
                    }

                    // responseData contains the API response
                    toast.success('Batch created successfully');
                    handleOpenManageBatchDialog(false);
                    setCurrentStep(0);
                    // Reset form data
                    methods.reset({
                        courseCreationType: 'existing',
                        selectedCourse: null,
                        sessionCreationType: 'existing',
                        selectedSession: null,
                        selectedStartDate: null,
                        levelCreationType: 'existing',
                        selectedLevel: null,
                        selectedLevelDuration: null,
                        duplicateStudyMaterials: false,
                        selectedDuplicateSession: null,
                    });
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to create batch');
                },
            }
        );
    };

    const submit = () => {
        methods.handleSubmit((data) => {
            // Handle submission here
            const levelData =
                data.levelCreationType === 'new'
                    ? {
                          id: data.selectedLevel?.id || '',
                          new_level: true,
                          level_name: data.selectedLevel?.name || '',
                          duration_in_days: data.selectedLevelDuration || null,
                          thumbnail_id: null,
                          package_id: data.selectedCourse?.id || '',
                      }
                    : {
                          id: data.selectedLevel?.id || '',
                          new_level: false,
                          level_name: data.selectedLevel?.name || '',
                          duration_in_days: data.selectedLevelDuration || null,
                          thumbnail_id: null,
                          package_id: data.selectedCourse?.id || '',
                      };

            const sessionData =
                data.sessionCreationType === 'new'
                    ? {
                          id: data.selectedSession?.id || '',
                          new_session: true,
                          session_name: data.selectedSession?.name || '',
                          start_date: data.selectedStartDate || '',
                          levels: [levelData],
                          status: 'ACTIVE',
                          duplicate_from_session_id: data.duplicateStudyMaterials
                              ? data.selectedDuplicateSession?.id
                              : undefined,
                      }
                    : {
                          id: data.selectedSession?.id || '',
                          new_session: false,
                          session_name: data.selectedSession?.name || '',
                          start_date: data.selectedStartDate || '',
                          levels: [levelData],
                          status: 'ACTIVE',
                          duplicate_from_session_id: data.duplicateStudyMaterials
                              ? data.selectedDuplicateSession?.id
                              : undefined,
                      };

            const courseData: CourseFormData =
                data.courseCreationType === 'new'
                    ? {
                          id: data.selectedCourse?.id || '',
                          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                          // @ts-expect-error
                          course_name: data.selectedCourse?.name || '',
                          thumbnail_file_id: '',
                          new_course: true,
                          contain_levels: true,
                          sessions: [sessionData],
                      }
                    : {
                          id: data.selectedCourse?.id || '',
                          course_name: data.selectedCourse?.name || '',
                          thumbnail_file_id: '',
                          new_course: false,
                          contain_levels: true,
                          sessions: [sessionData],
                      };
            console.log('going inside handleAddCourse:');
            handleAddCourse({
                requestData: courseData,
                duplicateFromSession: data.duplicateStudyMaterials,
                duplicationSessionId: data.selectedDuplicateSession?.id || '',
                courseId: data.selectedCourse?.id || '',
                levelId: data.selectedLevel?.id || '',
                sessionId: data.selectedSession?.id || '',
            });
        })();
    };

    const backButton = (
        <MyButton buttonType="secondary" onClick={prevStep} className="font-normal">
            Back
        </MyButton>
    );

    const nextButtonText = currentStep === 2 ? 'Create Batch' : 'Next Step';
    const nextButtonIcon = currentStep === 2 ? <Plus size={18} className="mr-1.5" /> : null;

    const nextButton = (
        <MyButton
            onClick={() => {
                currentStep === 2 ? submit() : nextStep();
            }}
            buttonType={currentStep === 2 ? 'secondary' : 'text'}
            className={
                currentStep === 2
                    ? 'font-semibold text-neutral-700'
                    : 'text-primary-600 hover:text-primary-700 font-semibold'
            }
        >
            {nextButtonIcon}
            {nextButtonText}
        </MyButton>
    );

    const footer =
        currentStep !== 0 ? (
            <div className="flex w-full items-center justify-between">
                {backButton}
                {nextButton}
            </div>
        ) : (
            <div className="flex justify-end">{nextButton}</div>
        );

    const steps = [
        <CreateCourseStep key="course" handleOpenManageBatchDialog={handleOpenManageBatchDialog} />,
        <CreateSessionStep key="session" />,
        <CreateLevelStep key="level" />,
    ];

    const stepTitles = ['Select Course', 'Select Session', 'Select Level'];

    return (
        <MyDialog
            trigger={triggerButton}
            heading={`Create Batch - Step ${currentStep + 1}: ${stepTitles[currentStep]}`}
            footer={footer}
            dialogWidth="w-[600px]"
            open={openManageBatchDialog}
            onOpenChange={handleOpenManageBatchDialog}
            className="px-8 pb-8 pt-6"
        >
            <FormProvider {...methods}>
                <form onSubmit={methods.handleSubmit(submit)} className="space-y-6">
                    {steps[currentStep]}
                </form>
            </FormProvider>
        </MyDialog>
    );
};
