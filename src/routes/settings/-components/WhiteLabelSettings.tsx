import React, { useState, useEffect, useRef } from 'react';
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
    Info,
    LinkIcon,
    TableIcon,
    Plus,
    Trash2,
    Star,
    ChevronDown,
    ChevronUp,
    Palette,
    KeyRound,
    Route,
    Link2,
    Upload,
    Pencil
} from 'lucide-react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { WHITE_LABEL_SETUP, WHITE_LABEL_STATUS } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { UploadFileInS3Public } from '@/routes/signup/-services/signup-services';
import { useFileUpload } from '@/hooks/use-file-upload';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

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

interface RoutingConfig {
    redirect?: string;
    privacy_policy_url?: string;
    terms_and_condition_url?: string;
    after_login_route?: string;
    admin_portal_after_logout_route?: string;
    home_icon_click_route?: string;
    theme?: string;
    tab_text?: string;
    allow_signup?: boolean;
    tab_icon_file_id?: string;
    font_family?: string;
    allow_google_auth?: boolean;
    allow_github_auth?: boolean;
    allow_email_otp_auth?: boolean;
    allow_phone_auth?: boolean;
    allow_username_password_auth?: boolean;
    convert_username_password_to_lowercase?: boolean;
    play_store_app_link?: string;
    app_store_app_link?: string;
    windows_app_link?: string;
    mac_app_link?: string;
}

interface RoutingEntry extends RoutingConfig {
    id: string;
    role: string;
    domain: string;
    subdomain: string;
}

interface WhiteLabelStatusResponse {
    cloudflare_enabled: boolean;
    is_configured: boolean;
    domain_type: string | null;
    learner_portal_url: string | null;
    admin_portal_url: string | null;
    teacher_portal_url: string | null;
    routing_entries: RoutingEntry[];
}

/** A single row in the setup form */
interface DomainFormEntry {
    id: string;
    role: 'LEARNER' | 'ADMIN' | 'TEACHER';
    domain: string;
    isPrimary: boolean;
    expanded: boolean;
    config: RoutingConfig;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLES = ['LEARNER', 'ADMIN', 'TEACHER'] as const;

const roleLabel = (role: string): string => {
    switch (role?.toUpperCase()) {
        case 'LEARNER': return 'Learner Portal';
        case 'ADMIN':   return 'Admin Portal';
        case 'TEACHER': return 'Teacher Portal';
        default:        return role;
    }
};

const roleBadgeClass = (role: string): string => {
    switch (role?.toUpperCase()) {
        case 'LEARNER': return 'border-green-200 bg-green-50 text-green-700';
        case 'ADMIN':   return 'border-orange-200 bg-orange-50 text-orange-700';
        case 'TEACHER': return 'border-purple-200 bg-purple-50 text-purple-700';
        default:        return '';
    }
};

const fqdn = (entry: RoutingEntry): string => {
    if (!entry.subdomain || entry.subdomain === '*') return entry.domain;
    return `${entry.subdomain}.${entry.domain}`;
};

let nextFormId = 1;
const makeFormId = () => `form-${nextFormId++}`;

const emptyConfig = (): RoutingConfig => ({});

// ─── Sub-components ───────────────────────────────────────────────────────────

const ImageUploadButton = ({
    fileId,
    onChange,
}: {
    fileId?: string;
    onChange: (fileId: string | undefined) => void;
}) => {
    const instituteId = getInstituteId() || 'admin';
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const { getPublicUrl } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (fileId) {
            getPublicUrl(fileId)
                .then((url) => setPreviewUrl(url))
                .catch(() => setPreviewUrl(null));
        } else {
            setPreviewUrl(null);
        }
    }, [fileId, getPublicUrl]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const uploadedFileId = await UploadFileInS3Public(
                file,
                setIsUploading,
                instituteId,
                'INSTITUTE_BRANDING'
            );

