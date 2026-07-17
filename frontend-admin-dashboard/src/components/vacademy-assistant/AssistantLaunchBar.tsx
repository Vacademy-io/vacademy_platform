import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PaperPlaneRight, Sparkle } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ASSISTANT_CAPABILITIES } from '@/constants/urls';
import { useAssistDock } from '@/components/assist-dock/store';
import { CAPABILITY_COPY } from './VacademyAssistant';
import type { AssistantCapabilities } from './types';

/**
 * Dashboard entry point for the Vacademy Assistant: a search-style bar that
 * opens the Assist Dock panel with the question already sent. Renders nothing
 * when the assistant has no capabilities for this user (institute settings),
 * so it self-gates exactly like the panel does.
 */
export function AssistantLaunchBar() {
    const [question, setQuestion] = useState('');
    const askAssistant = useAssistDock((s) => s.askAssistant);

    const { data: capabilities } = useQuery<AssistantCapabilities>({
        queryKey: ['assistant-capabilities'],
        queryFn: async () => (await authenticatedAxiosInstance.get(ASSISTANT_CAPABILITIES)).data,
        staleTime: 5 * 60 * 1000,
    });

    // Role-accurate suggestion chips — only asks THIS user can actually make.
    const suggestions = useMemo(() => {
        const sugg: string[] = [];
        for (const group of capabilities?.groups ?? []) {
            sugg.push(...(CAPABILITY_COPY[group.key]?.suggestions ?? []));
        }
        return sugg.slice(0, 3);
    }, [capabilities]);

    if (!capabilities?.groups?.length) return null;

    const submit = () => {
        const text = question.trim();
        if (!text) return;
        setQuestion('');
        askAssistant(text);
    };

    return (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
            <div className="flex items-center gap-2">
                <Sparkle size={18} weight="fill" className="shrink-0 text-primary-500" />
                <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') submit();
                    }}
                    placeholder="Ask the assistant — “Who has overdue fees?”, “How do I schedule a class?”…"
                    className="h-9 flex-1 border-neutral-200 bg-white text-body"
                    aria-label="Ask the Vacademy Assistant"
                />
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={submit}
                    disable={!question.trim()}
                >
                    <PaperPlaneRight size={16} />
                    <span className="hidden sm:inline">Ask</span>
                </MyButton>
            </div>
            {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                    {suggestions.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => askAssistant(s)}
                            className="rounded-md border border-primary-200 bg-white px-2 py-0.5 text-caption text-neutral-700 hover:border-primary-300 hover:text-primary-600"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
