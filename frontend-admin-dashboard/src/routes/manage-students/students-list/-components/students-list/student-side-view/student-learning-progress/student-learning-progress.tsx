import { useEffect, useState } from 'react';
import { SubjectProgress } from './chapter-details/subject-progress';
import { useStudentSubjectsProgressQuery } from '@/routes/manage-students/students-list/-services/getStudentSubjects';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { BatchPicker } from '../BatchPicker';
import {
    ModulesWithChaptersProgressType,
    SubjectWithDetails,
} from '@/routes/manage-students/students-list/-types/student-subjects-details-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { MyButton } from '@/components/design-system/button';
import calculateLearningPercentage from '@/routes/manage-students/students-list/-utils/calculateLearningPercentage';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useForm, FormProvider } from 'react-hook-form';
import { useRouter } from '@tanstack/react-router';
import { GraduationCap, Books, ChartLineUp, ClockCounterClockwise, Warning, CaretDown, CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileRing,
    ProfileSkeleton,
    ProfileError,
    ProfileEmpty,
    ProfileHero,
    ProfileActionBar,
    ProfileMiniBar,
} from '../profile-ui';

// ── Per-subject completion helper ─────────────────────────────────────────────
// Mirrors calculateLearningPercentage but scoped to a single SubjectWithDetails.
function calcSubjectPercentage(subject: SubjectWithDetails): number {
    let total = 0;
    let count = 0;
    subject.modules.forEach((mod) => {
        mod.chapters.forEach((ch) => {
            count += 1;
            total += ch.percentage_completed;
        });
    });
    return count === 0 ? 0 : total / count;
}

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
        refetch,
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

    const handleSubjectChange = (subject: SubjectWithDetails) => {
        setCurrentSubjectDetails(subject);
        formMethods.setValue('subject', subject.subject_dto.id.toString());
    };

    const handleModuleChange = (mod: ModulesWithChaptersProgressType) => {
        setCurrentModuleDetails(mod);
        formMethods.setValue('module', mod.module.id.toString());
    };

    if (selectedStudent == null)
        return <ProfileEmpty icon={GraduationCap} title="Learner details unavailable" />;

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
            <div className="flex flex-col gap-3">
                {picker}
                <ProfileSkeleton blocks={2} />
            </div>
        );
    if (isError || error)
        return (
            <div className="flex flex-col gap-3">
                {picker}
                <ProfileError
                    title="Couldn't load learning progress"
                    hint="Something went wrong while fetching this learner's progress."
                    onRetry={() => refetch()}
                />
            </div>
        );
    if (
        subjectsWithChapters == null ||
        subjectsWithChapters == undefined ||
        subjectsWithChapters.length == 0 ||
        subjectsWithChapters[0] == undefined
    )
        return (
            <div className="flex flex-col gap-3">
                {picker}
                <ProfileEmpty
                    icon={Books}
                    title="No course content yet"
                    hint="No subjects have been created for this batch."
                />
            </div>
        );

    // ── Report navigation handlers ───────────────────────────────────────────
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

    // ── Hero derived values ──────────────────────────────────────────────────
    const heroTone =
        percentageCompleted >= 75
            ? 'success'
            : percentageCompleted >= 40
              ? 'primary'
              : 'warning';

    // Count subjects where per-subject completion is below 25%
    const behindCount = subjectsWithChapters.filter(
        (s) => calcSubjectPercentage(s) < 25
    ).length;

    const subjectTermLabel = getTerminology(ContentTerms.Subjects, SystemTerms.Subjects);
    const moduleTermLabel = getTerminology(ContentTerms.Modules, SystemTerms.Modules);

    return (
        <FormProvider {...formMethods}>
<<<<<<< HEAD
            <div className="flex flex-col gap-3">
                {picker}
=======
            <div className="flex flex-col gap-3 sm:gap-6">
                {picker}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-10">
                    <div className="flex flex-col gap-3 sm:gap-6">
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
>>>>>>> origin/main

                {/* ── Hero ─────────────────────────────────────────────── */}
                <ProfileHero
                    eyebrow={batch?.package_dto.package_name || 'Course'}
                    title={`${Math.round(percentageCompleted)}% Complete`}
                    subtitle={
                        batch
                            ? `${batch.session.session_name} · ${batch.level.level_name}`
                            : undefined
                    }
                    icon={GraduationCap}
                    tone={heroTone}
                >
                    <div className="flex items-center gap-4">
                        <ProfileRing value={percentageCompleted} />
                        {behindCount > 0 && (
                            <div className="flex items-center gap-1.5 rounded-md border border-warning-200 bg-warning-50 px-2.5 py-1.5">
                                <Warning className="size-3.5 shrink-0 text-warning-600" weight="fill" />
                                <span className="text-xs font-semibold text-warning-700">
                                    Behind on {behindCount}{' '}
                                    {behindCount === 1
                                        ? subjectTermLabel.toLowerCase()
                                        : `${subjectTermLabel.toLowerCase()}s`}
                                </span>
                            </div>
                        )}
                    </div>
                </ProfileHero>

                {/* ── Report action bar ─────────────────────────────────── */}
                <ProfileActionBar>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleLearningTimeLineClick}
                    >
                        <ClockCounterClockwise className="size-4" />
                        Timeline
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleLearningProgressClick}
                    >
                        <ChartLineUp className="size-4" />
                        Progress
                    </MyButton>
                </ProfileActionBar>

                {/* ── Course content expandable subject list ────────────── */}
                <ProfileSectionCard icon={Books} heading="Course Content">
                    <div className="flex flex-col divide-y divide-neutral-100">
                        {subjectsWithChapters.map((subject) => {
                            const subjectPct = calcSubjectPercentage(subject);
                            const isActive =
                                currentSubjectDetails?.subject_dto.id === subject.subject_dto.id;

                            return (
                                <div key={subject.subject_dto.id}>
                                    {/* Subject row */}
                                    <button
                                        type="button"
                                        onClick={() => handleSubjectChange(subject)}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition',
                                            'hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                                            isActive && 'bg-primary-50'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'shrink-0 transition',
                                                isActive
                                                    ? 'text-primary-600'
                                                    : 'text-neutral-400'
                                            )}
                                        >
                                            {isActive ? (
                                                <CaretDown className="size-4" weight="bold" />
                                            ) : (
                                                <CaretRight className="size-4" weight="bold" />
                                            )}
                                        </span>
                                        <span
                                            className={cn(
                                                'min-w-0 flex-1 truncate text-sm font-medium',
                                                isActive
                                                    ? 'text-primary-700'
                                                    : 'text-neutral-800'
                                            )}
                                        >
                                            {subject.subject_dto.subject_name}
                                        </span>
                                        <div className="w-24 shrink-0">
                                            <ProfileMiniBar value={subjectPct} />
                                        </div>
                                    </button>

                                    {/* Expanded module list + SubjectProgress for active subject */}
                                    {isActive && (
                                        <div className="mb-2 ml-7 flex flex-col gap-2 border-l-2 border-primary-100 pl-3 pt-1">
                                            {subject.modules.length === 0 ? (
                                                <p className="text-xs italic text-neutral-400">
                                                    No {moduleTermLabel.toLowerCase()}s for this{' '}
                                                    {subjectTermLabel.toLowerCase()}.
                                                </p>
                                            ) : (
                                                subject.modules.map((mod) => {
                                                    const modTotal = mod.chapters.length;
                                                    const modCompleted = mod.chapters.filter(
                                                        (ch) => ch.percentage_completed >= 100
                                                    ).length;
                                                    const modPct =
                                                        modTotal === 0
                                                            ? 0
                                                            : (modCompleted / modTotal) * 100;
                                                    const isActiveMod =
                                                        currentModuleDetails?.module.id ===
                                                        mod.module.id;

                                                    return (
                                                        <button
                                                            key={mod.module.id}
                                                            type="button"
                                                            onClick={() => handleModuleChange(mod)}
                                                            className={cn(
                                                                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition',
                                                                'hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                                                                isActiveMod &&
                                                                    'bg-primary-50 ring-1 ring-primary-200'
                                                            )}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    'min-w-0 flex-1 truncate text-xs font-medium',
                                                                    isActiveMod
                                                                        ? 'text-primary-700'
                                                                        : 'text-neutral-700'
                                                                )}
                                                            >
                                                                {mod.module.module_name}
                                                            </span>
                                                            <div className="w-20 shrink-0">
                                                                <ProfileMiniBar value={modPct} />
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            )}

                                            {/* SubjectProgress for selected module */}
                                            {currentModuleDetails && (
                                                <div className="pt-1">
                                                    <SubjectProgress
                                                        moduleDetails={currentModuleDetails}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ProfileSectionCard>
            </div>
        </FormProvider>
    );

};
