import { useState } from 'react';
import QuizDetailView from './QuizDetailView';
import QuizResultsOverview from './QuizResultsOverview';
import { QuizResultsMessage } from './quiz-results-shared';

/**
 * Course-details → Quiz Results.
 *
 * Two screens, one tab: the batch's quizzes, and one quiz's learners / questions. The
 * selection is local state rather than a route param so the surrounding course-details
 * tab strip (which owns the URL) is left alone.
 */
export default function QuizResultsTab({ packageSessionId }: { packageSessionId: string }) {
    // The course page can hand over a comma-joined list when several batches share the
    // course; results are per batch, so take the first — same rule the Pulse tab uses.
    const batchId = (packageSessionId ?? '').split(',')[0] ?? '';
    const [openSlideId, setOpenSlideId] = useState<string | null>(null);

    if (!batchId) {
        return (
            <QuizResultsMessage
                title="Select a batch to see quiz results"
                subtitle="Quiz results are reported per batch, because the same quiz slide can be shared across several of them."
            />
        );
    }

    return (
        <div className="flex flex-col gap-4 p-1">
            {openSlideId ? (
                <QuizDetailView
                    batchId={batchId}
                    slideId={openSlideId}
                    onBack={() => setOpenSlideId(null)}
                />
            ) : (
                <QuizResultsOverview batchId={batchId} onOpenQuiz={setOpenSlideId} />
            )}
        </div>
    );
}
