import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { Plus, Trash, CaretDown, CaretUp } from '@phosphor-icons/react';
import { NewUserRow, CustomFieldValue } from '../../../-types/bulk-assign-types';
import {
    getCustomFieldSettingsFromCache,
    CustomField,
    SystemField,
} from '@/services/custom-field-settings';

interface Props {
    onAdd: (rows: NewUserRow[]) => void;
}

// Internal row state (extends NewUserRow with a custom_fields Record for easy editing)
interface EditableRow {
    email: string;
    full_name: string;
    mobile_number: string;
    username: string;
    password: string;
    gender: string;
    date_of_birth: string;
    address_line: string;
    city: string;
    region: string;
    pin_code: string;
    fathers_name: string;
    mothers_name: string;
    parents_mobile_number: string;
    parents_email: string;
    parents_to_mother_mobile_number: string;
    parents_to_mother_email: string;
    linked_institute_name: string;
    /** custom_field_id → value */
    custom_fields: Record<string, string>;
    /** Whether the "extra fields" section is expanded */
    expanded: boolean;
}

const emptyRow = (): EditableRow => ({
    email: '',
    full_name: '',
    mobile_number: '',
    username: '',
    password: '',
    gender: '',
    date_of_birth: '',
    address_line: '',
    city: '',
    region: '',
    pin_code: '',
    fathers_name: '',
    mothers_name: '',
    parents_mobile_number: '',
    parents_email: '',
    parents_to_mother_mobile_number: '',
    parents_to_mother_email: '',
    linked_institute_name: '',
    custom_fields: {},
    expanded: false,
});

// Map system field key → EditableRow field key + input type
const SYSTEM_FIELD_MAP: Record<
    string,
    { rowKey: keyof EditableRow; inputType: string; placeholder: string }
> = {
    GENDER: { rowKey: 'gender', inputType: 'text', placeholder: 'MALE / FEMALE / OTHER' },
    DATE_OF_BIRTH: { rowKey: 'date_of_birth', inputType: 'date', placeholder: 'YYYY-MM-DD' },
    ADDRESS_LINE: { rowKey: 'address_line', inputType: 'text', placeholder: 'Address line' },
    CITY: { rowKey: 'city', inputType: 'text', placeholder: 'City' },
    REGION: { rowKey: 'region', inputType: 'text', placeholder: 'State / Region' },
    PIN_CODE: { rowKey: 'pin_code', inputType: 'text', placeholder: 'PIN code' },
    LINKED_INSTITUTE_NAME: {
        rowKey: 'linked_institute_name',
        inputType: 'text',
        placeholder: 'College / School',
    },
    FATHER_NAME: { rowKey: 'fathers_name', inputType: 'text', placeholder: "Father's name" },
    MOTHER_NAME: { rowKey: 'mothers_name', inputType: 'text', placeholder: "Mother's name" },
    PARENTS_MOBILE_NUMBER: {
        rowKey: 'parents_mobile_number',
        inputType: 'tel',
        placeholder: "Father's mobile",
    },
    PARENTS_EMAIL: {
        rowKey: 'parents_email',
        inputType: 'email',
        placeholder: "Father's email",
    },
    PARENTS_TO_MOTHER_MOBILE_NUMBER: {
        rowKey: 'parents_to_mother_mobile_number',
        inputType: 'tel',
        placeholder: "Mother's mobile",
    },
    PARENTS_TO_MOTHER_EMAIL: {
        rowKey: 'parents_to_mother_email',
        inputType: 'email',
        placeholder: "Mother's email",
    },
};

// System fields that are excluded from the form (handled in other steps)
const EXCLUDED_SYSTEM_KEYS = new Set([
    'FULL_NAME',
    'EMAIL',
    'MOBILE_NUMBER',
    'USERNAME',
    'PACKAGE_SESSION_ID',
    'INSTITUTE_ENROLLMENT_ID',
    'ATTENDANCE',
    'COUNTRY',
    'PLAN_TYPE',
    'AMOUNT_PAID',
    'PREFFERED_BATCH',
    'EXPIRY_DATE',
    'STATUS',
]);

interface VisibleSystemField {
    key: string;
    label: string;
    rowKey: keyof EditableRow;
    inputType: string;
    placeholder: string;
}

