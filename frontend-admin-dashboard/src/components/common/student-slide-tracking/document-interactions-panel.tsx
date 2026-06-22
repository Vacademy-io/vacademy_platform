import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_SLIDE_INTERACTIONS_ADMIN } from '@/constants/urls';

/**
 * Shows a learner's responses to the interactive blocks inside a DOCUMENT slide
 * — checklist ticks, fill-in-the-blank answers, and inline MCQ choices — in the
 * admin activity-log dialog. Data comes from the learner_slide_interaction store
 * (POSTed by the learner app as they interact). Read-only.
 */
interface InteractionRow {
    elementKey: string;
    elementType: string;
    stateJson?: string | null;
}

interface ChecklistState {
    checked?: number[];
    items?: string[];
}
interface FillBlanksState {
    statement?: string;
    answers?: Array<{ expected?: string; value?: string; correct?: boolean }>;
}
interface McqState {
    question?: string;
    options?: string[];
    selected?: number | null;
    selectedText?: string | null;
    correct?: boolean;
    correctIndex?: number;
}
interface FlashcardState {
    front?: string;
    back?: string;
    viewed?: boolean;
    flipCount?: number;
}

const safeParse = <T,>(raw?: string | null): T | null => {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const ResultTag = ({ correct }: { correct?: boolean }) => (
    <span
        className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
            correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
    >
        {correct ? 'Correct' : 'Incorrect'}
    </span>
);

const DocumentInteractionsPanel = ({ slideId, userId }: { slideId: string; userId: string }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['slide-interactions-admin', slideId, userId],
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get(
                `${GET_SLIDE_INTERACTIONS_ADMIN}?slideId=${encodeURIComponent(slideId)}&userId=${encodeURIComponent(userId)}`
            );
            return (Array.isArray(res.data) ? res.data : []) as InteractionRow[];
        },
        enabled: Boolean(slideId && userId),
        staleTime: 30_000,
    });

    if (!slideId || !userId) return null;
    if (isLoading) {
        return <div className="mt-6 px-4 text-xs text-slate-500">Loading interactions…</div>;
    }
    if (!data || data.length === 0) return null;

    const checklists = data.filter((d) => d.elementType === 'CHECKLIST');
    const fills = data
        .filter((d) => d.elementType === 'FILL_BLANKS')
        .sort((a, b) => a.elementKey.localeCompare(b.elementKey));
    const mcqs = data
        .filter((d) => d.elementType === 'MCQ')
        .sort((a, b) => a.elementKey.localeCompare(b.elementKey));
    const flashcards = data
        .filter((d) => d.elementType === 'FLASHCARD')
        .sort((a, b) => a.elementKey.localeCompare(b.elementKey));

    return (
        <div className="mt-6 space-y-5 px-4">
            <div className="text-sm font-semibold text-slate-700">Interactive responses</div>

            {checklists.map((row) => {
                const s = safeParse<ChecklistState>(row.stateJson);
                const items = s?.items ?? [];
                const checked = new Set(s?.checked ?? []);
                if (items.length === 0) return null;
                return (
                    <div key={row.elementKey} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-medium text-slate-600">
                            Checklist · {checked.size}/{items.length} ticked
                        </div>
                        <ul className="space-y-1">
                            {items.map((label, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                                    <span className={checked.has(i) ? 'text-green-600' : 'text-slate-400'}>
                                        {checked.has(i) ? '☑' : '☐'}
                                    </span>
                                    <span>{label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}

            {fills.map((row) => {
                const s = safeParse<FillBlanksState>(row.stateJson);
                const answers = s?.answers ?? [];
                if (answers.length === 0) return null;
                return (
                    <div key={row.elementKey} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-medium text-slate-600">Fill in the blanks</div>
                        <div className="space-y-1.5">
                            {answers.map((a, i) => (
                                <div key={i} className="text-sm text-slate-800">
                                    <span className="text-slate-500">Blank {i + 1}:</span>{' '}
                                    <span className="font-medium">{a.value || <em className="text-slate-400">blank</em>}</span>
                                    {!a.correct && a.expected ? (
                                        <span className="text-slate-500"> (expected: {a.expected})</span>
                                    ) : null}
                                    <ResultTag correct={a.correct} />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {mcqs.map((row) => {
                const s = safeParse<McqState>(row.stateJson);
                if (!s) return null;
                const correctText =
                    s.options && s.correctIndex != null && s.correctIndex >= 0
                        ? s.options[s.correctIndex]
                        : undefined;
                return (
                    <div key={row.elementKey} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="mb-1 text-xs font-medium text-slate-600">Quiz (MCQ)</div>
                        {s.question ? (
                            <div className="mb-2 text-sm font-medium text-slate-800">{s.question}</div>
                        ) : null}
                        <div className="text-sm text-slate-800">
                            <span className="text-slate-500">Answer:</span>{' '}
                            <span className="font-medium">
                                {s.selectedText || <em className="text-slate-400">no answer</em>}
                            </span>
                            <ResultTag correct={s.correct} />
                        </div>
                        {!s.correct && correctText ? (
                            <div className="mt-1 text-sm text-slate-600">
                                Correct answer: <span className="font-medium">{correctText}</span>
                            </div>
                        ) : null}
                    </div>
                );
            })}

            {flashcards.map((row) => {
                const s = safeParse<FlashcardState>(row.stateJson);
                if (!s) return null;
                return (
                    <div key={row.elementKey} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="mb-1 text-xs font-medium text-slate-600">
                            Flashcard ·{' '}
                            {s.viewed ? (
                                <span className="text-green-700">
                                    viewed{s.flipCount ? ` (flipped ${s.flipCount}×)` : ''}
                                </span>
                            ) : (
                                <span className="text-slate-400">not viewed</span>
                            )}
                        </div>
                        {s.front ? <div className="text-sm text-slate-800">{s.front}</div> : null}
                        {s.back ? (
                            <div className="mt-0.5 text-sm text-slate-500">Back: {s.back}</div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
};

export default DocumentInteractionsPanel;
