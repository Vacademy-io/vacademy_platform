import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { handleGetListIndividualTopics } from '../-services/ai-center-service';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import AIQuestionsPreview from './AIQuestionsPreview';
import { AITaskIndividualListInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';
import { getTaskTypeFromFeature } from '../-helpers/GetImagesForAITools';
import AIChatWithPDFPreview from './AIChatWithPDFPreview';
import AIPlanLecturePreview from './AIPlanLecturePreview';
import AIEvaluatePreview from './AIEvaluatePreview';
import {
    ArrowCounterClockwise,
    CaretLeft,
    CaretRight,
    DownloadSimple,
    FileAudio,
    FileImage,
    FilePdf,
    FileText,
    MagnifyingGlass,
    Sparkle,
    X,
} from '@phosphor-icons/react';
import {
    FileFamily,
    classifyFile,
    friendlyHeading,
    relativeTime,
    sourceLabel,
    statusLabel,
    statusStyles,
    taskDisplayName,
} from '../-utils/format';
import type { QuestionsFromTextData } from '../ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import { UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';
import { useAIQuestionDialogStore } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/zustand-global-states/ai-add-questions-dialog-zustand';

const FamilyIcon = ({ family }: { family: FileFamily }) => {
    const cls = 'text-primary-500';
    if (family === 'pdf') return <FilePdf size={20} weight="fill" className={cls} />;
    if (family === 'audio') return <FileAudio size={20} weight="fill" className={cls} />;
    if (family === 'image') return <FileImage size={20} weight="fill" className={cls} />;
    return <FileText size={20} weight="fill" className={cls} />;
};

type StatusFilter = 'all' | 'COMPLETED' | 'PROGRESS' | 'FAILED';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'COMPLETED', label: 'Ready' },
    { value: 'PROGRESS', label: 'In progress' },
    { value: 'FAILED', label: 'Failed' },
];

const DATE_BUCKETS = ['Today', 'Yesterday', 'Earlier this week', 'Older'] as const;
type DateBucket = (typeof DATE_BUCKETS)[number];

const bucketForDate = (iso: string): DateBucket => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === yesterday.getTime()) return 'Yesterday';
    if (d >= weekAgo) return 'Earlier this week';
    return 'Older';
};

async function handleDownload(url: string, file_name: string) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Download failed:', error);
    }
}

type TaskCardProps = {
    task: AITaskIndividualListInterface;
    heading: string;
    openQuestionsPreview: boolean;
    setOpenQuestionsPreview: React.Dispatch<React.SetStateAction<boolean>>;
    pollGenerateAssessment?: (prompt?: string, taskId?: string) => void;
    handleGenerateQuestionsForAssessment?: (
        pdfId?: string,
        prompt?: string,
        taskId?: string
    ) => void;
    pollGenerateQuestionsFromText?: (data: QuestionsFromTextData) => void;
    pollGenerateQuestionsFromAudio?: (data: QuestionsFromTextData, taskId: string) => void;
    sectionsForm?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
};

