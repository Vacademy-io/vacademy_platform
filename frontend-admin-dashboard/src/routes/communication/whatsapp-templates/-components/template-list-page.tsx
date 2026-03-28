import { useEffect, useState } from 'react';
import { Plus, ArrowClockwise, Trash, PaperPlaneRight, PencilSimple, ArrowSquareOut, Info } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { listTemplates, deleteTemplate, submitToMeta, syncTemplates, WhatsAppTemplateDTO } from '../-services/template-api';
import { getWhatsAppProviderStatus } from '@/services/whatsapp-provider-service';
import { TemplateBuilder } from './template-builder';

export function TemplateListPage() {
    const [templates, setTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplateDTO | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeProvider, setActiveProvider] = useState<string>('');
    const instituteId = getInstituteId() || '';

    // Meta/COMBOT can create templates via API; WATI must use WATI dashboard
    const canCreateViaApi = activeProvider === 'META' || activeProvider === 'COMBOT' || activeProvider === '';

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await listTemplates(instituteId);
            setTemplates(data);
        } catch { toast.error('Failed to load templates'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        loadTemplates();
        getWhatsAppProviderStatus()
            .then((status) => setActiveProvider(status.activeProvider || ''))
            .catch(() => {});
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncTemplates(instituteId);
            toast.success(`Synced ${result.synced} templates from Meta`);
            loadTemplates();
        } catch { toast.error('Sync failed'); }
        finally { setSyncing(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await deleteTemplate(id);
            toast.success('Template deleted');
            loadTemplates();
        } catch { toast.error('Delete failed'); }
    };

    const handleSubmit = async (id: string) => {
        try {
            await submitToMeta(id);
            toast.success('Template submitted to Meta for approval');
            loadTemplates();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg || 'Submit failed');
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
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.DRAFT}`}>
                {status}
            </span>
        );
    };

    const categoryBadge = (cat: string) => {
        const styles: Record<string, string> = {
            MARKETING: 'bg-purple-50 text-purple-600',
            UTILITY: 'bg-blue-50 text-blue-600',
            AUTHENTICATION: 'bg-cyan-50 text-cyan-600',
        };
        return (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${styles[cat] || 'bg-gray-50 text-gray-500'}`}>
                {cat}
            </span>
        );
    };

    const filtered = templates.filter((t) =>
        t.status !== 'DELETED' &&
        (t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (t.bodyText || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="p-4 sm:p-6 w-full max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">WhatsApp Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {canCreateViaApi
                            ? 'Create, manage, and submit templates for Meta approval'
                            : 'View synced templates. Create new templates in WATI Dashboard.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
                        <ArrowClockwise size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Templates'}
                    </button>

                    {canCreateViaApi ? (
                        <button onClick={() => setIsCreating(true)}
                            className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Plus size={16} /> Create Template
                        </button>
                    ) : (
                        <a href="https://app.wati.io/template-messages" target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                            <ArrowSquareOut size={16} /> Create in WATI
                        </a>
                    )}
                </div>
            </div>

            {/* Provider info banner */}
            {activeProvider === 'WATI' && (
                <div className="flex items-start gap-2 p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-700">
                        <p className="font-medium">WATI Provider Active</p>
                        <p className="mt-0.5">
                            Templates must be created in the <a href="https://app.wati.io/template-messages" target="_blank" rel="noopener noreferrer" className="underline font-medium">WATI Dashboard</a>.
                            Once approved by Meta, click "Sync Templates" to import them here.
                            You can then use them in chatbot flows and the WhatsApp inbox.
                        </p>
                    </div>
                </div>
            )}

            {/* Search */}
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full px-3 py-2 text-sm border rounded-lg mb-4" />

            {loading ? (
                <p className="text-center text-gray-400 py-8">Loading templates...</p>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">No templates yet. Create one or sync from Meta.</p>
                    <button onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Create Template
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-blue-200 transition">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-medium text-gray-800">{t.name}</span>
                                    {statusBadge(t.status || 'DRAFT')}
                                    {categoryBadge(t.category)}
                                    <span className="text-xs text-gray-400">{t.language}</span>
                                    {t.createdViaVacademy && (
                                        <span className="text-[10px] px-1 py-0.5 bg-blue-50 text-blue-500 rounded">Vacademy</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 truncate max-w-xl">{t.bodyText}</p>
                                {t.rejectionReason && (
                                    <p className="text-xs text-red-500 mt-1">Rejection: {t.rejectionReason}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 ml-3 shrink-0">
                                {canCreateViaApi && (t.status === 'DRAFT' || t.status === 'REJECTED') && (
                                    <>
                                        <button onClick={() => setEditingTemplate(t)} title="Edit"
                                            className="p-2 rounded hover:bg-gray-100">
                                            <PencilSimple size={16} className="text-gray-500" />
                                        </button>
                                        <button onClick={() => handleSubmit(t.id!)} title="Submit to Meta"
                                            className="p-2 rounded hover:bg-gray-100">
                                            <PaperPlaneRight size={16} className="text-blue-500" />
                                        </button>
                                    </>
                                )}
                                <button onClick={() => handleDelete(t.id!)} title="Delete"
                                    className="p-2 rounded hover:bg-gray-100">
                                    <Trash size={16} className="text-red-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
