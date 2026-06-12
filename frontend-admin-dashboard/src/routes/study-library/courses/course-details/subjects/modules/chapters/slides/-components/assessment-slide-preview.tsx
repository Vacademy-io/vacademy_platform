'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    ListChecks,
    ArrowSquareOut,
    Clock,
    ListNumbers,
    Trophy,
    Users,
    Warning,
} from '@phosphor-icons/react';

import { Slide, useSlidesMutations } from '../-hooks/use-slides';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_OVERVIEW_URL,
    GET_ASSESSMENT_TOTAL_MARKS_URL,
    GET_ASSESSMENT_LISTS,
    PUBLISH_ASSESSMENT_URL,
} from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { MyButton } from '@/components/design-system/button';

interface AssessmentSlidePreviewProps {
    activeItem: Slide;
    isLearnerView?: boolean;
}

// /assessment-service/assessment/admin/get-overview wraps the overview in
// `assessment_overview_dto`. We only consume the slice we need.
interface AssessmentOverviewResponse {
    assessment_overview_dto?: {
        duration_in_min?: number | null;
        start_date_and_time?: string | null;
        end_date_and_time?: string | null;
        subject_id?: string | null;
        total_participants?: number | null;
        total_attempted?: number | null;
        total_ongoing?: number | null;
    };
}

interface TotalMarksResponse {
    total_achievable_marks?: number | null;
    section_wise_achievable_marks?: Record<string, number> | null;
}

const Stat = ({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number | null | undefined;
}) => (
    <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
        <span className="text-primary-500">{icon}</span>
        <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</span>
            <span className="text-sm font-semibold text-neutral-800">
                {value ?? '—'}
            </span>
        </div>
    </div>
);