export const ManualUserEntry = ({ onAdd }: Props) => {
    const [rows, setRows] = useState<EditableRow[]>([emptyRow()]);
    const [submitted, setSubmitted] = useState(false);

    // ─── Compute dynamic fields from institute settings ────
    const { visibleSystemFields, enrollmentCustomFields } = useMemo(() => {
        const settings = getCustomFieldSettingsFromCache();

        // System fields
        const sysFields: VisibleSystemField[] = [];
        if (settings?.systemFields) {
            for (const sf of settings.systemFields) {
                if (!sf.visibility) continue;
                if (EXCLUDED_SYSTEM_KEYS.has(sf.key)) continue;
                const mapping = SYSTEM_FIELD_MAP[sf.key];
                if (!mapping) continue;
                sysFields.push({
                    key: sf.key,
                    label: sf.customValue || sf.defaultValue,
                    rowKey: mapping.rowKey,
                    inputType: mapping.inputType,
                    placeholder: mapping.placeholder,
                });
            }
        } else {
            // Fallback: show gender only if no settings
            sysFields.push({
                key: 'GENDER',
                label: 'Gender',
                rowKey: 'gender',
                inputType: 'text',
                placeholder: 'MALE / FEMALE / OTHER',
            });
        }

        // Custom fields with learnerEnrollment visibility
        const cfFields = (settings?.customFields ?? []).filter(
            (cf: CustomField) => cf.visibility?.learnerEnrollment === true
        );

        return { visibleSystemFields: sysFields, enrollmentCustomFields: cfFields };
    }, []);

    const hasExtraFields = visibleSystemFields.length > 0 || enrollmentCustomFields.length > 0;

    const update = (idx: number, field: keyof EditableRow, value: string) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    };

    const updateCustomField = (idx: number, cfId: string, value: string) => {
        setRows((prev) =>
            prev.map((r, i) =>
                i === idx ? { ...r, custom_fields: { ...r.custom_fields, [cfId]: value } } : r
            )
        );
    };

    const toggleExpanded = (idx: number) => {
        setRows((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, expanded: !r.expanded } : r))
        );
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);

    const removeRow = (idx: number) =>
        setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

    const validate = (row: EditableRow) => row.email.trim() && row.full_name.trim();

    const handleAdd = () => {
        setSubmitted(true);
        const valid = rows.filter(validate);
        if (valid.length === 0) return;

        onAdd(
            valid.map((r): NewUserRow => {
                // Build custom field values
                const cfValues: CustomFieldValue[] = [];
                for (const [cfId, val] of Object.entries(r.custom_fields)) {
                    if (val?.trim()) {
                        cfValues.push({ custom_field_id: cfId, value: val.trim() });
                    }
                }

                return {
                    email: r.email.trim(),
                    full_name: r.full_name.trim(),
                    mobile_number: r.mobile_number?.trim() || undefined,
                    username: r.username?.trim() || undefined,
                    password: r.password?.trim() || undefined,
                    gender: r.gender?.trim() || undefined,
                    date_of_birth: r.date_of_birth?.trim() || undefined,
                    address_line: r.address_line?.trim() || undefined,
                    city: r.city?.trim() || undefined,
                    region: r.region?.trim() || undefined,
                    pin_code: r.pin_code?.trim() || undefined,
                    fathers_name: r.fathers_name?.trim() || undefined,
                    mothers_name: r.mothers_name?.trim() || undefined,
                    parents_mobile_number: r.parents_mobile_number?.trim() || undefined,
                    parents_email: r.parents_email?.trim() || undefined,
                    parents_to_mother_mobile_number:
                        r.parents_to_mother_mobile_number?.trim() || undefined,
                    parents_to_mother_email: r.parents_to_mother_email?.trim() || undefined,
                    linked_institute_name: r.linked_institute_name?.trim() || undefined,
                    custom_field_values: cfValues.length > 0 ? cfValues : undefined,
                };
            })
        );
        setRows([emptyRow()]);
        setSubmitted(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
                {rows.map((row, idx) => (
                    <div
                        key={idx}
                        className="rounded-lg border border-neutral-200 bg-white p-4"
                    >
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-neutral-500">
                                Learner #{idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                                {hasExtraFields && (
                                    <button
                                        onClick={() => toggleExpanded(idx)}
                                        className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                                    >
                                        {row.expanded ? (
                                            <>
                                                <CaretUp size={12} /> Less fields
                                            </>
                                        ) : (
                                            <>
                                                <CaretDown size={12} /> More fields
                                            </>
                                        )}
                                    </button>
                                )}
                                {rows.length > 1 && (
                                    <button
                                        onClick={() => removeRow(idx)}
                                        className="text-neutral-400 hover:text-danger-500 transition-colors"
                                    >
                                        <Trash size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Core fields — always visible */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="mb-1 text-xs text-neutral-500">
                                    Email <span className="text-danger-500">*</span>
                                </Label>
                                <Input
                                    type="email"
                                    placeholder="student@example.com"
                                    value={row.email}
                                    onChange={(e) => update(idx, 'email', e.target.value)}
                                    className={
                                        submitted && !row.email.trim()
                                            ? 'border-danger-400'
                                            : ''
                                    }
                                />
                            </div>
                            <div>
                                <Label className="mb-1 text-xs text-neutral-500">
                                    Full Name <span className="text-danger-500">*</span>
                                </Label>
                                <Input
                                    placeholder="John Doe"
                                    value={row.full_name}
                                    onChange={(e) => update(idx, 'full_name', e.target.value)}
                                    className={
                                        submitted && !row.full_name.trim()
                                            ? 'border-danger-400'
                                            : ''
                                    }
                                />
                            </div>
                            <div>
                                <Label className="mb-1 text-xs text-neutral-500">
                                    Mobile (optional)
                                </Label>
                                <Input
                                    placeholder="+91 9876543210"
                                    value={row.mobile_number}
                                    onChange={(e) =>
                                        update(idx, 'mobile_number', e.target.value)
                                    }
                                />
                            </div>
                            <div>
                                <Label className="mb-1 text-xs text-neutral-500">
                                    Username (optional)
                                </Label>
                                <Input
                                    placeholder="auto-generated if blank"
                                    value={row.username}
                                    onChange={(e) => update(idx, 'username', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="mb-1 text-xs text-neutral-500">
                                    Password (optional)
                                </Label>
                                <Input
                                    type="password"
                                    placeholder="auto-generated if blank"
                                    value={row.password}
                                    onChange={(e) => update(idx, 'password', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Expandable extra fields */}
                        {row.expanded && hasExtraFields && (
                            <div className="mt-3 border-t border-neutral-100 pt-3">
                                <p className="mb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Additional Details
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Dynamic system fields */}
                                    {visibleSystemFields.map((sf) => (
                                        <div key={sf.key}>
                                            <Label className="mb-1 text-xs text-neutral-500">
                                                {sf.label}
                                            </Label>
                                            <Input
                                                type={sf.inputType}
                                                placeholder={sf.placeholder}
                                                value={
                                                    (row[sf.rowKey] as string) || ''
                                                }
                                                onChange={(e) =>
                                                    update(idx, sf.rowKey, e.target.value)
                                                }
                                            />
                                        </div>
                                    ))}

                                    {/* Custom fields */}
                                    {enrollmentCustomFields.map((cf: CustomField) => (
                                        <div key={cf.id}>
                                            <Label className="mb-1 text-xs text-neutral-500">
                                                {cf.name}
                                                {cf.required && (
                                                    <span className="ml-1 text-danger-500">*</span>
                                                )}
                                            </Label>
                                            {cf.type === 'dropdown' && cf.options ? (
                                                <select
                                                    className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm transition-colors focus:border-primary-500 focus:outline-none"
                                                    value={row.custom_fields[cf.id] || ''}
                                                    onChange={(e) =>
                                                        updateCustomField(
                                                            idx,
                                                            cf.id,
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Select {cf.name}
                                                    </option>
                                                    {cf.options.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <Input
                                                    type={
                                                        cf.type === 'number'
                                                            ? 'number'
                                                            : 'text'
                                                    }
                                                    placeholder={`Enter ${cf.name}`}
                                                    value={row.custom_fields[cf.id] || ''}
                                                    onChange={(e) =>
                                                        updateCustomField(
                                                            idx,
                                                            cf.id,
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors"
                >
                    <Plus size={14} />
                    Add another learner
                </button>
                <div className="flex-1" />
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    layoutVariant="default"
                    onClick={handleAdd}
                >
                    Add {rows.filter(validate).length} learner
                    {rows.filter(validate).length !== 1 ? 's' : ''}
                </MyButton>
            </div>
        </div>
    );
};
