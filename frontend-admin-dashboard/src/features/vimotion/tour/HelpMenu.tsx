import { CheckCircle2, Circle, HelpCircle } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useVimTour } from './VimTourProvider';
import type { VimTourId } from './storage';

const TOUR_ITEMS: { id: VimTourId; label: string; hint: string }[] = [
    {
        id: 'vim-dashboard',
        label: 'Dashboard tour',
        hint: 'Sidebar, tabs, credits',
    },
    {
        id: 'vim-composer',
        label: 'Create video tour',
        hint: 'Prompt, settings, generate',
    },
    {
        id: 'vim-brand-kit',
        label: 'Brand kit tour',
        hint: 'Palette, fonts, intro/outro',
    },
    {
        id: 'vim-avatar',
        label: 'Avatars tour',
        hint: 'Custom vs built-in hosts',
    },
    {
        id: 'vim-editor',
        label: 'Video editor tour',
        hint: 'Timeline, regenerate, export',
    },
];

export function HelpMenu() {
    const { startTour, hasSeen } = useVimTour();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    data-tour="vim-help"
                    aria-label="Help and tours"
                    title="Help and tours"
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                    <HelpCircle className="size-4" />
                    Help &amp; tours
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64">
                <DropdownMenuLabel className="text-xs text-neutral-500">
                    Replay any tour
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TOUR_ITEMS.map((item) => {
                    const seen = hasSeen(item.id);
                    return (
                        <DropdownMenuItem
                            key={item.id}
                            onSelect={() => startTour(item.id)}
                            className="flex items-start gap-2 py-2"
                        >
                            {seen ? (
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                            ) : (
                                <Circle className="mt-0.5 size-4 shrink-0 text-neutral-300" />
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                                <p className="text-xs text-neutral-500">{item.hint}</p>
                            </div>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
