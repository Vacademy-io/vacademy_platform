import { createLazyFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { KpiBand } from './-components/KpiBand';
import { ConversionFunnelWidget } from './-components/ConversionFunnelWidget';
import { CounsellorLeaderboardWidget } from './-components/CounsellorLeaderboardWidget';
import {
    MissedFollowupsWidget,
    UpcomingFollowupsWidget,
} from './-components/FollowupsWidgets';
import {
    NewVsExistingLeadsWidget,
    ReassignmentVolumeWidget,
} from './-components/TimeSeriesWidgets';
import { CampaignCardsRow } from './-components/CampaignCardsRow';
import { InsightsStrip } from './-components/InsightsStrip';
// Reuse the disabled-notice from the counsellors route — same UX in both
// places, no need for a duplicate component.
import { FeatureDisabledNotice } from '@/routes/counsellors/-components/FeatureDisabledNotice';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY, TEACHER_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export const Route = createLazyFileRoute('/sales-dashboard/')({
    component: RouteComponent,
});

type PresetKey = '7d' | '30d' | '90d';

// Typed by the exact literal union so `noUncheckedIndexedAccess` doesn't
// treat the lookup as possibly undefined.
const PRESETS: Record<PresetKey, () => { from: number; to: number }> = {
    '7d': () => ({ from: Date.now() - 7 * 86_400_000, to: Date.now() }),
    '30d': () => ({ from: Date.now() - 30 * 86_400_000, to: Date.now() }),
    '90d': () => ({ from: Date.now() - 90 * 86_400_000, to: Date.now() }),
};

/**
 * Read the display-settings gate. Pure-helper, called before any hooks fire
 * in RouteComponent — never call hooks here. Putting the gate between hooks
 * would violate Rules of Hooks (different render paths → different hook
 * counts → React crash).
 */
function isSalesDashboardEnabled(): boolean {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const viewerRoles = getUserRoles(accessToken);
    const isAdmin = viewerRoles.includes('ADMIN');
    const roleKey = isAdmin ? ADMIN_DISPLAY_SETTINGS_KEY : TEACHER_DISPLAY_SETTINGS_KEY;
    const ds = getDisplaySettingsFromCache(roleKey);
    return ds?.workbench?.salesDashboardVisible === true;
}

function RouteComponent() {
    // Gate evaluated BEFORE any hooks. Each branch returns a different
    // component, so hooks belong to whichever subtree mounts — never the
    // same instance with a different hook count.
    if (!isSalesDashboardEnabled()) {
        return (
            <FeatureDisabledNotice
                title="Sales dashboard is not enabled"
                settingsLabel="Counsellor workbench"
            />
        );
    }
    return <SalesDashboardPage />;
}

function SalesDashboardPage() {
    const { setNavHeading } = useNavHeadingStore();
    const instituteId = getInstituteId();
    const [preset, setPreset] = useState<PresetKey>('30d');
    const range = PRESETS[preset]();
    const teamId: string | undefined = undefined; // RBAC adds a team picker in a follow-up

    useEffect(() => {
        setNavHeading('Sales Dashboard');
    }, [setNavHeading]);

    if (!instituteId) return null;

    return (
        <LayoutContainer>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-h2 font-medium text-neutral-900">Sales</h2>
                        <p className="text-caption text-neutral-500">
                            Pipeline, followups, campaigns, and counsellor performance at a glance.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-1">
                        {(['7d', '30d', '90d'] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPreset(p)}
                                className={`rounded px-2 py-1 text-caption ${
                                    preset === p
                                        ? 'bg-primary-500 text-white'
                                        : 'text-neutral-600 hover:bg-neutral-50'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* KPI band */}
                <KpiBand
                    instituteId={instituteId}
                    teamId={teamId}
                    from={range.from}
                    to={range.to}
                />

                {/* Row 2: Funnel + leaderboard */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ConversionFunnelWidget
                        instituteId={instituteId}
                        teamId={teamId}
                        from={range.from}
                        to={range.to}
                    />
                    <CounsellorLeaderboardWidget instituteId={instituteId} teamId={teamId} />
                </div>

                {/* Row 3: Followups */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <UpcomingFollowupsWidget instituteId={instituteId} teamId={teamId} />
                    <MissedFollowupsWidget instituteId={instituteId} teamId={teamId} />
                </div>

                {/* Row 4: Time series */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <NewVsExistingLeadsWidget
                        instituteId={instituteId}
                        teamId={teamId}
                        from={range.from}
                        to={range.to}
                    />
                    <ReassignmentVolumeWidget
                        instituteId={instituteId}
                        from={range.from}
                        to={range.to}
                    />
                </div>

                {/* Bottom: campaigns + insights */}
                <CampaignCardsRow instituteId={instituteId} period="WEEK" />
                <InsightsStrip instituteId={instituteId} teamId={teamId} />
            </div>
        </LayoutContainer>
    );
}
