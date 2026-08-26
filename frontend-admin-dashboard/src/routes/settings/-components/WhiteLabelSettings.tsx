import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    ChevronDown,
    ChevronUp,
    Palette,
    KeyRound,
    Route,
    Link2,
    Upload,
    Pencil,
    Phone
} from 'lucide-react';
import PreferredCountriesSelector from './PreferredCountriesSelector';
import {
    parsePreferredCountriesString,
    stringifyPreferredCountries,
    countryCodeToFlag,
} from '../-utils/countries';
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

interface PagesDomainResult {
    project: string;
    name: string;
    status: string;
    action: string;
    pages_cname_target: string;
}

interface WhiteLabelSetupResponse {
    setup_complete: boolean;
    learner_portal_url: string;
    admin_portal_url: string;
    teacher_portal_url: string;
    dns_records_configured: DnsRecordResult[];
    pages_domains_configured?: PagesDomainResult[];
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
    /**
     * Comma-separated ISO 3166-1 alpha-2 country codes (e.g. "in,us,gb,au").
     * The first entry becomes the default country in phone inputs across the
     * learner and admin dashboards. The full ordered list determines the order
     * of the country picker dropdown.
     */
    comma_separated_preferred_country?: string;
    /**
     * When true, the institute name is hidden wherever the logo is rendered
     * (login page, sidebar header). Useful when the logo already contains the
     * institute name. Default (undefined / false): name is shown as before.
     */
    hide_institute_name?: boolean;
    /**
     * Optional explicit logo width in pixels. When set, overrides the default
     * responsive logo sizing in the sidebar and login page. Leave unset to
     * preserve existing behavior. 250+ (the panel width) COMBINED WITH a blank
     * logo_height_px makes the sidebar logo full-bleed: the header padding is
     * dropped and the logo spans all 250px, scaling by width alone.
     */
    logo_width_px?: number;
    /**
     * Optional explicit logo height in pixels. When set, the logo is fitted
     * (object-contain) inside the width × height box — which also opts the
     * sidebar out of full-bleed, since fitting a fixed height would letterbox
     * the logo back down. Leave unset to scale proportionally to the width.
     */
    logo_height_px?: number;
    /**
     * When true, the institute name is rendered stacked BELOW the logo (centered
     * vertical) instead of to its right, in the sidebar header. Default
     * (undefined / false): name sits beside the logo, as before.
     */
    stack_name_below_logo?: boolean;
}

// UI-enforced caps so operators can't enter values that break the layout.
export const LOGO_DIMENSION_LIMITS = {
    minPx: 16,
    maxWidthPx: 400,
    maxHeightPx: 200,
} as const;

interface RoutingEntry extends RoutingConfig {
    id: string;
    role: string;
    domain: string;
    subdomain: string;
    /** Live Cloudflare Pages custom-domain status: active / pending / initializing / … */
    pages_status?: string | null;
    /** CNAME target (<project>.pages.dev) the customer must point an external domain at. */
    pages_cname_target?: string | null;
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

const roleLabel = (role: string, t: (key: string) => string): string => {
    switch (role?.toUpperCase()) {
        case 'LEARNER': return t('roles.learnerPortal');
        case 'ADMIN':   return t('roles.adminPortal');
        case 'TEACHER': return t('roles.teacherPortal');
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
    const { t } = useTranslation('settingsWhiteLabel');
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
            toast.error(t('imageUpload.uploadFailed'));
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
                    <img src={previewUrl} alt={t('imageUpload.iconPreviewAlt')} className="size-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1 rounded text-white hover:bg-white/20"
                            title={t('imageUpload.changeImage')}
                        >
                            <Pencil className="size-3" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange(undefined)}
                            className="p-1 rounded text-white hover:bg-red-500/80"
                            title={t('imageUpload.removeImage')}
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
                    placeholder={t('imageUpload.fileUuidPlaceholder')}
                    value={fileId || ''}
                    onChange={(e) => onChange(e.target.value || undefined)}
                    className="h-8 text-sm"
                />
            </div>
        </div>
    );
};

