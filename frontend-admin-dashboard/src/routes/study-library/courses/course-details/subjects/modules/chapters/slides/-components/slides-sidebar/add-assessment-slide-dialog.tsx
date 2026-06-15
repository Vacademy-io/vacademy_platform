import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { MagnifyingGlass } from '@phosphor-icons/react';

import { MyButton } from '@/components/design-system/button';
import { DialogFooter } from '@/components/ui/dialog';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_ASSESSMENT_LISTS,
    STEP1_ASSESSMENT_URL,
    STEP3_ASSESSMENT_URL,
} from '@/constants/urls';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getInstituteId, convertToLocalDateTime } from '@/constants/helper';
import {
    useSlidesMutations,
    type AssessmentSlidePayload,
    type Slide,
} from '../../-hooks/use-slides';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { getSlideStatusForUser } from '../../non-admin/hooks/useNonAdminSlides';
import {
    buildAppendReorderPayload,
    generateUniqueSlideTitle,
    getNextSlideOrder,
} from '../../-helper/slide-naming-utils';

interface AssessmentRow {
    assessment_id: string;
    name: string;
    status: string;
    duration?: number | null;
    play_mode?: string | null;
    evaluation_type?: string | null;
    submission_type?: string | null;
    bound_start_time?: string | null;
    bound_end_time?: string | null;
}

interface AssessmentListResponse {
    content?: AssessmentRow[];
    total_pages?: number;
    total_elements?: number;
    page_no?: number;
    page_size?: number;
}

const PAGE_SIZE = 20;

const AssessmentSlideRow = ({
    row,
    isSelected,
    onSelect,
    fallbackName,
}: {
    row: AssessmentRow;
    isSelected: boolean;
    onSelect: () => void;
    fallbackName: string;
}) => {
    const isDraft = row.status === 'DRAFT';
    const displayName = row.name?.trim() || fallbackName;
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-sm font-semibold text-neutral-900">
                    {displayName}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                    {row.play_mode && (
                        <span className="rounded bg-neutral-100 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-neutral-600">
                            {row.play_mode}
                        </span>
                    )}
                    <span
                        className={`rounded px-2 py-0.5 text-2xs font-semibold uppercase ${
                            isDraft
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                        }`}
                        title={
                            isDraft
                                ? 'Draft assessments cannot be taken until published'
                                : undefined
                        }
                    >
                        {row.status}
                    </span>
                </div>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-neutral-500">
                {typeof row.duration === 'number' && row.duration > 0 ? (
                    <span>{row.duration} min</span>
                ) : null}
                {row.evaluation_type ? <span>{row.evaluation_type}</span> : null}
                {row.bound_end_time && new Date(`${row.bound_end_time.replace(" ", "T")}Z`).getFullYear() !== 9999 ? (
                    <span>
                        Ends {convertToLocalDateTime(row.bound_end_time)}
                    </span>
                ) : null}
            </div>
        </button>
    );
};