const TaskCard = ({
    task,
    heading,
    openQuestionsPreview,
    setOpenQuestionsPreview,
    pollGenerateAssessment,
    handleGenerateQuestionsForAssessment,
    pollGenerateQuestionsFromText,
    pollGenerateQuestionsFromAudio,
    sectionsForm,
    currentSectionIndex,
}: TaskCardProps) => {
    const family = classifyFile(task.file_detail?.file_type);
    const display = taskDisplayName(task);

    return (
        <div className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-primary-200 hover:shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                    <FamilyIcon family={family} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="break-words text-sm font-medium text-gray-900">
                        {display}
                    </span>
                    <span className="text-xs text-neutral-500">
                        {sourceLabel[family]} · {relativeTime(task.updated_at)}
                    </span>
                </div>
                <span
                    className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusStyles(
                        task.status
                    )}`}
                >
                    {statusLabel(task.status)}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-[52px]">
                {task.status !== 'PROGRESS' && heading === 'Vsmart Feedback' && (
                    <AIEvaluatePreview
                        task={task}
                        openEvaluatePreview={openQuestionsPreview}
                        setOpenEvaluatePreview={setOpenQuestionsPreview}
                    />
                )}
                {task.status !== 'PROGRESS' && heading === 'Vsmart Lecturer' && (
                    <AIPlanLecturePreview
                        task={task}
                        openPlanLecturePreview={openQuestionsPreview}
                        setOpenPlanLecturePreview={setOpenQuestionsPreview}
                    />
                )}
                {task.status !== 'PROGRESS' && heading === 'Vsmart Chat' && (
                    <AIChatWithPDFPreview
                        task={task}
                        openAIPreview={openQuestionsPreview}
                        setOpenAIPreview={setOpenQuestionsPreview}
                    />
                )}
                {heading !== 'Vsmart Lecturer' &&
                    heading !== 'Vsmart Chat' &&
                    heading !== 'Vsmart Feedback' &&
                    (task.status === 'COMPLETED' || task.status === 'FAILED') && (
                        <AIQuestionsPreview
                            task={task}
                            pollGenerateAssessment={pollGenerateAssessment}
                            handleGenerateQuestionsForAssessment={
                                handleGenerateQuestionsForAssessment
                            }
                            pollGenerateQuestionsFromText={pollGenerateQuestionsFromText}
                            pollGenerateQuestionsFromAudio={pollGenerateQuestionsFromAudio}
                            heading={heading}
                            openQuestionsPreview={openQuestionsPreview}
                            setOpenQuestionsPreview={setOpenQuestionsPreview}
                            sectionsForm={sectionsForm}
                            currentSectionIndex={currentSectionIndex}
                        />
                    )}
                {task.file_detail && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (task.file_detail) {
                                handleDownload(
                                    task.file_detail.url,
                                    task.file_detail.file_name
                                );
                            }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                    >
                        <DownloadSimple size={14} />
                        Download
                    </button>
                )}
            </div>
        </div>
    );
};

const AITasksList = ({
    heading,
    enableDialog = false,
    setEnableDialog,
    pollGenerateAssessment,
    handleGenerateQuestionsForAssessment,
    pollGenerateQuestionsFromText,
    pollGenerateQuestionsFromAudio,
    sectionsForm,
    currentSectionIndex,
}: {
    heading: string;
    enableDialog?: boolean;
    setEnableDialog?: React.Dispatch<React.SetStateAction<boolean>>;
    pollGenerateAssessment?: (prompt?: string, taskId?: string) => void;
    handleGenerateQuestionsForAssessment?: (
        pdfId?: string,
        prompt?: string,
        taskId?: string
    ) => void;
    pollGenerateQuestionsFromText?: (data: QuestionsFromTextData) => void;
    pollGenerateQuestionsFromAudio?: (data: QuestionsFromTextData, taskId: string) => void;
    sectionsForm?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const { isAIQuestionDialog9, setIsAIQuestionDialog9 } = useAIQuestionDialogStore();

    const [openQuestionsPreview, setOpenQuestionsPreview] = useState(false);
    const [allTasks, setAllTasks] = useState<AITaskIndividualListInterface[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const getAITasksIndividualListMutation = useMutation({
        mutationFn: async ({ taskType }: { taskType: string }) => {
            return handleGetListIndividualTopics(taskType);
        },
        onSuccess: (response) => {
            setAllTasks(response);
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    const handleRefreshList = (taskType: string) => {
        getAITasksIndividualListMutation.mutate({ taskType });
    };

    const { mutate } = getAITasksIndividualListMutation;

    useEffect(() => {
        if (isAIQuestionDialog9 && !openQuestionsPreview) {
            let count = 0;
            const maxRuns = 5;
            const interval = setInterval(() => {
                if (count >= maxRuns) {
                    clearInterval(interval);
                    return;
                }
                mutate({ taskType: getTaskTypeFromFeature(heading) });
                count++;
            }, 20000);

            return () => clearInterval(interval);
        }
        return () => {};
    }, [mutate, heading, isAIQuestionDialog9, openQuestionsPreview]);

    useEffect(() => {
        const fetchTasks = async () => {
            setIsLoading(true);
            try {
                const taskType = getTaskTypeFromFeature(heading);
                const data = await handleGetListIndividualTopics(taskType);
                setAllTasks(data);
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
                setAllTasks([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTasks();
    }, [heading]);

    useEffect(() => {
        setIsAIQuestionDialog9(enableDialog);
    }, [enableDialog]);

    const handleCloseListDialog = () => {
        setIsAIQuestionDialog9(!isAIQuestionDialog9);
        setEnableDialog?.(false);
    };

    const friendly = friendlyHeading(heading);
    const isLoadingState =
        getAITasksIndividualListMutation.status === 'pending' || isLoading;

    const filteredTasks = useMemo(() => {
        let result = allTasks;
        if (statusFilter !== 'all') {
            result = result.filter((t) => t.status === statusFilter);
        }
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            result = result.filter((t) => {
                const display = taskDisplayName(t).toLowerCase();
                const name = (t.task_name || '').toLowerCase();
                const file = (t.file_detail?.file_name || '').toLowerCase();
                return display.includes(q) || name.includes(q) || file.includes(q);
            });
        }
        return result;
    }, [allTasks, statusFilter, searchQuery]);

    const sortedFiltered = useMemo(
        () =>
            [...filteredTasks].sort((a, b) =>
                a.updated_at < b.updated_at ? 1 : -1
            ),
        [filteredTasks]
    );

    const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / ITEMS_PER_PAGE));
    const safePage = Math.min(page, totalPages);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter]);

    const pagedTasks = useMemo(() => {
        const start = (safePage - 1) * ITEMS_PER_PAGE;
        return sortedFiltered.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedFiltered, safePage]);

    const groupedTasks = useMemo(() => {
        const groups: Record<DateBucket, AITaskIndividualListInterface[]> = {
            Today: [],
            Yesterday: [],
            'Earlier this week': [],
            Older: [],
        };
        for (const task of pagedTasks) {
            groups[bucketForDate(task.updated_at)].push(task);
        }
        return groups;
    }, [pagedTasks]);

    const rangeStart =
        sortedFiltered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
    const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, sortedFiltered.length);

    const statusCounts = useMemo(() => {
        const counts: Record<StatusFilter, number> = {
            all: allTasks.length,
            COMPLETED: 0,
            PROGRESS: 0,
            FAILED: 0,
        };
        for (const task of allTasks) {
            if (task.status === 'COMPLETED') counts.COMPLETED++;
            else if (task.status === 'FAILED') counts.FAILED++;
            else counts.PROGRESS++;
        }
        return counts;
    }, [allTasks]);

    const hasAnyResult = filteredTasks.length > 0;
    const hasAnyTasks = allTasks.length > 0;

    return (
        <Dialog open={isAIQuestionDialog9} onOpenChange={handleCloseListDialog}>
            {!setEnableDialog && (
                <DialogTrigger
                    asChild
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="border-none font-normal !text-blue-600 shadow-none hover:bg-transparent focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent"
                    >
                        View all
                    </MyButton>
                </DialogTrigger>
            )}
            <DialogContent
                onClick={(e) => e.stopPropagation()}
                className="no-scrollbar !m-0 flex size-[90%] flex-col !gap-0 overflow-hidden !p-0"
            >
                <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-neutral-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5">
                            <h2 className="text-lg font-semibold text-gray-900">{friendly}</h2>
                            {!isLoadingState && (
                                <p className="text-xs text-neutral-500">
                                    {allTasks.length === 0
                                        ? 'Nothing here yet'
                                        : `${allTasks.length} ${allTasks.length === 1 ? 'item' : 'items'}`}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    handleRefreshList(getTaskTypeFromFeature(heading))
                                }
                                className="rounded-lg border border-neutral-200 p-2 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
                                aria-label="Refresh"
                            >
                                <ArrowCounterClockwise size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={handleCloseListDialog}
                                className="rounded-lg border border-neutral-200 p-2 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {hasAnyTasks && (
                        <>
                            <div className="relative">
                                <MagnifyingGlass
                                    size={14}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or filename…"
                                    className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm placeholder:text-neutral-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                                        aria-label="Clear search"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {STATUS_FILTERS.map((f) => {
                                    const active = statusFilter === f.value;
                                    const count = statusCounts[f.value];
                                    return (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() => setStatusFilter(f.value)}
                                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                                                active
                                                    ? 'border-primary-300 bg-primary-50 text-primary-600'
                                                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'
                                            }`}
                                        >
                                            {f.label}
                                            <span
                                                className={`inline-flex min-w-[20px] items-center justify-center rounded px-1 text-[10px] ${
                                                    active
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'bg-neutral-100 text-neutral-500'
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {isLoadingState ? (
                    <DashboardLoader />
                ) : !hasAnyTasks ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                        <Sparkle size={28} weight="fill" className="text-primary-300" />
                        <p className="text-sm font-medium text-gray-900">Nothing here yet</p>
                        <p className="max-w-xs text-xs text-neutral-500">
                            Anything you draft with this tool will show up here.
                        </p>
                    </div>
                ) : !hasAnyResult ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                        <MagnifyingGlass size={24} className="text-neutral-300" />
                        <p className="text-sm font-medium text-gray-900">No matches</p>
                        <p className="max-w-xs text-xs text-neutral-500">
                            Try a different search term or filter.
                        </p>
                        {(searchQuery || statusFilter !== 'all') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('all');
                                }}
                                className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 overflow-y-auto bg-neutral-50 p-5">
                        {DATE_BUCKETS.map((bucket) => {
                            const tasks = groupedTasks[bucket];
                            if (tasks.length === 0) return null;
                            return (
                                <section key={bucket} className="flex flex-col gap-3">
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                            {bucket}
                                        </h3>
                                        <span className="text-[11px] text-neutral-400">
                                            {tasks.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {tasks.map((task) => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                heading={heading}
                                                openQuestionsPreview={openQuestionsPreview}
                                                setOpenQuestionsPreview={
                                                    setOpenQuestionsPreview
                                                }
                                                pollGenerateAssessment={
                                                    pollGenerateAssessment
                                                }
                                                handleGenerateQuestionsForAssessment={
                                                    handleGenerateQuestionsForAssessment
                                                }
                                                pollGenerateQuestionsFromText={
                                                    pollGenerateQuestionsFromText
                                                }
                                                pollGenerateQuestionsFromAudio={
                                                    pollGenerateQuestionsFromAudio
                                                }
                                                sectionsForm={sectionsForm}
                                                currentSectionIndex={currentSectionIndex}
                                            />
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
                {hasAnyResult && totalPages > 1 && (
                    <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3">
                        <span className="text-xs text-neutral-500">
                            Showing {rangeStart}–{rangeEnd} of {sortedFiltered.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <CaretLeft size={12} weight="bold" />
                                Prev
                            </button>
                            <span className="px-2 text-xs text-neutral-600">
                                Page {safePage} of {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage === totalPages}
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                                <CaretRight size={12} weight="bold" />
                            </button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default AITasksList;
