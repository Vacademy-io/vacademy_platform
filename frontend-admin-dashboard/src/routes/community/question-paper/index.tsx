import { createFileRoute } from '@tanstack/react-router';

interface QuestionPaperPramas {
    id: string;
}

export const Route = createFileRoute('/community/question-paper/')({
    validateSearch: (search: Record<string, unknown>): QuestionPaperPramas => {
        return {
            id: search.id as string,
        };
    },
});