export const AddAssessmentSlideDialog = ({
    openState,
}: {
    openState?: ((open: boolean) => void) | undefined;
}) => {
    const router = useRouter();
    const { courseId, levelId, chapterId, moduleId, subjectId, sessionId } =
        router.state.location.search;
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { items, setActiveItem } = useContentStore();

    const packageSessionId =
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || '';

    const { addUpdateAssessmentSlide, updateSlideOrder, isUpdating } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        packageSessionId
    );

    const [mode, setMode] = useState<'link' | 'create'>('link');
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedRow, setSelectedRow] = useState<AssessmentRow | null>(null);
    const [pageNo, setPageNo] = useState(0);

    // Quick-create form state. Both create a standard EXAM; "manual" sets
    // evaluation_type=MANUAL (learner uploads a PDF answer sheet, admin evaluates),
    // "auto" is objective auto-grading. The manual upload flow keys off
    // evaluation_type — not the play_mode — so a plain EXAM is all we need.
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'manual' | 'auto'>('manual');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setPageNo(0);
        }, 300);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const instituteId = getInstituteId();

    const { data, isLoading, isError } = useQuery<AssessmentListResponse>({
        queryKey: [
            'GET_ASSESSMENT_LIST_FOR_SLIDE_PICKER',
            instituteId,
            debouncedSearch,
            pageNo,
        ],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance({
                method: 'POST',
                url: GET_ASSESSMENT_LISTS,
                params: {
                    pageNo,
                    pageSize: PAGE_SIZE,
                    instituteId,
                },
                data: {
                    name: debouncedSearch,
                    // Backend dereferences these lists with .isEmpty() — send
                    // explicit empty arrays so we don't NPE on the server.
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
            return response?.data;
        },
        enabled: Boolean(instituteId),
        staleTime: 30 * 1000,
    });

    const rows = useMemo(() => data?.content ?? [], [data?.content]);
    const totalPages = data?.total_pages ?? 0;

    // Build a stable per-row fallback "Assessment N" label using the page-
    // global page offset so it doesn't reset on each re-render.
    const fallbackNameFor = (index: number) =>
        `Assessment ${pageNo * PAGE_SIZE + index + 1}`;

    // Shared: create the ASSESSMENT slide for a given assessment, append it, and
    // activate it. Used by both "link existing" and "quick create".
    const linkAssessmentAsSlide = async (assessmentId: string, assessmentName: string) => {
        const slideId = crypto.randomUUID();
        const assessmentSlideId = crypto.randomUUID();
        const title = `Assessment: ${assessmentName}`;

        const payload: AssessmentSlidePayload = {
            id: slideId,
            source_id: assessmentSlideId,
            source_type: 'ASSESSMENT',
            title,
            description: '',
            image_file_id: '',
            slide_order: getNextSlideOrder((items as Slide[]) || []),
            status: getSlideStatusForUser(),
            new_slide: true,
            notify: false,
            assessment_slide: {
                id: assessmentSlideId,
                assessment_id: assessmentId,
                allow_reattempt: true,
                show_result: true,
            },
        };

        const response = await addUpdateAssessmentSlide(payload);
        if (!response) throw new Error('Failed to link assessment');

        // Reorder so the new slide appears at the bottom
        const currentSlides = (items as Slide[]) || [];
        const reordered = buildAppendReorderPayload(slideId, currentSlides);
        await updateSlideOrder({
            chapterId: chapterId || '',
            slideOrderPayload: reordered,
        });

        // Optimistically activate
        const newSlide: Slide = {
            id: slideId,
            source_id: assessmentSlideId,
            source_type: 'ASSESSMENT',
            title,
            image_file_id: '',
            description: '',
            status: payload.status,
            slide_order: payload.slide_order ?? 0,
            video_slide: null,
            document_slide: null,
            question_slide: null,
            assignment_slide: null,
            quiz_slide: null,
            audio_slide: null,
            scorm_slide: null,
            assessment_slide: {
                id: assessmentSlideId,
                assessment_id: assessmentId,
                allow_reattempt: true,
                show_result: true,
            },
            is_loaded: true,
            new_slide: true,
        };
        setActiveItem(newSlide);
    };

    const handleLink = async () => {
        if (!selectedRow) return;
        try {
            const selectedIndex = rows.findIndex(
                (r) => r.assessment_id === selectedRow.assessment_id
            );
            const fallback =
                selectedIndex >= 0
                    ? fallbackNameFor(selectedIndex)
                    : generateUniqueSlideTitle((items as Slide[]) || [], 'Assessment');
            const assessmentName = selectedRow.name?.trim() || fallback;

            await linkAssessmentAsSlide(selectedRow.assessment_id, assessmentName);

            toast.success('Assessment linked as a slide');
            openState?.(false);
        } catch (err) {
            console.error('Failed to link assessment slide', err);
            toast.error((err as Error)?.message || 'Failed to link assessment');
        }
    };

    // Quick-create: mint a DRAFT assessment (Step 1) scoped to this slide's batch
    // (Step 3), then link it. The admin finishes setup via "Add questions" on the
    // slide preview. Reuses the existing create endpoints — no new APIs.
    const handleCreateAndLink = async () => {
        const name = newName.trim();
        if (!name || isCreating) return;
        setIsCreating(true);
        try {
            // Always create a standard EXAM. Manual vs auto is the result/evaluation
            // type — evaluation_type=MANUAL is what drives the learner answer-PDF
            // upload flow — so we don't introduce a special MANUAL_UPLOAD_EXAM play_mode.
            const examtype = 'EXAM';
            const resultType = newType === 'manual' ? 'MANUAL' : 'AUTO_AFTER_SUBMISSION';

            // Step 1 — basic info (DRAFT / INCOMPLETE)
            const step1Res = await authenticatedAxiosInstance({
                method: 'POST',
                url: STEP1_ASSESSMENT_URL,
                params: { assessmentId: null, instituteId, type: examtype },
                data: {
                    status: 'INCOMPLETE',
                    assessment_type: 'ASSESSMENT',
                    test_creation: {
                        assessment_name: name,
                        subject_id: subjectId || '',
                        assessment_instructions_html: '',
                    },
                    test_boundation: {
                        start_date: new Date().toISOString(),
                        end_date: new Date('9999-12-31T23:59:59.999Z').toISOString(),
                    },
                    assessment_preview_time: 0,
                    default_reattempt_count: 1,
                    switch_sections: true,
                    evaluation_type: newType === 'manual' ? 'MANUAL' : 'AUTO',
                    submission_type: '',
                    result_type: resultType,
                    raise_reattempt_request: true,
                    raise_time_increase_request: true,
                },
            });

            const newAssessmentId = step1Res?.data?.assessment_id;
            if (!newAssessmentId) throw new Error('Could not create assessment');

            // Step 3 — scope to this slide's batch (closed / PRIVATE)
            await authenticatedAxiosInstance({
                method: 'POST',
                url: STEP3_ASSESSMENT_URL,
                params: { assessmentId: newAssessmentId, instituteId, type: examtype },
                data: {
                    closed_test: true,
                    open_test_details: {},
                    added_pre_register_batches_details: packageSessionId
                        ? [packageSessionId]
                        : [],
                    deleted_pre_register_batches_details: [],
                    added_pre_register_students_details: [],
                    deleted_pre_register_students_details: [],
                    updated_join_link: '',
                    notify_student: {
                        when_assessment_created: false,
                        show_leaderboard: false,
                        before_assessment_goes_live: 0,
                        when_assessment_live: false,
                        when_assessment_report_generated: false,
                    },
                    notify_parent: {
                        when_assessment_created: false,
                        before_assessment_goes_live: 0,
                        show_leaderboard: false,
                        when_assessment_live: false,
                        when_student_appears: false,
                        when_student_finishes_test: false,
                        when_assessment_report_generated: false,
                    },
                },
            });

            await linkAssessmentAsSlide(newAssessmentId, name);

            toast.success(
                'Draft assessment created and linked. Add questions to finish setup.'
            );
            openState?.(false);
        } catch (err) {
            console.error('Failed to create assessment from slide', err);
            toast.error((err as Error)?.message || 'Failed to create assessment');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
                <button
                    type="button"
                    onClick={() => setMode('link')}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                        mode === 'link'
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                >
                    Link existing
                </button>
                <button
                    type="button"
                    onClick={() => setMode('create')}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                        mode === 'create'
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                >
                    Create new
                </button>
            </div>

            {mode === 'link' && (
                <>
            <div className="relative">
                <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search assessments by name..."
                    className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    autoFocus
                />
            </div>

            <div className="max-h-96 min-h-52 overflow-y-auto rounded-md border border-neutral-200 p-2">
                {isLoading ? (
                    <div className="py-10 text-center text-sm text-neutral-500">
                        Loading assessments...
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center text-sm text-red-500">
                        Failed to load assessments. Please retry.
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-10 text-center text-sm text-neutral-500">
                        {debouncedSearch
                            ? 'No assessments matched your search.'
                            : 'No assessments available for this institute.'}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rows.map((row, index) => (
                            <AssessmentSlideRow
                                key={row.assessment_id}
                                row={row}
                                isSelected={selectedRow?.assessment_id === row.assessment_id}
                                onSelect={() => setSelectedRow(row)}
                                fallbackName={fallbackNameFor(index)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                        Page {pageNo + 1} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={pageNo === 0}
                            onClick={() => setPageNo((p) => Math.max(0, p - 1))}
                            className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            disabled={pageNo + 1 >= totalPages}
                            onClick={() => setPageNo((p) => p + 1)}
                            className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
                </>
            )}

            {mode === 'create' && (
                <div className="flex flex-col gap-4 py-1">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Assessment name
                        </label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Chapter 1 Test"
                            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                            Type
                        </label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setNewType('manual')}
                                className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                                    newType === 'manual'
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                                }`}
                            >
                                <span className="text-sm font-semibold text-neutral-900">
                                    Upload-sheet (manual)
                                </span>
                                <span className="text-xs text-neutral-500">
                                    Learner uploads a PDF answer sheet; you evaluate and award
                                    marks.
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewType('auto')}
                                className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                                    newType === 'auto'
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                                }`}
                            >
                                <span className="text-sm font-semibold text-neutral-900">
                                    Auto-graded (objective)
                                </span>
                                <span className="text-xs text-neutral-500">
                                    Objective questions graded automatically.
                                </span>
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-neutral-500">
                        Creates a draft scoped to this batch. Add questions and publish it to
                        make it available to learners.
                    </p>
                </div>
            )}

            <DialogFooter className="mt-1 flex justify-end gap-2">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    onClick={() => openState?.(false)}
                    disable={isUpdating || isCreating}
                >
                    Cancel
                </MyButton>
                {mode === 'link' ? (
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={handleLink}
                        disable={!selectedRow || isUpdating}
                    >
                        {isUpdating ? 'Linking...' : 'Link as slide'}
                    </MyButton>
                ) : (
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={handleCreateAndLink}
                        disable={!newName.trim() || isCreating || isUpdating}
                    >
                        {isCreating ? 'Creating...' : 'Create & link'}
                    </MyButton>
                )}
            </DialogFooter>
        </div>
    );
};
