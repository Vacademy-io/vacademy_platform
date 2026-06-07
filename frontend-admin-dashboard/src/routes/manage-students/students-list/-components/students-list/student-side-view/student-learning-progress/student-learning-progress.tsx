import { useEffect, useState } from 'react';
import { useStudentSubjectsProgressQuery } from '@/routes/manage-students/students-list/-services/getStudentSubjects';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { BatchPicker } from '../BatchPicker';
import {
    SubjectWithDetails,
} from '@/routes/manage-students/students-list/-types/student-subjects-details-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { StatusChip } from '@/components/design-system/status-chips';
import calculateLearningPercentage from '@/routes/manage-students/students-list/-utils/calculateLearningPercentage';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useForm, FormProvider } from 'react-hook-form';
import { useRouter } from '@tanstack/react-router';
import {
    GraduationCap,
    Stack,
    ChartLineUp,
    ClockCounterClockwise,
    CaretDown,
    CaretRight,
    VideoCamera,
    FileText,
} from '@phosphor-icons/react';
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
    // Only one module accordion can be open at a time per handoff.
    const [openModuleId, setOpenModuleId] = useState<string>('');

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
            const firstModuleId = currentSubjectDetails.modules[0].module.id.toString();
            setOpenModuleId(firstModuleId);
            formMethods.setValue('module', firstModuleId);
        } else {
            setOpenModuleId('');
        }
    }, [currentSubjectDetails]);

    const handleSubjectChange = (subject: SubjectWithDetails) => {
        setCurrentSubjectDetails(subject);
        formMethods.setValue('subject', subject.subject_dto.id.toString());
        // Reset module accordion to the new subject's first module.
        const firstModuleId = subject.modules[0]?.module.id.toString() ?? '';
        setOpenModuleId(firstModuleId);
        if (firstModuleId) {
            formMethods.setValue('module', firstModuleId);
        }
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
                    icon={Stack}
                    title="No course content yet"
                    hint="No subjects have been created for this batch."
                />
            </div>
        );

    // ── Report navigation handlers ───────────────────────────────────────────
    // learningTab is lower-cased to match the Tabs `value` in studentReports.tsx
    // (`timeline` / `progress`). levelId uses batch.level.id — was incorrectly
    // set to batch.session.id, which made the Level prefill always miss.
    const handleLearningTimeLineClick = () => {
        router.navigate({
            to: '/study-library/reports',
            search: {
                studentReport: {
                    tab: 'STUDENT',
                    learningTab: 'timeline',
                    courseId: batch?.package_dto.id,
                    sessionId: batch?.session.id,
                    levelId: batch?.level.id,
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
                    learningTab: 'progress',
                    courseId: batch?.package_dto.id,
                    sessionId: batch?.session.id,
                    levelId: batch?.level.id,
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
            <div className="flex flex-col gap-3">
                {picker}

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
                            <StatusChip
                                status="WARNING"
                                textSize="text-caption"
                                text={`Behind on ${behindCount} ${
                                    behindCount === 1
                                        ? subjectTermLabel.toLowerCase()
                                        : `${subjectTermLabel.toLowerCase()}s`
                                }`}
                            />
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
                        Learning Timeline
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleLearningProgressClick}
                    >
                        <ChartLineUp className="size-4" />
                        Learning Progress
                    </MyButton>
                </ProfileActionBar>

                {/* ── Course content — Subject dropdown selects which subject's
                       modules to show; modules are an accordion stack. ─────── */}
                <ProfileSectionCard
                    icon={Stack}
                    heading="Course Content"
                    action={
                        subjectsWithChapters.length > 1 ? (
                            <MyDropdown
                                currentValue={
                                    currentSubjectDetails?.subject_dto.subject_name ?? ''
                                }
                                dropdownList={subjectsWithChapters.map(
                                    (s) => s.subject_dto.subject_name
                                )}
                                placeholder={`Select ${subjectTermLabel.toLowerCase()}`}
                                handleChange={(value: string) => {
                                    const next = subjectsWithChapters.find(
                                        (s) => s.subject_dto.subject_name === value
                                    );
                                    if (next) handleSubjectChange(next);
                                }}
                            />
                        ) : null
                    }
                >
                    {currentSubjectDetails == null ||
                    currentSubjectDetails.modules.length === 0 ? (
                        <p className="px-1 py-2 text-caption italic text-muted-foreground">
                            No {moduleTermLabel.toLowerCase()}s for this{' '}
                            {subjectTermLabel.toLowerCase()}.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            {currentSubjectDetails.modules.map((mod) => {
                                const modTotal = mod.chapters.length;
                                const modCompleted = mod.chapters.filter(
                                    (ch) => ch.percentage_completed >= 100
                                ).length;
                                const modPct =
                                    modTotal === 0
                                        ? 0
                                        : (modCompleted / modTotal) * 100;
                                const isOpen = openModuleId === mod.module.id.toString();

                                return (
                                    <div
                                        key={mod.module.id}
                                        className="overflow-hidden rounded-md border border-border"
                                    >
                                        {/* Header (tinted surface-2 strip) */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setOpenModuleId(
                                                    isOpen ? '' : mod.module.id.toString()
                                                )
                                            }
                                            aria-expanded={isOpen}
                                            className={cn(
                                                'flex w-full items-center gap-3 bg-muted px-4 py-3 text-left transition',
                                                'hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400'
                                            )}
                                        >
                                            <span className="shrink-0 text-muted-foreground">
                                                {isOpen ? (
                                                    <CaretDown
                                                        className="size-4"
                                                        weight="bold"
                                                    />
                                                ) : (
                                                    <CaretRight
                                                        className="size-4"
                                                        weight="bold"
                                                    />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-body font-semibold text-card-foreground">
                                                {moduleTermLabel}: {mod.module.module_name}
                                            </span>
                                            <div className="w-24 shrink-0">
                                                <ProfileMiniBar value={modPct} label="" />
                                            </div>
                                            <span className="w-10 shrink-0 text-right text-caption font-semibold text-primary-600">
                                                {Math.round(modPct)}%
                                            </span>
                                        </button>

                                        {/* Body: flat list of chapters as Done / Behind rows */}
                                        {isOpen && (
                                            <div className="flex flex-col bg-card px-4 pb-3 pt-1.5">
                                                {mod.chapters.length === 0 ? (
                                                    <p className="py-2 text-caption italic text-muted-foreground">
                                                        No chapters in this{' '}
                                                        {moduleTermLabel.toLowerCase()}.
                                                    </p>
                                                ) : (
                                                    mod.chapters.map((chapter, idx) => {
                                                        const isDone =
                                                            chapter.percentage_completed >= 100;
                                                        // Treat the chapter as a video if any of
                                                        // its slides are videos, otherwise show
                                                        // the document icon.
                                                        const isVideo =
                                                            (chapter.video_count ?? 0) > 0;
                                                        const TypeIcon = isVideo
                                                            ? VideoCamera
                                                            : FileText;
                                                        return (
                                                            <div
                                                                key={chapter.id}
                                                                className={cn(
                                                                    'flex items-center gap-3 py-2',
                                                                    idx > 0 &&
                                                                        'border-t border-neutral-100'
                                                                )}
                                                            >
                                                                <span
                                                                    className={cn(
                                                                        'flex size-7 shrink-0 items-center justify-center rounded-md',
                                                                        isDone
                                                                            ? 'bg-success-50 text-success-600'
                                                                            : 'bg-warning-50 text-warning-600'
                                                                    )}
                                                                >
                                                                    <TypeIcon
                                                                        className="size-4"
                                                                        weight="duotone"
                                                                    />
                                                                </span>
                                                                <span className="min-w-0 flex-1 truncate text-body text-card-foreground">
                                                                    {chapter.chapter_name}
                                                                </span>
                                                                <StatusChip
                                                                    status={
                                                                        isDone
                                                                            ? 'SUCCESS'
                                                                            : 'WARNING'
                                                                    }
                                                                    textSize="text-caption"
                                                                    text={
                                                                        isDone
                                                                            ? 'Done'
                                                                            : 'Behind'
                                                                    }
                                                                    showIcon={false}
                                                                />
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ProfileSectionCard>
            </div>
        </FormProvider>
    );

};
