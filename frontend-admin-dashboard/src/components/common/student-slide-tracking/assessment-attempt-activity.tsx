'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    ClipboardText,
    Eye,
    FilePdf,
    PencilSimpleLine,
    Spinner,
    UploadSimple,
    X as XIcon,
} from '@phosphor-icons/react';

import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_ASSESSMENT_LISTS } from '@/constants/urls';
import {
    getAdminParticipants,
    getAttemptData,
    viewStudentReport,
} from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/assessment-details-services';
import {
    getAssessmentDetails,
    getQuestionDataForSection,
} from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { stashEvalReturnUrl } from '@/routes/evaluation/evaluation-tool/-utils/eval-return';
import {
    releaseEvaluationResult,
    submitEvlauationMarks,
} from '@/routes/evaluation/evaluations/-services/evaluation-service';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getPublicUrl } from '@/services/upload_file';
import { downloadFileFromUrl, ensureFileHasExtension } from '@/lib/file-download';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { convertToLocalDateTime } from '@/constants/helper';

interface AssessmentAttemptActivityProps {
    assessmentId: string;
    instituteId: string | undefined;
    userId: string;
    userName: string;
    // Slide title is set as "Assessment: <name>" at link time; used to resolve the
    // assessment's play_mode / visibility from the admin list.
    assessmentTitle?: string;
}

interface ParticipantRow {
    full_name?: string | null;
    user_id?: string | null;
    attempt_id?: string | null;
    attempt_date?: string | null;
    end_time?: string | null;
    evaluation_status?: string | null;
    score?: number | string | null;
}

// Resolve the max mark from a question's marking_json defensively.
const parseMaxMark = (markingJson?: string): number => {
    try {
        const value = JSON.parse(markingJson || '')?.data?.totalMark;
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    } catch {
        return 0;
    }
};

const isEvaluatedStatus = (status?: string | null) => {
    const s = (status || '').toUpperCase();
    return s === 'COMPLETED' || s === 'AI_EVALUATION_COMPLETED';
};

const isEvaluatingStatus = (status?: string | null) => {
    const s = (status || '').toUpperCase();
    return s === 'EVALUATING' || s === 'AI_EVALUATION_IN_PROGRESS';
};

