import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
    CaretDown,
    CaretUp,
    CheckCircle,
    Eye,
    Gear,
    Lightbulb,
    Plus,
    PlusSquare,
    X,
} from '@phosphor-icons/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    CUSTOM_FIELD_TYPES,
    COMMON_FILE_TYPES,
    ALL_FILES_VALUE,
    type CustomFieldType,
} from '@/services/custom-field-settings';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { InlineFieldEditor } from './InlineFieldEditor';

export interface DropdownOption {
    id: string;
    value: string;
    disabled?: boolean;
}

export interface CustomFieldConfig {
    /** Whether the new field should be mandatory. Callers that ignore this default to true. */
    isRequired?: boolean;
    defaultValue?: string;
    min?: number;
    max?: number;
    minDate?: string;
    maxDate?: string;
    maxLength?: number;
    countryCode?: string;
    allowedFileTypes?: string[];
    maxSizeMB?: number;
    heading?: string;
    /** Checkbox consent body — rendered as a scrollable block above the box. */
    description?: string;
    /** Short hint shown under any field. Distinct from `description`. */
    helpText?: string;
}

interface AddCustomFieldDialogProps {
    trigger: React.ReactNode;
    onAddField: (
        type: string,
        name: string,
        oldKey: boolean,
        options?: DropdownOption[],
        config?: CustomFieldConfig
    ) => void;
    existingFieldNames: string[];
    supportedTypes?: CustomFieldType[];
}

const hasOptionsType = (type: CustomFieldType) =>
    type === 'dropdown' || type === 'radio' || type === 'multi_select';

/** Types with extra constraints worth tucking behind "Advanced options". */
const hasAdvancedOptions = (type: CustomFieldType) => type === 'file' || type === 'checkbox';

