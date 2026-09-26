import { ShieldCheck } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/design-system/status-chips';
import {
    getWritingIntegrity,
    type WritingIntegrity,
} from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/ai-evaluation-services';

interface Props {
    processId: string;
    questionId: string;
}

const formatMinutes = (seconds: number | null) =>
    seconds == null ? null : Math.max(1, Math.round(seconds / 60));

/**
 * How a typed answer was written: pace, typing signals, overlap with another
 * learner, and the AI grader's machine-text hint. Evidence for the teacher to
 * look at - it proves nothing and never changes the marks. Renders nothing
 * for an uploaded copy or a question with no report.
 */
export function WritingIntegrityPanel({ processId, questionId }: Props) {
    const { t } = useTranslation('assessmentWritingIntegrityPanel');
    // One request per process, shared by every question card through the cache.
    const { data } = useQuery({
        queryKey: ['WRITING_INTEGRITY', processId],
        queryFn: () => getWritingIntegrity(processId),
        staleTime: 60_000,
        enabled: !!processId,
    });
    const report: WritingIntegrity | undefined = data?.find((r) => r.question_id === questionId);
    if (!report) return null;

    const signals = report.signals;
    const minutes = formatMinutes(report.time_taken_seconds);
    const stats: string[] = [t('stats.words', { value: report.words })];
    if (minutes != null) stats.push(t('stats.minutes', { value: minutes }));
    if (report.words_per_minute != null) {
        stats.push(t('stats.wordsPerMinute', { value: report.words_per_minute }));
    }
    if (signals) {
        stats.push(t('stats.tabSwitches', { value: signals.focusLosses ?? 0 }));
        stats.push(t('stats.corrections', { value: signals.deletions ?? 0 }));
        stats.push(t('stats.largeInserts', { value: signals.largeInserts ?? 0 }));
        stats.push(t('stats.blockedPastes', { value: signals.blockedInjections ?? 0 }));
    }
    if (report.similar_participant && report.similarity_percent != null) {
        stats.push(
            t('stats.similarity', {
                name: report.similar_participant,
                percent: Math.round(report.similarity_percent),
            })
        );
    }
    if (report.ai_style_level) {
        stats.push(t('stats.aiStyle', { level: t(`aiStyleLevel.${report.ai_style_level}`) }));
    }

    return (
        <div className="rounded-md border border-neutral-200 p-3">
            <div className="mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-neutral-500" />
                <h4 className="text-xs font-semibold uppercase text-neutral-500">{t('heading')}</h4>
            </div>
            <div className="flex flex-wrap gap-2">
                {stats.map((stat) => (
                    <Badge key={stat} variant="outline" className="font-normal">
                        {stat}
                    </Badge>
                ))}
            </div>
            {report.flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {report.flags.map((flag) => (
                        <StatusChip
                            key={flag}
                            text={t(`flags.${flag}`)}
                            textSize="text-caption"
                            status="WARNING"
                        />
                    ))}
                </div>
            )}
            {report.ai_style_reason && (
                <p className="mt-2 text-caption text-neutral-500">
                    {t('aiStyleReason', { reason: report.ai_style_reason })}
                </p>
            )}
            {!report.signals_available && (
                <p className="mt-2 text-caption text-neutral-500">{t('noSignals')}</p>
            )}
            <p className="mt-2 text-caption text-neutral-400">{t('disclaimer')}</p>
        </div>
    );
}