const StatusBadge = ({ configured }: { configured: boolean }) => {
    const { t } = useTranslation('settingsWhiteLabel');
    return configured ? (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
            <CheckCircle2 className="size-3" />
            {t('status.configured')}
        </Badge>
    ) : (
        <Badge variant="secondary" className="gap-1">
            <AlertCircle className="size-3" />
            {t('status.notConfigured')}
        </Badge>
    );
};

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

const pagesStatusClass = (status: string): string => {
    switch (status?.toLowerCase()) {
        case 'active':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'pending':
        case 'initializing':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        default:
            return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

const PagesDomainRow = ({ record }: { record: PagesDomainResult }) => {
    const { t } = useTranslation('settingsWhiteLabel');
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm space-y-1.5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">
                        PAGES
                    </span>
                    <span className="truncate font-mono text-slate-700">{record.name}</span>
                    <span className="hidden shrink-0 text-slate-400 sm:inline">→</span>
                    <span className="hidden truncate font-mono text-slate-500 sm:inline">{record.project}</span>
                </div>
                <Badge variant="outline" className={`ml-3 shrink-0 text-xs ${pagesStatusClass(record.status)}`}>
                    {record.status || record.action}
                </Badge>
            </div>
            {record.status?.toLowerCase() !== 'active' && record.pages_cname_target && (
                <p className="text-xs text-slate-500">
                    {t('pagesDomain.cnameHint')}{' '}
                    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">
                        {record.name} → {record.pages_cname_target}
                    </code>
                    . {t('pagesDomain.sslHint')}
                </p>
            )}
        </div>
    );
};

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
    const { t } = useTranslation('settingsWhiteLabel');
    if (value === null || value === undefined || value === '') return null;
    const display = typeof value === 'boolean' ? (value ? t('configValue.yes') : t('configValue.no')) : String(value);
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
}) => {
    const { t } = useTranslation('settingsWhiteLabel');
    return (
    <div className="space-y-5 pt-4">
        {/* Branding */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Palette className="size-4 text-blue-500" />
                {t('configForm.branding.heading')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.branding.tabTitleLabel')}</Label>
                    <Input placeholder={t('configForm.branding.tabTitlePlaceholder')} value={config.tab_text || ''}
                           onChange={e => onUpdate('tab_text', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.branding.tabIconLabel')}</Label>
                    <ImageUploadButton
                        fileId={config.tab_icon_file_id}
                        onChange={(id) => onUpdate('tab_icon_file_id', id)}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.branding.themeLabel')}</Label>
                    <Input placeholder={t('configForm.branding.themePlaceholder')} value={config.theme || ''}
                           onChange={e => onUpdate('theme', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.branding.fontFamilyLabel')}</Label>
                    <Input placeholder={t('configForm.branding.fontFamilyPlaceholder')} value={config.font_family || ''}
                           onChange={e => onUpdate('font_family', e.target.value)} className="h-8 text-sm" />
                </div>
            </div>

            {/* Logo display controls — apply to sidebar + login on both admin and learner sides */}
            <div className="rounded-md border border-slate-100 bg-slate-50/50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-xs font-medium text-slate-700 cursor-pointer" htmlFor="switch-hide_institute_name">
                            {t('configForm.branding.hideNameLabel')}
                        </Label>
                        <p className="text-[11px] text-slate-400">
                            {t('configForm.branding.hideNameHint')}
                        </p>
                    </div>
                    <Switch
                        id="switch-hide_institute_name"
                        checked={!!config.hide_institute_name}
                        onCheckedChange={v => onUpdate('hide_institute_name', v)}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-xs font-medium text-slate-700 cursor-pointer" htmlFor="switch-stack_name_below_logo">
                            {t('configForm.branding.stackNameLabel')}
                        </Label>
                        <p className="text-xs text-slate-400">
                            {t('configForm.branding.stackNameHint')}
                        </p>
                    </div>
                    <Switch
                        id="switch-stack_name_below_logo"
                        checked={!!config.stack_name_below_logo}
                        onCheckedChange={v => onUpdate('stack_name_below_logo', v)}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">
                            {t('configForm.branding.logoWidthLabel')}
                        </Label>
                        <Input
                            type="number"
                            min={LOGO_DIMENSION_LIMITS.minPx}
                            max={LOGO_DIMENSION_LIMITS.maxWidthPx}
                            placeholder={`${LOGO_DIMENSION_LIMITS.minPx}–${LOGO_DIMENSION_LIMITS.maxWidthPx}`}
                            value={config.logo_width_px ?? ''}
                            onChange={e => {
                                const raw = e.target.value;
                                if (raw === '') {
                                    onUpdate('logo_width_px', undefined);
                                    return;
                                }
                                const n = Number(raw);
                                if (!Number.isFinite(n)) return;
                                const clamped = Math.max(
                                    LOGO_DIMENSION_LIMITS.minPx,
                                    Math.min(LOGO_DIMENSION_LIMITS.maxWidthPx, Math.round(n))
                                );
                                onUpdate('logo_width_px', clamped);
                            }}
                            className="h-8 text-sm"
                        />
                        <p className="text-[10px] text-slate-400">
                            {t('configForm.branding.logoWidthHint')}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">
                            {t('configForm.branding.logoHeightLabel')}
                        </Label>
                        <Input
                            type="number"
                            min={LOGO_DIMENSION_LIMITS.minPx}
                            max={LOGO_DIMENSION_LIMITS.maxHeightPx}
                            placeholder={`${LOGO_DIMENSION_LIMITS.minPx}–${LOGO_DIMENSION_LIMITS.maxHeightPx}`}
                            value={config.logo_height_px ?? ''}
                            onChange={e => {
                                const raw = e.target.value;
                                if (raw === '') {
                                    onUpdate('logo_height_px', undefined);
                                    return;
                                }
                                const n = Number(raw);
                                if (!Number.isFinite(n)) return;
                                const clamped = Math.max(
                                    LOGO_DIMENSION_LIMITS.minPx,
                                    Math.min(LOGO_DIMENSION_LIMITS.maxHeightPx, Math.round(n))
                                );
                                onUpdate('logo_height_px', clamped);
                            }}
                            className="h-8 text-sm"
                        />
                        <p className="text-[10px] text-slate-400">
                            {t('configForm.branding.logoHeightHint')}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <Separator />

        {/* Authentication */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <KeyRound className="size-4 text-amber-500" />
                {t('configForm.auth.heading')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                    ['allow_signup', t('configForm.auth.allowSignup')],
                    ['allow_google_auth', t('configForm.auth.googleAuth')],
                    ['allow_github_auth', t('configForm.auth.githubAuth')],
                    ['allow_email_otp_auth', t('configForm.auth.emailOtpAuth')],
                    ['allow_phone_auth', t('configForm.auth.phoneAuth')],
                    ['allow_username_password_auth', t('configForm.auth.usernamePasswordAuth')],
                    ['convert_username_password_to_lowercase', t('configForm.auth.convertUsernameLowercase')],
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

        {/* Phone Input Preferences */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Phone className="size-4 text-sky-500" />
                {t('configForm.phone.heading')}
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">
                    {t('configForm.phone.preferredCountriesLabel')}
                </Label>
                <PreferredCountriesSelector
                    value={parsePreferredCountriesString(
                        config.comma_separated_preferred_country
                    )}
                    onChange={(codes) =>
                        onUpdate(
                            'comma_separated_preferred_country',
                            codes.length > 0 ? stringifyPreferredCountries(codes) : undefined
                        )
                    }
                />
                <p className="text-[11px] text-slate-400">
                    {t('configForm.phone.preferredCountriesHint')}
                </p>
            </div>
        </div>

        <Separator />

        {/* Routes */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Route className="size-4 text-green-500" />
                {t('configForm.routes.heading')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.routes.redirectLabel')}</Label>
                    <Input placeholder={t('configForm.routes.redirectPlaceholder')} value={config.redirect || ''}
                           onChange={e => onUpdate('redirect', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.routes.afterLoginLabel')}</Label>
                    <Input placeholder={t('configForm.routes.afterLoginPlaceholder')} value={config.after_login_route || ''}
                           onChange={e => onUpdate('after_login_route', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.routes.afterLogoutLabel')}</Label>
                    <Input placeholder={t('configForm.routes.afterLogoutPlaceholder')} value={config.admin_portal_after_logout_route || ''}
                           onChange={e => onUpdate('admin_portal_after_logout_route', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.routes.homeClickLabel')}</Label>
                    <Input placeholder={t('configForm.routes.homeClickPlaceholder')} value={config.home_icon_click_route || ''}
                           onChange={e => onUpdate('home_icon_click_route', e.target.value)} className="h-8 text-sm" />
                </div>
            </div>
        </div>

        <Separator />

        {/* Links */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Link2 className="size-4 text-violet-500" />
                {t('configForm.links.heading')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.links.privacyPolicyLabel')}</Label>
                    <Input placeholder={t('configForm.links.privacyPolicyPlaceholder')} value={config.privacy_policy_url || ''}
                           onChange={e => onUpdate('privacy_policy_url', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.links.termsLabel')}</Label>
                    <Input placeholder={t('configForm.links.termsPlaceholder')} value={config.terms_and_condition_url || ''}
                           onChange={e => onUpdate('terms_and_condition_url', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.links.playStoreLabel')}</Label>
                    <Input placeholder={t('configForm.links.playStorePlaceholder')} value={config.play_store_app_link || ''}
                           onChange={e => onUpdate('play_store_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.links.appStoreLabel')}</Label>
                    <Input placeholder={t('configForm.links.appStorePlaceholder')} value={config.app_store_app_link || ''}
                           onChange={e => onUpdate('app_store_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.links.windowsLabel')}</Label>
                    <Input placeholder={t('configForm.links.genericUrlPlaceholder')} value={config.windows_app_link || ''}
                           onChange={e => onUpdate('windows_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500">{t('configForm.links.macLabel')}</Label>
                    <Input placeholder={t('configForm.links.genericUrlPlaceholder')} value={config.mac_app_link || ''}
                           onChange={e => onUpdate('mac_app_link', e.target.value)} className="h-8 text-sm" />
                </div>
            </div>
        </div>
    </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WhiteLabelSettings({ isTab }: { isTab?: boolean }) {
    const { t } = useTranslation('settingsWhiteLabel');
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
                    comma_separated_preferred_country:
                        r.comma_separated_preferred_country ?? undefined,
                    hide_institute_name: r.hide_institute_name ?? undefined,
                    logo_width_px: r.logo_width_px ?? undefined,
                    logo_height_px: r.logo_height_px ?? undefined,
                    stack_name_below_logo: r.stack_name_below_logo ?? undefined,
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
        if (!instituteId) { toast.error(t('toast.noInstituteSelected')); return; }

        const nonEmpty = formEntries.filter(e => e.domain.trim());
        if (nonEmpty.length === 0) { toast.error(t('toast.addAtLeastOneDomain')); return; }

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
            toast.success(t('toast.setupCompleted'));
            await fetchStatus();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || err?.response?.data || t('toast.setupFailed');
            toast.error(typeof errMsg === 'string' ? errMsg : t('toast.setupFailed'));
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
        setFormEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
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
                            {t('header.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert className="border-slate-200 bg-slate-50">
                            <Info className="size-4 text-slate-500" />
                            <AlertDescription className="text-slate-600">
                                <strong>{t('notAvailable.strong')}</strong> {t('notAvailable.description')}
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
                                {t('header.title')}
                            </CardTitle>
                            <CardDescription>
                                {t('header.description')}
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
                                    title={t('header.refreshStatus')}>
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
                            {t('currentConfig.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Primary URLs */}
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                {t('currentConfig.primaryUrlsLabel')}
                            </p>
                            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <PortalUrlRow label={getTerminology(RoleTerms.Learner, SystemTerms.Learner)} url={status.learner_portal_url} />
                                <PortalUrlRow label={getTerminology(RoleTerms.Admin, SystemTerms.Admin)} url={status.admin_portal_url} />
                                <PortalUrlRow label={getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)} url={status.teacher_portal_url} />
                                {!status.learner_portal_url && !status.admin_portal_url && !status.teacher_portal_url && (
                                    <p className="text-sm text-slate-400 italic">{t('currentConfig.noPortalUrls')}</p>
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
                                            {t('currentConfig.domainRoutingEntries')}
                                        </p>
                                        <Badge variant="secondary" className="text-xs">
                                            {t('currentConfig.totalBadge', { count: status.routing_entries.length })}
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
                        {status?.is_configured ? t('setupCard.titleUpdate') : t('setupCard.titleNew')}
                    </CardTitle>
                    <CardDescription>
                        {t('setupCard.descriptionPart1')} <strong>{t('setupCard.settingsLabel')}</strong> {t('setupCard.descriptionPart2')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert className="border-blue-100 bg-blue-50">
                        <Info className="size-4 text-blue-600" />
                        <AlertDescription className="text-blue-700 text-sm">
                            <strong>{t('setupCard.tip.label')}</strong> {t('setupCard.tip.enterPrefix')}{' '}
                            <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">my-school.vacademy.io</code> {t('setupCard.tip.vacademySuffix')}{' '}
                            <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">learn.myschool.com</code> {t('setupCard.tip.customSuffix')}
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
                                            <Label className="text-xs text-slate-500">{t('setupCard.roleLabel')}</Label>
                                            <Select value={entry.role}
                                                    onValueChange={v => updateEntry(entry.id, 'role', v)}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {ROLES.map(r => (
                                                        <SelectItem key={r} value={r}>{roleLabel(r, t)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">{t('setupCard.domainLabel')}</Label>
                                            <Input placeholder={t('setupCard.domainPlaceholder')} value={entry.domain}
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
                                            title={entry.isPrimary ? t('setupCard.primaryTooltip') : t('setupCard.setPrimaryTooltip')}>
                                        <Star className={`size-3 ${entry.isPrimary ? 'fill-amber-500' : ''}`} />
                                        {entry.isPrimary ? t('setupCard.primary') : t('setupCard.setPrimary')}
                                    </button>

                                    {/* Expand config */}
                                    <button type="button" onClick={() => toggleExpand(entry.id)}
                                            className="mt-6 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                            title={t('setupCard.toggleSettingsTooltip')}>
                                        {entry.expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                        {t('setupCard.settingsToggle')}
                                    </button>

                                    {/* Remove */}
                                    {formEntries.length > 1 && (
                                        <button type="button" onClick={() => removeEntry(entry.id)}
                                                className="mt-6 rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                title={t('setupCard.removeTooltip')}>
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
                        {t('setupCard.addAnotherDomain')}
                    </button>

                    <Separator />

                    {/* Submit */}
                    <div className="flex items-center gap-3">
                        <MyButton id="white-label-setup-btn" onClick={handleSetup}
                                  disabled={setupLoading} buttonType="primary" scale="large" layoutVariant="default">
                            {setupLoading ? (
                                <><Loader2 className="size-4 animate-spin mr-2" /> {t('setupCard.configuring')}</>
                            ) : status?.is_configured ? t('setupCard.updateButton') : t('setupCard.applyButton')}
                        </MyButton>
                        {status?.is_configured && (
                            <p className="text-xs text-slate-500">
                                {t('setupCard.preservedHint')}
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
                            {t('setupResult.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <PortalUrlRow label={getTerminology(RoleTerms.Learner, SystemTerms.Learner)} url={lastSetupResult.learner_portal_url} />
                            <PortalUrlRow label={getTerminology(RoleTerms.Admin, SystemTerms.Admin)} url={lastSetupResult.admin_portal_url} />
                            <PortalUrlRow label={getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)} url={lastSetupResult.teacher_portal_url} />
                        </div>
                        {(lastSetupResult.pages_domains_configured?.length ?? 0) > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">
                                        {t('setupResult.pagesCustomDomains')}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {t('setupResult.pagesHint')}
                                    </p>
                                    <div className="space-y-1.5">
                                        {lastSetupResult.pages_domains_configured!.map((r, i) => (
                                            <PagesDomainRow key={i} record={r} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        {lastSetupResult.dns_records_configured?.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">{t('setupResult.dnsRecordsConfigured')}</p>
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
    const { t } = useTranslation('settingsWhiteLabel');
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
        entry.allow_phone_auth != null || entry.allow_username_password_auth != null ||
        entry.comma_separated_preferred_country ||
        entry.hide_institute_name != null ||
        entry.logo_width_px != null || entry.logo_height_px != null ||
        entry.stack_name_below_logo != null
    );

    const preferredCountryCodes = parsePreferredCountriesString(
        entry.comma_separated_preferred_country
    );

    return (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {/* Summary row */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className={roleBadgeClass(entry.role)}>
                        {roleLabel(entry.role, t)}
                    </Badge>
                    <a href={`https://${full}`} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-sm text-blue-600 hover:underline font-mono truncate">
                        {full}
                        <ExternalLink className="size-3 shrink-0" />
                    </a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {entry.pages_status && (
                        <Badge
                            variant="outline"
                            className={`text-xs capitalize ${pagesStatusClass(entry.pages_status)}`}
                            title={t('routingEntryCard.cloudflareStatusTooltip')}
                        >
                            {entry.pages_status}
                        </Badge>
                    )}
                    {entry.tab_text && (
                        <span className="text-xs text-slate-500 hidden sm:inline">
                            {t('routingEntryCard.tabPrefix', { value: entry.tab_text })}
                        </span>
                    )}
                    {entry.theme && (
                        <span className="text-xs text-slate-500 hidden sm:inline">
                            {t('routingEntryCard.themePrefix', { value: entry.theme })}
                        </span>
                    )}
                    {hasConfig && (
                        <button onClick={() => setExpanded(!expanded)}
                                className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title={t('routingEntryCard.showDetailsTooltip')}>
                            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* CNAME record to add — shown for a pending external (non-vacademy.io) domain */}
            {entry.pages_status &&
                entry.pages_status.toLowerCase() !== 'active' &&
                entry.pages_cname_target &&
                !full.toLowerCase().endsWith('.vacademy.io') && (
                    <div className="border-t border-amber-100 bg-amber-50 px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-amber-800">
                            {t('routingEntryCard.cnameInstructionPrefix')}{' '}
                            <span className="font-mono">{entry.domain}</span> {t('routingEntryCard.cnameInstructionSuffix')}
                        </p>
                        <div className="space-y-1 text-xs font-mono">
                            <div className="flex gap-3">
                                <span className="w-12 text-slate-500">{t('routingEntryCard.dnsType')}</span>
                                <span className="text-slate-800">CNAME</span>
                            </div>
                            <div className="flex gap-3">
                                <span className="w-12 text-slate-500">{t('routingEntryCard.dnsName')}</span>
                                <span className="text-slate-800">{entry.subdomain}</span>
                            </div>
                            <div className="flex gap-3">
                                <span className="w-12 text-slate-500">{t('routingEntryCard.dnsValue')}</span>
                                <span className="break-all text-slate-800">{entry.pages_cname_target}</span>
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-amber-700">
                            {t('routingEntryCard.sslAutoActivate')}
                        </p>
                    </div>
                )}

            {/* Expanded details */}
            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                        <ConfigValue label={t('routingEntryCard.fields.domain')} value={entry.domain} />
                        <ConfigValue label={t('routingEntryCard.fields.subdomain')} value={entry.subdomain} />
                        <ConfigValue label={t('routingEntryCard.fields.tabTitle')} value={entry.tab_text} />
                        <ConfigValue label={t('routingEntryCard.fields.tabIcon')} value={entry.tab_icon_file_id} />
                        <ConfigValue label={t('routingEntryCard.fields.theme')} value={entry.theme} />
                        <ConfigValue label={t('routingEntryCard.fields.font')} value={entry.font_family} />
                        <ConfigValue label={t('routingEntryCard.fields.redirect')} value={entry.redirect} />
                        <ConfigValue label={t('routingEntryCard.fields.afterLogin')} value={entry.after_login_route} />
                        <ConfigValue label={t('routingEntryCard.fields.afterLogout')} value={entry.admin_portal_after_logout_route} />
                        <ConfigValue label={t('routingEntryCard.fields.homeClick')} value={entry.home_icon_click_route} />
                        <ConfigValue label={t('routingEntryCard.fields.signUp')} value={entry.allow_signup} />
                        <ConfigValue label={t('routingEntryCard.fields.googleAuth')} value={entry.allow_google_auth} />
                        <ConfigValue label={t('routingEntryCard.fields.githubAuth')} value={entry.allow_github_auth} />
                        <ConfigValue label={t('routingEntryCard.fields.emailOtp')} value={entry.allow_email_otp_auth} />
                        <ConfigValue label={t('routingEntryCard.fields.phoneAuth')} value={entry.allow_phone_auth} />
                        <ConfigValue label={t('routingEntryCard.fields.userPassAuth')} value={entry.allow_username_password_auth} />
                        <ConfigValue label={t('routingEntryCard.fields.privacyPolicy')} value={entry.privacy_policy_url} />
                        <ConfigValue label={t('routingEntryCard.fields.terms')} value={entry.terms_and_condition_url} />
                        <ConfigValue label={t('routingEntryCard.fields.playStore')} value={entry.play_store_app_link} />
                        <ConfigValue label={t('routingEntryCard.fields.appStore')} value={entry.app_store_app_link} />
                        <ConfigValue label={t('routingEntryCard.fields.windows')} value={entry.windows_app_link} />
                        <ConfigValue label={t('routingEntryCard.fields.mac')} value={entry.mac_app_link} />
                        <ConfigValue label={t('routingEntryCard.fields.hideInstituteName')} value={entry.hide_institute_name} />
                        <ConfigValue label={t('routingEntryCard.fields.logoWidth')} value={entry.logo_width_px} />
                        <ConfigValue label={t('routingEntryCard.fields.logoHeight')} value={entry.logo_height_px} />
                        <ConfigValue label={t('routingEntryCard.fields.stackNameBelowLogo')} value={entry.stack_name_below_logo} />
                    </div>
                    {preferredCountryCodes.length > 0 && (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500">{t('routingEntryCard.preferredCountries')}</span>
                                <div className="flex flex-wrap gap-1">
                                    {preferredCountryCodes.map((code, idx) => (
                                        <span
                                            key={code}
                                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono ${
                                                idx === 0
                                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                                            }`}
                                            title={
                                                idx === 0
                                                    ? t('routingEntryCard.defaultCountryTooltip')
                                                    : undefined
                                            }
                                        >
                                            {idx === 0 && (
                                                <Star className="size-2.5 fill-amber-500 text-amber-500" />
                                            )}
                                            <span className="text-sm leading-none">
                                                {countryCodeToFlag(code)}
                                            </span>
                                            <span className="uppercase">{code}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
