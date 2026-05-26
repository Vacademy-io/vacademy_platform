import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { Copy, Check, ArrowSquareOut, Trash, Plus, PencilSimple, X } from '@phosphor-icons/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    initiateMetaOAuth,
    getSessionPages,
    getFormFields,
    listPageForms,
    saveMetaConnector,
    saveGoogleConnector,
    listConnectors,
    deactivateConnector,
    updateConnector,
    buildGoogleWebhookUrl,
    fetchAudienceCustomFields,
    buildFieldMappingJson,
    type MetaPage,
    type ConnectorListItem,
    type PlatformFormField,
    type AudienceCustomField,
} from '../-services/ad-platform-service';
import { AUDIENCE_CAMPAIGNS_LIST } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

// ── Audience list hook ───────────────────────────────────────────────────────

interface AudienceOption {
    id: string;
    name: string;
}

function useAudienceList(instituteId: string) {
    return useQuery({
        queryKey: ['audience-list-for-integrations', instituteId],
        queryFn: async (): Promise<AudienceOption[]> => {
            const res = await authenticatedAxiosInstance.post(AUDIENCE_CAMPAIGNS_LIST, {
                institute_id: instituteId,
                page: 0,
                size: 200,
            });
            const items = res.data?.content ?? [];
            return items.map((c: { id?: string; audience_id?: string; campaign_name: string }) => ({
                id: c.audience_id ?? c.id ?? '',
                name: c.campaign_name,
            }));
        },
        enabled: !!instituteId,
        staleTime: 60_000,
    });
}

// ── Derive a short label from a Lead Gen Form name ──────────────────────────
// Takes the first token before `_` or whitespace. Useful as an auto-prefill for
// per-connector default values (e.g. `Wakad_leadform_2026` → `Wakad`).
const firstTokenOfFormName = (formName: string | undefined): string => {
    if (!formName) return '';
    const token = formName.split(/[_\s]/).find(Boolean) ?? '';
    return token.trim();
};

// ── Field mapping builder ─────────────────────────────────────────────────────

interface MappingRow {
    platformKey: string;
    targetFieldName: string;
}

