import { useNavigate } from '@tanstack/react-router';
import { forwardRef } from 'react';
import { Clapperboard, FolderOpen, LogOut, Palette, Sparkles, UserSquare2, Wand2, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiCreditsQuery } from '@/services/ai-credits/get-ai-credits';
import { AiCreditsPanel } from '@/components/common/ai-credits/AiCreditsPanel';
import { removeCookiesAndLogout } from '@/lib/auth/sessionUtility';
import { useStudioName } from './hooks/useStudioName';
import { HelpMenu } from '../tour/HelpMenu';
import type { DashboardTab } from './tabsConfig';

interface SidebarProps {
    instituteId: string | undefined;
    activeTab: DashboardTab;
    onTabChange: (tab: DashboardTab) => void;
}

const NAV_ITEMS: { id: DashboardTab; label: string; Icon: typeof Clapperboard }[] = [
    { id: 'create', label: 'Create', Icon: Wand2 },
    { id: 'recent', label: 'Recent', Icon: Clapperboard },
    { id: 'assets', label: 'Assets', Icon: FolderOpen },
    { id: 'avatars', label: 'Avatars', Icon: UserSquare2 },
    { id: 'brand-kits', label: 'Brand Kits', Icon: Palette },
];

export function Sidebar({ instituteId, activeTab, onTabChange }: SidebarProps) {
    const navigate = useNavigate();
    const studioName = useStudioName(instituteId);
    const credits = useAiCreditsQuery(!!instituteId);

    const handleLogout = () => {
        removeCookiesAndLogout();
        navigate({ to: '/vim/login' });
    };

    return (
        <aside
            data-tour="vim-sidebar"
            className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white"
        >
            {/* Brand + studio name */}
            <div className="flex items-center gap-2.5 p-5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                    <Sparkles className="size-4 text-primary-500" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-neutral-900">
                        {studioName.data ?? 'Vimotion'}
                    </p>
                    <p className="text-xs text-neutral-500">Studio</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3">
                <ul className="space-y-0.5">
                    {NAV_ITEMS.map(({ id, label, Icon }) => {
                        const active = activeTab === id;
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    data-tour={`vim-sidebar-${id}`}
                                    onClick={() => onTabChange(id)}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                        active
                                            ? 'bg-neutral-900 text-white'
                                            : 'text-neutral-700 hover:bg-neutral-100'
                                    )}
                                >
                                    <Icon className="size-4" />
                                    {label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Credits + Help + Logout */}
            <div className="space-y-2 border-t border-neutral-100 p-3">
                {credits.data && (
                    <AiCreditsPanel
                        popoverSide="right"
                        popoverAlign="end"
                        popoverSideOffset={12}
                        trigger={<CreditsCardTrigger data={credits.data} />}
                    />
                )}
                <HelpMenu />
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                    <LogOut className="size-4" />
                    Log out
                </button>
            </div>
        </aside>
    );
}

interface CreditsCardProps {
    data: {
        current_balance: string;
        total_credits: string;
        is_low_balance: boolean;
    };
}

const CreditsCardTrigger = forwardRef<
    HTMLButtonElement,
    CreditsCardProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ data, className, ...rest }, ref) => {
    const balance = Number(data.current_balance) || 0;
    const total = Number(data.total_credits) || 0;
    const used = Math.max(0, total - balance);
    const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

    return (
        <button
            ref={ref}
            type="button"
            data-tour="vim-credits"
            className={cn(
                'w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-left outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-500',
                className
            )}
            {...rest}
        >
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                <Coins className="size-3.5 text-primary-500" />
                AI credits
            </div>
            <p className="mt-1.5 text-base font-semibold text-neutral-900">
                {formatCredits(balance)}
                <span className="ml-1 text-xs font-normal text-neutral-400">
                    / {formatCredits(total)}
                </span>
            </p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                    className={cn(
                        'h-full transition-all',
                        data.is_low_balance ? 'bg-red-500' : 'bg-neutral-900'
                    )}
                    style={{ width: `${usedPct}%` }}
                />
            </div>
            {data.is_low_balance && (
                <p className="mt-1.5 text-[11px] font-medium text-red-600">Low balance</p>
            )}
        </button>
    );
});
CreditsCardTrigger.displayName = 'CreditsCardTrigger';

export function formatCredits(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
}
