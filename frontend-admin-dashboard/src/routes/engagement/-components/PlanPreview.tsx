import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import type { EngagementItemType, MissPolicy } from '../-types/types';

/**
 * Live preview of what the learner will see, rendered from the composer's current
 * state rather than from a saved plan — so it updates as the teacher types.
 *
 * It deliberately mirrors the learner rules rather than just listing the fields:
 * the answer key stays hidden until the reveal time, catch-up shows its reduced
 * percentage, and a locked future task shows no content at all. A preview that
 * showed the answer would teach the wrong thing about how this works.
 */

export interface PreviewTask {
    key: string;
    itemType: EngagementItemType;
    title: string;
    isRequired?: boolean;
    contentHtml?: string;
    prompt?: string;
    options?: { id: string; text: string }[];
    correctOptionId?: string;
    explanation?: string;
    completionPoints?: number;
    correctPoints?: number;
}

const TYPE_ACCENT: Record<EngagementItemType, string> = {
    READING_HTML: 'bg-sky-500',
    VISUAL_NOTE: 'bg-violet-500',
    QUESTION_OF_DAY: 'bg-amber-500',
    QUIZ: 'bg-emerald-500',
    GAME: 'bg-rose-500',
    POLL: 'bg-indigo-500',
    COURSE_SLIDE: 'bg-teal-500',
};

function clean(html: string): string {
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function PlanPreview({
    tasks,
    startTime,
    endTime,
    revealTime,
    missPolicy,
    catchUpPercent,
    activeKey,
}: {
    tasks: PreviewTask[];
    startTime: string;
    endTime: string;
    revealTime?: string;
    missPolicy: MissPolicy;
    catchUpPercent?: number;
    /** Which task to show expanded; defaults to the first. */
    activeKey?: string | null;
}) {
    const { t } = useTranslation('engagement');
    const active = tasks.find((t) => t.key === activeKey) ?? tasks[0];
    const isQuestion = active?.itemType === 'QUESTION_OF_DAY' || active?.itemType === 'POLL';
    const isProse = active?.itemType === 'READING_HTML' || active?.itemType === 'VISUAL_NOTE';

    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {t('preview.title')}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                    {t('preview.open', { start: startTime, end: endTime })}
                    {revealTime ? ` · ${t('preview.answersAt', { time: revealTime })}` : ''}
                </p>
            </div>

            {/* The home-page card */}
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-neutral-900">
                            {t('preview.cardTitle')}
                        </p>
                        <p className="text-xs text-neutral-500">
                            {t('preview.done', { count: tasks.length })}
                        </p>
                    </div>
                    <span className="h-2 w-20 overflow-hidden rounded-full bg-neutral-200" />
                </div>
                <div className="divide-y divide-neutral-100">
                    {tasks.length === 0 && (
                        <p className="px-4 py-6 text-center text-xs text-neutral-400">
                            {t('preview.addTask')}
                        </p>
                    )}
                    {tasks.map((task) => (
                        <div key={task.key} className="flex items-center gap-3 px-4 py-3">
                            <span
                                className={`h-8 w-1.5 shrink-0 rounded-full ${TYPE_ACCENT[task.itemType]}`}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600">
                                        {t(`composer.types.${task.itemType}`)}
                                    </span>
                                    {task.isRequired && (
                                        <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-white">
                                            {t('composer.required')}
                                        </span>
                                    )}
                                </span>
                                <span className="mt-1 block truncate text-sm text-neutral-900">
                                    {task.title || t('preview.untitled')}
                                </span>
                                <span className="block text-xs text-neutral-500">
                                    {t('preview.upTo', {
                                        count:
                                            (task.completionPoints ?? 0) +
                                            (task.correctPoints ?? 0),
                                    })}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* The opened task */}
            {active && (
                <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
                    <p className="text-sm font-semibold text-neutral-900">
                        {active.title || t('preview.untitled')}
                    </p>

                    {missPolicy === 'CATCH_UP_REDUCED' && (
                        <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                            {t('preview.catchUp', { percent: catchUpPercent ?? 50 })}
                        </p>
                    )}

                    {isProse && active.contentHtml && (
                        <div
                            className="prose prose-sm max-w-none text-sm text-neutral-700"
                            // Composer-authored HTML, sanitized before preview.
                            dangerouslySetInnerHTML={{ __html: clean(active.contentHtml) }}
                        />
                    )}

                    {active.itemType === 'COURSE_SLIDE' && (
                        <p className="rounded bg-teal-50 px-2 py-1.5 text-xs text-teal-800">
                            {t('preview.lesson')}
                        </p>
                    )}

                    {active.itemType === 'GAME' && (
                        <p className="rounded bg-neutral-50 px-2 py-1.5 text-xs text-neutral-500">
                            {t('preview.sandboxed')}
                        </p>
                    )}

                    {isQuestion && (
                        <>
                            {active.prompt && (
                                <div
                                    className="prose prose-sm max-w-none text-sm text-neutral-800"
                                    dangerouslySetInnerHTML={{ __html: clean(active.prompt) }}
                                />
                            )}
                            <div className="grid gap-1.5">
                                {(active.options ?? [])
                                    .filter((o) => o.text.trim().length > 0)
                                    .map((option) => (
                                        <div
                                            key={option.id}
                                            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
                                        >
                                            {option.text}
                                        </div>
                                    ))}
                                {(active.options ?? []).every((o) => !o.text.trim()) && (
                                    <p className="text-xs text-neutral-400">
                                        {t('preview.optionsHint')}
                                    </p>
                                )}
                            </div>
                            {active.itemType === 'QUESTION_OF_DAY' && (
                                <p className="rounded bg-neutral-50 px-2 py-1.5 text-xs text-neutral-500">
                                    {t(
                                        active.explanation
                                            ? 'preview.hiddenAnswerExpl'
                                            : 'preview.hiddenAnswer',
                                        { time: revealTime || endTime }
                                    )}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