const AssessmentSlidePreview = ({ activeItem }: AssessmentSlidePreviewProps) => {
    const router = useRouter();
    const assessmentSlide = activeItem.assessment_slide;
    const assessmentId = assessmentSlide?.assessment_id;
    const instituteId = getInstituteId();

    // Slide-publish wiring (same as the add-assessment dialog) so the banner's
    // Publish can also publish the slide.
    const { courseId, levelId, chapterId, moduleId, subjectId, sessionId } =
        router.state.location.search;
    const { getPackageSessionId } = useInstituteDetailsStore();
    const packageSessionId =
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || '';
    const { addUpdateAssessmentSlide } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        packageSessionId
    );

    const overviewQuery = useQuery<AssessmentOverviewResponse>({
        queryKey: ['ASSESSMENT_SLIDE_OVERVIEW_ADMIN', assessmentId, instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance({
                method: 'GET',
                url: GET_OVERVIEW_URL,
                params: { assessmentId, instituteId },
            });
            return response?.data;
        },
        enabled: Boolean(assessmentId && instituteId),
        staleTime: 30 * 1000,
    });

    const totalMarksQuery = useQuery<TotalMarksResponse>({
        queryKey: ['ASSESSMENT_SLIDE_TOTAL_MARKS_ADMIN', assessmentId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance({
                method: 'GET',
                url: GET_ASSESSMENT_TOTAL_MARKS_URL,
                params: { assessmentId },
            });
            return response?.data;
        },
        enabled: Boolean(assessmentId),
        staleTime: 30 * 1000,
    });

    // Resolve the assessment's play_mode + visibility so "Manage in Assessments"
    // can deep-link to this assessment's details page. get-overview doesn't carry
    // these, so look the assessment up by id in the assessment list (name-filtered
    // to narrow the page, then matched by assessment_id).
    const routeParamsQuery = useQuery<{
        playMode?: string | null;
        visibility?: string | null;
        status?: string | null;
    } | null>({
        queryKey: ['ASSESSMENT_SLIDE_ROUTE_PARAMS_ADMIN', assessmentId, instituteId, activeItem.title],
        queryFn: async () => {
            const searchName = (activeItem.title?.replace(/^Assessment:\s*/, '') ?? '').trim();
            const response = await authenticatedAxiosInstance({
                method: 'POST',
                url: GET_ASSESSMENT_LISTS,
                params: { pageNo: 0, pageSize: 25, instituteId },
                data: {
                    name: searchName,
                    batch_ids: [],
                    subjects_ids: [],
                    tag_ids: [],
                    evaluation_types: [],
                    institute_ids: instituteId ? [instituteId] : [],
                    assessment_modes: [],
                    access_statuses: [],
                    sort_columns: {},
                    assessment_statuses: ['PUBLISHED', 'DRAFT'],
                    assessment_types: ['ASSESSMENT'],
                },
            });
            const rows: Array<{
                assessment_id: string;
                play_mode?: string | null;
                assessment_visibility?: string | null;
                status?: string | null;
            }> = response?.data?.content ?? [];
            const match = rows.find((r) => r.assessment_id === assessmentId);
            return match
                ? {
                      playMode: match.play_mode,
                      visibility: match.assessment_visibility,
                      status: match.status,
                  }
                : null;
        },
        enabled: Boolean(assessmentId && instituteId),
        staleTime: 60 * 1000,
    });

    // Publish the linked assessment directly from the slide so the admin doesn't
    // have to open the assessment module just to make it available to learners.
    const queryClient = useQueryClient();
    const publishMutation = useMutation({
        mutationFn: async () => {
            // 1) Publish the assessment.
            await authenticatedAxiosInstance({
                method: 'POST',
                url: PUBLISH_ASSESSMENT_URL,
                params: {
                    assessmentId,
                    instituteId,
                    type: routeParamsQuery.data?.playMode,
                },
                data: {},
            });
            // 2) Publish the slide too. This is one-way: the combined Publish here
            //    publishes the slide, but publishing/unpublishing the slide on its
            //    own (top action) never touches the assessment.
            if (activeItem.assessment_slide) {
                await addUpdateAssessmentSlide({
                    id: activeItem.id,
                    source_id: activeItem.assessment_slide.id,
                    source_type: 'ASSESSMENT',
                    title: activeItem.title,
                    description: activeItem.description || '',
                    image_file_id: activeItem.image_file_id || '',
                    status: 'PUBLISHED',
                    slide_order: activeItem.slide_order,
                    notify: false,
                    new_slide: false,
                    assessment_slide: {
                        id: activeItem.assessment_slide.id,
                        assessment_id: activeItem.assessment_slide.assessment_id,
                        allow_reattempt: activeItem.assessment_slide.allow_reattempt ?? true,
                        show_result: activeItem.assessment_slide.show_result ?? true,
                    },
                });
            }
        },
        onSuccess: () => {
            toast.success('Assessment and slide published — learners can now take it.');
            queryClient.invalidateQueries({
                queryKey: ['ASSESSMENT_SLIDE_ROUTE_PARAMS_ADMIN'],
            });
        },
        onError: () => {
            toast.error(
                'Could not publish. Open it in Assessments to finish setup, then publish.'
            );
        },
    });

    const overview = overviewQuery.data?.assessment_overview_dto;
    const totalMarks = totalMarksQuery.data;
    const sectionCount = totalMarks?.section_wise_achievable_marks
        ? Object.keys(totalMarks.section_wise_achievable_marks).length
        : null;
    const isLoading = overviewQuery.isLoading || totalMarksQuery.isLoading;
    const isError = overviewQuery.isError && totalMarksQuery.isError;

    // Slide title is set as "Assessment: <name>" at link time. Strip the
    // prefix so the preview shows the bare assessment name.
    const displayName = activeItem.title?.replace(/^Assessment:\s*/, '') || activeItem.title;

    if (!assessmentId) {
        return (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
                <ListChecks className="size-8 text-neutral-400" />
                <p className="mt-3 text-sm text-neutral-500">
                    No assessment linked to this slide.
                </p>
            </div>
        );
    }

    // Deep-link into this assessment's details page. play_mode/visibility come from
    // the resolver; if unresolved (e.g. a renamed assessment off the filtered page),
    // fall back to the generic list so the action never dead-ends.
    const goToAssessmentDetails = (tab: 'overview' | 'submissions') => {
        const routeParams = routeParamsQuery.data;
        if (routeParams?.playMode) {
            router.navigate({
                to: '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab',
                params: {
                    assessmentId,
                    examType: routeParams.playMode,
                    assesssmentType: routeParams.visibility ?? 'PRIVATE',
                    assessmentTab: tab,
                },
            });
        } else {
            router.navigate({ to: '/assessment/assessment-list' });
        }
    };

    // Submission counts come for free from the overview we already fetch. The
    // precise evaluated/pending breakdown lives in the submissions tab (one click).
    const submittedCount = overview?.total_attempted ?? 0;
    const participantCount = overview?.total_participants ?? 0;

    // A linked-but-unpublished assessment isn't visible to learners until the
    // admin adds questions and publishes it.
    const isDraft = routeParamsQuery.data?.status === 'DRAFT';
    const goToAddQuestions = () => {
        const routeParams = routeParamsQuery.data;
        if (!routeParams?.playMode) return;
        router.navigate({
            to: '/assessment/create-assessment/$assessmentId/$examtype',
            params: { assessmentId, examtype: routeParams.playMode },
            search: { currentStep: 1 },
        });
    };

    return (
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="rounded-md bg-rose-50 p-2 text-rose-500">
                        <ListChecks className="size-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Linked assessment
                        </span>
                        <h3 className="text-base font-semibold text-neutral-900">
                            {isLoading && !displayName ? 'Loading…' : displayName}
                        </h3>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => goToAssessmentDetails('submissions')}
                    >
                        <span className="inline-flex items-center gap-1 text-xs">
                            View Submissions
                            <ArrowSquareOut className="size-3.5" />
                        </span>
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => goToAssessmentDetails('overview')}
                    >
                        <span className="inline-flex items-center gap-1 text-xs">
                            Manage in Assessments
                            <ArrowSquareOut className="size-3.5" />
                        </span>
                    </MyButton>
                </div>
            </div>

            {isDraft && (
                <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                        <Warning className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-amber-800">
                                Draft — not visible to learners yet
                            </span>
                            <span className="text-xs text-amber-700/80">
                                Add questions and publish this assessment to make it available.
                            </span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={goToAddQuestions}
                        >
                            <span className="inline-flex items-center gap-1 text-xs">
                                Add questions
                                <ArrowSquareOut className="size-3.5" />
                            </span>
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={() => publishMutation.mutate()}
                            disable={publishMutation.isPending}
                        >
                            {publishMutation.isPending ? 'Publishing…' : 'Publish'}
                        </MyButton>
                    </div>
                </div>
            )}

            {isError && (
                <p className="text-xs text-red-500">
                    Could not load assessment details. The link may still work for learners.
                </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat
                    icon={<Clock className="size-4" />}
                    label="Duration"
                    value={
                        typeof overview?.duration_in_min === 'number' &&
                        overview.duration_in_min > 0
                            ? `${overview.duration_in_min} min`
                            : null
                    }
                />
                <Stat
                    icon={<ListNumbers className="size-4" />}
                    label="Sections"
                    value={sectionCount && sectionCount > 0 ? sectionCount : null}
                />
                <Stat
                    icon={<Trophy className="size-4" />}
                    label="Total marks"
                    value={
                        typeof totalMarks?.total_achievable_marks === 'number'
                            ? totalMarks.total_achievable_marks
                            : null
                    }
                />
            </div>

            {/* Submissions at-a-glance — full evaluated/pending breakdown is in the
                submissions tab via "View Submissions". */}
            <div className="flex items-center gap-3 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                <Users className="size-4 text-primary-500" />
                <span>
                    <span className="font-semibold text-neutral-800">{submittedCount}</span> submitted
                </span>
                <span className="text-neutral-400">·</span>
                <span>
                    <span className="font-semibold text-neutral-800">{participantCount}</span> enrolled
                </span>
            </div>

            <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-600">
                <p className="font-medium text-neutral-800">Slide settings</p>
                <ul className="mt-1 list-disc pl-4">
                    <li>
                        Re-attempt:{' '}
                        <span className="font-semibold">
                            {assessmentSlide?.allow_reattempt === false ? 'Disabled' : 'Allowed'}
                        </span>
                    </li>
                    <li>
                        Show result:{' '}
                        <span className="font-semibold">
                            {assessmentSlide?.show_result === false ? 'Hidden' : 'Visible'}
                        </span>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default AssessmentSlidePreview;
