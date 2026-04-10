import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { VariableMapping, VariableMappingSource } from '@/types/chatbot-flow/chatbot-flow-types';
import { CustomFieldOption, fetchInstituteCustomFields } from '../-services/chatbot-flow-api';
import { getInstituteId } from '@/constants/helper';

/**
 * System (user) fields that can be mapped as placeholder values. The value is
 * the JSON key on the admin-core-service `UserDTO` snake_case serialization,
 * which is what the notification_service receives from `/internal/user/by-phone`.
 */
const SYSTEM_FIELD_OPTIONS: Array<{ key: string; label: string }> = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    { key: 'mobile_number', label: 'Mobile Number' },
    { key: 'username', label: 'Username' },
    { key: 'id', label: 'User ID' },
    { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'address_line', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'region', label: 'Region / State' },
    { key: 'pin_code', label: 'Pin Code' },
];

const SOURCE_OPTIONS: Array<{ value: VariableMappingSource; label: string }> = [
    { value: 'SYSTEM_FIELD', label: 'System Field' },
    { value: 'CUSTOM_FIELD', label: 'Custom Field' },
    { value: 'SESSION', label: 'Session Variable' },
    { value: 'CONTEXT', label: 'Context (phone, instituteId, …)' },
    { value: 'FIXED', label: 'Fixed Value' },
];

// Cache shared across mounts so switching nodes doesn't re-fetch every time.
let customFieldCache: { instituteId: string; data: CustomFieldOption[] } | null = null;

interface VariableMappingEditorProps {
    variables: VariableMapping[];
    onChange: (next: VariableMapping[]) => void;
}

export function VariableMappingEditor({ variables, onChange }: VariableMappingEditorProps) {
    const instituteId = getInstituteId() || '';
    const [customFields, setCustomFields] = useState<CustomFieldOption[]>(
        customFieldCache?.instituteId === instituteId && customFieldCache.data.length > 0
            ? customFieldCache.data
            : []
    );
    const [loadingCustom, setLoadingCustom] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const needsCustomFields = variables.some((v) => v.source === 'CUSTOM_FIELD');

    const loadCustomFields = useCallback(async () => {
        if (!instituteId) {
            setLoadError('No instituteId available');
            return;
        }
        // Only treat the cache as warm when it has actual data — empty/failed
        // results should NOT poison subsequent attempts.
        if (customFieldCache?.instituteId === instituteId && customFieldCache.data.length > 0) {
            setCustomFields(customFieldCache.data);
            return;
        }
        setLoadingCustom(true);
        setLoadError(null);
        try {
            const data = await fetchInstituteCustomFields(instituteId);
            // eslint-disable-next-line no-console
            console.debug('[VariableMappingEditor] Loaded custom fields:', data);
            if (data.length > 0) {
                customFieldCache = { instituteId, data };
            }
            setCustomFields(data);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[VariableMappingEditor] Failed to load custom fields:', e);
            setLoadError(e instanceof Error ? e.message : 'Failed to load custom fields');
            setCustomFields([]);
        } finally {
            setLoadingCustom(false);
        }
    }, [instituteId]);

    useEffect(() => {
        if (needsCustomFields) loadCustomFields();
    }, [needsCustomFields, loadCustomFields]);

    const updateRow = (idx: number, patch: Partial<VariableMapping>) => {
        const next = variables.map((v, i) => (i === idx ? { ...v, ...patch } : v));
        onChange(next);
    };

    const addRow = () => {
        onChange([...variables, { name: '', source: 'SYSTEM_FIELD', field: '', defaultValue: '' }]);
    };

    const removeRow = (idx: number) => {
        onChange(variables.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-2">
            {variables.length === 0 && (
                <p className="text-xs italic text-gray-400">
                    No mappings yet. Add one to resolve a {'{{placeholder}}'} from user data with a
                    fallback default.
                </p>
            )}

            {variables.map((v, idx) => (
                <div key={idx} className="space-y-1 rounded border bg-white p-2">
                    <div className="flex items-center gap-1">
                        <span className="shrink-0 text-xs text-gray-400">{`{{`}</span>
                        <input
                            type="text"
                            value={v.name}
                            onChange={(e) => updateRow(idx, { name: e.target.value })}
                            placeholder="placeholderName"
                            className="flex-1 rounded border px-1.5 py-1 font-mono text-xs"
                        />
                        <span className="shrink-0 text-xs text-gray-400">{`}}`}</span>
                        <button
                            onClick={() => removeRow(idx)}
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Remove"
                        >
                            <Trash size={14} />
                        </button>
                    </div>

                    <select
                        value={v.source}
                        onChange={(e) =>
                            updateRow(idx, {
                                source: e.target.value as VariableMappingSource,
                                field: '',
                            })
                        }
                        className="w-full rounded border px-1.5 py-1 text-xs"
                    >
                        {SOURCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>

                    {v.source === 'SYSTEM_FIELD' && (
                        <select
                            value={v.field}
                            onChange={(e) => updateRow(idx, { field: e.target.value })}
                            className="w-full rounded border px-1.5 py-1 text-xs"
                        >
                            <option value="">— Select system field —</option>
                            {SYSTEM_FIELD_OPTIONS.map((o) => (
                                <option key={o.key} value={o.key}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    )}

                    {v.source === 'CUSTOM_FIELD' && (
                        <>
                            <select
                                value={v.field}
                                onChange={(e) => updateRow(idx, { field: e.target.value })}
                                className="w-full rounded border px-1.5 py-1 text-xs"
                            >
                                <option value="">
                                    {loadingCustom ? 'Loading…' : '— Select custom field —'}
                                </option>
                                {customFields.map((cf) => (
                                    <option key={cf.id} value={cf.fieldName}>
                                        {cf.fieldName} ({cf.fieldType})
                                    </option>
                                ))}
                            </select>
                            {!loadingCustom && customFields.length === 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] text-gray-400">
                                        {loadError
                                            ? `Error: ${loadError}`
                                            : 'No custom fields found for this institute.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            customFieldCache = null;
                                            loadCustomFields();
                                        }}
                                        className="text-[10px] text-blue-600 hover:text-blue-800"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {(v.source === 'SESSION' || v.source === 'CONTEXT' || v.source === 'FIXED') && (
                        <input
                            type="text"
                            value={v.field}
                            onChange={(e) => updateRow(idx, { field: e.target.value })}
                            placeholder={
                                v.source === 'FIXED'
                                    ? 'Literal value'
                                    : v.source === 'CONTEXT'
                                      ? 'phone | instituteId | userId | messageText'
                                      : 'session variable key'
                            }
                            className="w-full rounded border px-1.5 py-1 font-mono text-xs"
                        />
                    )}

                    <input
                        type="text"
                        value={v.defaultValue}
                        onChange={(e) => updateRow(idx, { defaultValue: e.target.value })}
                        placeholder="Default (used when value is missing)"
                        className="w-full rounded border px-1.5 py-1 text-xs"
                    />
                </div>
            ))}

            <button
                onClick={addRow}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
                <Plus size={12} /> Add Variable
            </button>
        </div>
    );
}