            if (uploadedFileId) {
                onChange(uploadedFileId);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="flex items-center gap-3">
            <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />

            {previewUrl ? (
                <div className="group relative size-12 shrink-0 rounded-md border border-slate-200 overflow-hidden bg-slate-50">
                    <img src={previewUrl} alt="Icon preview" className="size-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1 rounded text-white hover:bg-white/20"
                            title="Change image"
                        >
                            <Pencil className="size-3" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange(undefined)}
                            className="p-1 rounded text-white hover:bg-red-500/80"
                            title="Remove image"
                        >
                            <Trash2 className="size-3" />
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex size-12 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                    {isUploading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <>
                            <Upload className="size-4" />
                        </>
                    )}
                </button>
            )}

            <div className="flex-1 space-y-1">
                <Input
                    placeholder="or enter file UUID"
                    value={fileId || ''}
                    onChange={(e) => onChange(e.target.value || undefined)}
                    className="h-8 text-sm"
                />
            </div>
        </div>
    );
};

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
        <Badge variant={record.action === 'CREATED' ? 'default' : 'secondary'} className="ml-3 shrink-0 text-xs">
            {record.action}
        </Badge>
    </div>
);

const PortalUrlRow = ({ label, url }: { label: string; url: string | null | undefined }) => {
    if (!url) return null;
    return (
        <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-600 w-28 shrink-0">{label}</span>
            <a href={url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-blue-600 hover:underline truncate">
                {url}
                <ExternalLink className="size-3 shrink-0" />
            </a>
        </div>
    );
};

/** Displays a single config value in the current config table */
const ConfigValue = ({ label, value }: { label: string; value: any }) => {
    if (value === null || value === undefined || value === '') return null;
    const display = typeof value === 'boolean' ? (value ? '✓ Yes' : '✗ No') : String(value);
    return (
        <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 shrink-0">{label}</span>
            <span className="text-slate-700 font-mono truncate text-right">{display}</span>
        </div>
    );
};

// ─── Config Form Section ──────────────────────────────────────────────────────

const ConfigFormSection = ({
    config,
    onUpdate,
}: {
    config: RoutingConfig;
    onUpdate: (field: keyof RoutingConfig, value: any) => void;
}) => (
    <div className="space-y-5 pt-4">
        {/* Branding */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Palette className="size-4 text-blue-500" />
                Branding
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Tab Title</Label>
                    <Input placeholder="My School" value={config.tab_text || ''}
                           onChange={e => onUpdate('tab_text', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Tab Icon File ID</Label>
                    <ImageUploadButton
                        fileId={config.tab_icon_file_id}
                        onChange={(id) => onUpdate('tab_icon_file_id', id)}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Theme / Color</Label>
                    <Input placeholder="#4F46E5 or theme-name" value={config.theme || ''}
                           onChange={e => onUpdate('theme', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Font Family</Label>
                    <Input placeholder="Inter, Roboto, etc." value={config.font_family || ''}
                           onChange={e => onUpdate('font_family', e.target.value)} className="h-8 text-sm" />
                </div>
            </div>
        </div>

        <Separator />

        {/* Authentication */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <KeyRound className="size-4 text-amber-500" />
                Authentication
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                    ['allow_signup', 'Allow Sign Up'],
                    ['allow_google_auth', 'Google Auth'],
                    ['allow_github_auth', 'GitHub Auth'],
                    ['allow_email_otp_auth', 'Email OTP Auth'],
                    ['allow_phone_auth', 'Phone Auth'],
                    ['allow_username_password_auth', 'Username/Password Auth'],
                    ['convert_username_password_to_lowercase', 'Convert Username to Lowercase'],
                ] as [keyof RoutingConfig, string][]).map(([field, label]) => (
                    <div key={field} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2">
                        <Label className="text-xs text-slate-600 cursor-pointer" htmlFor={`switch-${field}`}>
                            {label}
                        </Label>
                        <Switch
                            id={`switch-${field}`}
                            checked={!!config[field]}
                            onCheckedChange={v => onUpdate(field, v)}
                        />
                    </div>
                ))}
            </div>
        </div>

        <Separator />

        {/* Routes */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Route className="size-4 text-green-500" />
                Routes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Redirect URL</Label>
                    <Input placeholder="/dashboard" value={config.redirect || ''}
                           onChange={e => onUpdate('redirect', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">After Login Route</Label>
                    <Input placeholder="/dashboard" value={config.after_login_route || ''}
                           onChange={e => onUpdate('after_login_route', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">After Logout Route</Label>
                    <Input placeholder="/login" value={config.admin_portal_after_logout_route || ''}
                           onChange={e => onUpdate('admin_portal_after_logout_route', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Home Icon Click Route</Label>
                    <Input placeholder="/" value={config.home_icon_click_route || ''}
                           onChange={e => onUpdate('home_icon_click_route', e.target.value)} className="h-8 text-sm" />
                </div>
            </div>
        </div>

        <Separator />

        {/* Links */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Link2 className="size-4 text-violet-500" />
                Links
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Privacy Policy URL</Label>
                    <Input placeholder="https://myschool.com/privacy" value={config.privacy_policy_url || ''}
                           onChange={e => onUpdate('privacy_policy_url', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Terms & Conditions URL</Label>
                    <Input placeholder="https://myschool.com/terms" value={config.terms_and_condition_url || ''}
                           onChange={e => onUpdate('terms_and_condition_url', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Play Store Link</Label>
                    <Input placeholder="https://play.google.com/..." value={config.play_store_app_link || ''}
                           onChange={e => onUpdate('play_store_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">App Store Link</Label>
                    <Input placeholder="https://apps.apple.com/..." value={config.app_store_app_link || ''}
                           onChange={e => onUpdate('app_store_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Windows App Link</Label>
                    <Input placeholder="https://..." value={config.windows_app_link || ''}
                           onChange={e => onUpdate('windows_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Mac App Link</Label>
                    <Input placeholder="https://..." value={config.mac_app_link || ''}
                           onChange={e => onUpdate('mac_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
            </div>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WhiteLabelSettings({ isTab }: { isTab?: boolean }) {
    const instituteId = getInstituteId();

    const [formEntries, setFormEntries] = useState<DomainFormEntry[]>([
        { id: makeFormId(), role: 'LEARNER', domain: '', isPrimary: true, expanded: false, config: emptyConfig() },
        { id: makeFormId(), role: 'ADMIN',   domain: '', isPrimary: true, expanded: false, config: emptyConfig() },
    ]);

    const [status, setStatus] = useState<WhiteLabelStatusResponse | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);
    const [lastSetupResult, setLastSetupResult] = useState<WhiteLabelSetupResponse | null>(null);

    useEffect(() => { if (instituteId) fetchStatus(); }, [instituteId]);

    // ── Pre-fill from existing routing entries ────────────────────────────────
    const prefillFromStatus = (data: WhiteLabelStatusResponse) => {
        if (!data.routing_entries || data.routing_entries.length === 0) return;

        const newEntries: DomainFormEntry[] = data.routing_entries.map((r) => {
            const fullDomain = fqdn(r);
            let isPrimary = false;
            if (r.role === 'LEARNER' && data.learner_portal_url)
                isPrimary = data.learner_portal_url.replace(/^https?:\/\//, '') === fullDomain;
            else if (r.role === 'ADMIN' && data.admin_portal_url)
                isPrimary = data.admin_portal_url.replace(/^https?:\/\//, '') === fullDomain;
            else if (r.role === 'TEACHER' && data.teacher_portal_url)
                isPrimary = data.teacher_portal_url.replace(/^https?:\/\//, '') === fullDomain;

            return {
                id: makeFormId(),
                role: r.role as 'LEARNER' | 'ADMIN' | 'TEACHER',
                domain: fullDomain,
                isPrimary,
                expanded: false,
                config: {
                    tab_text: r.tab_text ?? undefined,
                    tab_icon_file_id: r.tab_icon_file_id ?? undefined,
                    theme: r.theme ?? undefined,
                    font_family: r.font_family ?? undefined,
                    redirect: r.redirect ?? undefined,
                    after_login_route: r.after_login_route ?? undefined,
                    admin_portal_after_logout_route: r.admin_portal_after_logout_route ?? undefined,
                    home_icon_click_route: r.home_icon_click_route ?? undefined,
                    allow_signup: r.allow_signup ?? undefined,
                    allow_google_auth: r.allow_google_auth ?? undefined,
                    allow_github_auth: r.allow_github_auth ?? undefined,
                    allow_email_otp_auth: r.allow_email_otp_auth ?? undefined,
                    allow_phone_auth: r.allow_phone_auth ?? undefined,
                    allow_username_password_auth: r.allow_username_password_auth ?? undefined,
                    convert_username_password_to_lowercase: r.convert_username_password_to_lowercase ?? undefined,
                    privacy_policy_url: r.privacy_policy_url ?? undefined,
                    terms_and_condition_url: r.terms_and_condition_url ?? undefined,
                    play_store_app_link: r.play_store_app_link ?? undefined,
                    app_store_app_link: r.app_store_app_link ?? undefined,
                    windows_app_link: r.windows_app_link ?? undefined,
                    mac_app_link: r.mac_app_link ?? undefined,
                },
            };
        });

        if (newEntries.length > 0) setFormEntries(newEntries);
    };

    // ── API ───────────────────────────────────────────────────────────────────
    const fetchStatus = async () => {
        if (!instituteId) return;
        setStatusLoading(true);
        try {
            const res = await authenticatedAxiosInstance.get<WhiteLabelStatusResponse>(
                WHITE_LABEL_STATUS(instituteId)
            );
            console.log('[WhiteLabel] Status response:', res.data);
            setStatus(res.data);
            prefillFromStatus(res.data);
        } catch (err) {
            console.error('[WhiteLabel] Failed to load status', err);
        } finally {
            setStatusLoading(false);
        }
    };

    const handleSetup = async () => {
        if (!instituteId) { toast.error('No institute selected'); return; }

        const nonEmpty = formEntries.filter(e => e.domain.trim());
        if (nonEmpty.length === 0) { toast.error('Add at least one domain entry'); return; }

        for (const role of ROLES) {
            const primaries = nonEmpty.filter(e => e.role === role && e.isPrimary);
            if (primaries.length > 1) {
                toast.error(`Only one primary domain allowed for ${roleLabel(role)}`);
                return;
            }
        }

        setSetupLoading(true);
        setLastSetupResult(null);
        try {
            const payload = {
                entries: nonEmpty.map(e => ({
                    role: e.role,
                    domain: e.domain.trim().toLowerCase(),
                    is_primary: e.isPrimary,
                    routing_config: e.config,
                })),
            };

            const res = await authenticatedAxiosInstance.post<WhiteLabelSetupResponse>(
                `${WHITE_LABEL_SETUP}?instituteId=${instituteId}`,
                payload
            );
            setLastSetupResult(res.data);
            toast.success('White-label setup completed! 🎉');
            await fetchStatus();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || err?.response?.data || 'Setup failed.';
            toast.error(typeof errMsg === 'string' ? errMsg : 'Setup failed');
        } finally {
            setSetupLoading(false);
        }
    };

    // ── Form entry CRUD ───────────────────────────────────────────────────────
    const addEntry = () => {
        setFormEntries(prev => [
            ...prev,
            { id: makeFormId(), role: 'LEARNER', domain: '', isPrimary: false, expanded: false, config: emptyConfig() },
        ]);
    };

    const removeEntry = (id: string) => {
        setFormEntries(prev => prev.filter(e => e.id !== id));
    };

    const updateEntry = (id: string, field: keyof DomainFormEntry, value: any) => {
        if (field === 'isPrimary' && value === true) {
            setFormEntries(prev => {
                const entry = prev.find(e => e.id === id);
                if (!entry) return prev;
                return prev.map(e => {
                    if (e.id === id) return { ...e, isPrimary: true };
                    if (e.role === entry.role && e.isPrimary) return { ...e, isPrimary: false };
                    return e;
                });
            });
        } else {
            setFormEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
        }
    };

    const updateEntryConfig = (id: string, field: keyof RoutingConfig, value: any) => {
        setFormEntries(prev =>
            prev.map(e =>
                e.id === id ? { ...e, config: { ...e.config, [field]: value } } : e
            )
        );
    };

    const toggleExpand = (id: string) => {
        setFormEntries(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e));
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (status !== null && !status.cloudflare_enabled) {
        return (
            <div className="max-w-3xl">
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Globe className="size-5 text-slate-400" />
                            White-Label Domain Setup
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert className="border-slate-200 bg-slate-50">
                            <Info className="size-4 text-slate-500" />
                            <AlertDescription className="text-slate-600">
                                <strong>Not available on this deployment.</strong> Cloudflare API
                                credentials are not configured. Contact your platform administrator.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* ── Header ── */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Globe className="size-5 text-blue-600" />
                                White-Label Domain Setup
                            </CardTitle>
                            <CardDescription>
                                Configure custom domains, branding, auth settings and more for each portal.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {statusLoading ? (
                                <Loader2 className="size-4 animate-spin text-slate-400" />
                            ) : status ? (
                                <StatusBadge configured={status.is_configured} />
                            ) : null}
                            <button onClick={fetchStatus} disabled={statusLoading}
                                    className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                    title="Refresh status">
                                <RefreshCw className="size-4" />
                            </button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* ── Current Configuration ── */}
            {status?.is_configured && (
                <Card className="border-blue-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <LinkIcon className="size-4 text-blue-600" />
                            Current Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Primary URLs */}
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                Primary Portal URLs (Institute Default)
                            </p>
                            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <PortalUrlRow label="Learner" url={status.learner_portal_url} />
                                <PortalUrlRow label="Admin" url={status.admin_portal_url} />
                                <PortalUrlRow label="Teacher" url={status.teacher_portal_url} />
                                {!status.learner_portal_url && !status.admin_portal_url && !status.teacher_portal_url && (
                                    <p className="text-sm text-slate-400 italic">No portal URLs set.</p>
                                )}
                            </div>
                        </div>

                        {/* Full routing entries */}
                        {status.routing_entries && status.routing_entries.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <TableIcon className="size-4 text-slate-500" />
                                        <p className="text-sm font-semibold text-slate-700">
                                            Domain Routing Entries
                                        </p>
                                        <Badge variant="secondary" className="text-xs">
                                            {status.routing_entries.length} total
                                        </Badge>
                                    </div>
                                    <div className="space-y-2">
                                        {status.routing_entries.map((entry) => (
                                            <RoutingEntryCard key={entry.id} entry={entry} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Setup / Update Form ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {status?.is_configured ? 'Add / Update Domains' : 'New Setup'}
                    </CardTitle>
                    <CardDescription>
                        Add domain entries below. Click <strong>⚙ Settings</strong> on each entry to
                        configure branding, authentication, routes, and links.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert className="border-blue-100 bg-blue-50">
                        <Info className="size-4 text-blue-600" />
                        <AlertDescription className="text-blue-700 text-sm">
                            <strong>Tip:</strong> Enter{' '}
                            <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">my-school.vacademy.io</code> for
                            Vacademy subdomains, or{' '}
                            <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">learn.myschool.com</code> for
                            custom domains. Mark one per role as ⭐ Primary.
                        </AlertDescription>
                    </Alert>

                    {/* Dynamic entries */}
                    <div className="space-y-3">
                        {formEntries.map((entry, idx) => (
                            <div key={entry.id}
                                 className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                {/* Top row: entry number, role, domain, primary, expand, delete */}
                                <div className="flex items-start gap-3 p-4">
                                    <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                                        {idx + 1}
                                    </span>

                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">Role</Label>
                                            <Select value={entry.role}
                                                    onValueChange={v => updateEntry(entry.id, 'role', v)}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {ROLES.map(r => (
                                                        <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">Domain</Label>
                                            <Input placeholder="learn.myschool.com" value={entry.domain}
                                                   onChange={e => updateEntry(entry.id, 'domain',
                                                       e.target.value.toLowerCase().replace(/\s/g, ''))}
                                                   className="h-9" />
                                        </div>
                                    </div>

                                    {/* Primary */}
                                    <button type="button"
                                            onClick={() => updateEntry(entry.id, 'isPrimary', !entry.isPrimary)}
                                            className={`mt-6 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                                entry.isPrimary
                                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                    : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                                            }`}
                                            title={entry.isPrimary ? 'Primary domain for this role' : 'Set as primary'}>
                                        <Star className={`size-3 ${entry.isPrimary ? 'fill-amber-500' : ''}`} />
                                        {entry.isPrimary ? 'Primary' : 'Set primary'}
                                    </button>

                                    {/* Expand config */}
                                    <button type="button" onClick={() => toggleExpand(entry.id)}
                                            className="mt-6 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                            title="Toggle settings">
                                        {entry.expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                        Settings
                                    </button>

                                    {/* Remove */}
                                    {formEntries.length > 1 && (
                                        <button type="button" onClick={() => removeEntry(entry.id)}
                                                className="mt-6 rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                title="Remove">
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Expanded config section */}
                                {entry.expanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/30 px-4 pb-4">
                                        <ConfigFormSection
                                            config={entry.config}
                                            onUpdate={(field, value) => updateEntryConfig(entry.id, field, value)}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add entry */}
                    <button type="button" onClick={addEntry}
                            className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors w-full justify-center">
                        <Plus className="size-4" />
                        Add another domain
                    </button>

                    <Separator />

                    {/* Submit */}
                    <div className="flex items-center gap-3">
                        <MyButton id="white-label-setup-btn" onClick={handleSetup}
                                  disabled={setupLoading} buttonType="primary" scale="large" layoutVariant="default">
                            {setupLoading ? (
                                <><Loader2 className="size-4 animate-spin mr-2" /> Configuring…</>
                            ) : status?.is_configured ? 'Update White-Label Setup' : 'Apply White-Label Setup'}
                        </MyButton>
                        {status?.is_configured && (
                            <p className="text-xs text-slate-500">
                                Existing entries are preserved. Only listed domains are created/updated.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Last setup result ── */}
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
                            <PortalUrlRow label="Learner" url={lastSetupResult.learner_portal_url} />
                            <PortalUrlRow label="Admin" url={lastSetupResult.admin_portal_url} />
                            <PortalUrlRow label="Teacher" url={lastSetupResult.teacher_portal_url} />
                        </div>
                        {lastSetupResult.dns_records_configured?.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">DNS Records Configured</p>
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
                                    {lastSetupResult.warnings.map((w, i) => <p key={i}>{w}</p>)}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─── Routing Entry Card (current config display) ──────────────────────────────

function RoutingEntryCard({ entry }: { entry: RoutingEntry }) {
    const [expanded, setExpanded] = useState(false);
    const full = fqdn(entry);

    const hasConfig = !!(
        entry.tab_text || entry.theme || entry.font_family || entry.tab_icon_file_id ||
        entry.redirect || entry.after_login_route || entry.admin_portal_after_logout_route ||
        entry.home_icon_click_route || entry.privacy_policy_url || entry.terms_and_condition_url ||
        entry.play_store_app_link || entry.app_store_app_link ||
        entry.windows_app_link || entry.mac_app_link ||
        entry.allow_signup != null || entry.allow_google_auth != null ||
        entry.allow_github_auth != null || entry.allow_email_otp_auth != null ||
        entry.allow_phone_auth != null || entry.allow_username_password_auth != null
    );

    return (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {/* Summary row */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={roleBadgeClass(entry.role)}>
                        {roleLabel(entry.role)}
                    </Badge>
                    <a href={`https://${full}`} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-sm text-blue-600 hover:underline font-mono truncate">
                        {full}
                        <ExternalLink className="size-3 shrink-0" />
                    </a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {entry.tab_text && (
                        <span className="text-xs text-slate-500 hidden sm:inline">
                            Tab: {entry.tab_text}
                        </span>
                    )}
                    {entry.theme && (
                        <span className="text-xs text-slate-500 hidden sm:inline">
                            Theme: {entry.theme}
                        </span>
                    )}
                    {hasConfig && (
                        <button onClick={() => setExpanded(!expanded)}
                                className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Show details">
                            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                        <ConfigValue label="Domain" value={entry.domain} />
                        <ConfigValue label="Subdomain" value={entry.subdomain} />
                        <ConfigValue label="Tab Title" value={entry.tab_text} />
                        <ConfigValue label="Tab Icon" value={entry.tab_icon_file_id} />
                        <ConfigValue label="Theme" value={entry.theme} />
                        <ConfigValue label="Font" value={entry.font_family} />
                        <ConfigValue label="Redirect" value={entry.redirect} />
                        <ConfigValue label="After Login" value={entry.after_login_route} />
                        <ConfigValue label="After Logout" value={entry.admin_portal_after_logout_route} />
                        <ConfigValue label="Home Click" value={entry.home_icon_click_route} />
                        <ConfigValue label="Sign Up" value={entry.allow_signup} />
                        <ConfigValue label="Google Auth" value={entry.allow_google_auth} />
                        <ConfigValue label="GitHub Auth" value={entry.allow_github_auth} />
                        <ConfigValue label="Email OTP" value={entry.allow_email_otp_auth} />
                        <ConfigValue label="Phone Auth" value={entry.allow_phone_auth} />
                        <ConfigValue label="User/Pass Auth" value={entry.allow_username_password_auth} />
                        <ConfigValue label="Privacy Policy" value={entry.privacy_policy_url} />
                        <ConfigValue label="Terms" value={entry.terms_and_condition_url} />
                        <ConfigValue label="Play Store" value={entry.play_store_app_link} />
                        <ConfigValue label="App Store" value={entry.app_store_app_link} />
                        <ConfigValue label="Windows" value={entry.windows_app_link} />
                        <ConfigValue label="Mac" value={entry.mac_app_link} />
                    </div>
                </div>
            )}
        </div>
    );
}