export const AddCustomFieldDialog = ({
    trigger,
    onAddField,
    existingFieldNames,
    supportedTypes,
}: AddCustomFieldDialogProps) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<CustomFieldType>('text');
    const [fieldName, setFieldName] = useState('');
    const [isNameValid, setIsNameValid] = useState(false);
    const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([]);
    const [defaultValue, setDefaultValue] = useState('');
    const [isRequired, setIsRequired] = useState(true);
    const [helpTextEnabled, setHelpTextEnabled] = useState(false);
    const [helpText, setHelpText] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [checkboxDefault, setCheckboxDefault] = useState(false);
    const [checkboxHeading, setCheckboxHeading] = useState('');
    const [checkboxDescription, setCheckboxDescription] = useState('');
    const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>([]);
    const [maxSizeMB, setMaxSizeMB] = useState<number>(5);

    const availableTypes = supportedTypes
        ? CUSTOM_FIELD_TYPES.filter((t) => supportedTypes.includes(t.value as CustomFieldType))
        : CUSTOM_FIELD_TYPES;

    const resetForm = () => {
        setFieldName('');
        setSelectedType('text');
        setDropdownOptions([]);
        setDefaultValue('');
        setIsRequired(true);
        setHelpTextEnabled(false);
        setHelpText('');
        setShowAdvanced(false);
        setCheckboxDefault(false);
        setCheckboxHeading('');
        setCheckboxDescription('');
        setAllowedFileTypes([]);
        setMaxSizeMB(5);
    };

    const buildConfig = (): CustomFieldConfig | undefined => {
        const config: CustomFieldConfig = {};
        if (selectedType === 'checkbox') {
            config.defaultValue = checkboxDefault ? 'true' : 'false';
            if (checkboxHeading.trim()) config.heading = checkboxHeading.trim();
            if (checkboxDescription.trim()) config.description = checkboxDescription.trim();
        } else if (defaultValue.trim()) {
            config.defaultValue = defaultValue.trim();
        }
        if (selectedType === 'file') {
            if (allowedFileTypes.length > 0) config.allowedFileTypes = allowedFileTypes;
            config.maxSizeMB = maxSizeMB;
        }
        if (helpTextEnabled && helpText.trim()) config.helpText = helpText.trim();
        // Only surface isRequired when it deviates from the default-true that
        // every caller already applies, so config stays undefined otherwise.
        if (!isRequired) config.isRequired = false;
        return Object.keys(config).length > 0 ? config : undefined;
    };

    const submit = (keepOpen: boolean) => {
        onAddField(
            selectedType === 'text' ? 'textfield' : selectedType,
            fieldName.trim(),
            false,
            hasOptionsType(selectedType) ? dropdownOptions : undefined,
            buildConfig()
        );
        resetForm();
        if (!keepOpen) setIsDialogOpen(false);
    };

    useEffect(() => {
        const trimmed = fieldName.trim();
        setIsNameValid(
            trimmed.length > 0 &&
                !existingFieldNames.some((name) => name.toLowerCase() === trimmed.toLowerCase())
        );
    }, [fieldName, existingFieldNames]);

    useEffect(() => {
        if (!isDialogOpen) resetForm();
    }, [isDialogOpen]);

    const optionValues = dropdownOptions.map((o) => o.value);

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 p-0">{/* design-lint-ignore: vh/max-w dialog sizing matches MyDialog primitive */}
                <div className="flex items-start gap-3 border-b border-neutral-200 p-6">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                        <PlusSquare size={22} />
                    </span>
                    <div className="flex flex-col">
                        <h1 className="text-title font-semibold">Add Custom Field</h1>
                        <p className="text-caption text-neutral-500">
                            Create a new field and customize how it appears in the registration
                            form.
                        </p>
                    </div>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
                    {/* ---------------- Left: the form ---------------- */}
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1">
                            <Label className="text-body font-semibold">1. Field Type</Label>
                            <Select
                                value={selectedType}
                                onValueChange={(val) => {
                                    setSelectedType(val as CustomFieldType);
                                    setDropdownOptions(
                                        hasOptionsType(val as CustomFieldType)
                                            ? [{ id: '0', value: 'Option 1' }]
                                            : []
                                    );
                                    setDefaultValue('');
                                    setAllowedFileTypes([]);
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select field type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTypes.map((ft) => (
                                        <SelectItem key={ft.value} value={ft.value}>
                                            {ft.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-caption text-neutral-500">
                                Choose the type of input you want to collect.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-body font-semibold">
                                2. Field Label
                                <span className="text-danger-600"> *</span>
                            </Label>
                            <MyInput
                                inputType="text"
                                inputPlaceholder="Enter field label"
                                input={fieldName}
                                onChangeFunction={(e) => setFieldName(e.target.value)}
                                size="large"
                                className="w-full"
                            />
                            {fieldName.trim().length > 0 && !isNameValid ? (
                                <p className="text-caption text-danger-600">
                                    This field name is already taken
                                </p>
                            ) : (
                                <p className="text-caption text-neutral-500">
                                    This label will be shown on the form.
                                </p>
                            )}
                        </div>

                        {hasOptionsType(selectedType) && (
                            <InlineFieldEditor
                                name=""
                                onNameChange={() => {}}
                                hideName
                                bare
                                options={optionValues}
                                onOptionsChange={(next) =>
                                    setDropdownOptions(
                                        next.map((value, idx) => ({ id: String(idx), value }))
                                    )
                                }
                            />
                        )}

                        {selectedType !== 'checkbox' && selectedType !== 'file' && (
                            <div className="flex flex-col gap-1">
                                <Label className="text-body font-semibold">
                                    3. Default Value (Optional)
                                </Label>
                                <MyInput
                                    inputType="text"
                                    inputPlaceholder="Enter default value"
                                    input={defaultValue}
                                    onChangeFunction={(e) => setDefaultValue(e.target.value)}
                                    size="large"
                                    className="w-full"
                                />
                                <p className="text-caption text-neutral-500">
                                    Pre-fill this value when the form loads.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 p-3">
                                <div className="flex flex-col">
                                    <span className="text-body font-semibold">
                                        Required Field
                                        <span className="text-danger-600"> *</span>
                                    </span>
                                    <span className="text-caption text-neutral-500">
                                        Make this field mandatory
                                    </span>
                                </div>
                                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
                            </div>
                            <div className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 p-3">
                                <div className="flex flex-col">
                                    <span className="text-body font-semibold">
                                        Help Text{' '}
                                        <span className="font-regular text-neutral-500">
                                            (Optional)
                                        </span>
                                    </span>
                                    <span className="text-caption text-neutral-500">
                                        Show additional info below the field
                                    </span>
                                </div>
                                <Switch
                                    checked={helpTextEnabled}
                                    onCheckedChange={setHelpTextEnabled}
                                />
                            </div>
                        </div>

                        {helpTextEnabled && (
                            <MyInput
                                inputType="text"
                                inputPlaceholder="Enter help text"
                                input={helpText}
                                onChangeFunction={(e) => setHelpText(e.target.value)}
                                size="large"
                                className="w-full"
                            />
                        )}

                        {hasAdvancedOptions(selectedType) && (
                            <div className="rounded-lg border border-neutral-200">
                                <button
                                    type="button"
                                    className="flex w-full items-center justify-between p-3"
                                    onClick={() => setShowAdvanced((v) => !v)}
                                >
                                    <span className="flex items-center gap-2 text-body">
                                        <Gear size={18} /> Advanced Options
                                    </span>
                                    {showAdvanced ? (
                                        <CaretUp size={16} />
                                    ) : (
                                        <CaretDown size={16} />
                                    )}
                                </button>
                                {showAdvanced && (
                                    <div className="flex flex-col gap-3 border-t border-neutral-200 p-3">
                                        {selectedType === 'checkbox' && (
                                            <>
                                                <div className="flex flex-col gap-1">
                                                    <Label className="text-caption text-neutral-500">
                                                        Heading (Optional)
                                                    </Label>
                                                    <MyInput
                                                        inputType="text"
                                                        inputPlaceholder="e.g. Terms & Conditions"
                                                        input={checkboxHeading}
                                                        onChangeFunction={(e) =>
                                                            setCheckboxHeading(e.target.value)
                                                        }
                                                        size="large"
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <Label className="text-caption text-neutral-500">
                                                        Description / Consent Text (Optional)
                                                    </Label>
                                                    <textarea
                                                        placeholder="e.g. Terms & Conditions text shown above the checkbox. Line breaks are preserved."
                                                        value={checkboxDescription}
                                                        onChange={(e) =>
                                                            setCheckboxDescription(e.target.value)
                                                        }
                                                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                                                        rows={5}
                                                    />
                                                    <p className="text-caption text-neutral-500">
                                                        Shown as a scrollable block above the
                                                        checkbox.
                                                    </p>
                                                </div>
                                                <label className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={checkboxDefault}
                                                        onCheckedChange={(c) =>
                                                            setCheckboxDefault(c === true)
                                                        }
                                                    />
                                                    <span className="text-body">
                                                        Checked by default
                                                    </span>
                                                </label>
                                            </>
                                        )}
                                        {selectedType === 'file' && (
                                            <>
                                                <Label className="text-caption text-neutral-500">
                                                    Allowed File Types
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {COMMON_FILE_TYPES.map((ft) => {
                                                        const isAll = ft.value === ALL_FILES_VALUE;
                                                        const disabledByAll =
                                                            !isAll &&
                                                            allowedFileTypes.includes(
                                                                ALL_FILES_VALUE
                                                            );
                                                        return (
                                                            <label
                                                                key={ft.value}
                                                                className="flex cursor-pointer items-center gap-1"
                                                            >
                                                                <Checkbox
                                                                    checked={allowedFileTypes.includes(
                                                                        ft.value
                                                                    )}
                                                                    disabled={disabledByAll}
                                                                    onCheckedChange={() =>
                                                                        setAllowedFileTypes(
                                                                            (prev) => {
                                                                                if (isAll)
                                                                                    return prev.includes(
                                                                                        ALL_FILES_VALUE
                                                                                    )
                                                                                        ? []
                                                                                        : [
                                                                                              ALL_FILES_VALUE,
                                                                                          ];
                                                                                const without =
                                                                                    prev.filter(
                                                                                        (t) =>
                                                                                            t !==
                                                                                            ALL_FILES_VALUE
                                                                                    );
                                                                                return without.includes(
                                                                                    ft.value
                                                                                )
                                                                                    ? without.filter(
                                                                                          (t) =>
                                                                                              t !==
                                                                                              ft.value
                                                                                      )
                                                                                    : [
                                                                                          ...without,
                                                                                          ft.value,
                                                                                      ];
                                                                            }
                                                                        )
                                                                    }
                                                                />
                                                                <span className="text-caption">
                                                                    {ft.label}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <Label className="text-caption text-neutral-500">
                                                        Max File Size (MB)
                                                    </Label>
                                                    <MyInput
                                                        inputType="number"
                                                        inputPlaceholder="5"
                                                        input={String(maxSizeMB)}
                                                        onChangeFunction={(e) =>
                                                            setMaxSizeMB(
                                                                Number(e.target.value) || 5
                                                            )
                                                        }
                                                        size="large"
                                                        className="w-32"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ---------------- Right: preview + tips ---------------- */}
                    <div className="flex flex-col gap-4 md:border-l md:border-neutral-200 md:pl-6">
                        <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-2 text-body font-semibold">
                                <Eye size={18} /> Live Preview
                            </span>
                            <p className="text-caption text-neutral-500">
                                This is how the field will appear on the registration form.
                            </p>
                        </div>

                        <div className="rounded-lg border border-neutral-200 p-4">
                            <div className="flex flex-col gap-1">
                                <Label className="text-body font-semibold">
                                    {fieldName.trim() || 'Field Label'}
                                    {isRequired && <span className="text-danger-600"> *</span>}
                                </Label>
                                <div className="pointer-events-none">
                                    <CustomFieldRenderer
                                        type={selectedType}
                                        name={fieldName.trim() || 'Field Label'}
                                        value=""
                                        disabled
                                        options={optionValues}
                                        config={{
                                            heading: checkboxHeading.trim() || undefined,
                                            description:
                                                checkboxDescription.trim() || undefined,
                                        }}
                                    />
                                </div>
                                <p className="text-caption text-neutral-500">
                                    {helpTextEnabled && helpText.trim()
                                        ? helpText.trim()
                                        : 'Help text will appear here (if enabled)'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-4">
                            <span className="flex items-center gap-2 text-body font-semibold text-warning-600">
                                <Lightbulb size={18} /> Tips
                            </span>
                            <ul className="ml-4 list-disc text-caption text-neutral-600">
                                <li>You can change the field type anytime.</li>
                                <li>Drag the field to reorder it in the form.</li>
                                <li>Click the pencil on a field to edit its settings.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 p-4">
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        className="mr-auto"
                        onClick={() => setIsDialogOpen(false)}
                    >
                        <X size={16} /> Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        disable={!isNameValid}
                        onClick={() => submit(true)}
                    >
                        <Plus size={16} /> Save &amp; Add Another
                    </MyButton>
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="primary"
                        disable={!isNameValid}
                        onClick={() => submit(false)}
                    >
                        <CheckCircle size={16} /> Add Field
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
