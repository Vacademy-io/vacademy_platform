import { useEffect, useState } from 'react';
import { SubjectProgress } from './chapter-details/subject-progress';
import { useStudentSubjectsProgressQuery } from '@/routes/manage-students/students-list/-services/getStudentSubjects';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { BatchPicker } from '../BatchPicker';
import {
    ModulesWithChaptersProgressType,
    SubjectWithDetails,
} from '@/routes/manage-students/students-list/-types/student-subjects-details-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { Separator } from '@/components/ui/separator';
import { MyButton } from '@/components/design-system/button';
import calculateLearningPercentage from '@/routes/manage-students/students-list/-utils/calculateLearningPercentage';
import { PercentCompletionStatus } from './PercentCompletionStatus';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import SelectField from '@/components/design-system/select-field';
import { useForm, FormProvider } from 'react-hook-form';
import { useRouter } from '@tanstack/react-router';

export const StudentLearningProgress = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const [currentSubjectDetails, setCurrentSubjectDetails] = useState<SubjectWithDetails | null>(
        null
    );
    const [currentModuleDetails, setCurrentModuleDetails] =
        useState<ModulesWithChaptersProgressType | null>(null);

    const { selectedStudent } = useStudentSidebar();
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const [batch, setBatch] = useState<BatchForSessionType | null>(null);
    const [percentageCompleted, setPercentageCompleted] = useState<number>(0);
    const router = useRouter();

    // Multi-enrollment: admin scopes the progress view to a specific batch.
    // Defaults to the row's primary (latest) ps_id; falls back to the legacy single field.
    const enrollmentPsIds: string[] = (selectedStudent?.all_package_session_ids?.length
        ? selectedStudent.all_package_session_ids
        : selectedStudent?.package_session_id
          ? [selectedStudent.package_session_id]
          : []) as string[];
    const [selectedPsId, setSelectedPsId] = useState<string>(enrollmentPsIds[0] ?? '');
    useEffect(() => {
        setSelectedPsId(enrollmentPsIds[0] ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStudent?.user_id]);
    const activePsId = isSubmissionTab
        ? selectedStudent?.package_id || ''
        : selectedPsId;

    // Initialize the form and its methods
    const formMethods = useForm({
        defaultValues: {
            subject: '',
            module: '',
        },
    });

    useEffect(() => {
        setBatch(
            getDetailsFromPackageSessionId({ packageSessionId: activePsId })
        );
    }, [selectedStudent, activePsId]);

    const {
        data: subjectsWithChapters,
        isLoading,
        isError,
        error,
    } = useStudentSubjectsProgressQuery({
        userId: isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '',
        packageSessionId: activePsId,
    });

    useEffect(() => {
        if (subjectsWithChapters && subjectsWithChapters !== null) {
            const percentage = calculateLearningPercentage(subjectsWithChapters);
            setPercentageCompleted(percentage);
        }
    }, [subjectsWithChapters]);

    useEffect(() => {
        if (subjectsWithChapters && subjectsWithChapters.length > 0 && subjectsWithChapters[0]) {
            setCurrentSubjectDetails(subjectsWithChapters[0]);
            formMethods.setValue('subject', subjectsWithChapters[0].subject_dto.id.toString());
        } else {
            setCurrentSubjectDetails(null);
        }
    }, [subjectsWithChapters]);

    useEffect(() => {
        if (
            currentSubjectDetails &&
            currentSubjectDetails.modules.length > 0 &&
            currentSubjectDetails.modules[0]
        ) {
            setCurrentModuleDetails(currentSubjectDetails.modules[0]);
            formMethods.setValue('module', currentSubjectDetails.modules[0].module.id.toString());
        } else {
            setCurrentModuleDetails(null);
        }
    }, [currentSubjectDetails]);

    const handleSubjectChange = (value: string) => {
        const selectedSubject = subjectsWithChapters?.find(
            (subject) => subject.subject_dto.id.toString() === value
        );
        if (selectedSubject) {
            setCurrentSubjectDetails(selectedSubject);
        }
    };

    const handleModuleChange = (value: string) => {
        if (currentSubjectDetails) {
            const selectedModule = currentSubjectDetails.modules.find(
                (module) => module.module.id.toString() === value
            );
            if (selectedModule) {
                setCurrentModuleDetails(selectedModule);
            }
        }
    };

    if (selectedStudent == null) return <p>Student details unavailable</p>;

    // Picker stays visible across loading/error/empty so admin can still switch batches.
    const picker = !isSubmissionTab && (
        <BatchPicker
            packageSessionIds={enrollmentPsIds}
            value={selectedPsId}
            onChange={setSelectedPsId}
            label="View progress for"
        />
    );

    if (isLoading)
        return (
            <div>
                {picker}
                <DashboardLoader />
            </div>
        );
    if (isError || error)
        return (
            <div>
                {picker}
                <p>Error loading subject details</p>
            </div>
        );
    if (
        subjectsWithChapters == null ||
        subjectsWithChapters == undefined ||
        subjectsWithChapters.length == 0 ||
        subjectsWithChapters[0] == undefined
    )
        return (
            <div>
                {picker}
                <p>No subject has been created</p>
            </div>
        );

    // Prepare options for subject dropdown
    const subjectOptions = subjectsWithChapters.map((subject) => ({
        _id: subject.subject_dto.id,
        value: subject.subject_dto.id.toString(),
        label: subject.subject_dto.subject_name,
    }));

    // Prepare options for module dropdown
    const moduleOptions =
        currentSubjectDetails?.modules.map((module) => ({
            _id: module.module.id,
            value: module.module.id.toString(),
            label: module.module.module_name,
        })) || [];

    const handleLearningTimeLineClick = () => {
        router.navigate({
            to: '/study-library/reports',
            search: {
                studentReport: {
                    tab: 'STUDENT',
                    learningTab: 'TIMELINE',
                    courseId: batch?.package_dto.id,
                    sessionId: batch?.session.id,
                    levelId: batch?.session.id,
                    fullName: selectedStudent.full_name,
                    userId: isSubmissionTab
                        ? selectedStudent?.id || ''
                        : selectedStudent?.user_id || '',
                },
            },
        });
    };
    const handleLearningProgressClick = () => {
        router.navigate({
            to: '/study-library/reports',
            search: {
                studentReport: {
                    tab: 'STUDENT',
                    learningTab: 'PROGRESS',
                    courseId: batch?.package_dto.id,
                    sessionId: batch?.session.id,
                    levelId: batch?.session.id,
                    fullName: selectedStudent.full_name,
                    userId: isSubmissionTab
                        ? selectedStudent?.id || ''
                        : selectedStudent?.user_id || '',
                },
            },
        });
    };

    return (
        <FormProvider {...formMethods}>
            <div className="flex flex-col gap-6">
                {picker}
                <div className="flex items-center gap-10">
                    <div className="flex flex-col gap-6">
                        <p className="text-title font-semibold text-primary-500">
                            {batch?.package_dto.package_name}
                        </p>
                        <div className="flex flex-col gap-2">
                            <p className="text-body">Session: {batch?.session.session_name}</p>
                            <p className="text-body">Level: {batch?.level.level_name}</p>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <PercentCompletionStatus percentage={percentageCompleted} />
                        <p className="text-caption">{percentageCompleted} % completed</p>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <MyButton
                        buttonType="secondary"
                        scale="large"
                        onClick={handleLearningTimeLineClick}
                    >
                        Check Learning Timeline
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="large"
                        onClick={handleLearningProgressClick}
                    >
                        Check Learning Progress
                    </MyButton>
                </div>
                <Separator />

                {/* Subject dropdown */}
                <div className="flex items-center justify-between gap-2">
                    <div className="w-full">
                        <SelectField
                            label={getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}
                            name="subject"
                            options={subjectOptions}
                            control={formMethods.control}
                            onSelect={handleSubjectChange}
                            className="flex w-[250px] items-center gap-3"
                            labelStyle="w-fit mt-2"
                        />
                    </div>

                    <div className="flex flex-col gap-10">
                        {currentSubjectDetails && currentSubjectDetails.modules.length > 0 ? (
                            <div className="flex flex-col gap-10">
                                {/* Module dropdown */}
                                <div className="w-full">
                                    <SelectField
                                        label={getTerminology(ContentTerms.Modules, SystemTerms.Modules)}
                                        name="module"
                                        options={moduleOptions}
                                        control={formMethods.control}
                                        onSelect={handleModuleChange}
                                        className="flex w-[200px] items-center gap-3"
                                        labelStyle="w-fit mt-2"
                                    />
                                </div>
                            </div>
                        ) : (
                            <p>No modules created for this subject </p>
                        )}
                    </div>
                </div>
                <SubjectProgress moduleDetails={currentModuleDetails} />
            </div>
        </FormProvider>
    );
};