// Maps the attempt's evaluation_status to a friendly chip (mirrors the
// submissions panel chip so both surfaces read identically).
const StatusChip = ({ status }: { status?: string | null }) => {
    const isEvaluated = isEvaluatedStatus(status);
    const isEvaluating = isEvaluatingStatus(status);
    const label = isEvaluated ? 'Evaluated' : isEvaluating ? 'Evaluating' : 'Pending';
    const cls = isEvaluated
        ? 'border-green-200 bg-green-100 text-green-700'
        : isEvaluating
          ? 'border-blue-200 bg-blue-100 text-blue-700'
          : 'border-amber-200 bg-amber-100 text-amber-700';
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${cls}`}
        >
            {label}
        </span>
    );
};

const AssessmentAttemptActivity = ({
    assessmentId,
    instituteId,
    userId,
    userName,
    assessmentTitle,
}: AssessmentAttemptActivityProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { uploadFile } = useFileUpload();

    // Resolve play_mode + visibility so we can fetch the assessment shape and deep
    // link into the full evaluator (get-overview doesn't carry these — look the
    // assessment up by name in the admin list, then match by id).
    const routeParamsQuery = useQuery<{
        playMode?: string | null;
        visibility?: string | null;
    } | null>({
        queryKey: ['ASSESSMENT_ACTIVITY_ROUTE_PARAMS', assessmentId, instituteId, assessmentTitle],
        queryFn: async () => {
            const searchName = (assessmentTitle?.replace(/^Assessment:\s*/, '') ?? '').trim();
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
            const list: Array<{
                assessment_id: string;
                play_mode?: string | null;
                assessment_visibility?: string | null;
            }> = response?.data?.content ?? [];
            const match = list.find((r) => r.assessment_id === assessmentId);
            return match
                ? { playMode: match.play_mode, visibility: match.assessment_visibility }
                : null;
        },
        enabled: Boolean(assessmentId && instituteId),
        staleTime: 60 * 1000,
    });

    const playMode = routeParamsQuery.data?.playMode ?? undefined;
    const visibility = routeParamsQuery.data?.visibility ?? undefined;

    // The student's attempt for this assessment. Narrow by name, then match the
    // exact learner by user_id.
    const {
        data: participantsData,
        isLoading: isParticipantsLoading,
        isError: isParticipantsError,
    } = useQuery({
        queryKey: ['ASSESSMENT_ACTIVITY_PARTICIPANT', assessmentId, instituteId, userId, visibility],
        queryFn: () =>
            getAdminParticipants(assessmentId, instituteId, 0, 10, {
                name: userName || '',
                assessment_type: visibility ?? 'PRIVATE',
                attempt_type: ['ENDED'],
                registration_source: 'BATCH_PREVIEW_REGISTRATION',
                batches: [],
                status: ['ACTIVE'],
                sort_columns: {},
            }),
        enabled: Boolean(assessmentId && instituteId && !routeParamsQuery.isLoading),
        staleTime: 30 * 1000,
    });

    const attempt: ParticipantRow | null = useMemo(() => {
        const rows: ParticipantRow[] = participantsData?.content ?? [];
        if (rows.length === 0) return null;
        return rows.find((r) => r.user_id === userId) ?? rows[0] ?? null;
    }, [participantsData, userId]);

    const attemptId = attempt?.attempt_id ?? undefined;

    // Assessment shape — needed to build the marks payload (slide assessments are
    // 1 section + 1 question) and to show the max marks.
    const { data: assessmentDetails } = useQuery({
        ...getAssessmentDetails({ assessmentId, instituteId, type: playMode }),
        enabled: Boolean(assessmentId && instituteId && playMode),
    });

    const sectionIds = useMemo(() => {
        const sections =
            assessmentDetails?.[1]?.saved_data?.sections ??
            assessmentDetails?.[0]?.saved_data?.sections ??
            [];
        return sections
            .map((s: { id?: string }) => s?.id)
            .filter(Boolean)
            .join(',');
    }, [assessmentDetails]);

    const { data: questionData } = useQuery({
        ...getQuestionDataForSection({ assessmentId, sectionIds }),
        enabled: Boolean(assessmentId && sectionIds),
    });

    const primaryQuestion = useMemo(() => {
        if (!questionData) return null;
        for (const [sectionId, questions] of Object.entries(
            questionData as Record<string, Array<{ question_id: string; marking_json?: string }>>
        )) {
            const q = questions?.[0];
            if (q) {
                return {
                    sectionId,
                    questionId: q.question_id,
                    maxMarks: parseMaxMark(q.marking_json),
                };
            }
        }
        return null;
    }, [questionData]);

    // Report detail — gives the evaluated copy file id (the annotated PDF shown to
    // the learner). Submitted answer is fetched on demand via getAttemptData.
    const { data: reportDetail } = useQuery({
        queryKey: ['ASSESSMENT_ACTIVITY_REPORT_DETAIL', assessmentId, attemptId, instituteId],
        queryFn: () => viewStudentReport(assessmentId, attemptId as string, instituteId),
        enabled: Boolean(assessmentId && attemptId && instituteId),
        staleTime: 30 * 1000,
    });
    const evaluatedFileId: string | undefined =
        (reportDetail as { evaluated_file_id?: string | null } | undefined)?.evaluated_file_id ??
        undefined;

    // ---- Inline grade form ----
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [marks, setMarks] = useState('');
    const [remarks, setRemarks] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);
    const [viewingSubmitted, setViewingSubmitted] = useState(false);

    // Prefill marks with the existing score once the attempt resolves.
    useEffect(() => {
        if (attempt) {
            setMarks(
                attempt.score != null && attempt.score !== '' ? String(attempt.score) : ''
            );
        }
    }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

    const evaluated = isEvaluatedStatus(attempt?.evaluation_status);
    const hasScore = attempt?.score != null && attempt?.score !== '';
    const busy = submitting || uploading;

    const handleViewSubmitted = async () => {
        if (!attemptId) return;
        setViewingSubmitted(true);
        try {
            const fileId = await getAttemptData(attemptId);
            const url = fileId ? await getPublicUrl(fileId as string) : null;
            if (url) {
                window.open(url, '_blank');
            } else {
                toast.error('No submitted answer file found for this attempt.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Could not open the submitted answer.');
        } finally {
            setViewingSubmitted(false);
        }
    };

    const handleViewEvaluated = async () => {
        if (!evaluatedFileId) return;
        const url = await getPublicUrl(evaluatedFileId);
        if (url) {
            // Download with a correct, `.pdf`-carrying name — the public URL's
            // basename comes from the original upload name, which for
            // quick-evaluated copies can lack an extension.
            await downloadFileFromUrl(url, `Evaluated-Copy-${attempt?.full_name ?? attemptId ?? ''}`);
        } else {
            toast.error('No evaluated copy found yet.');
        }
    };

    const handleOpenTool = () => {
        if (!attemptId || !playMode) return;
        stashEvalReturnUrl(window.location.href);
        navigate({
            to: '/evaluation/evaluate/$assessmentId/$attemptId/$examType',
            params: { assessmentId, attemptId, examType: playMode },
        });
    };

    const handleSubmit = async () => {
        if (!primaryQuestion) {
            toast.error('Could not load the assessment question. Please use the full tool.');
            return;
        }
        if (!attemptId || !instituteId) return;

        const parsed = parseFloat(marks);
        if (!Number.isFinite(parsed)) {
            toast.error('Please enter marks.');
            return;
        }
        const cap = primaryQuestion.maxMarks > 0 ? primaryQuestion.maxMarks : Infinity;
        const clamped = Math.min(Math.max(parsed, 0), cap);

        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const tokenData = getTokenDecodedData(accessToken);

        setSubmitting(true);
        try {
            let fileId = '';
            if (file) {
                fileId =
                    (await uploadFile({
                        // Ensure the evaluated copy carries a correct extension so it
                        // later downloads as e.g. `.pdf` rather than an extension-less file.
                        file: ensureFileHasExtension(file),
                        setIsUploading: setUploading,
                        userId: tokenData?.user ?? '',
                        source: instituteId,
                        sourceId: 'EVALUATIONS',
                    })) || '';
            }

            const dataJson = JSON.stringify({
                attemptId,
                assessmentId,
                evaluatorUserId: tokenData?.user,
                setId: '',
            });

            await submitEvlauationMarks(assessmentId, instituteId, attemptId, {
                set_id: '',
                file_id: fileId,
                data_json: dataJson,
                request: [
                    {
                        section_id: primaryQuestion.sectionId,
                        question_id: primaryQuestion.questionId,
                        status: 'evaluated',
                        marks: clamped,
                        evaluator_feedback: remarks.trim() || undefined,
                    },
                ],
            });

            // Auto-release so the learner sees the result immediately. Best-effort —
            // a release failure shouldn't block the (already successful) submission.
            try {
                await releaseEvaluationResult(assessmentId, instituteId, attemptId);
            } catch (releaseError) {
                console.error('Failed to auto-release result:', releaseError);
            }

            setSavedFlash(true);
            setFile(null);
            toast.success('Evaluation submitted', {
                description: `${userName || 'Learner'}'s submission has been evaluated.`,
            });
            queryClient.invalidateQueries({ queryKey: ['ASSESSMENT_ACTIVITY_PARTICIPANT'] });
            queryClient.invalidateQueries({ queryKey: ['ASSESSMENT_ACTIVITY_REPORT_DETAIL'] });
            queryClient.invalidateQueries({ queryKey: ['ASSESSMENT_SLIDE_SUBMISSIONS_PANEL'] });
            setTimeout(() => setSavedFlash(false), 2000);
        } catch (e) {
            console.error(e);
            toast.error('Failed to submit evaluation. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (isParticipantsLoading || routeParamsQuery.isLoading) {
        return (
            <div className="space-y-3 p-5">
                <div className="h-40 animate-pulse rounded-xl border border-neutral-200 bg-white" />
            </div>
        );
    }

    if (isParticipantsError) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-neutral-500">
                <ClipboardText size={36} className="text-neutral-300" weight="duotone" />
                <p className="text-sm font-medium">Could not load this attempt</p>
                <p className="text-xs">Open “View Submissions” on the slide to evaluate instead.</p>
            </div>
        );
    }

    if (!attempt) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-neutral-500">
                <ClipboardText size={36} className="text-neutral-300" weight="duotone" />
                <p className="text-sm font-medium">No submission yet</p>
                <p className="text-xs">This student hasn&apos;t submitted this assessment.</p>
            </div>
        );
    }

    const submittedAt =
        attempt.end_time || attempt.attempt_date
            ? convertToLocalDateTime((attempt.end_time || attempt.attempt_date) as string)
            : null;

    return (
        <div className="p-5">
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Left — Attempt info */}
                    <div className="flex flex-col gap-3 border-b border-neutral-200 p-5 lg:border-b-0 lg:border-r">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-neutral-800">
                                    {submittedAt ? 'Submitted' : 'Attempt'}
                                </span>
                                <span className="text-xs text-neutral-500">
                                    {submittedAt ?? '—'}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {evaluated && hasScore && (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                        {attempt.score}
                                        {primaryQuestion && primaryQuestion.maxMarks > 0
                                            ? ` / ${primaryQuestion.maxMarks}`
                                            : ''}{' '}
                                        marks
                                    </span>
                                )}
                                <StatusChip status={attempt.evaluation_status} />
                            </div>
                        </div>

                        {/* Submitted answer */}
                        <div className="flex flex-col gap-2">
                            <span className="text-2xs font-semibold uppercase tracking-wide text-neutral-500">
                                Submitted Answer
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={handleViewSubmitted}
                                    disable={!attemptId || viewingSubmitted}
                                >
                                    <span className="inline-flex items-center gap-1 text-xs">
                                        {viewingSubmitted ? (
                                            <Spinner className="size-3.5 animate-spin" />
                                        ) : (
                                            <Eye className="size-3.5" />
                                        )}
                                        View answer
                                    </span>
                                </MyButton>
                                {evaluatedFileId && (
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={handleViewEvaluated}
                                    >
                                        <span className="inline-flex items-center gap-1 text-xs">
                                            <FilePdf className="size-3.5 text-red-500" />
                                            View evaluated copy
                                        </span>
                                    </MyButton>
                                )}
                            </div>
                        </div>

                        {/* Full tool */}
                        <div className="mt-auto">
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={handleOpenTool}
                                disable={!attemptId || !playMode}
                            >
                                <span className="inline-flex items-center gap-1 text-xs">
                                    <PencilSimpleLine className="size-3.5" />
                                    Open full evaluator
                                </span>
                            </MyButton>
                        </div>
                    </div>

                    {/* Right — Inline quick evaluate */}
                    <div className="flex flex-col gap-3 bg-neutral-50/50 p-5">
                        <div className="flex items-center gap-2">
                            <ClipboardText size={14} className="text-primary-500" weight="bold" />
                            <span className="text-2xs font-semibold uppercase tracking-wide text-neutral-700">
                                {evaluated ? 'Re-evaluate' : 'Quick evaluate'}
                            </span>
                        </div>

                        {/* Marks */}
                        <div className="flex flex-col gap-1">
                            <label className="text-2xs font-medium text-neutral-600">
                                Marks
                                {primaryQuestion && primaryQuestion.maxMarks > 0
                                    ? ` (out of ${primaryQuestion.maxMarks})`
                                    : ''}{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={
                                    primaryQuestion && primaryQuestion.maxMarks > 0
                                        ? primaryQuestion.maxMarks
                                        : undefined
                                }
                                step="0.5"
                                value={marks}
                                onChange={(e) => setMarks(e.target.value)}
                                placeholder="Enter marks"
                                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                            />
                        </div>

                        {/* Remarks */}
                        <div className="flex flex-col gap-1">
                            <label className="text-2xs font-medium text-neutral-600">
                                Remarks{' '}
                                <span className="font-normal text-neutral-400">(optional)</span>
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Add remarks the learner will see…"
                                rows={2}
                                className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                            />
                        </div>

                        {/* Evaluated PDF */}
                        <div className="flex flex-col gap-1">
                            <label className="text-2xs font-medium text-neutral-600">
                                Evaluated PDF{' '}
                                <span className="font-normal text-neutral-400">(optional)</span>
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex items-center justify-between rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1.5">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <FilePdf size={14} className="shrink-0 text-primary-500" />
                                        <span className="truncate text-xs font-medium text-primary-600">
                                            {file.name}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFile(null)}
                                        disabled={busy}
                                        className="rounded p-1 text-primary-600 hover:bg-primary-100 disabled:opacity-50"
                                        title="Remove"
                                    >
                                        <XIcon size={12} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={busy}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-white px-2 py-2 text-xs font-medium text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50"
                                >
                                    <UploadSimple size={12} />
                                    Upload evaluated PDF
                                </button>
                            )}
                        </div>

                        {/* Save */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={busy || !primaryQuestion || marks.trim() === ''}
                            className="mt-1 w-full rounded-md bg-primary-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {busy
                                ? 'Submitting…'
                                : savedFlash
                                  ? '✓ Submitted'
                                  : evaluated
                                    ? 'Update evaluation'
                                    : 'Submit evaluation'}
                        </button>
                        {!playMode && (
                            <p className="text-2xs text-amber-600">
                                Couldn&apos;t resolve the assessment settings — try the full
                                evaluator.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssessmentAttemptActivity;
