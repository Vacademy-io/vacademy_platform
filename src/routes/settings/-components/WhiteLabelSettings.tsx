import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import {
    Globe,
    Shield,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    Loader2,
    RefreshCw,
    Server,
    Info,
} from 'lucide-react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { WHITE_LABEL_SETUP, WHITE_LABEL_STATUS } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DnsRecordResult {
    type: string;
    name: string;
    target: string;
    proxied: boolean;
    cloudflare_record_id: string;
    action: string;
}

interface WhiteLabelSetupResponse {
    setup_complete: boolean;
    learner_portal_url: string;
    admin_portal_url: string;
    teacher_portal_url: string;
    dns_records_configured: DnsRecordResult[];
    warnings: string[];
}

interface WhiteLabelStatusResponse {
    cloudflare_enabled: boolean;
    is_configured: boolean;
    domain_type: string | null;
    learner_portal_url: string | null;
    admin_portal_url: string | null;
    teacher_portal_url: string | null;
    routing_entries: Array<{
        id: string;
        role: string;
        domain: string;
        subdomain: string;
    }>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ configured }: { configured: boolean }) =>
    configured ? (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
            <CheckCircle2 className="size-3" />
            Configured
        </Badge>
    ) : (
        <Badge variant="secondary" className="gap-1">
            <AlertCircle className="size-3" />
            Not Configured
        </Badge>
    );

const DnsRecordRow = ({ record }: { record: DnsRecordResult }) => (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-mono">
        <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-sans font-semibold text-blue-700">
                {record.type}
            </span>
            <span className="truncate text-slate-700">{record.name}</span>
            <span className="hidden shrink-0 text-slate-400 sm:inline">→</span>
            <span className="hidden truncate text-slate-500 sm:inline">{record.target}</span>
        </div>
        <Badge
            variant={record.action === 'CREATED' ? 'default' : 'secondary'}
            className="ml-3 shrink-0 text-xs"
        >
            {record.action}
        </Badge>
    </div>
);

