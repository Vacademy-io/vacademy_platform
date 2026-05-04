'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { ListChecks, ArrowSquareOut, Clock, ListNumbers, Trophy } from '@phosphor-icons/react';

import { Slide } from '../-hooks/use-slides';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_OVERVIEW_URL, GET_ASSESSMENT_TOTAL_MARKS_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
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
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    onClick={() => {
                        router.navigate({
                            to: '/assessment/assessment-list',
                        });
                    }}
                >
                    <span className="inline-flex items-center gap-1 text-xs">
                        Manage in Assessments
                        <ArrowSquareOut className="size-3.5" />
                    </span>
                </MyButton>
            </div>

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
