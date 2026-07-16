import { useRouterState } from '@tanstack/react-router';
import { BookOpen, CaretLeft, CaretRight, GraduationCap, Question, Sparkle, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { getTokenFromCookie, isTokenExpired } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useSupportConfig } from '@/services/support';
import { SupportPanel } from '@/components/common/support/SupportPanel';
import { useAssistDock } from './store';
import { tutorialsForRoute } from './tutorials';
import { TutorialViewer } from './TutorialViewer';

// Keep in sync with routes/__root.tsx publicRoutes — the dock only shows inside
// the authenticated shell.
const PUBLIC_PREFIXES = [
    '/login',
    '/signup',
    '/landing',
    '/pricing',
    '/content',
    '/evaluator-ai',
    '/vim/onboarding',
    '/vim/login',
    '/vim/waitlist',
];

export function AssistDock() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const search = useRouterState({ select: (s) => s.location.search }) as { selectedTab?: string };
    const panel = useAssistDock((s) => s.panel);
    const togglePanel = useAssistDock((s) => s.togglePanel);
    const setPanel = useAssistDock((s) => s.setPanel);
    const openTutorial = useAssistDock((s) => s.openTutorial);
    const minimized = useAssistDock((s) => s.minimized);
    const setMinimized = useAssistDock((s) => s.setMinimized);
    // Non-admin roles get a 403 here (retry disabled on the hook); the badge is simply omitted then.
    const supportConfig = useSupportConfig();

    const token = getTokenFromCookie(TokenKey.accessToken);
    const isAuthed = !!token && !isTokenExpired(token);
    const onPublicRoute = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isAuthed || onPublicRoute) return null;

    const tutorials = tutorialsForRoute(pathname, search?.selectedTab);
    const totalBadge = tutorials.length + (supportConfig.data?.openTicketCount ?? 0);

    return (
        <>
            {minimized ? (
                /* Collapsed pull-tab. Same edge/vertical anchor as the full rail so it
                   doesn't jump around when toggled. */
                <button
                    type="button"
                    aria-label="Expand guides & support"
                    onClick={() => setMinimized(false)}
                    className="fixed right-0 top-24 z-30 hidden items-center gap-1 rounded-l-lg border border-r-0 border-neutral-200 bg-white py-2 pl-2 pr-1.5 text-neutral-500 shadow-sm transition-colors hover:bg-neutral-100 md:flex"
                >
                    <CaretLeft size={14} />
                    {totalBadge > 0 ? (
                        <span className="flex size-4 items-center justify-center rounded-full bg-primary-500 text-caption font-semibold text-white">
                            {totalBadge}
                        </span>
                    ) : null}
                </button>
            ) : (
                /* Thin fixed rail — a full-height column flush to the right edge. The
                    layout (LayoutContainer main content) reserves w-14 so content never
                    slides under it. pt-20 clears the top navbar. Hidden by default on
                    mobile (< md): a right rail wastes horizontal space on phones, and
                    the layout drops its right gutter to match. */
                <aside className="fixed inset-y-0 right-0 z-30 hidden w-14 flex-col items-center gap-1 border-l border-neutral-200 bg-white pb-4 pt-20 md:flex">
                    <button
                        type="button"
                        aria-label="Minimize"
                        onClick={() => setMinimized(true)}
                        className="mb-1 flex size-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                    >
                        <CaretRight size={14} />
                    </button>

                    <RailButton
                        label="Guides"
                        active={panel === 'tutorials'}
                        onClick={() => togglePanel('tutorials')}
                        badge={tutorials.length || undefined}
                    >
                        <BookOpen size={20} weight={panel === 'tutorials' ? 'fill' : 'regular'} />
                    </RailButton>

                    <RailButton
                        label="Assist"
                        active={panel === 'assistant'}
                        onClick={() => togglePanel('assistant')}
                    >
                        <Sparkle size={20} weight={panel === 'assistant' ? 'fill' : 'regular'} />
                    </RailButton>

                    <RailButton
                        label="Issues"
                        active={panel === 'support'}
                        onClick={() => togglePanel('support')}
                        badge={supportConfig.data?.openTicketCount || undefined}
                    >
                        <Question size={20} weight={panel === 'support' ? 'fill' : 'regular'} />
                    </RailButton>
                </aside>
            )}

            <SupportPanel
                open={panel === 'support'}
                onOpenChange={(v) => setPanel(v ? 'support' : 'none')}
            />

            {/* Tutorials panel (slides out left of the rail) */}
            {panel === 'tutorials' && (
                <div className="fixed bottom-4 right-16 top-20 z-40 flex w-72 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
                    <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <GraduationCap size={18} className="text-primary-500" />
                            <p className="text-body font-semibold text-neutral-800">Tutorials</p>
                        </div>
                        <button
                            type="button"
                            aria-label="Close tutorials"
                            onClick={() => setPanel('none')}
                            className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {tutorials.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                                <BookOpen size={26} className="text-neutral-300" />
                                <p className="text-caption text-neutral-500">
                                    No tutorials for this page yet.
                                </p>
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-1">
                                {tutorials.map((t) => (
                                    <li key={t.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                openTutorial(t.file, t.title);
                                                setPanel('none');
                                            }}
                                            className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-primary-50"
                                        >
                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500 group-hover:bg-primary-100">
                                                <BookOpen size={15} weight="duotone" />
                                            </span>
                                            <span className="flex-1 truncate text-caption text-neutral-700">
                                                {t.title}
                                            </span>
                                            <CaretRight
                                                size={14}
                                                className="shrink-0 text-neutral-300 group-hover:text-primary-400"
                                            />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Big walkthrough player */}
            <TutorialViewer />
        </>
    );
}

function RailButton({
    label,
    children,
    onClick,
    active,
    badge,
}: {
    label: string;
    children: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    badge?: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                'relative flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-2 transition-colors',
                active ? 'bg-primary-50 text-primary-600' : 'text-neutral-500 hover:bg-neutral-100'
            )}
        >
            {children}
            <span className="text-caption font-medium leading-none">{label}</span>
            {badge ? (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary-500 text-caption font-semibold text-white">
                    {badge}
                </span>
            ) : null}
        </button>
    );
}
