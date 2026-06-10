import { Star, ChatText } from '@phosphor-icons/react';
import type { LiveClassFeedbackRow } from '../-types/types';
import {
    isStarQuestion,
    isTextQuestion,
    maxStarsFor,
    parseQuestions,
    parseResponses,
} from '../-utils/parse';

/**
 * Renders a submission's answered questions (label + value) as a compact list.
 * Used by the "Simple" view's Feedback column. With `textOnly`, star-rating
 * questions are excluded (the rating is shown in its own column).
 */
export function FeedbackAnswers({
    row,
    textOnly = false,
}: {
    row: LiveClassFeedbackRow;
    textOnly?: boolean;
}) {
    const questions = parseQuestions(row);
    const responses = parseResponses(row);
    const answered = questions.filter((q) => {
        if (textOnly && isStarQuestion(q)) return false;
        const v = responses[q.id];
        return v != null && String(v).trim().length > 0;
    });

    if (answered.length === 0) {
        return <span className="text-sm text-neutral-400">—</span>;
    }

    return (
        <div className="flex flex-col gap-2">
            {answered.map((q) => {
                const value = responses[q.id];
                return (
                    <div key={q.id} className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-neutral-500">{q.label}</span>
                        {isStarQuestion(q) && !isNaN(parseFloat(String(value))) ? (
                            <span className="flex items-center gap-1 text-sm font-medium text-neutral-800">
                                <Star weight="fill" className="size-4 text-warning-500" />
                                {parseFloat(String(value))}
                                <span className="text-xs text-neutral-400">/{maxStarsFor(q)}</span>
                            </span>
                        ) : isTextQuestion(q) ? (
                            <span className="flex items-start gap-1.5 text-sm text-neutral-700">
                                <ChatText className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                                <span className="whitespace-pre-wrap">{String(value)}</span>
                            </span>
                        ) : (
                            <span className="text-sm text-neutral-700">{String(value)}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
