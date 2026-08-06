/**
 * "Start from a use case" gallery.
 *
 * Each card shows what the agent is for, who it talks to, and a two-line sample
 * of the actual call — the fastest way to make an abstract "AI agent" concrete
 * for someone running an institute. Picking one opens the short setup wizard.
 */
import React from 'react';
import { ArrowRight, ChatCircleDots } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ACCENT_CLASSES, AGENT_USE_CASES, type AgentUseCase } from '../-constants/use-cases';

function UseCaseCard({ useCase, onPick }: { useCase: AgentUseCase; onPick: () => void }) {
    const accent = ACCENT_CLASSES[useCase.accent];
    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={onPick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick();
                }
            }}
            className={cn(
                'group flex cursor-pointer flex-col gap-3 p-4 transition-colors',
                accent.border
            )}
        >
            <div className="flex items-start gap-3">
                <div
                    className={cn(
                        'flex size-9 items-center justify-center rounded-md',
                        accent.iconBg
                    )}
                >
                    {React.createElement(useCase.icon, {
                        className: cn('size-5', accent.iconText),
                        weight: 'duotone',
                    })}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-subtitle font-semibold text-neutral-700">
                        {useCase.title}
                    </p>
                    <p className="truncate text-caption text-neutral-400">{useCase.audience}</p>
                </div>
            </div>

            <p className="text-body text-neutral-500">{useCase.tagline}</p>

            {/* Mini transcript — what the call actually sounds like. */}
            <div className="flex flex-col gap-1.5 rounded-md bg-neutral-50 p-2.5">
                {useCase.sample.map((turn, i) => (
                    <div
                        key={i}
                        className={cn(
                            'flex items-end gap-1.5',
                            turn.speaker === 'person' && 'flex-row-reverse'
                        )}
                    >
                        <span
                            className={cn(
                                'max-w-full rounded-lg px-2 py-1 text-caption',
                                turn.speaker === 'agent'
                                    ? accent.bubble
                                    : 'bg-white text-neutral-500 ring-1 ring-neutral-200'
                            )}
                        >
                            {turn.text}
                        </span>
                    </div>
                ))}
            </div>

            <ul className="flex flex-col gap-1">
                {useCase.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-caption text-neutral-500">
                        <ChatCircleDots
                            className={cn('mt-0.5 size-3.5 shrink-0', accent.iconText)}
                            weight="fill"
                        />
                        {b}
                    </li>
                ))}
            </ul>

            <span
                className={cn(
                    'mt-auto flex items-center gap-1 pt-1 text-caption font-medium',
                    accent.iconText
                )}
            >
                Set this up
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
        </Card>
    );
}

export function UseCaseGallery({
    onPick,
    title = 'Start from a use case',
    subtitle = 'Pick what you want the agent to do. Answer three or four questions and the AI writes the prompt, opening line and what each call should find out — you review it before anything goes live.',
}: {
    onPick: (useCase: AgentUseCase) => void;
    title?: string;
    subtitle?: string;
}) {
    return (
        <section className="flex flex-col gap-3">
            {(title || subtitle) && (
                <div>
                    {title && (
                        <h2 className="text-subtitle font-semibold text-neutral-700">{title}</h2>
                    )}
                    {subtitle && <p className="max-w-3xl text-body text-neutral-500">{subtitle}</p>}
                </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {AGENT_USE_CASES.map((uc) => (
                    <UseCaseCard key={uc.id} useCase={uc} onPick={() => onPick(uc)} />
                ))}
            </div>
        </section>
    );
}