const PortalUrlRow = ({
    label,
    url,
}: {
    label: string;
    url: string | null | undefined;
}) => {
    if (!url) return null;
    return (
        <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-600 w-28 shrink-0">{label}</span>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:underline truncate"
            >
                {url}
                <ExternalLink className="size-3 shrink-0" />
            </a>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WhiteLabelSettings({ isTab }: { isTab?: boolean }) {
    const instituteId = getInstituteId();

    // ── State ─────────────────────────────────────────────────────────────────
    const [domainMode, setDomainMode] = useState<'VACADEMY_SUBDOMAIN' | 'CUSTOM'>(
        'VACADEMY_SUBDOMAIN'
    );

    // Subdomain mode
    const [subdomainSlug, setSubdomainSlug] = useState('');

    // Custom domain mode
    const [customLearnerDomain, setCustomLearnerDomain] = useState('');
    const [customAdminDomain, setCustomAdminDomain] = useState('');
    const [customTeacherDomain, setCustomTeacherDomain] = useState('');

    // Status
    const [status, setStatus] = useState<WhiteLabelStatusResponse | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);

    // Setup
    const [setupLoading, setSetupLoading] = useState(false);
    const [lastSetupResult, setLastSetupResult] = useState<WhiteLabelSetupResponse | null>(null);

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (instituteId) fetchStatus();
    }, [instituteId]);

    // ── API calls ─────────────────────────────────────────────────────────────
    const fetchStatus = async () => {
        if (!instituteId) return;
        setStatusLoading(true);
        try {
            const res = await authenticatedAxiosInstance.get<WhiteLabelStatusResponse>(
                WHITE_LABEL_STATUS(instituteId)
            );
            setStatus(res.data);
            // Pre-fill form from existing configuration
            if (res.data.domain_type) {
                setDomainMode(res.data.domain_type as 'VACADEMY_SUBDOMAIN' | 'CUSTOM');
            }
        } catch (err) {
            console.error('[WhiteLabel] Failed to load status', err);
        } finally {
            setStatusLoading(false);
        }
    };

    const handleSetup = async () => {
        if (!instituteId) {
            toast.error('No institute selected');
            return;
        }

        // Validation
        if (domainMode === 'VACADEMY_SUBDOMAIN') {
            if (!subdomainSlug.trim()) {
                toast.error('Please enter a subdomain slug');
                return;
            }
            if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomainSlug.trim())) {
                toast.error(
                    'Subdomain must be lowercase alphanumeric with hyphens only (e.g. my-school)'
                );
                return;
            }
        } else {
            if (!customLearnerDomain.trim() || !customAdminDomain.trim()) {
                toast.error('Learner domain and admin domain are required');
                return;
            }
        }

        setSetupLoading(true);
        setLastSetupResult(null);

        try {
            const payload = {
                domain_type: domainMode,
                ...(domainMode === 'VACADEMY_SUBDOMAIN'
                    ? { subdomain_slug: subdomainSlug.trim().toLowerCase() }
                    : {
                          custom_learner_domain: customLearnerDomain.trim().toLowerCase(),
                          custom_admin_domain: customAdminDomain.trim().toLowerCase(),
                          ...(customTeacherDomain.trim()
                              ? {
                                    custom_teacher_domain: customTeacherDomain
                                        .trim()
                                        .toLowerCase(),
                                }
                              : {}),
                      }),
            };

            const res = await authenticatedAxiosInstance.post<WhiteLabelSetupResponse>(
                `${WHITE_LABEL_SETUP}?instituteId=${instituteId}`,
                payload
            );

            setLastSetupResult(res.data);
            toast.success('White-label setup completed successfully! 🎉');
            await fetchStatus();
        } catch (err: any) {
            const errMsg =
                err?.response?.data?.message ||
                err?.response?.data ||
                'Setup failed. Please try again.';
            toast.error(typeof errMsg === 'string' ? errMsg : 'Setup failed');
            console.error('[WhiteLabel] Setup error', err);
        } finally {
            setSetupLoading(false);
        }
    };

    // ── URL preview ───────────────────────────────────────────────────────────
    const previewLearnerUrl =
        domainMode === 'VACADEMY_SUBDOMAIN' && subdomainSlug
            ? `https://${subdomainSlug.trim().toLowerCase()}.vacademy.io`
            : customLearnerDomain
              ? `https://${customLearnerDomain.trim().toLowerCase()}`
              : null;

    const previewAdminUrl =
        domainMode === 'VACADEMY_SUBDOMAIN' && subdomainSlug
            ? `https://${subdomainSlug.trim().toLowerCase()}-admin.vacademy.io`
            : customAdminDomain
              ? `https://${customAdminDomain.trim().toLowerCase()}`
              : null;

    // ── Render ────────────────────────────────────────────────────────────────

    // Feature-gate: backend tells us Cloudflare is not configured on this deployment
    if (status !== null && !status.cloudflare_enabled) {
        return (
            <div className="max-w-3xl">
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Globe className="size-5 text-slate-400" />
                            White-Label Domain Setup
                        </CardTitle>
                        <CardDescription>
                            Automated DNS configuration for custom institute domains.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert className="border-slate-200 bg-slate-50">
                            <Info className="size-4 text-slate-500" />
                            <AlertDescription className="text-slate-600">
                                <strong>Not available on this deployment.</strong> The Cloudflare API
                                credentials (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">CLOUDFLARE_API_TOKEN</code>{' '}
                                and{' '}
                                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">CLOUDFLARE_ZONE_ID</code>) are
                                not configured for this instance. Contact your platform administrator
                                to enable automated white-label DNS setup.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header card */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Globe className="size-5 text-blue-600" />
                                White-Label Domain Setup
                            </CardTitle>
                            <CardDescription>
                                Configure custom domains for your institute's learner, admin, and
                                teacher portals. DNS records are created automatically via
                                Cloudflare.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {statusLoading ? (
                                <Loader2 className="size-4 animate-spin text-slate-400" />
                            ) : status ? (
                                <StatusBadge configured={status.is_configured} />
                            ) : null}
                            <button
                                onClick={fetchStatus}
                                disabled={statusLoading}
                                className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Refresh status"
                            >
                                <RefreshCw className="size-4" />
                            </button>
                        </div>
                    </div>
                </CardHeader>

                {/* Current status section */}
                {status?.is_configured && (
                    <CardContent className="border-t pt-4">
                        <p className="mb-3 text-sm font-semibold text-slate-700">
                            Current Configuration
                        </p>
                        <div className="space-y-2">
                            <PortalUrlRow label="Learner" url={status.learner_portal_url} />
                            <PortalUrlRow label="Admin" url={status.admin_portal_url} />
                            <PortalUrlRow label="Teacher" url={status.teacher_portal_url} />
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Setup wizard */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {status?.is_configured ? 'Update Configuration' : 'New Setup'}
                    </CardTitle>
                    <CardDescription>
                        Choose your domain type and fill in the details below.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Domain mode tabs */}
                    <Tabs
                        value={domainMode}
                        onValueChange={(v) =>
                            setDomainMode(v as 'VACADEMY_SUBDOMAIN' | 'CUSTOM')
                        }
                    >
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="VACADEMY_SUBDOMAIN">
                                <Server className="size-4 mr-2" />
                                Vacademy Subdomain
                            </TabsTrigger>
                            <TabsTrigger value="CUSTOM">
                                <Globe className="size-4 mr-2" />
                                Custom Domain
                            </TabsTrigger>
                        </TabsList>

                        {/* ── VACADEMY SUBDOMAIN ── */}
                        <TabsContent value="VACADEMY_SUBDOMAIN" className="space-y-4 pt-4">
                            <Alert className="border-blue-100 bg-blue-50">
                                <Info className="size-4 text-blue-600" />
                                <AlertDescription className="text-blue-700 text-sm">
                                    We'll create{' '}
                                    <strong>*.vacademy.io</strong> subdomains automatically.
                                    No DNS changes needed on your end.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="subdomain-slug">
                                    Subdomain Slug
                                    <span className="ml-1 text-red-500">*</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="subdomain-slug"
                                        placeholder="my-school"
                                        value={subdomainSlug}
                                        onChange={(e) =>
                                            setSubdomainSlug(
                                                e.target.value
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9-]/g, '')
                                            )
                                        }
                                        className="max-w-xs"
                                    />
                                    <span className="text-sm text-slate-500">.vacademy.io</span>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Lowercase letters, numbers and hyphens only.
                                </p>
                            </div>

                            {previewLearnerUrl && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Preview
                                    </p>
                                    <PortalUrlRow label="Learner" url={previewLearnerUrl} />
                                    <PortalUrlRow label="Admin" url={previewAdminUrl} />
                                </div>
                            )}
                        </TabsContent>

                        {/* ── CUSTOM DOMAIN ── */}
                        <TabsContent value="CUSTOM" className="space-y-4 pt-4">
                            <Alert className="border-amber-100 bg-amber-50">
                                <Shield className="size-4 text-amber-600" />
                                <AlertDescription className="text-amber-700 text-sm">
                                    Cloudflare CNAME records will be created automatically. Ensure
                                    your domain's nameservers point to Cloudflare, or add the
                                    generated CNAME records manually at your registrar.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="learner-domain">
                                        Learner Portal Domain
                                        <span className="ml-1 text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="learner-domain"
                                        placeholder="learn.myschool.com"
                                        value={customLearnerDomain}
                                        onChange={(e) =>
                                            setCustomLearnerDomain(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="admin-domain">
                                        Admin Portal Domain
                                        <span className="ml-1 text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="admin-domain"
                                        placeholder="admin.myschool.com"
                                        value={customAdminDomain}
                                        onChange={(e) =>
                                            setCustomAdminDomain(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="teacher-domain">
                                        Teacher Portal Domain
                                        <span className="ml-1 text-slate-400 font-normal text-xs">
                                            (optional)
                                        </span>
                                    </Label>
                                    <Input
                                        id="teacher-domain"
                                        placeholder="teach.myschool.com"
                                        value={customTeacherDomain}
                                        onChange={(e) =>
                                            setCustomTeacherDomain(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <Separator />

                    {/* Submit */}
                    <div className="flex items-center gap-3">
                        <MyButton
                            id="white-label-setup-btn"
                            onClick={handleSetup}
                            disabled={setupLoading}
                            buttonType="primary"
                            scale="large"
                            layoutVariant="default"
                        >
                            {setupLoading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin mr-2" />
                                    Configuring…
                                </>
                            ) : status?.is_configured ? (
                                'Update White-Label Setup'
                            ) : (
                                'Apply White-Label Setup'
                            )}
                        </MyButton>

                        {status?.is_configured && (
                            <p className="text-xs text-slate-500">
                                This will update your DNS records and portal URLs. Propagation may
                                take up to 5 minutes.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Last setup result */}
            {lastSetupResult && (
                <Card className="border-emerald-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
                            <CheckCircle2 className="size-5" />
                            Setup Complete
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <PortalUrlRow
                                label="Learner"
                                url={lastSetupResult.learner_portal_url}
                            />
                            <PortalUrlRow
                                label="Admin"
                                url={lastSetupResult.admin_portal_url}
                            />
                            <PortalUrlRow
                                label="Teacher"
                                url={lastSetupResult.teacher_portal_url}
                            />
                        </div>

                        {lastSetupResult.dns_records_configured?.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">
                                        DNS Records Configured
                                    </p>
                                    <div className="space-y-1.5">
                                        {lastSetupResult.dns_records_configured.map((r, i) => (
                                            <DnsRecordRow key={i} record={r} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {lastSetupResult.warnings?.length > 0 && (
                            <Alert className="border-amber-100 bg-amber-50">
                                <AlertCircle className="size-4 text-amber-600" />
                                <AlertDescription className="text-amber-700 text-sm space-y-1">
                                    {lastSetupResult.warnings.map((w, i) => (
                                        <p key={i}>{w}</p>
                                    ))}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
