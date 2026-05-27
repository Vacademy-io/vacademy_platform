import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, FormInput, AlertCircle, Loader2, Info, X } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import { useToast } from '@/hooks/use-toast';
import { fetchInstituteDefaultFields } from '@/services/custom-field-mappings';
import { CUSTOM_FIELD_TYPES, type CustomFieldType } from '@/services/custom-field-settings';
import {
    addCustomFieldToProductPage,
    createAndLinkCustomField,
    getProductPage,
    removeCustomFieldFromProductPage,
} from '../-services/product-pages-service';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductPageAggregatedField } from '../-types/product-page-types';

interface Props {
    productPageId: string;
    instituteId: string;
}

type DialogTab = 'existing' | 'create';

const HAS_OPTIONS = (t: CustomFieldType) =>
    t === 'dropdown' || t === 'radio' || t === 'multi_select';

export const ProductPageCustomFieldsManager = ({ productPageId, instituteId }: Props) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Add dialog
    const [addOpen, setAddOpen] = useState(false);
    const [dialogTab, setDialogTab] = useState<DialogTab>('existing');
    const [selectedFieldId, setSelectedFieldId] = useState('');

    // Create-new form state
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
    const [newFieldRequired, setNewFieldRequired] = useState(false);
    const [newFieldOptions, setNewFieldOptions] = useState<{ id: string; value: string }[]>([
        { id: crypto.randomUUID(), value: '' },
    ]);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<ProductPageAggregatedField | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const { data: page } = useQuery({
        queryKey: ['productPage', productPageId],
        queryFn: () => getProductPage(productPageId),
        enabled: !!productPageId,
        staleTime: 60 * 1000,
    });

    const aggregatedFields = page?.aggregated_custom_fields ?? [];
    const alreadyAddedIds = new Set(aggregatedFields.map((f) => f.field.field_id));
    const hasNoInvites = !page?.mappings?.length;

    const { data: defaultFields = [], isLoading: loadingDefaults } = useQuery({
        queryKey: ['instituteDefaultFields', instituteId],
        queryFn: () => fetchInstituteDefaultFields(instituteId),
        enabled: addOpen && dialogTab === 'existing',
        staleTime: 5 * 60 * 1000,
    });

    const availableToAdd = defaultFields.filter((f) => !alreadyAddedIds.has(f.custom_field.id));

    const resetAddDialog = () => {
        setAddOpen(false);
        setDialogTab('existing');
        setSelectedFieldId('');
        setNewFieldName('');
        setNewFieldType('text');
        setNewFieldRequired(false);
        setNewFieldOptions([{ id: crypto.randomUUID(), value: '' }]);
    };

    // ── mutations ─────────────────────────────────────────────────────────────

    const addExistingMutation = useMutation({
        mutationFn: (customFieldId: string) =>
            addCustomFieldToProductPage(productPageId, customFieldId, instituteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productPage', productPageId] });
            toast({ title: 'Field added', description: 'Custom field added to all invites in this page' });
            resetAddDialog();
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to add custom field', variant: 'destructive' });
        },
    });

    const createMutation = useMutation({
        mutationFn: () => {
            const config = HAS_OPTIONS(newFieldType)
                ? JSON.stringify(
                      newFieldOptions
                          .filter((o) => o.value.trim())
                          .map((o) => ({ id: o.id, value: o.value.trim(), label: o.value.trim() }))
                  )
                : undefined;
            return createAndLinkCustomField(productPageId, instituteId, {
                field_name: newFieldName.trim(),
                field_type: newFieldType,
                is_mandatory: newFieldRequired,
                config,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productPage', productPageId] });
            toast({ title: 'Field created', description: 'Custom field created and linked to all invites in this page' });
            resetAddDialog();
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to create custom field', variant: 'destructive' });
        },
    });

    const removeMutation = useMutation({
        mutationFn: (customFieldId: string) =>
            removeCustomFieldFromProductPage(productPageId, customFieldId, instituteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productPage', productPageId] });
            toast({ title: 'Field removed', description: 'Custom field removed from all invites in this page' });
            setDeleteTarget(null);
            setDeleteConfirmText('');
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to remove custom field', variant: 'destructive' });
        },
    });

    const isMutating =
        addExistingMutation.isPending || createMutation.isPending || removeMutation.isPending;

    const canSubmitCreate =
        newFieldName.trim().length > 0 &&
        (!HAS_OPTIONS(newFieldType) || newFieldOptions.some((o) => o.value.trim()));

    // ── option helpers ────────────────────────────────────────────────────────

    const addOption = () =>
        setNewFieldOptions((prev) => [...prev, { id: crypto.randomUUID(), value: '' }]);
    const removeOption = (id: string) =>
        setNewFieldOptions((prev) => prev.filter((o) => o.id !== id));
    const updateOption = (id: string, val: string) =>
        setNewFieldOptions((prev) => prev.map((o) => (o.id === id ? { ...o, value: val } : o)));

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                    <p className="text-sm text-neutral-500">
                        Manage registration form fields collected during enrollment. Changes apply to{' '}
                        <strong>all invites</strong> in this page.
                    </p>
                    {hasNoInvites ? (
                        <p className="flex items-center gap-1.5 text-xs text-warning-600">
                            <AlertCircle className="size-3.5 shrink-0" />
                            Add courses under the <strong>Courses</strong> tab and save the page first.
                        </p>
                    ) : (
                        <p className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <Info className="size-3.5 shrink-0" />
                            If you added new courses, save the page first so changes are reflected here.
                        </p>
                    )}
                </div>
                <MyButton
                    scale="small"
                    buttonType="secondary"
                    onClick={() => setAddOpen(true)}
                    disable={hasNoInvites}
                >
                    <Plus className="size-3.5" />
                    Add Field
                </MyButton>
            </div>

            {/* Field list */}
            {aggregatedFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-white py-12 text-center">
                    <FormInput className="mb-2 size-8 text-neutral-300" />
                    <p className="text-sm text-neutral-400">No custom fields yet.</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                        Add fields to collect extra info from learners during enrollment.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {aggregatedFields.map((agg) => {
                        const cf = agg.field.custom_field;
                        const fieldName = cf?.fieldName ?? '—';
                        const fieldType = cf?.fieldType ?? '—';
                        const isMandatory = agg.field.is_mandatory ?? cf?.isMandatory ?? false;
                        return (
                            <div
                                key={agg.field.field_id}
                                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
                            >
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-sm font-medium text-neutral-800">
                                        {fieldName}
                                    </span>
                                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs capitalize text-neutral-500">
                                        {fieldType}
                                    </span>
                                    {isMandatory && (
                                        <span className="rounded bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600">
                                            Required
                                        </span>
                                    )}
                                    <span className="text-xs text-neutral-400">
                                        {agg.enroll_invite_ids.length} invite
                                        {agg.enroll_invite_ids.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    layoutVariant="icon"
                                    onClick={() => {
                                        setDeleteTarget(agg);
                                        setDeleteConfirmText('');
                                    }}
                                >
                                    <Trash2 className="size-3.5 text-danger-500" />
                                </MyButton>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Add Field Dialog ──────────────────────────────────────────────── */}
            <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddDialog(); else setAddOpen(true); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Custom Field</DialogTitle>
                    </DialogHeader>

                    {/* Tabs */}
                    <div className="flex gap-0 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                        {(['existing', 'create'] as DialogTab[]).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setDialogTab(tab)}
                                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                                    dialogTab === tab
                                        ? 'bg-white text-neutral-800 shadow-sm'
                                        : 'text-neutral-500 hover:text-neutral-700'
                                }`}
                            >
                                {tab === 'existing' ? 'From Existing' : 'Create New'}
                            </button>
                        ))}
                    </div>

                    {/* ── From Existing tab ── */}
                    {dialogTab === 'existing' && (
                        <>
                            <p className="text-xs text-neutral-400">
                                Pick a field from your institute's default fields. It will be linked to all invites in this page.
                            </p>
                            {loadingDefaults ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="size-6 animate-spin text-neutral-400" />
                                </div>
                            ) : availableToAdd.length === 0 ? (
                                <p className="py-4 text-center text-sm text-neutral-400">
                                    All institute fields are already added. Switch to{' '}
                                    <button
                                        type="button"
                                        className="font-semibold text-primary-600 underline underline-offset-2"
                                        onClick={() => setDialogTab('create')}
                                    >
                                        Create New
                                    </button>{' '}
                                    to add a new one.
                                </p>
                            ) : (
                                <div className="max-h-64 space-y-2 overflow-y-auto py-1">
                                    {availableToAdd.map((f) => (
                                        <button
                                            key={f.custom_field.id}
                                            type="button"
                                            onClick={() => setSelectedFieldId(f.custom_field.id)}
                                            className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                                                selectedFieldId === f.custom_field.id
                                                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                                                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                                            }`}
                                        >
                                            <span className="font-medium">{f.custom_field.fieldName}</span>
                                            <span className="capitalize text-xs text-neutral-400">
                                                {f.custom_field.fieldType}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <DialogFooter>
                                <MyButton buttonType="secondary" scale="small" onClick={resetAddDialog}>
                                    Cancel
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    scale="small"
                                    disable={!selectedFieldId || isMutating}
                                    onClick={() => selectedFieldId && addExistingMutation.mutate(selectedFieldId)}
                                >
                                    {addExistingMutation.isPending ? (
                                        <span className="flex items-center gap-1.5">
                                            <Loader2 className="size-3.5 animate-spin" />
                                            Adding...
                                        </span>
                                    ) : (
                                        'Add Field'
                                    )}
                                </MyButton>
                            </DialogFooter>
                        </>
                    )}

                    {/* ── Create New tab ── */}
                    {dialogTab === 'create' && (
                        <>
                            <p className="text-xs text-neutral-400">
                                Create a new field — it will be linked to <strong>all invites</strong> in
                                this page automatically.
                            </p>
                            <div className="space-y-4 py-1">
                                {/* Field name */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-neutral-600">
                                        Field Name <span className="text-danger-500">*</span>
                                    </Label>
                                    <Input
                                        placeholder="e.g. Date of Birth"
                                        value={newFieldName}
                                        onChange={(e) => setNewFieldName(e.target.value)}
                                        className="focus:border-primary-400 focus:ring-primary-300"
                                    />
                                </div>

                                {/* Field type */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-neutral-600">Field Type</Label>
                                    <select
                                        value={newFieldType}
                                        onChange={(e) => {
                                            setNewFieldType(e.target.value as CustomFieldType);
                                            setNewFieldOptions([{ id: crypto.randomUUID(), value: '' }]);
                                        }}
                                        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
                                    >
                                        {CUSTOM_FIELD_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Required toggle */}
                                <label className="flex cursor-pointer items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={newFieldRequired}
                                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                                        className="size-4 rounded border-neutral-300 accent-primary-500"
                                    />
                                    <span className="text-sm text-neutral-700">Required field</span>
                                </label>

                                {/* Options (dropdown / radio / multi_select) */}
                                {HAS_OPTIONS(newFieldType) && (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-neutral-600">
                                            Options <span className="text-danger-500">*</span>
                                        </Label>
                                        <div className="space-y-1.5">
                                            {newFieldOptions.map((opt, i) => (
                                                <div key={opt.id} className="flex items-center gap-2">
                                                    <Input
                                                        placeholder={`Option ${i + 1}`}
                                                        value={opt.value}
                                                        onChange={(e) => updateOption(opt.id, e.target.value)}
                                                        className="focus:border-primary-400 focus:ring-primary-300"
                                                    />
                                                    {newFieldOptions.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeOption(opt.id)}
                                                            className="shrink-0 text-neutral-400 hover:text-danger-500"
                                                        >
                                                            <X className="size-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addOption}
                                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                                        >
                                            <Plus className="size-3.5" />
                                            Add option
                                        </button>
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <MyButton buttonType="secondary" scale="small" onClick={resetAddDialog}>
                                    Cancel
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    scale="small"
                                    disable={!canSubmitCreate || isMutating}
                                    onClick={() => createMutation.mutate()}
                                >
                                    {createMutation.isPending ? (
                                        <span className="flex items-center gap-1.5">
                                            <Loader2 className="size-3.5 animate-spin" />
                                            Creating...
                                        </span>
                                    ) : (
                                        'Create & Link Field'
                                    )}
                                </MyButton>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                        setDeleteConfirmText('');
                    }
                }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Remove Custom Field</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-1">
                        <p className="text-sm text-neutral-600">
                            This will remove{' '}
                            <strong>
                                {deleteTarget?.field.custom_field?.fieldName ?? 'this field'}
                            </strong>{' '}
                            from all {deleteTarget?.enroll_invite_ids.length} invite
                            {(deleteTarget?.enroll_invite_ids.length ?? 0) !== 1 ? 's' : ''} it is
                            associated with. Learner answers already collected will not be deleted.
                        </p>
                        <div className="space-y-1.5">
                            <p className="text-xs text-neutral-500">
                                Type <strong>delete</strong> to confirm
                            </p>
                            <Input
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="delete"
                                className="focus:border-danger-400 focus:ring-danger-300"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => {
                                setDeleteTarget(null);
                                setDeleteConfirmText('');
                            }}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            disable={deleteConfirmText.toLowerCase() !== 'delete' || isMutating}
                            onClick={() =>
                                deleteTarget && removeMutation.mutate(deleteTarget.field.field_id)
                            }
                        >
                            {removeMutation.isPending ? (
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Removing...
                                </span>
                            ) : (
                                'Remove Field'
                            )}
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
