import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { ListChecks } from '@phosphor-icons/react';

import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    STEP1_ASSESSMENT_URL,
    STEP2_ASSESSMENT_URL,
    STEP3_ASSESSMENT_URL,
    PRIVATE_ADD_QUESTIONS,
    PUBLISH_ASSESSMENT_URL,
} from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    useSlidesMutations,
    type AssessmentSlidePayload,
    type Slide,
} from '../-hooks/use-slides';
import { useContentStore } from '../-stores/chapter-sidebar-store';
import { getSlideStatusForUser } from '../non-admin/hooks/useNonAdminSlides';
import {
    buildAppendReorderPayload,
    getNextSlideOrder,
} from '../-helper/slide-naming-utils';

// In-slide "create assessment" form — the assessment analog of a manual-upload
// assignment. The admin writes a task description (and embeds the question PDF)
// in the rich-text editor; we append a standard "download → start → you have N
// minutes" note, set the per-attempt duration, and auto-provision a complete
// MANUAL assessment (1 section + 1 placeholder question) so it's ready to
// publish without the wizard. The learner uploads a PDF answer sheet, which the
// admin evaluates.
const AssessmentCreateForm = () => {
    const router = useRouter();
    const { courseId, levelId, chapterId, moduleId, subjectId, sessionId } =
        router.state.location.search;
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { items, setActiveItem, setAssessmentCreateMode } = useContentStore();
    const instituteId = getInstituteId();

    const packageSessionId =
        getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        }) || '';

    const { addUpdateAssessmentSlide, updateSlideOrder } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        packageSessionId
    );

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    // Max marks — applied to the single placeholder question so manual
    // evaluation can award up to this and the learner's score reads "X / total".
    const [totalMarks, setTotalMarks] = useState('100');
    // Per-attempt time limit (minutes). The standard note reflects this value.
    const [duration, setDuration] = useState('15');
    const [hasDateRange, setHasDateRange] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reattemptCount, setReattemptCount] = useState('2');
    const [isCreating, setIsCreating] = useState(false);

    const linkAssessmentAsSlide = async (
        assessmentId: string,
        assessmentName: string,
        allowReattempt: boolean
    ) => {
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
                allow_reattempt: allowReattempt,
                show_result: true,
            },
        };

        const response = await addUpdateAssessmentSlide(payload);
        if (!response) throw new Error('Failed to link assessment');

        const currentSlides = (items as Slide[]) || [];
        const reordered = buildAppendReorderPayload(slideId, currentSlides);
        await updateSlideOrder({
            chapterId: chapterId || '',
            slideOrderPayload: reordered,
        });

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
                allow_reattempt: allowReattempt,
                show_result: true,
            },
            is_loaded: true,
            new_slide: true,
        };
        setActiveItem(newSlide);
    };

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (!trimmed || isCreating) return;
        if (hasDateRange && (!startDate || !endDate)) {
            toast.error('Enter both a start and end date, or turn off the date range.');
            return;
        }
        if (hasDateRange && new Date(endDate) <= new Date(startDate)) {
            toast.error('End date must be after the start date.');
            return;
        }

        setIsCreating(true);
        try {
            const examtype = 'EXAM';
            const durationMin = Math.max(1, parseInt(duration, 10) || 15);
            const marks = Math.max(1, parseInt(totalMarks, 10) || 1);
            const reattempts = Math.max(0, parseInt(reattemptCount, 10) || 0);
            const startIso = hasDateRange
                ? new Date(startDate).toISOString()
                : new Date().toISOString();
            const endIso = hasDateRange
                ? new Date(endDate).toISOString()
                : new Date('9999-12-31T23:59:59.999Z').toISOString();

            // Standard learner-facing note appended after the admin's description.
            const noteHtml =
                `<p>Download the question paper above, and when your answers are ready, click <strong>Start Assessment</strong>.</p>` +
                `<p><strong>Note:</strong> Do not click Start Assessment until you have prepared your answers. ` +
                `After clicking Start Assessment, you will have <strong>${durationMin} minutes</strong> to upload your answers file.</p>`;
            const instructionsHtml = `${description || ''}${noteHtml}`;

            // Step 1 — basic info (DRAFT / INCOMPLETE), always MANUAL.
            const step1Res = await authenticatedAxiosInstance({
                method: 'POST',
                url: STEP1_ASSESSMENT_URL,
                params: { assessmentId: null, instituteId, type: examtype },
                data: {
                    status: 'INCOMPLETE',
                    assessment_type: 'ASSESSMENT',
                    test_creation: {
                        assessment_name: trimmed,
                        subject_id: subjectId || '',
                        assessment_instructions_html: instructionsHtml,
                    },
                    test_boundation: {
                        start_date: startIso,
                        end_date: endIso,
                    },
                    assessment_preview_time: 0,
                    default_reattempt_count: reattempts,
                    switch_sections: true,
                    evaluation_type: 'MANUAL',
                    submission_type: '',
                    result_type: 'MANUAL',
                    // The attempt count is the hard cap — students can't request
                    // extra re-attempts beyond it.
                    raise_reattempt_request: false,
                    raise_time_increase_request: false,
                },
            });

            const newAssessmentId = step1Res?.data?.assessment_id;
            if (!newAssessmentId) throw new Error('Could not create assessment');

            // Create one placeholder question (LONG_ANSWER) — a container for the
            // manual answer upload — and grab its generated id.
            const questionRes = await authenticatedAxiosInstance({
                method: 'POST',
                url: PRIVATE_ADD_QUESTIONS,
                data: {
                    questions: [
                        {
                            question_type: 'LONG_ANSWER',
                            text: { type: 'HTML', content: 'Upload your answer sheet.' },
                            auto_evaluation_json:
                                '{"type":"LONG_ANSWER","data":{"answer":{"type":"HTML","content":""}}}',
                            explanation_text: { type: 'HTML', content: '' },
                        },
                    ],
                },
            });
            const questionId = questionRes?.data?.questions?.[0]?.id;
            if (!questionId) throw new Error('Could not create the question');

            // Step 2 — one section with the placeholder question + the duration.
            await authenticatedAxiosInstance({
                method: 'POST',
                url: STEP2_ASSESSMENT_URL,
                params: { assessmentId: newAssessmentId, instituteId, type: examtype },
                data: {
                    test_duration: {
                        entire_test_duration: durationMin,
                        distribution_duration: 'ASSESSMENT',
                    },
                    added_sections: [
                        {
                            section_name: 'Section 1',
                            section_id: '',
                            section_description_html: '',
                            section_duration: durationMin,
                            section_order: 1,
                            total_marks: marks,
                            cutoff_marks: 0,
                            problem_randomization: false,
                            question_and_marking: [
                                {
                                    question_id: questionId,
                                    marking_json: JSON.stringify({
                                        type: 'LONG_ANSWER',
                                        data: {
                                            totalMark: String(marks),
                                            negativeMark: '0',
                                            negativeMarkingPercentage: '',
                                        },
                                    }),
                                    question_duration_in_min: 0,
                                    question_order: 1,
                                    evaluation_criteria_json: null,
                                    criteria_template_id: null,
                                    is_added: true,
                                    is_deleted: false,
                                    is_updated: false,
                                },
                            ],
                        },
                    ],
                    updated_sections: [],
                    deleted_sections: [],
                },
            });

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

            // Publish immediately — the assessment is complete (section + question
            // + duration), so there's nothing left for the admin to set up.
            await authenticatedAxiosInstance({
                method: 'POST',
                url: PUBLISH_ASSESSMENT_URL,
                params: { assessmentId: newAssessmentId, instituteId, type: examtype },
                data: {},
            });

            // Re-attempt is driven solely by the attempt count: only allow it
            // when more than one attempt is permitted.
            await linkAssessmentAsSlide(newAssessmentId, trimmed, reattempts > 1);

            toast.success('Assessment created and published.');
        } catch (err) {
            console.error('Failed to create assessment from slide', err);
            toast.error((err as Error)?.message || 'Failed to create assessment');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="rounded-md bg-rose-50 p-2 text-rose-500">
                    <ListChecks className="size-5" />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-base font-semibold text-neutral-900">
                        Create assessment
                    </h3>
                    <p className="text-sm text-neutral-500">
                        Learners download the question paper, then upload a PDF answer sheet which
                        you evaluate. Creates a draft scoped to this batch — publish it when ready.
                    </p>
                </div>
            </div>

            <MyInput
                inputType="text"
                label="Assessment name"
                required
                inputPlaceholder="e.g. Chapter 1 Test"
                input={name}
                onChangeFunction={(e) => setName(e.target.value)}
                size="large"
                className="w-full"
            />

            <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-neutral-700">Task description</span>
                <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Write the task description here — upload the question PDF for learners to download."
                    minHeight={180}
                />
                <span className="text-xs text-neutral-500">
                    Upload the question paper here. A standard note (download the paper, then start;
                    you&apos;ll have {Math.max(1, parseInt(duration, 10) || 15)} minutes to upload
                    answers) is added automatically.
                </span>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <MyInput
                    inputType="number"
                    label="Total marks"
                    inputPlaceholder="100"
                    input={totalMarks}
                    onChangeFunction={(e) => setTotalMarks(e.target.value)}
                    size="large"
                    className="w-full"
                    min={1}
                    onKeyDown={(e) => {
                        if (['e', 'E', '-', '+'].includes(e.key)) e.preventDefault();
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                />
                <div className="flex w-full flex-col gap-1.5">
                    <MyInput
                        inputType="number"
                        label="Duration (minutes)"
                        inputPlaceholder="15"
                        input={duration}
                        onChangeFunction={(e) => setDuration(e.target.value)}
                        size="large"
                        className="w-full"
                        min={1}
                        onKeyDown={(e) => {
                            if (['e', 'E', '-', '+'].includes(e.key)) e.preventDefault();
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                    />
                    <span className="text-xs text-neutral-500">
                        This is the time learners get to <strong>upload their answer file</strong>{' '}
                        after clicking Start Assessment — not the time to write their answers (they
                        prepare those beforehand from the question paper).
                    </span>
                </div>
            </div>

            {/* Live Date Range */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-neutral-800">
                        Live date range
                    </span>
                    <Switch
                        checked={hasDateRange}
                        onCheckedChange={(checked) => {
                            setHasDateRange(checked);
                            if (!checked) {
                                setStartDate('');
                                setEndDate('');
                            }
                        }}
                    />
                </div>
                {hasDateRange ? (
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <MyInput
                            inputType="datetime-local"
                            label="Start date & time"
                            required
                            input={startDate}
                            onChangeFunction={(e) => setStartDate(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                        <MyInput
                            inputType="datetime-local"
                            label="End date & time"
                            required
                            input={endDate}
                            onChangeFunction={(e) => setEndDate(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                    </div>
                ) : (
                    <p className="text-xs text-neutral-500">
                        Always available — no start or end date.
                    </p>
                )}
            </div>

            {/* Attempts */}
            <MyInput
                inputType="number"
                label="Attempts allowed"
                inputPlaceholder="2"
                input={reattemptCount}
                onChangeFunction={(e) => setReattemptCount(e.target.value)}
                size="large"
                className="w-48"
                min={0}
                onKeyDown={(e) => {
                    if (['e', 'E', '-', '+'].includes(e.key)) e.preventDefault();
                }}
                onWheel={(e) => e.currentTarget.blur()}
            />

            <div className="flex justify-end gap-2">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    onClick={() => setAssessmentCreateMode(false)}
                    disable={isCreating}
                >
                    Cancel
                </MyButton>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleCreate}
                    disable={!name.trim() || isCreating}
                >
                    {isCreating ? 'Creating…' : 'Create assessment'}
                </MyButton>
            </div>
        </div>
    );
};

export default AssessmentCreateForm;
