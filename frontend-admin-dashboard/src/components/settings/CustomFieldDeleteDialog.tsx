import React, { useState, useEffect } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    getCustomFieldUsages,
    softDeleteCustomFieldMappings,
    type CustomFieldMappingUsage,
} from '@/services/custom-field-mappings';
import { toast } from 'sonner';

const TYPE_LABELS: Record<string, string> = {
    DEFAULT_CUSTOM_FIELD: 'Default (Institute-wide)',
    ENROLL_INVITE: 'Enroll Invite',
    AUDIENCE_FORM: 'Audience Campaign',
    SESSION: 'Live Session',
    ASSESSMENT: 'Assessment',
};

const TYPE_COLORS: Record<string, string> = {
    DEFAULT_CUSTOM_FIELD: 'bg-blue-100 text-blue-700',
    ENROLL_INVITE: 'bg-green-100 text-green-700',
    AUDIENCE_FORM: 'bg-purple-100 text-purple-700',
    SESSION: 'bg-orange-100 text-orange-700',
    ASSESSMENT: 'bg-rose-100 text-rose-700',
};

interface CustomFieldDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fieldName: string;
    fieldId: string;
    instituteId: string;
    onDeleteComplete: () => void;
}

export const CustomFieldDeleteDialog: React.FC<CustomFieldDeleteDialogProps> = ({
    open,
    onOpenChange,
    fieldName,
    fieldId,
    instituteId,
    onDeleteComplete,
}) => {
    const [usages, setUsages] = useState<CustomFieldMappingUsage[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (open && fieldId && instituteId) {
            setLoadError(false);
            loadUsages();
        }
        if (!open) {
            setUsages([]);
            setSelected(new Set());
            setLoadError(false);
        }
    }, [open, fieldId, instituteId]);

    const loadUsages = async () => {
        setIsLoading(true);
        try {
            const data = await getCustomFieldUsages(instituteId, fieldId);
            const safeData = Array.isArray(data) ? data : [];
            setUsages(safeData);
            setSelected(new Set(safeData.map((u) => u.mapping_id)));
        } catch {
            setLoadError(true);
            toast.error('Failed to load field usage data. The endpoint may not be deployed yet.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleOne = (mappingId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(mappingId)) {
                next.delete(mappingId);
            } else {
                next.add(mappingId);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === usages.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(usages.map((u) => u.mapping_id)));
        }
    };

    const handleDelete = async () => {
        if (selected.size === 0) return;
        setIsDeleting(true);
        try {
            await softDeleteCustomFieldMappings(Array.from(selected));
            toast.success(`Deleted ${selected.size} mapping(s) for "${fieldName}"`);
            onOpenChange(false);
            onDeleteComplete();
        } catch {
            toast.error('Failed to delete mappings');
        } finally {
            setIsDeleting(false);
        }
    };

    const safeUsages = Array.isArray(usages) ? usages : [];

    const grouped = safeUsages.reduce<Record<string, CustomFieldMappingUsage[]>>(
        (acc, usage) => {
            const key = usage.type;
            if (!acc[key]) acc[key] = [];
            acc[key].push(usage);
            return acc;
        },
        {}
    );

    const hasDefault = safeUsages.some((u) => u.type === 'DEFAULT_CUSTOM_FIELD');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trash2 className="size-5 text-red-500" />
                        Delete Field: {fieldName}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-6 animate-spin text-gray-400" />
                    </div>
                ) : loadError ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <AlertTriangle className="size-8 text-amber-500" />
                        <p className="text-sm text-gray-600">
                            Could not load usage data for this field. The API
                            endpoint may not be deployed yet.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadUsages}
                        >
                            Retry
                        </Button>
                    </div>
                ) : safeUsages.length === 0 ? (
                    <p className="py-4 text-sm text-gray-500">
                        No active mappings found for this field.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            This field is used in{' '}
                            <strong>{usages.length} place(s)</strong>. Select
                            which mappings to remove. Only the mappings are
                            deleted &mdash; existing learner answers are
                            preserved and will reappear if the field is
                            re-added later.
                        </p>

                        {hasDefault && selected.has(
                            usages.find((u) => u.type === 'DEFAULT_CUSTOM_FIELD')?.mapping_id ?? ''
                        ) && (
                            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <span>
                                    You are deleting the <strong>DEFAULT</strong>{' '}
                                    mapping. This field will no longer appear as
                                    a pre-selected default when creating new
                                    Invite / Audience / Live Class / Assessment
                                    instances.
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 border-b pb-2">
                            <Checkbox
                                checked={selected.size === usages.length}
                                onCheckedChange={toggleAll}
                            />
                            <span className="text-sm font-medium text-gray-700">
                                Select All ({usages.length})
                            </span>
                        </div>

                        {Object.entries(grouped).map(([type, items]) => (
                            <div key={type} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        className={`text-xs font-medium ${TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600'}`}
                                    >
                                        {TYPE_LABELS[type] ?? type}
                                    </Badge>
                                    <span className="text-xs text-gray-400">
                                        {items.length} mapping(s)
                                    </span>
                                </div>
                                {items.map((usage) => (
                                    <label
                                        key={usage.mapping_id}
                                        className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-gray-50"
                                    >
                                        <Checkbox
                                            checked={selected.has(usage.mapping_id)}
                                            onCheckedChange={() =>
                                                toggleOne(usage.mapping_id)
                                            }
                                        />
                                        <span className="text-sm text-gray-700">
                                            {usage.type === 'DEFAULT_CUSTOM_FIELD'
                                                ? 'Institute Default'
                                                : usage.type_id
                                                  ? `ID: ${usage.type_id.substring(0, 8)}...`
                                                  : 'Unknown'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                <DialogFooter className="gap-2 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting || selected.size === 0}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            `Delete ${selected.size} Mapping(s)`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
