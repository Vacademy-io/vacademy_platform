import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus, ArrowClockwise, Trash, PaperPlaneRight, PencilSimple, ArrowSquareOut, Info, WarningCircle,
    BracketsCurly, CaretDown, CaretUp, EnvelopeSimple, HandTap, ImageSquare,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { reportApiError } from '@/lib/report-api-error';
import { listTemplates, deleteTemplate, submitToMeta, syncTemplates, WhatsAppTemplateDTO } from '../-services/template-api';
import { getWhatsAppProviderStatus } from '@/services/whatsapp-provider-service';
import { SettingsQuickAccessButton } from '@/components/settings/quick-access/SettingsQuickAccessButton';
import { SettingsTabs } from '@/routes/settings/-constants/terms';
import { TemplateBuilder } from './template-builder';
import { WhatsAppTemplateBubble } from './whatsapp-template-bubble';

export function TemplateListPage() {
    const { t } = useTranslation('communicationTemplateListPage');
    const [templates, setTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplateDTO | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeProvider, setActiveProvider] = useState<string>('');
    const [channelFilter, setChannelFilter] = useState<'ALL' | 'WHATSAPP' | 'EMAIL'>('ALL');
    const instituteId = getInstituteId() || '';

    // Meta/COMBOT can create templates via API; WATI must use WATI dashboard
    const canCreateViaApi = activeProvider === 'META' || activeProvider === 'COMBOT' || activeProvider === '';

    const [loadError, setLoadError] = useState<string | null>(null);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await listTemplates(instituteId);
            setTemplates(data);
            setLoadError(null);
        } catch (err) {
            // Keep the reason on screen, not just in a toast that disappears — an empty list with
            // no explanation reads as "you have no templates", which is a different problem.
            setLoadError(
                reportApiError(err, {
                    feature: 'whatsapp-template-list',
                    fallbackMessage: t('couldNotLoadTemplates'),
                })
            );
        } finally { setLoading(false); }
    };

    useEffect(() => {
        loadTemplates();
        getWhatsAppProviderStatus()
            .then((status) => setActiveProvider(status.activeProvider || ''))
            .catch(() => {});
    }, []);

    const providerLabel = activeProvider === 'WATI' ? 'WATI' : 'Meta';

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncTemplates(instituteId);
            toast.success(
                result.synced > 0
                    ? t('syncedCount', { count: result.synced, provider: providerLabel })
                    : t('noTemplatesForAccount', { provider: providerLabel })
            );
            loadTemplates();
        } catch (err) {
            // Almost always an expired token or missing credentials — the server now says which.
            reportApiError(err, {
                feature: 'whatsapp-template-sync',
                fallbackMessage: t('couldNotSyncTemplates', { provider: providerLabel }),
            });
        } finally { setSyncing(false); }
    };

    const handleDelete = async (tpl: WhatsAppTemplateDTO) => {
        const warning = tpl.status === 'APPROVED' || tpl.status === 'PENDING'
            ? t('deleteConfirmLive', { name: tpl.name, provider: providerLabel })
            : t('deleteConfirmDraft', { name: tpl.name });
        if (!confirm(warning)) return;
        try {
            await deleteTemplate(tpl.id!);
            toast.success(t('templateDeleted'));
            loadTemplates();
        } catch (err) {
            reportApiError(err, {
                feature: 'whatsapp-template-delete',
                fallbackMessage: t('couldNotDeleteTemplate', { name: tpl.name }),
            });
        }
    };

    const handleSubmit = async (id: string) => {
        try {
            const submitted = await submitToMeta(id);
            toast.success(
                submitted.status === 'APPROVED'
                    ? t('approvedByMeta')
                    : t('submittedForApproval')
            );
            loadTemplates();
        } catch (err) {
            reportApiError(err, {
                feature: 'whatsapp-template-submit',
                fallbackMessage: t('metaRejectedTemplate'),
                toastDuration: 8000,
            });
        }
    };

    const handleBuilderClose = () => {
        setEditingTemplate(null);
        setIsCreating(false);
        loadTemplates();
    };

    // Show builder if creating or editing
    if (isCreating || editingTemplate) {
        return <TemplateBuilder template={editingTemplate} onClose={handleBuilderClose} />;
    }

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            DRAFT: 'bg-gray-100 text-gray-600',
            PENDING: 'bg-yellow-100 text-yellow-700',
            APPROVED: 'bg-green-100 text-green-700',
            REJECTED: 'bg-red-100 text-red-600',
            DISABLED: 'bg-orange-100 text-orange-600',
            DELETED: 'bg-gray-200 text-gray-400',
        };
        const labels: Record<string, string> = {
            DRAFT: t('status.draft'),
            PENDING: t('status.pending'),
            APPROVED: t('status.approved'),
            REJECTED: t('status.rejected'),
            DISABLED: t('status.disabled'),
            DELETED: t('status.deleted'),
        };
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.DRAFT}`}>
                {labels[status] || status}
            </span>
        );
    };

    const categoryBadge = (cat: string) => {
        const styles: Record<string, string> = {
            MARKETING: 'bg-purple-50 text-purple-600',
            UTILITY: 'bg-blue-50 text-blue-600',
            AUTHENTICATION: 'bg-cyan-50 text-cyan-600',
        };
        const labels: Record<string, string> = {
            MARKETING: t('category.marketing'),
            UTILITY: t('category.utility'),
            AUTHENTICATION: t('category.authentication'),
        };
        return (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${styles[cat] || 'bg-gray-50 text-gray-500'}`}>
                {labels[cat] || cat}
            </span>
        );
    };

    const filtered = templates.filter((t) =>
        t.status !== 'DELETED' &&
        (channelFilter === 'ALL' || (t.channelType || 'WHATSAPP') === channelFilter) &&
        (t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (t.bodyText || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
         (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="p-4 sm:p-6 w-full max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('pageTitle')}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {canCreateViaApi
                            ? t('subtitleApi')
                            : t('subtitleWati')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <SettingsQuickAccessButton
                        settingsKey={SettingsTabs.WhatsApp}
                        label={t('whatsappSettings')}
                    />
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
                        <ArrowClockwise size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? t('syncing') : t('syncTemplates')}
                    </button>

                    {canCreateViaApi ? (
                        <button onClick={() => setIsCreating(true)}
                            className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Plus size={16} /> {t('createTemplate')}
                        </button>
                    ) : (
                        <a href="https://app.wati.io/template-messages" target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                            <ArrowSquareOut size={16} /> {t('createInWati')}
                        </a>
                    )}
                </div>
            </div>

            {/* Provider info banner */}
            {activeProvider === 'WATI' && (
                <div className="flex items-start gap-2 p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-700">
                        <p className="font-medium">{t('watiBanner.title')}</p>
                        <p className="mt-0.5">
                            {t('watiBanner.beforeLink')}{' '}
                            <a href="https://app.wati.io/template-messages" target="_blank" rel="noopener noreferrer" className="underline font-medium">{t('watiBanner.linkText')}</a>
                            {t('watiBanner.afterLink')}
                        </p>
                    </div>
                </div>
            )}

            {/* Channel filter tabs */}
            <div className="flex gap-1 mb-3">
                {(['ALL', 'WHATSAPP', 'EMAIL'] as const).map((tab) => (
                    <button key={tab} onClick={() => setChannelFilter(tab)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                            channelFilter === tab
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {tab === 'ALL' ? t('tabAll') : tab === 'WHATSAPP' ? t('tabWhatsapp') : t('tabEmail')}
                    </button>
                ))}
            </div>

            {/* Search */}
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full px-3 py-2 text-sm border rounded-lg mb-4" />

            {loading ? (
                <p className="text-center text-gray-400 py-8">{t('loadingTemplates')}</p>
            ) : loadError ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 py-10 text-center">
                    <WarningCircle size={24} className="text-danger-600" />
                    <p className="max-w-md px-4 text-sm text-danger-600">{loadError}</p>
                    <button onClick={loadTemplates}
                        className="rounded-lg border border-danger-200 bg-white px-4 py-2 text-sm hover:bg-danger-50">
                        {t('tryAgain')}
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">
                        {templates.length === 0
                            ? t('noTemplatesYet', { provider: providerLabel })
                            : t('noTemplatesMatchSearch')}
                    </p>
                    {templates.length === 0 && canCreateViaApi && (
                        <button onClick={() => setIsCreating(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            {t('createTemplate')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((tpl) => (
                        <TemplateCard
                            key={tpl.id}
                            tpl={tpl}
                            statusBadge={statusBadge(tpl.status || 'DRAFT')}
                            categoryBadge={categoryBadge(tpl.category)}
                            canEdit={canCreateViaApi && (tpl.status === 'DRAFT' || tpl.status === 'REJECTED')}
                            onEdit={() => setEditingTemplate(tpl)}
                            onSubmit={() => handleSubmit(tpl.id!)}
                            onDelete={() => handleDelete(tpl)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

const PLACEHOLDER_TOKEN = /\{\{\s*[\w.]+\s*\}\}/g;

/**
 * One template as a card: name and status on top, the message the way the learner sees it in the
 * middle (long bodies folded), and what it carries — header, variables, buttons — at the bottom.
 */
function TemplateCard({
    tpl,
    statusBadge,
    categoryBadge,
    canEdit,
    onEdit,
    onSubmit,
    onDelete,
}: {
    tpl: WhatsAppTemplateDTO;
    statusBadge: ReactNode;
    categoryBadge: ReactNode;
    canEdit: boolean;
    onEdit: () => void;
    onSubmit: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation('communicationTemplateListPage');
    const [expanded, setExpanded] = useState(false);
    const isWhatsApp = (tpl.channelType || 'WHATSAPP') === 'WHATSAPP';
    const body = tpl.bodyText || '';
    const isLong = body.split('\n').length > 6 || body.length > 260;
    const variableCount = new Set(`${tpl.headerText || ''} ${body}`.match(PLACEHOLDER_TOKEN) || []).size;
    const buttonCount = tpl.buttons?.length || 0;
    const headerType = (tpl.headerType || 'NONE').toUpperCase();
    // Meta sends the literal "NONE" when nothing was rejected.
    const rejection =
        tpl.rejectionReason && tpl.rejectionReason.trim().toUpperCase() !== 'NONE' ? tpl.rejectionReason : null;

    const chip = 'flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-caption text-neutral-600';

    return (
        <div className="flex flex-col overflow-hidden rounded-lg border bg-card transition hover:border-primary-200 hover:shadow-sm">
            {/* Name + status */}
            <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                    <p className="break-all font-mono text-body font-semibold text-neutral-800">
                        {tpl.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {statusBadge}
                        {categoryBadge}
                        <span className="text-caption text-neutral-400">{tpl.language}</span>
                        {!isWhatsApp && (
                            <span className="flex items-center gap-1 text-caption text-neutral-500">
                                <EnvelopeSimple size={12} /> {t('tabEmail')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center">
                    {canEdit && (
                        <>
                            <button onClick={onEdit} title={t('edit')} className="rounded p-2 hover:bg-muted">
                                <PencilSimple size={16} className="text-neutral-500" />
                            </button>
                            <button onClick={onSubmit} title={t('submitToMeta')} className="rounded p-2 hover:bg-muted">
                                <PaperPlaneRight size={16} className="text-info-600" />
                            </button>
                        </>
                    )}
                    <button onClick={onDelete} title={t('delete')} className="rounded p-2 hover:bg-danger-50">
                        <Trash size={16} className="text-danger-500" />
                    </button>
                </div>
            </div>

            {/* The message as it arrives */}
            <div className={cn('flex flex-1 flex-col p-3', isWhatsApp ? 'bg-success-50' : 'bg-muted')}>
                {isWhatsApp ? (
                    <WhatsAppTemplateBubble
                        headerType={tpl.headerType}
                        headerText={tpl.headerText}
                        headerSampleUrl={tpl.headerSampleUrl}
                        bodyText={body}
                        footerText={tpl.footerText}
                        buttons={tpl.buttons}
                        clampBody={isLong && !expanded}
                        className="max-w-sm"
                    />
                ) : (
                    <div className="rounded-lg bg-card p-3 shadow-sm">
                        {tpl.subject && <p className="mb-1 text-body font-semibold text-neutral-800">{tpl.subject}</p>}
                        <p className={cn('whitespace-pre-wrap break-words text-caption text-neutral-600', !expanded && 'line-clamp-6')}>
                            {body}
                        </p>
                    </div>
                )}
                {isLong && (
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="mt-2 flex items-center gap-1 self-start text-caption font-semibold text-info-600 hover:underline"
                    >
                        {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
                        {expanded
                            ? t('showLess', { defaultValue: 'Show less' })
                            : t('showFullMessage', { defaultValue: 'Show full message' })}
                    </button>
                )}
            </div>

            {rejection && (
                <p className="border-t bg-danger-50 px-4 py-2 text-caption text-danger-600">
                    {t('rejectionReason', { reason: rejection })}
                </p>
            )}

            {/* What it carries */}
            {isWhatsApp && (headerType !== 'NONE' || variableCount > 0 || buttonCount > 0) && (
                <div className="flex flex-wrap gap-1.5 border-t px-4 py-2">
                    {headerType !== 'NONE' && (
                        <span className={chip}>
                            <ImageSquare size={12} />
                            {t('summary.header', {
                                type: t(`summary.headerType.${headerType.toLowerCase()}`, { defaultValue: headerType }),
                                defaultValue: '{{type}} header',
                            })}
                        </span>
                    )}
                    {variableCount > 0 && (
                        <span className={chip}>
                            <BracketsCurly size={12} />
                            {t('summary.variables', { count: variableCount, defaultValue: variableCount === 1 ? '{{count}} variable' : '{{count}} variables' })}
                        </span>
                    )}
                    {buttonCount > 0 && (
                        <span className={chip}>
                            <HandTap size={12} />
                            {t('summary.buttons', { count: buttonCount, defaultValue: buttonCount === 1 ? '{{count}} button' : '{{count}} buttons' })}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
