import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { PencilSimple, Plus, TrashSimple, DotsSixVertical } from '@phosphor-icons/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CUSTOM_FIELD_TYPES, type CustomFieldType } from '@/services/custom-field-settings';

export interface DropdownOption {
    id: number;
    value: string;
    disabled: boolean;
}

export interface CustomFieldConfig {
    defaultValue?: string;
    min?: number;
    max?: number;
    minDate?: string;
    maxDate?: string;
    maxLength?: number;
    countryCode?: string;
    allowedFileTypes?: string[];
    maxSizeMB?: number;
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

const COMMON_FILE_TYPES = [
    { value: 'pdf', label: 'PDF' },
    { value: 'doc', label: 'DOC' },
    { value: 'docx', label: 'DOCX' },
    { value: 'xls', label: 'XLS' },
    { value: 'xlsx', label: 'XLSX' },
    { value: 'csv', label: 'CSV' },
    { value: 'png', label: 'PNG' },
    { value: 'jpg', label: 'JPG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'gif', label: 'GIF' },
    { value: 'svg', label: 'SVG' },
    { value: 'mp4', label: 'MP4' },
    { value: 'mp3', label: 'MP3' },
    { value: 'zip', label: 'ZIP' },
    { value: 'txt', label: 'TXT' },
];

const hasOptionsType = (type: CustomFieldType) =>
    type === 'dropdown' || type === 'radio' || type === 'multi_select';

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
    const [checkboxDefault, setCheckboxDefault] = useState(false);
    const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>([]);
    const [maxSizeMB, setMaxSizeMB] = useState<number>(5);

    const availableTypes = supportedTypes
        ? CUSTOM_FIELD_TYPES.filter((t) => supportedTypes.includes(t.value as CustomFieldType))
        : CUSTOM_FIELD_TYPES;

    const handleAddDropdownOption = () => {
        setDropdownOptions((prev) => [
            ...prev,
            { id: prev.length, value: `option ${prev.length + 1}`, disabled: false },
        ]);
    };

    const handleDeleteOption = (id: number) => {
        setDropdownOptions((prev) => prev.filter((opt) => opt.id !== id));
    };

    const handleOptionValueChange = (id: number, newValue: string) => {
        setDropdownOptions((prev) =>
            prev.map((opt) => (opt.id === id ? { ...opt, value: newValue } : opt))
        );
    };

    const handleEditClick = (id: number) => {
        setDropdownOptions((prev) =>
            prev.map((opt) => (opt.id === id ? { ...opt, disabled: !opt.disabled } : opt))
        );
    };

    const toggleFileType = (fileType: string) => {
        setAllowedFileTypes((prev) =>
            prev.includes(fileType)
                ? prev.filter((t) => t !== fileType)
                : [...prev, fileType]
        );
    };

    const resetForm = () => {
        setFieldName('');
        setSelectedType('text');
        setDropdownOptions([]);
        setDefaultValue('');
        setCheckboxDefault(false);
        setAllowedFileTypes([]);
        setMaxSizeMB(5);
    };

    const handleDone = () => {
        const config: CustomFieldConfig = {};

        if (selectedType === 'checkbox') {
            config.defaultValue = checkboxDefault ? 'true' : 'false';
        } else if (selectedType === 'file') {
            if (allowedFileTypes.length > 0) config.allowedFileTypes = allowedFileTypes;
            config.maxSizeMB = maxSizeMB;
        } else if (defaultValue) {
            config.defaultValue = defaultValue;
        }

        onAddField(
            selectedType === 'text' ? 'textfield' : selectedType,
            fieldName,
            false,
            hasOptionsType(selectedType) ? dropdownOptions : undefined,
            Object.keys(config).length > 0 ? config : undefined
        );

        setIsDialogOpen(false);
        resetForm();
    };

    useEffect(() => {
        if (fieldName.length > 0) {
            const isDuplicate = existingFieldNames.some(
                (name) => name.toLowerCase() === fieldName.toLowerCase()
            );
            setIsNameValid(!isDuplicate);
        } else {
            setIsNameValid(false);
        }
    }, [fieldName, existingFieldNames]);

    useEffect(() => {
        if (!isDialogOpen) {
            resetForm();
        }
    }, [isDialogOpen]);

    const renderOptionsEditor = () => (
        <div className="flex flex-col gap-1">
            <h1 className="mt-4">
                {selectedType === 'radio' ? 'Radio' : 'Dropdown'} Options
            </h1>
            <div className="flex flex-col gap-4">
                {dropdownOptions.map((option) => (
                    <div
                        className="flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-1"
                        key={option.id}
                    >
                        <MyInput
                            inputType="text"
                            inputPlaceholder={option.value}
                            input={option.value}
                            onChangeFunction={(e) =>
                                handleOptionValueChange(option.id, e.target.value)
                            }
                            disabled={option.disabled}
                            className="size-fit border-none pl-0"
                        />
                        <div className="flex items-center gap-6">
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="secondary"
                                className="h-6 min-w-6 !rounded-sm px-1"
                                onClick={() => handleEditClick(option.id)}
                            >
                                <PencilSimple size={32} />
                            </MyButton>
                            {dropdownOptions.length > 1 && (
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="secondary"
                                    onClick={() => handleDeleteOption(option.id)}
                                    className="h-6 min-w-6 !rounded-sm px-1"
                                >
                                    <TrashSimple className="!size-4 text-danger-500" />
                                </MyButton>
                            )}
                            <DotsSixVertical size={20} />
                        </div>
                    </div>
                ))}
            </div>
            <MyButton
                type="button"
                scale="small"
                buttonType="secondary"
                className="mt-2 w-20 min-w-4 border-none font-thin !text-primary-500"
                onClick={handleAddDropdownOption}
            >
                <Plus size={18} />
                Add
            </MyButton>
            {dropdownOptions.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                    <Label className="text-sm font-medium">Default Value (Optional)</Label>
                    <Select value={defaultValue} onValueChange={setDefaultValue}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select default option" />
                        </SelectTrigger>
                        <SelectContent>
                            {dropdownOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.value}>
                                    {opt.value}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );

    const renderDefaultValueInput = () => {
        switch (selectedType) {
            case 'text':
                return (
                    <div className="mt-2 flex flex-col gap-1">
                        <Label className="text-sm font-medium">Default Value (Optional)</Label>
                        <MyInput
                            inputType="text"
                            inputPlaceholder="Enter default value"
                            input={defaultValue}
                            onChangeFunction={(e) => setDefaultValue(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                    </div>
                );
            case 'textarea':
                return (
                    <div className="mt-2 flex flex-col gap-1">
                        <Label className="text-sm font-medium">Default Value (Optional)</Label>
                        <textarea
                            placeholder="Enter default value"
                            value={defaultValue}
                            onChange={(e) => setDefaultValue(e.target.value)}
                            className="min-h-[60px] w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                            rows={3}
                        />
                    </div>
                );
            case 'number':
                return (
                    <div className="mt-2 flex flex-col gap-1">
                        <Label className="text-sm font-medium">Default Value (Optional)</Label>
                        <MyInput
                            inputType="number"
                            inputPlaceholder="Enter default number"
                            input={defaultValue}
                            onChangeFunction={(e) => setDefaultValue(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                    </div>
                );
            case 'email':
                return (
                    <div className="mt-2 flex flex-col gap-1">
                        <Label className="text-sm font-medium">Default Value (Optional)</Label>
                        <MyInput
                            inputType="email"
                            inputPlaceholder="Enter default email"
                            input={defaultValue}
                            onChangeFunction={(e) => setDefaultValue(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                    </div>
                );
            case 'url':
                return (
                    <div className="mt-2 flex flex-col gap-1">
                        <Label className="text-sm font-medium">Default Value (Optional)</Label>
                        <MyInput
                            inputType="url"
                            inputPlaceholder="Enter default URL"
                            input={defaultValue}
                            onChangeFunction={(e) => setDefaultValue(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                    </div>
                );
            case 'phone':
                return (
                    <div className="mt-2 flex flex-col gap-1">
                        <Label className="text-sm font-medium">Default Value (Optional)</Label>
                        <MyInput
                            inputType="tel"
                            inputPlaceholder="Enter default phone number"
                            input={defaultValue}
                            onChangeFunction={(e) => setDefaultValue(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                    </div>
                );
            case 'date':
                return (
                    <div className="mt-2 flex flex-col gap-1">
                        <Label className="text-sm font-medium">Default Value (Optional)</Label>
                        <input
                            type="date"
                            value={defaultValue}
                            onChange={(e) => setDefaultValue(e.target.value)}
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        />
                    </div>
                );
            case 'checkbox':
                return (
                    <div className="mt-2 flex items-center gap-2">
                        <Label className="text-sm font-medium">Default Value:</Label>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={checkboxDefault}
                                onCheckedChange={(checked) =>
                                    setCheckboxDefault(checked === true)
                                }
                            />
                            <span className="text-sm">
                                {checkboxDefault ? 'Checked' : 'Unchecked'}
                            </span>
                        </div>
                    </div>
                );
            case 'file':
                return (
                    <div className="mt-2 flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-sm font-medium">
                                Allowed File Types (leave empty for all)
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {COMMON_FILE_TYPES.map((ft) => (
                                    <label
                                        key={ft.value}
                                        className="flex cursor-pointer items-center gap-1"
                                    >
                                        <Checkbox
                                            checked={allowedFileTypes.includes(ft.value)}
                                            onCheckedChange={() => toggleFileType(ft.value)}
                                        />
                                        <span className="text-xs">{ft.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-sm font-medium">Max File Size (MB)</Label>
                            <MyInput
                                inputType="number"
                                inputPlaceholder="5"
                                input={String(maxSizeMB)}
                                onChangeFunction={(e) =>
                                    setMaxSizeMB(Number(e.target.value) || 5)
                                }
                                size="large"
                                className="w-32"
                            />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="flex max-h-[80vh] flex-col p-0">
                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">
                    Add Custom Field
                </h1>
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
                    <div className="flex flex-col gap-1">
                        <Label className="text-sm font-medium">Field Type</Label>
                        <Select
                            value={selectedType}
                            onValueChange={(val) => {
                                setSelectedType(val as CustomFieldType);
                                setDropdownOptions([]);
                                setDefaultValue('');
                                setCheckboxDefault(false);
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
                    </div>

                    <div className="flex flex-col gap-1">
                        <h1>
                            Field Name
                            <span className="text-subtitle text-danger-600">*</span>
                        </h1>
                        <MyInput
                            inputType="text"
                            inputPlaceholder="Type Here"
                            input={fieldName}
                            onChangeFunction={(e) => setFieldName(e.target.value)}
                            size="large"
                            className="w-full"
                        />
                        {fieldName.length > 0 && !isNameValid && (
                            <p className="text-caption text-danger-600">
                                This field name is already taken
                            </p>
                        )}
                    </div>

                    {hasOptionsType(selectedType) && renderOptionsEditor()}

                    {renderDefaultValueInput()}

                    <div className="flex justify-center">
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="primary"
                            className="mt-4 w-fit"
                            onClick={handleDone}
                            disable={!isNameValid}
                        >
                            Done
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