function FieldMappingBuilder({
    platformFields,
    audienceFields,
    value,
    onChange,
}: {
    platformFields: PlatformFormField[];
    audienceFields: AudienceCustomField[];
    value: MappingRow[];
    onChange: (rows: MappingRow[]) => void;
}) {
    // Auto-populate unmapped platform fields
    useEffect(() => {
        if (platformFields.length > 0 && value.length === 0) {
            const initial = platformFields.map((pf) => {
                // Try auto-match by name similarity
                const match = audienceFields.find(
                    (af) => af.fieldName.toLowerCase().trim() === pf.key.toLowerCase().trim()
                );
                return { platformKey: pf.key, targetFieldName: match?.fieldName ?? '' };
            });
            onChange(initial);
        }
    }, [platformFields, audienceFields]);

    const updateRow = (idx: number, target: string) => {
        const updated = [...value];
        updated[idx] = { ...updated[idx]!, targetFieldName: target };
        onChange(updated);
    };

    if (platformFields.length === 0) return null;

    return (
        <div className="space-y-2">
            <Label className="text-xs font-medium">Field Mapping</Label>
            <p className="text-xs text-muted-foreground">
                Map each platform field to an audience custom field. Unmapped fields are kept with
                original names.
            </p>
            <div className="space-y-1.5 rounded-md border bg-neutral-50 p-3">
                <div className="grid grid-cols-[1fr_24px_1fr] gap-2 text-caption font-medium uppercase tracking-wider text-neutral-400">
                    <span>Platform Field</span>
                    <span />
                    <span>Audience Field</span>
                </div>
                {value.map((row, idx) => (
                    <div
                        key={row.platformKey}
                        className="grid grid-cols-[1fr_24px_1fr] items-center gap-2"
                    >
                        <div className="truncate rounded bg-white px-2 py-1.5 text-xs">
                            {platformFields.find((p) => p.key === row.platformKey)?.label ??
                                row.platformKey}
                        </div>
                        <span className="text-center text-xs text-neutral-300">→</span>
                        <select
                            className="rounded border bg-white px-2 py-1.5 text-xs"
                            value={row.targetFieldName}
                            onChange={(e) => updateRow(idx, e.target.value)}
                        >
                            <option value="">— skip —</option>
                            {audienceFields.map((af) => (
                                <option key={af.id} value={af.fieldName}>
                                    {af.fieldName}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Connector edit dialog (per-center default values) ──────────────────────

interface KeyValueRow {
    key: string;
    value: string;
}

const parseDefaultValues = (json: string | null | undefined): KeyValueRow[] => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
                key,
                value: value == null ? '' : String(value),
            }));
        }
    } catch {
        // ignore — show empty editor and let admin start fresh
    }
    return [];
};

const serializeDefaultValues = (rows: KeyValueRow[]): string => {
    const obj: Record<string, string> = {};
    rows.forEach((r) => {
        const k = r.key.trim();
        if (k) obj[k] = r.value;
    });
    return JSON.stringify(obj);
};

function ConnectorEditDialog({
    connector,
    open,
    onOpenChange,
    onSave,
    isSaving,
}: {
    connector: ConnectorListItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (rows: KeyValueRow[]) => void;
    isSaving: boolean;
}) {
    const [rows, setRows] = useState<KeyValueRow[]>([]);

    useEffect(() => {
        if (open && connector) {
            const initial = parseDefaultValues(connector.defaultValuesJson);
            setRows(initial.length > 0 ? initial : [{ key: '', value: '' }]);
        }
    }, [open, connector]);

    const updateRow = (idx: number, patch: Partial<KeyValueRow>) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };
    const addRow = () => setRows((prev) => [...prev, { key: '', value: '' }]);
    const removeRow = (idx: number) =>
        setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

    const handleSave = () => {
        onSave(rows);
    };

    const hasDuplicateKeys = (() => {
        const seen = new Set<string>();
        for (const r of rows) {
            const k = r.key.trim();
            if (!k) continue;
            if (seen.has(k)) return true;
            seen.add(k);
        }
        return false;
    })();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Edit center details</DialogTitle>
                    <DialogDescription>
                        These key/value pairs are merged into every form submission this connector
                        receives. Use them for per-center constants like center name, schedule
                        link, or contact phone. Form values always take precedence over defaults.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_28px] gap-2 text-caption font-medium uppercase tracking-wider text-neutral-400">
                        <span>Key</span>
                        <span>Value</span>
                        <span />
                    </div>
                    {rows.map((row, idx) => (
                        <div
                            key={idx}
                            className="grid grid-cols-[1fr_1fr_28px] items-center gap-2"
                        >
                            <Input
                                value={row.key}
                                onChange={(e) => updateRow(idx, { key: e.target.value })}
                                placeholder="e.g. center name"
                            />
                            <Input
                                value={row.value}
                                onChange={(e) => updateRow(idx, { value: e.target.value })}
                                placeholder="e.g. Baner"
                            />
                            <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                className="text-neutral-400 hover:text-red-600"
                                title="Remove row"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
                        <Plus className="size-3.5" />
                        Add field
                    </Button>
                    {hasDuplicateKeys && (
                        <p className="text-xs text-red-600">
                            Duplicate keys detected — only the last value for each key will be kept.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Connector table ──────────────────────────────────────────────────────────

const VENDOR_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    META_LEAD_ADS: { label: 'Meta', color: 'text-blue-700', bg: 'bg-blue-100' },
    GOOGLE_LEAD_ADS: { label: 'Google', color: 'text-red-700', bg: 'bg-red-100' },
};

function ConnectorTable({
    connectors,
    onDelete,
    onEdit,
}: {
    connectors: ConnectorListItem[];
    onDelete: (id: string) => void;
    onEdit: (connector: ConnectorListItem) => void;
}) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    if (connectors.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-8 text-center">
                <p className="text-sm font-medium text-neutral-500">No connectors yet</p>
                <p className="text-xs text-neutral-400">
                    Add a Meta or Google connector below to start receiving leads.
                </p>
            </div>
        );
    }

    const copyWebhookUrl = (c: ConnectorListItem) => {
        if (c.vendor === 'GOOGLE_LEAD_ADS' && c.platformFormId) {
            navigator.clipboard.writeText(buildGoogleWebhookUrl(c.platformFormId));
            setCopiedId(c.id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
                <thead className="border-b bg-neutral-50 text-caption text-neutral-500">
                    <tr>
                        <th className="px-4 py-2">Platform</th>
                        <th className="px-4 py-2">Form / Campaign ID</th>
                        <th className="px-4 py-2">Audience ID</th>
                        <th className="px-4 py-2">Source</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Webhook</th>
                        <th className="px-4 py-2" />
                    </tr>
                </thead>
                <tbody>
                    {connectors.map((c) => {
                        const v = VENDOR_LABELS[c.vendor] ?? {
                            label: c.vendor,
                            color: 'text-neutral-700',
                            bg: 'bg-neutral-100',
                        };
                        return (
                            <tr key={c.id} className="border-b last:border-0">
                                <td className="px-4 py-2.5">
                                    <span
                                        className={`rounded px-2 py-0.5 text-xs font-medium ${v.bg} ${v.color}`}
                                    >
                                        {v.label}
                                    </span>
                                </td>
                                <td className="max-w-40 truncate px-4 py-2.5 font-mono text-caption">
                                    {c.platformFormId ?? '-'}
                                </td>
                                <td className="max-w-40 truncate px-4 py-2.5 font-mono text-caption">
                                    {c.audienceId}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-neutral-500">
                                    {c.producesSourceType ?? '-'}
                                </td>
                                <td className="px-4 py-2.5">
                                    <span
                                        className={`text-xs font-medium ${
                                            c.connectionStatus === 'ACTIVE'
                                                ? 'text-green-600'
                                                : 'text-neutral-400'
                                        }`}
                                    >
                                        {c.connectionStatus}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5">
                                    {c.vendor === 'GOOGLE_LEAD_ADS' && c.platformFormId && (
                                        <button
                                            onClick={() => copyWebhookUrl(c)}
                                            className="text-neutral-400 hover:text-neutral-700"
                                            title="Copy webhook URL"
                                        >
                                            {copiedId === c.id ? (
                                                <Check className="size-4 text-green-600" />
                                            ) : (
                                                <Copy className="size-4" />
                                            )}
                                        </button>
                                    )}
                                    {c.vendor === 'META_LEAD_ADS' && (
                                        <span className="text-xs text-neutral-400">auto</span>
                                    )}
                                </td>
                                <td className="flex items-center gap-2 px-4 py-2.5">
                                    <button
                                        onClick={() => onEdit(c)}
                                        className="text-neutral-400 hover:text-primary-600"
                                        title="Edit center details"
                                    >
                                        <PencilSimple className="size-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(c.id)}
                                        className="text-neutral-400 hover:text-red-600"
                                        title="Deactivate connector"
                                    >
                                        <Trash className="size-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── Add Google form ──────────────────────────────────────────────────────────

function AddGoogleForm({ onSaved }: { onSaved: () => void }) {
    const [googleKey, setGoogleKey] = useState('');
    const [audienceId, setAudienceId] = useState('');
    const [copied, setCopied] = useState(false);
    const instituteId = getCurrentInstituteId() ?? '';
    const webhookUrl = googleKey ? buildGoogleWebhookUrl(googleKey) : '';
    const { data: audiences = [] } = useAudienceList(instituteId);

    const { mutate: save, isPending } = useMutation({
        mutationFn: () =>
            saveGoogleConnector({
                vendor: 'GOOGLE_LEAD_ADS',
                instituteId,
                audienceId,
                googleKey,
                platformFormId: googleKey,
                producesSourceType: 'GOOGLE_ADS',
            }),
        onSuccess: (result) => {
            toast.success(result.message);
            setGoogleKey('');
            setAudienceId('');
            onSaved();
        },
        onError: () => toast.error('Failed to save Google connector'),
    });

    return (
        <div className="space-y-3 rounded-lg border bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label className="text-xs">Google Key</Label>
                    <Input
                        placeholder="e.g. my-leads-abc123"
                        value={googleKey}
                        onChange={(e) => setGoogleKey(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Audience</Label>
                    <select
                        className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                        value={audienceId}
                        onChange={(e) => setAudienceId(e.target.value)}
                    >
                        <option value="">Select audience...</option>
                        {audiences.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {webhookUrl && (
                <div className="flex items-center gap-2 rounded-md border bg-neutral-50 px-3 py-2">
                    <code className="flex-1 truncate text-xs">{webhookUrl}</code>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(webhookUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }}
                        className="shrink-0 text-neutral-500 hover:text-neutral-700"
                    >
                        {copied ? (
                            <Check className="size-4 text-green-600" />
                        ) : (
                            <Copy className="size-4" />
                        )}
                    </button>
                </div>
            )}
            <MyButton
                buttonType="primary"
                scale="small"
                onClick={() => save()}
                disable={isPending || !googleKey || !audienceId}
            >
                {isPending ? 'Saving...' : 'Save'}
            </MyButton>
        </div>
    );
}

// ── Add Meta form ────────────────────────────────────────────────────────────

function AddMetaForm({
    sessionKeyFromUrl,
    onSaved,
}: {
    sessionKeyFromUrl?: string;
    onSaved: () => void;
}) {
    const instituteId = getCurrentInstituteId() ?? '';
    const [sessionKey, setSessionKey] = useState(sessionKeyFromUrl || '');
    const [selectedPageId, setSelectedPageId] = useState('');
    const [formId, setFormId] = useState('');
    const [audienceId, setAudienceId] = useState('');
    const [sourceType, setSourceType] = useState<'FACEBOOK_ADS' | 'INSTAGRAM_ADS'>('FACEBOOK_ADS');
    const [fieldMappings, setFieldMappings] = useState<MappingRow[]>([]);
    // Per-connector default: which audience field gets stamped, and with what value.
    // Both come from the admin — nothing about the field name is hardcoded.
    const [stampFieldName, setStampFieldName] = useState('');
    const [stampValue, setStampValue] = useState('');
    const [stampValueTouched, setStampValueTouched] = useState(false);
    const { data: audiences = [] } = useAudienceList(instituteId);

    useEffect(() => {
        if (sessionKeyFromUrl) setSessionKey(sessionKeyFromUrl);
    }, [sessionKeyFromUrl]);

    const {
        data: pages,
        isLoading: loadingPages,
        error: pagesError,
    } = useQuery({
        queryKey: ['meta-pages', sessionKey],
        queryFn: () => getSessionPages(sessionKey),
        enabled: !!sessionKey,
        retry: false,
    });

    // Fetch forms when a page is selected
    const { data: forms = [], isLoading: loadingForms } = useQuery({
        queryKey: ['meta-forms', sessionKey, selectedPageId],
        queryFn: () => listPageForms(sessionKey, selectedPageId),
        enabled: !!sessionKey && !!selectedPageId,
        retry: false,
    });

    // Fetch form fields when a form is selected (for mapping UI)
    const { data: platformFields = [] } = useQuery({
        queryKey: ['meta-form-fields', sessionKey, formId, selectedPageId],
        queryFn: () => getFormFields(sessionKey, formId, selectedPageId),
        enabled: !!sessionKey && !!formId && !!selectedPageId,
        retry: false,
    });

    // Fetch audience custom fields when an audience is selected (for mapping UI)
    const { data: audienceFields = [] } = useQuery({
        queryKey: ['audience-custom-fields', instituteId, audienceId],
        queryFn: () => fetchAudienceCustomFields(instituteId, audienceId),
        enabled: !!instituteId && !!audienceId,
    });

    // Reset mappings when form or audience changes
    useEffect(() => {
        setFieldMappings([]);
    }, [formId, audienceId]);

    // Auto-prefill the stamp value (e.g. "Wakad") from the selected Lead Gen
    // Form name, until the admin types into the value. Picking a different form
    // re-derives. The field NAME is never auto-populated — it must be chosen
    // explicitly from the audience's custom fields.
    useEffect(() => {
        if (stampValueTouched) return;
        const selected = forms.find((f) => f.id === formId);
        setStampValue(firstTokenOfFormName(selected?.name));
    }, [formId, forms, stampValueTouched]);

    const { mutate: initOAuth, isPending: initiating } = useMutation({
        mutationFn: () => initiateMetaOAuth(instituteId),
        onSuccess: (data) => {
            window.location.href = data.oauth_url;
        },
        onError: () => toast.error('Failed to start Meta OAuth'),
    });

    const { mutate: saveConnector, isPending: saving } = useMutation({
        mutationFn: () => {
            const trimmedField = stampFieldName.trim();
            const trimmedValue = stampValue.trim();
            const hasStamp = !!trimmedField && !!trimmedValue;
            return saveMetaConnector({
                vendor: 'META_LEAD_ADS',
                instituteId,
                audienceId,
                sessionKey,
                selectedPageId,
                platformFormId: formId,
                producesSourceType: sourceType,
                platformPageId: selectedPageId,
                fieldMappingJson:
                    fieldMappings.length > 0 ? buildFieldMappingJson(fieldMappings) : undefined,
                defaultValuesJson: hasStamp
                    ? JSON.stringify({ [trimmedField]: trimmedValue })
                    : undefined,
            });
        },
        onSuccess: (result) => {
            toast.success(result.message);
            setFormId('');
            setAudienceId('');
            setSelectedPageId('');
            setFieldMappings([]);
            setStampFieldName('');
            setStampValue('');
            setStampValueTouched(false);
            onSaved();
        },
        onError: () => toast.error('Failed to save Meta connector'),
    });

    const isAuthorized = !!sessionKey && !!pages && pages.length > 0;

    return (
        <div className="space-y-3 rounded-lg border bg-white p-4">
            {!isAuthorized && (
                <>
                    {pagesError && (
                        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                            Session expired or invalid. Please reconnect.
                        </div>
                    )}
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={() => initOAuth()}
                        disable={initiating}
                    >
                        <ArrowSquareOut className="size-4" />
                        {initiating ? 'Redirecting...' : 'Connect Meta Account'}
                    </MyButton>
                    <p className="text-xs text-muted-foreground">
                        After connecting, you can add multiple forms — each linked to a different
                        audience.
                    </p>
                </>
            )}

            {loadingPages && sessionKey && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="size-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                    Loading pages...
                </div>
            )}

            {isAuthorized && (
                <>
                    <div className="rounded-md border border-green-100 bg-green-50 p-2 text-xs text-green-700">
                        Meta connected. Add a form → audience mapping below. You can add multiple.
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label className="text-xs">Facebook Page</Label>
                            <select
                                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                                value={selectedPageId}
                                onChange={(e) => setSelectedPageId(e.target.value)}
                            >
                                <option value="">Select a page...</option>
                                {pages.map((p: MetaPage) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Lead Gen Form</Label>
                            {loadingForms ? (
                                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                    <div className="size-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                                    Loading forms...
                                </div>
                            ) : forms.length > 0 ? (
                                <select
                                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                                    value={formId}
                                    onChange={(e) => setFormId(e.target.value)}
                                >
                                    <option value="">Select a form...</option>
                                    {forms.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.name} ({f.id})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    placeholder={
                                        selectedPageId
                                            ? 'No forms found — enter ID manually'
                                            : 'Select a page first'
                                    }
                                    value={formId}
                                    onChange={(e) => setFormId(e.target.value)}
                                />
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Audience</Label>
                            <select
                                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                                value={audienceId}
                                onChange={(e) => setAudienceId(e.target.value)}
                            >
                                <option value="">Select audience...</option>
                                {audiences.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Source Type</Label>
                            <div className="flex gap-3 pt-2">
                                {(['FACEBOOK_ADS', 'INSTAGRAM_ADS'] as const).map((t) => (
                                    <label
                                        key={t}
                                        className="flex cursor-pointer items-center gap-1.5 text-xs"
                                    >
                                        <input
                                            type="radio"
                                            name="metaSourceType"
                                            checked={sourceType === t}
                                            onChange={() => setSourceType(t)}
                                        />
                                        {t === 'FACEBOOK_ADS' ? 'Facebook' : 'Instagram'}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Per-connector default: stamp one audience field with a fixed value
                        on every lead from this form. Both the field name and value are
                        chosen by the admin — nothing is hardcoded. */}
                    {formId && audienceId && audienceFields.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label className="text-caption">Stamp audience field</Label>
                                <select
                                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                                    value={stampFieldName}
                                    onChange={(e) => setStampFieldName(e.target.value)}
                                >
                                    <option value="">— none —</option>
                                    {audienceFields.map((af) => (
                                        <option key={af.id} value={af.fieldName}>
                                            {af.fieldName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-caption">Value</Label>
                                <Input
                                    placeholder="e.g. Wakad"
                                    value={stampValue}
                                    onChange={(e) => {
                                        setStampValue(e.target.value);
                                        setStampValueTouched(true);
                                    }}
                                />
                                <p className="text-caption text-muted-foreground">
                                    Auto-filled from the form name. Stamped onto every lead from
                                    this connector if a field above is selected.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Field mapping — appears once both form and audience are selected */}
                    {formId &&
                        audienceId &&
                        platformFields.length > 0 &&
                        audienceFields.length > 0 && (
                            <FieldMappingBuilder
                                platformFields={platformFields}
                                audienceFields={audienceFields}
                                value={fieldMappings}
                                onChange={setFieldMappings}
                            />
                        )}

                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={() => saveConnector()}
                        disable={saving || !selectedPageId || !formId || !audienceId}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </MyButton>
                </>
            )}
        </div>
    );
}

// ── Main Integrations Page ───────────────────────────────────────────────────

export default function IntegrationSettings() {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    // Check for session_key in URL (set by Meta OAuth callback redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionKeyFromUrl = urlParams.get('session_key') || undefined;
    const oauthError = urlParams.get('error');

    const [showAddGoogle, setShowAddGoogle] = useState(false);
    const [showAddMeta, setShowAddMeta] = useState(!!sessionKeyFromUrl);

    useEffect(() => {
        if (oauthError) toast.error(`Meta OAuth failed: ${oauthError}`);
        if (sessionKeyFromUrl) toast.success('Meta account connected');
        if (sessionKeyFromUrl || oauthError) {
            const clean = new URL(window.location.href);
            clean.searchParams.delete('session_key');
            clean.searchParams.delete('error');
            window.history.replaceState({}, '', clean.toString());
        }
    }, [oauthError, sessionKeyFromUrl]);

    // Fetch existing connectors
    const {
        data: connectors = [],
        isLoading,
        error: connectorsError,
    } = useQuery({
        queryKey: ['ad-connectors', instituteId],
        queryFn: () => listConnectors(instituteId),
        enabled: !!instituteId,
        retry: false,
    });

    const { mutate: deleteConnector } = useMutation({
        mutationFn: deactivateConnector,
        onSuccess: () => {
            toast.success('Connector deactivated');
            queryClient.invalidateQueries({ queryKey: ['ad-connectors'] });
        },
        onError: () => toast.error('Failed to deactivate connector'),
    });

    const [editingConnector, setEditingConnector] = useState<ConnectorListItem | null>(null);

    const { mutate: saveConnectorEdits, isPending: isSavingEdits } = useMutation({
        mutationFn: (args: { id: string; defaultValuesJson: string }) =>
            updateConnector(args.id, { defaultValuesJson: args.defaultValuesJson }),
        onSuccess: () => {
            toast.success('Connector updated');
            setEditingConnector(null);
            queryClient.invalidateQueries({ queryKey: ['ad-connectors'] });
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to update connector';
            toast.error(msg);
        },
    });

    const handleSaved = () => {
        queryClient.invalidateQueries({ queryKey: ['ad-connectors'] });
    };

    return (
        <div className="space-y-6 p-6">
            <div>
                <h2 className="text-lg font-semibold">Ad Platform Integrations</h2>
                <p className="text-sm text-muted-foreground">
                    Connect Google Ads and Meta Lead Ads to capture leads into your audiences. Each
                    form/campaign maps to one audience — add multiple connectors for multiple
                    audiences.
                </p>
            </div>

            <Separator />

            {/* ── Existing connectors ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Active Connectors</CardTitle>
                    <CardDescription>
                        Each row links one ad platform form to one audience.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <div className="size-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                            Loading connectors...
                        </div>
                    ) : connectorsError ? (
                        <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                            Could not load connectors. The integration API may not be deployed yet.
                        </div>
                    ) : (
                        <ConnectorTable
                            connectors={Array.isArray(connectors) ? connectors : []}
                            onDelete={(id) => deleteConnector(id)}
                            onEdit={(c) => setEditingConnector(c)}
                        />
                    )}
                </CardContent>
            </Card>

            {/* ── Add new connectors ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Add New Connector</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2">
                        <Button
                            variant={showAddMeta ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                                setShowAddMeta(!showAddMeta);
                                setShowAddGoogle(false);
                            }}
                        >
                            <Plus className="mr-1 size-3.5" />
                            Meta Lead Ads
                        </Button>
                        <Button
                            variant={showAddGoogle ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                                setShowAddGoogle(!showAddGoogle);
                                setShowAddMeta(false);
                            }}
                        >
                            <Plus className="mr-1 size-3.5" />
                            Google Lead Forms
                        </Button>
                    </div>

                    {showAddMeta && (
                        <AddMetaForm sessionKeyFromUrl={sessionKeyFromUrl} onSaved={handleSaved} />
                    )}
                    {showAddGoogle && <AddGoogleForm onSaved={handleSaved} />}
                </CardContent>
            </Card>

            <ConnectorEditDialog
                connector={editingConnector}
                open={!!editingConnector}
                onOpenChange={(o) => {
                    if (!o) setEditingConnector(null);
                }}
                onSave={(rows) =>
                    editingConnector &&
                    saveConnectorEdits({
                        id: editingConnector.id,
                        defaultValuesJson: serializeDefaultValues(rows),
                    })
                }
                isSaving={isSavingEdits}
            />
        </div>
    );
}
