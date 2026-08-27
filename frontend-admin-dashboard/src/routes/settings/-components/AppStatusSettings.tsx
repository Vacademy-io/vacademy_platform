import { useEffect, useState } from 'react';
import {
    DeviceMobile,
    AndroidLogo,
    AppleLogo,
    WindowsLogo,
    ArrowSquareOut,
    ArrowsClockwise,
    CircleNotch,
    Info,
    Package,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MyButton } from '@/components/design-system/button';
import { StatusChip, StatusType } from '@/components/design-system/status-chips';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import { APP_REGISTRY_STATUS } from '@/constants/urls';

// ─── Types (mirrors community_service's AppRegistration payload, via admin_core_service's
//      AppStatusResponse DTO) ───────────────────────────────────────────────────────────────

type Platform = 'ANDROID' | 'IOS' | 'WINDOWS' | 'MACOS';

interface PlatformStatus {
    platform: Platform;
    enabled: boolean;
    status: string;
    store_url: string;
    current_version: string;
    current_build: string;
    released_at: string;
    last_synced_at: string;
}

interface RegisteredApp {
    id: string;
    name: string;
    display_name: string;
    package_name: string;
    platforms: PlatformStatus[];
}

interface AppStatusResponse {
    institute_id: string;
    apps: RegisteredApp[];
}

// ─── Presentation helpers ───────────────────────────────────────────────────────────────────

function buildPlatformMeta(
    t: TFunction
): Record<Platform, { label: string; Icon: typeof AndroidLogo }> {
    return {
        ANDROID: { label: t('platforms.android'), Icon: AndroidLogo },
        IOS: { label: t('platforms.ios'), Icon: AppleLogo },
        WINDOWS: { label: t('platforms.windows'), Icon: WindowsLogo },
        MACOS: { label: t('platforms.macos'), Icon: AppleLogo },
    };
}

/** Store-status strings come from the health-check dashboard's StoreStatus enum. */
function statusTone(status: string): StatusType {
    switch (status) {
        case 'LIVE':
        case 'APPROVED':
            return 'SUCCESS';
        case 'REJECTED':
        case 'SUSPENDED':
        case 'REMOVED':
        case 'FAILED':
            return 'DANGER';
        case 'IN_REVIEW':
        case 'SUBMITTED':
        case 'BUILD_PROCESSING':
        case 'UPDATE_AVAILABLE':
            return 'WARNING';
        default:
            return 'INFO';
    }
}

function statusLabel(status: string): string {
    return status
        .toLowerCase()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// ─── Main Component ─────────────────────────────────────────────────────────────────────────

/**
 * Read-only view of this institute's registered apps and their store status, pulled from the
 * health-check dashboard's App Registration module (community_service's app_registration table)
 * via admin_core_service's institute-scoped proxy.
 *
 * Registration and status updates are ops-only, done by the platform team in health-check —
 * there is intentionally no edit affordance here.
 */
export default function AppStatusSettings() {
    const { t } = useTranslation('settingsAppStatus');
    const instituteId = getInstituteId();
    const [data, setData] = useState<AppStatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const platformMeta = buildPlatformMeta(t);

    const fetchStatus = async () => {
        if (!instituteId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await authenticatedAxiosInstance.get<AppStatusResponse>(
                APP_REGISTRY_STATUS(instituteId)
            );
            setData(res.data);
        } catch (err) {
            console.error('[AppStatus] Failed to load app status', err);
            setError(t('errors.loadStatus'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (instituteId) fetchStatus();
    }, [instituteId]);

    return (
        <div className="max-w-3xl space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <DeviceMobile className="size-5 text-primary-500" />
                                {t('title')}
                            </CardTitle>
                            <CardDescription>{t('description')}</CardDescription>
                        </div>
                        <MyButton
                            id="app-status-refresh-btn"
                            buttonType="secondary"
                            scale="small"
                            layoutVariant="icon"
                            onClick={fetchStatus}
                            disable={loading}
                            title={t('refreshStatus')}
                        >
                            {loading ? (
                                <CircleNotch className="size-4 animate-spin" />
                            ) : (
                                <ArrowsClockwise className="size-4" />
                            )}
                        </MyButton>
                    </div>
                </CardHeader>
            </Card>

            {error && (
                <Alert className="border-danger-400 bg-danger-100">
                    <Info className="size-4 text-danger-600" />
                    <AlertDescription className="text-danger-600">{error}</AlertDescription>
                </Alert>
            )}

            {!error && loading && !data && (
                <Card>
                    <CardContent className="flex items-center justify-center gap-2 py-10 text-neutral-500">
                        <CircleNotch className="size-4 animate-spin" />
                        {t('loading')}
                    </CardContent>
                </Card>
            )}

            {!error && !loading && data && data.apps.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                        <Package className="size-8 text-neutral-300" />
                        <p className="text-body font-semibold text-neutral-600">
                            {t('emptyState.title')}
                        </p>
                        <p className="max-w-sm text-caption text-neutral-500">
                            {t('emptyState.description')}
                        </p>
                    </CardContent>
                </Card>
            )}

            {data?.apps.map((app) => (
                <Card key={app.id}>
                    <CardHeader>
                        <CardTitle className="text-body font-semibold">
                            {app.display_name || app.name || t('untitledApp')}
                        </CardTitle>
                        {app.package_name && (
                            <CardDescription className="font-mono text-caption">
                                {app.package_name}
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {app.platforms.length === 0 && (
                            <p className="text-caption text-neutral-500">
                                {t('noPlatforms')}
                            </p>
                        )}
                        {app.platforms.map((p) => {
                            const meta = platformMeta[p.platform];
                            return (
                                <div
                                    key={p.platform}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 p-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <meta.Icon className="size-5 text-neutral-500" />
                                        <span className="text-body font-medium text-neutral-600">
                                            {meta.label}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {(p.current_version || p.current_build) && (
                                            <span className="text-caption text-neutral-500">
                                                {p.current_version}
                                                {p.current_build ? ` (${p.current_build})` : ''}
                                            </span>
                                        )}
                                        <StatusChip
                                            text={statusLabel(p.status)}
                                            textSize="text-caption"
                                            status={statusTone(p.status)}
                                        />
                                        {p.store_url && (
                                            <a
                                                href={p.store_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1 text-caption text-primary-500 hover:underline"
                                            >
                                                {t('viewInStore')}
                                                <ArrowSquareOut className="size-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
