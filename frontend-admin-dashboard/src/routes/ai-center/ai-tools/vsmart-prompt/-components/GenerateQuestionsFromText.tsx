import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    handleGetQuestionsFromText,
    handleQueryGetListIndividualTopics,
} from '../../../-services/ai-center-service';
import { useForm, UseFormReturn, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAICenter } from '../../../-contexts/useAICenterContext';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { languageSupport } from '@/constants/dummy-data';
import { SectionFormType } from '@/types/assessments/assessment-steps';
import { getRandomTaskName } from '@/routes/ai-center/-utils/helper';
import { ArrowRight, PencilSimple, Sparkle } from '@phosphor-icons/react';
import { AITaskIndividualListInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';
import {
    relativeTime,
    statusLabel,
    statusStyles,
    taskDisplayName,
} from '@/routes/ai-center/-utils/format';
import { GeneratingState } from '@/routes/ai-center/-components/GeneratingState';
import AIQuestionsPreview from '@/routes/ai-center/-components/AIQuestionsPreview';
import { RecentFilesPanel } from '@/routes/ai-center/-components/RecentFilesPanel';

const QUESTION_TYPES = ['MCQ', 'True/False', 'Numeric', 'Short answer', 'Mixed'];

const formSchema = z.object({
    taskName: z.string().min(1),
    text: z.string().min(1),
    num: z.number().min(1),
    class_level: z.string().min(1),
    topics: z.string().min(1),
    question_type: z.string().min(1),
    question_language: z.string().min(1),
    preferredModel: z.string().optional(),
});

export type QuestionsFromTextData = z.infer<typeof formSchema>;

export const GenerateQuestionsFromText = ({
    form: parentForm,
    currentSectionIndex,
    initialTopic,
}: {
    form?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
    initialTopic?: string;
}) => {
    const queryClient = useQueryClient();
    const { setLoader, setKey } = useAICenter();
    const [enableTasksDialog, setEnableTasksDialog] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
    const [readyTask, setReadyTask] = useState<AITaskIndividualListInterface | null>(null);
    const [openPreviewDialog, setOpenPreviewDialog] = useState(false);

    const form = useForm<QuestionsFromTextData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            taskName: getRandomTaskName(),
            text: initialTopic?.trim() ?? '',
            num: 10,
            class_level: '',
            topics: '',
            question_type: 'MCQ',
            question_language: languageSupport[0],
            preferredModel: undefined,
        },
    });

    useEffect(() => {
        const topic = initialTopic?.trim();
        if (topic && !form.getValues('text')) {
            form.setValue('text', topic);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTopic]);

    const generateMutation = useMutation({
        mutationFn: async ({ data, taskId }: { data: QuestionsFromTextData; taskId: string }) => {
            setLoader(true);
            setKey('text');
            return handleGetQuestionsFromText(
                data.taskName,
                data.text,
                data.num,
                data.class_level,
                data.topics,
                data.question_type,
                data.question_language,
                taskId,
                data.preferredModel
            );
        },
        onSuccess: (response: unknown) => {
            setLoader(false);
            setKey(null);
            const taskId = (response as { taskId?: string } | null)?.taskId ?? null;
            setPendingTaskId(taskId);
            setReadyTask(null);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
        },
        onError: (error: unknown) => {
            console.error(error);
            setLoader(false);
            setKey(null);
            setErrorMessage("We couldn't draft questions from this. Want to try again?");
        },
    });

    const onSubmit = (values: QuestionsFromTextData) => {
        setErrorMessage(null);
        setReadyTask(null);
        setPendingTaskId(null);
        generateMutation.mutate({
            data: { ...values, taskName: getRandomTaskName() },
            taskId: '',
        });
    };

    const pollGenerateQuestionsFromText = (data: QuestionsFromTextData) => {
        onSubmit(data);
    };

    const { data: recentTasksData } = useQuery({
        ...handleQueryGetListIndividualTopics('TEXT_TO_QUESTIONS'),
        staleTime: 30 * 1000,
        refetchInterval:
            pendingTaskId !== null && readyTask === null ? 5000 : false,
    });

    useEffect(() => {
        if (!pendingTaskId || !Array.isArray(recentTasksData)) return;
        const match = recentTasksData.find(
            (t: AITaskIndividualListInterface) => t.id === pendingTaskId
        );
        if (!match) return;
        if (match.status === 'COMPLETED') {
            setReadyTask(match);
        } else if (match.status === 'FAILED') {
            setErrorMessage("We couldn't finish this draft. Want to try again?");
            setPendingTaskId(null);
        }
    }, [recentTasksData, pendingTaskId]);

    const recentTasks = useMemo(() => {
        const list: AITaskIndividualListInterface[] = Array.isArray(recentTasksData)
            ? recentTasksData
            : [];
        return [...list].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 3);
    }, [recentTasksData]);

    const isWorking =
        generateMutation.status === 'pending' ||
        (pendingTaskId !== null && readyTask === null);

    return (
        <div className="flex w-full flex-col gap-10 px-4 pb-12 sm:px-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                    Questions from a Topic
                </h1>
                <p className="text-sm text-gray-500">
                    Tell us the topic and what students should learn. We&apos;ll draft a set
                    of questions you can edit before sending.
                </p>
            </header>

            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
                <Section step={1} title="What&apos;s the topic?">
                    <div className="flex flex-col gap-4">
                        <Controller
                            control={form.control}
                            name="topics"
                            render={({ field, fieldState }) => (
                                <Field
                                    label="Topic name"
                                    error={fieldState.error ? 'Please give the topic a name.' : null}
                                >
                                    <input
                                        {...field}
                                        placeholder="e.g. Photosynthesis"
                                        disabled={isWorking}
                                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
                                    />
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="text"
                            render={({ field, fieldState }) => (
                                <Field
                                    label="What should students learn?"
                                    error={
                                        fieldState.error
                                            ? 'Please describe what the questions should cover.'
                                            : null
                                    }
                                >
                                    <textarea
                                        {...field}
                                        placeholder="e.g. test understanding of the process of photosynthesis, the factors that affect it, and its importance in ecosystems"
                                        rows={4}
                                        disabled={isWorking}
                                        className="w-full resize-y rounded-xl border border-neutral-200 bg-white p-3 text-sm placeholder:text-neutral-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
                                    />
                                </Field>
                            )}
                        />
                    </div>
                </Section>

                <Section step={2} title="Who&apos;s it for, and how many?">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Controller
                            control={form.control}
                            name="class_level"
                            render={({ field, fieldState }) => (
                                <Field
                                    label="Class"
                                    error={fieldState.error ? 'Please enter a class' : null}
                                >
                                    <input
                                        {...field}
                                        placeholder="e.g. 8th standard"
                                        disabled={isWorking}
                                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
                                    />
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="num"
                            render={({ field, fieldState }) => (
                                <Field
                                    label="Number of questions"
                                    error={
                                        fieldState.error ? 'How many questions would you like?' : null
                                    }
                                >
                                    <input
                                        value={String(field.value ?? '')}
                                        onChange={(e) => {
                                            const cleaned = e.target.value.replace(/\D/g, '');
                                            field.onChange(cleaned === '' ? 0 : Number(cleaned));
                                        }}
                                        inputMode="numeric"
                                        placeholder="10"
                                        disabled={isWorking}
                                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
                                    />
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="question_type"
                            render={({ field }) => (
                                <Field label="Question type">
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUESTION_TYPES.map((q) => (
                                            <button
                                                key={q}
                                                type="button"
                                                onClick={() => field.onChange(q)}
                                                disabled={isWorking}
                                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                                    field.value === q
                                                        ? 'border-primary-300 bg-primary-50 text-primary-600'
                                                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'
                                                } disabled:opacity-50`}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="question_language"
                            render={({ field }) => (
                                <Field label="Language">
                                    <select
                                        {...field}
                                        disabled={isWorking}
                                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
                                    >
                                        {languageSupport.map((lang) => (
                                            <option key={lang} value={lang}>
                                                {lang.charAt(0) + lang.slice(1).toLowerCase()}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}
                        />
                    </div>
                </Section>

                {errorMessage && (
                    <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                        {errorMessage}
                    </div>
                )}

                {isWorking ? (
                    <GeneratingState
                        title="Drafting your questions"
                        subtitle="Crafting questions on your topic. Usually ~30 seconds."
                    />
                ) : readyTask ? (
                    <div className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-blue-50 p-6">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/20">
                                    <Sparkle size={22} weight="fill" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-base font-semibold text-gray-900">
                                            Here&apos;s what we drafted for you
                                        </p>
                                        <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-600 ring-1 ring-inset ring-primary-200">
                                            <Sparkle size={10} weight="fill" />
                                            AI-generated
                                        </span>
                                    </div>
                                    <p className="text-sm text-neutral-600">
                                        Review and tweak the questions before saving or
                                        exporting. The teacher always has the final word.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <AIQuestionsPreview
                                    task={readyTask}
                                    openQuestionsPreview={openPreviewDialog}
                                    setOpenQuestionsPreview={setOpenPreviewDialog}
                                    heading="Vsmart Topics"
                                    pollGenerateQuestionsFromText={
                                        pollGenerateQuestionsFromText
                                    }
                                    sectionsForm={parentForm}
                                    currentSectionIndex={currentSectionIndex}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReadyTask(null);
                                        setPendingTaskId(null);
                                        form.reset({
                                            taskName: getRandomTaskName(),
                                            text: '',
                                            num: 10,
                                            class_level: '',
                                            topics: '',
                                            question_type: 'MCQ',
                                            question_language: languageSupport[0],
                                            preferredModel: undefined,
                                        });
                                        setErrorMessage(null);
                                    }}
                                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50"
                                >
                                    Draft another
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        type="submit"
                        className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                    >
                        Draft my questions
                        <ArrowRight size={16} weight="bold" />
                    </button>
                )}
            </form>

            <RecentFilesPanel
                tasks={recentTasks}
                title="Your recent drafts"
                fallbackLabel="Topic-based draft"
                emptyHint="Your topic-based drafts will appear here. Fill in the topic above and draft your first one."
                onOpenAll={() => setEnableTasksDialog(true)}
                overrideIcon={
                    <PencilSimple size={18} weight="fill" className="text-primary-500" />
                }
            />

            <AITasksList
                heading="Vsmart Topics"
                enableDialog={enableTasksDialog}
                setEnableDialog={setEnableTasksDialog}
                sectionsForm={parentForm}
                currentSectionIndex={currentSectionIndex}
            />
        </div>
    );
};

const Section = ({
    step,
    title,
    children,
}: {
    step: number;
    title: string;
    children: React.ReactNode;
}) => (
    <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-600">
                {step}
            </span>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="pl-9">{children}</div>
    </section>
);

const Field = ({
    label,
    error,
    children,
}: {
    label: string;
    error?: string | null;
    children: React.ReactNode;
}) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-600">{label}</label>
        {children}
        {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
);
