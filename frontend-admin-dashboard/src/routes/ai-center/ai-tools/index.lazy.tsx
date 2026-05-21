import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { AICenterProvider } from '../-contexts/useAICenterContext';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useEffect, useMemo, useState } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useQuery } from '@tanstack/react-query';
import { handleQueryGetListIndividualTopics } from '../-services/ai-center-service';
import { handleGetAdminDetails } from '@/services/student-list-section/getAdminDetails';
import {
    ArrowLeft,
    ArrowRight,
    CaretRight,
    ChalkboardSimple,
    ChatCircleDots,
    ClockCounterClockwise,
    Exam,
    FileAudio,
    FileImage,
    FilePdf,
    FileText,
    MicrophoneStage,
    PencilSimple,
    SortAscending,
} from '@phosphor-icons/react';
import { AITaskIndividualListInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';
import {
    FileFamily,
    classifyFile,
    headingForQuestionTask,
    isQuestionTask,
    relativeTime,
    routeForFamily,
    sourceLabel,
    statusLabel,
    statusStyles,
    taskDisplayName,
} from '../-utils/format';
import { RecentWorkDialog } from '../-components/RecentWorkDialog';
import AIQuestionsPreview from '../-components/AIQuestionsPreview';

type Category = 'assessment' | 'lecture-plan' | 'lecture-review';

const CATEGORIES: Array<{
    id: Category;
    title: string;
    subtitle: string;
    Icon: React.ComponentType<any>;
    accent: string;
    accentBg: string;
    directRoute?: string;
    step2Heading?: string;
}> = [
    {
        id: 'assessment',
        title: 'Create an assessment',
        subtitle: 'A question paper, quiz, or test — from any source you have.',
        Icon: Exam,
        accent: 'text-blue-600',
        accentBg: 'bg-blue-50',
        step2Heading: 'How would you like to generate the questions?',
    },
    {
        id: 'lecture-plan',
        title: 'Plan a lecture',
        subtitle: 'A time-based plan with key points and optional homework.',
        Icon: ChalkboardSimple,
        accent: 'text-violet-600',
        accentBg: 'bg-violet-50',
        directRoute: '/ai-center/ai-tools/vsmart-lecture',
    },
    {
        id: 'lecture-review',
        title: 'Review my teaching',
        subtitle: 'Get a kind, specific review of a class you recorded.',
        Icon: MicrophoneStage,
        accent: 'text-teal-600',
        accentBg: 'bg-teal-50',
        directRoute: '/ai-center/ai-tools/vsmart-feedback',
    },
];

type SubOption = {
    title: string;
    subtitle: string;
    route: string;
    Icon: React.ComponentType<any>;
};

const SUB_OPTIONS: Record<Category, SubOption[]> = {
    assessment: [
        {
            title: 'From a topic',
            subtitle: 'Type a topic, we draft the questions.',
            route: '/ai-center/ai-tools/vsmart-prompt',
            Icon: PencilSimple,
        },
        {
            title: 'From a document',
            subtitle: 'PDF, Word, or PowerPoint — fresh questions about its content.',
            route: '/ai-center/ai-tools/vsmart-upload',
            Icon: FilePdf,
        },
        {
            title: 'From an audio recording',
            subtitle: 'Upload a recording — questions based on what was said.',
            route: '/ai-center/ai-tools/vsmart-audio',
            Icon: FileAudio,
        },
        {
            title: 'From a photo of a paper',
            subtitle: 'Snap a printed paper — turn it into editable questions.',
            route: '/ai-center/ai-tools/vsmart-image',
            Icon: FileImage,
        },
        {
            title: 'From an existing question paper',
            subtitle: 'Digitize a question paper you already have.',
            route: '/ai-center/ai-tools/vsmart-extract',
            Icon: FileText,
        },
        {
            title: 'From my question bank',
            subtitle: 'Auto-sort by topic, or pull specific questions.',
            route: '/ai-center/ai-tools/vsmart-sorter',
            Icon: SortAscending,
        },
        {
            title: 'Chat with a document',
            subtitle: 'Have a back-and-forth about a PDF — ask for questions or summaries.',
            route: '/ai-center/ai-tools/vsmart-chat',
            Icon: ChatCircleDots,
        },
    ],
    'lecture-plan': [],
    'lecture-review': [],
};

const FamilyIcon = ({ family }: { family: FileFamily }) => {
    const cls = 'text-primary-500';
    if (family === 'pdf') return <FilePdf size={20} weight="fill" className={cls} />;
    if (family === 'audio') return <FileAudio size={20} weight="fill" className={cls} />;
    if (family === 'image') return <FileImage size={20} weight="fill" className={cls} />;
    return <FileText size={20} weight="fill" className={cls} />;
};

const greetingPrefix = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const firstName = (full?: string | null) => {
    if (!full) return '';
    return full.trim().split(/\s+/)[0] ?? '';
};

export const Route = createLazyFileRoute('/ai-center/ai-tools/')({
    component: () => (
        <LayoutContainer>
            <AICenterProvider>
                <RouteComponent />
            </AICenterProvider>
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const [category, setCategory] = useState<Category | null>(null);
    const [openAllWork, setOpenAllWork] = useState(false);
    const [previewTask, setPreviewTask] = useState<AITaskIndividualListInterface | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const openTaskFromCard = (task: AITaskIndividualListInterface) => {
        if (isQuestionTask(task) && task.status === 'COMPLETED') {
            setPreviewTask(task);
            setPreviewOpen(true);
            return;
        }
        const family = classifyFile(task.file_detail?.file_type);
        navigate({ to: routeForFamily[family] });
    };

    useEffect(() => {
        setNavHeading('Teaching Assistant');
    }, [setNavHeading]);

    const { data: adminDetails } = useQuery(handleGetAdminDetails());
    const { data: recentTasksData } = useQuery({
        ...handleQueryGetListIndividualTopics(),
        staleTime: 60 * 1000,
    });

    const continueItems = useMemo(() => {
        const list: AITaskIndividualListInterface[] = Array.isArray(recentTasksData)
            ? recentTasksData
            : [];
        return [...list]
            .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
            .slice(0, 3);
    }, [recentTasksData]);

    const name = firstName(adminDetails?.full_name);
    const activeCategory = category ? CATEGORIES.find((c) => c.id === category) : null;
    const subOptions = category ? SUB_OPTIONS[category] : [];

    return (
        <div className="flex w-full flex-col gap-10 pb-12">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                    {greetingPrefix()}
                    {name ? `, ${name}` : ''}.
                </h1>
                <p className="text-sm text-gray-500">
                    Let&apos;s get you to the right tool in a couple of clicks.
                </p>
            </header>

            <section className="flex flex-col gap-5">
                {category === null ? (
                    <>
                        <div className="flex items-baseline gap-3">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-600">
                                1
                            </span>
                            <div className="flex flex-col gap-0.5">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    What brings you here today?
                                </h2>
                                <p className="text-xs text-neutral-500">
                                    Pick the broad goal. We&apos;ll narrow down on the next
                                    step.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {CATEGORIES.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() =>
                                        c.directRoute
                                            ? navigate({ to: c.directRoute })
                                            : setCategory(c.id)
                                    }
                                    className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
                                >
                                    <div
                                        className={`flex size-12 items-center justify-center rounded-xl ${c.accentBg} ${c.accent}`}
                                    >
                                        <c.Icon size={24} weight="fill" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-base font-semibold text-gray-900">
                                            {c.title}
                                        </span>
                                        <span className="text-sm text-neutral-500">
                                            {c.subtitle}
                                        </span>
                                    </div>
                                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-500 opacity-0 transition-opacity group-hover:opacity-100">
                                        {c.directRoute ? 'Open' : 'Continue'}
                                        <CaretRight size={12} weight="bold" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => setCategory(null)}
                                className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700"
                            >
                                <ArrowLeft size={14} />
                                Back
                            </button>
                            <div className="flex items-baseline gap-3">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-600">
                                    2
                                </span>
                                <div className="flex flex-col gap-0.5">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {activeCategory!.step2Heading ??
                                            `${activeCategory!.title} — which one?`}
                                    </h2>
                                    <p className="text-xs text-neutral-500">
                                        Pick how you want to start. The next screen asks for
                                        the specifics.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {subOptions.map((opt) => (
                                <button
                                    key={opt.route}
                                    type="button"
                                    onClick={() => navigate({ to: opt.route })}
                                    className="group flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-primary-200 hover:shadow-md"
                                >
                                    <div
                                        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${activeCategory!.accentBg} ${activeCategory!.accent}`}
                                    >
                                        <opt.Icon size={20} weight="fill" />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="text-sm font-semibold text-gray-900">
                                            {opt.title}
                                        </span>
                                        <span className="text-xs text-neutral-500">
                                            {opt.subtitle}
                                        </span>
                                    </div>
                                    <ArrowRight
                                        size={16}
                                        weight="bold"
                                        className="shrink-0 text-neutral-300 transition-colors group-hover:text-primary-500"
                                    />
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </section>

            {continueItems.length > 0 && (
                <section className="flex flex-col gap-4">
                    <header className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ClockCounterClockwise size={18} className="text-neutral-500" />
                            <h2 className="text-base font-semibold text-gray-900">
                                Your recent work
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpenAllWork(true)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        >
                            View all
                            <ArrowRight size={12} weight="bold" />
                        </button>
                    </header>
                    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {continueItems.map((task) => {
                            const family = classifyFile(task.file_detail?.file_type);
                            const display = taskDisplayName(task, 'Topic-based questions');
                            return (
                                <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => openTaskFromCard(task)}
                                    className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-primary-200 hover:shadow-md"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                                            <FamilyIcon family={family} />
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="line-clamp-2 text-sm font-medium text-gray-900">
                                                {display}
                                            </span>
                                            <span className="text-xs text-neutral-500">
                                                {sourceLabel[family]} ·{' '}
                                                {relativeTime(task.updated_at)}
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
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            <RecentWorkDialog
                open={openAllWork}
                onOpenChange={setOpenAllWork}
                tasks={
                    Array.isArray(recentTasksData)
                        ? (recentTasksData as AITaskIndividualListInterface[])
                        : []
                }
                onPreviewTask={(task) => {
                    setOpenAllWork(false);
                    setPreviewTask(task);
                    setPreviewOpen(true);
                }}
            />

            {previewTask && (
                <AIQuestionsPreview
                    key={previewTask.id}
                    task={previewTask}
                    openQuestionsPreview={previewOpen}
                    setOpenQuestionsPreview={(open) => {
                        const next = typeof open === 'function' ? open(previewOpen) : open;
                        setPreviewOpen(next);
                        if (!next) {
                            setTimeout(() => setPreviewTask(null), 200);
                        }
                    }}
                    heading={headingForQuestionTask(previewTask)}
                    hideTrigger
                />
            )}
        </div>
    );
}
