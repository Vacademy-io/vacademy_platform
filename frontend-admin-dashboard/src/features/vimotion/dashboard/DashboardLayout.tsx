import { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { getInstituteId } from '@/constants/helper';
import { VideoConsoleWorkspace } from '@/routes/video-api-studio/-components/VideoConsoleWorkspace';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { RecentTab } from './RecentTab';
import { ReelsTab } from './ReelsTab';
import { AssetsTab } from './AssetsTab';
import { AvatarsTab } from './AvatarsTab';
import { BrandKitsTab } from './BrandKitsTab';
import { OnboardingBanner } from './OnboardingBanner';
import { isTab, type DashboardTab } from './tabsConfig';
import { VimTourProvider, useVimTour } from '../tour/VimTourProvider';

export function DashboardLayout() {
    const instituteId = getInstituteId();
    return (
        <VimTourProvider instituteId={instituteId}>
            <DashboardShell />
        </VimTourProvider>
    );
}

function DashboardShell() {
    const navigate = useNavigate();
    const instituteId = getInstituteId();
    const search = useSearch({ strict: false }) as { tab?: string; videoId?: string };
    const tab: DashboardTab = isTab(search.tab) ? search.tab : 'recent';
    const videoId = typeof search.videoId === 'string' && search.videoId ? search.videoId : null;
    const { startTourIfNew } = useVimTour();

    // First-time auto-start: dashboard tour kicks in on the recent tab (the
    // landing tab) once anchors are mounted. The Composer tour kicks in the
    // first time the user lands on the Create tab. Both are gated by their
    // own seen-flags so users see each one exactly once.
    useEffect(() => {
        if (videoId) return; // production view — no tour
        const id = window.setTimeout(() => {
            if (tab === 'create') {
                startTourIfNew('vim-composer');
            } else {
                startTourIfNew('vim-dashboard');
            }
        }, 600);
        return () => window.clearTimeout(id);
    }, [tab, videoId, startTourIfNew]);

    const setTab = (next: DashboardTab) => {
        // Switching tabs clears any pinned videoId so the user lands on the
        // tab content, not the production view of an unrelated video.
        navigate({
            to: '/vim/dashboard',
            search: { tab: next },
            replace: true,
        });
    };

    const onEditCurrent = (params: {
        videoId: string;
        htmlUrl: string;
        audioUrl: string;
        wordsUrl: string;
        apiKey: string;
        orientation: string;
    }) => {
        navigate({
            to: '/vim/edit/$videoId',
            params: { videoId: params.videoId },
            search: {
                htmlUrl: params.htmlUrl,
                audioUrl: params.audioUrl || undefined,
                wordsUrl: params.wordsUrl || undefined,
                avatarUrl: undefined,
                apiKey: params.apiKey || undefined,
                orientation: params.orientation || 'landscape',
                kind: undefined,
                focusTime: undefined,
            },
        });
    };

    // The Create tab and the per-video production view both host the
    // full-bleed VideoConsoleWorkspace. Wrapping either in the constrained
    // max-w-5xl + p-8 main column would crop the canvas and double-scroll.
    const isProductionView = !!videoId;
    const isFullBleed = isProductionView || tab === 'create';

    return (
        // h-screen (not min-h-screen) bounds the shell to one viewport so only
        // <main> scrolls — the sidebar + topbar stay pinned regardless of
        // content length.
        <div className="flex h-screen w-screen overflow-hidden bg-[#FAFAF7]">
            <Sidebar instituteId={instituteId} activeTab={tab} onTabChange={setTab} />

            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar instituteId={instituteId} activeTab={tab} />

                {isFullBleed ? (
                    <main className="min-h-0 flex-1 overflow-hidden">
                        {isProductionView ? (
                            <VideoConsoleWorkspace
                                key={`prod-${videoId}`}
                                showHistorySidebar={false}
                                initialVideoId={videoId}
                                onEdit={onEditCurrent}
                                vimMode
                            />
                        ) : (
                            <VideoConsoleWorkspace
                                showHistorySidebar={false}
                                onEdit={onEditCurrent}
                                vimMode
                            />
                        )}
                    </main>
                ) : (
                    <main className="flex-1 overflow-y-auto p-8">
                        <div className="mx-auto max-w-5xl space-y-6">
                            <OnboardingBanner />
                            {tab === 'recent' && <RecentTab />}
                            {tab === 'reels' && <ReelsTab />}
                            {tab === 'assets' && <AssetsTab />}
                            {tab === 'avatars' && <AvatarsTab />}
                            {tab === 'brand-kits' && <BrandKitsTab />}
                        </div>
                    </main>
                )}
            </div>
        </div>
    );
}
