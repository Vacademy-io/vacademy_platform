import { useState } from 'react';
import { MyInput } from '@/components/design-system/input';
import PhoneNumberInput from '@/components/design-system/phone-number-input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarBlank, Spinner } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getTokenFromCookie, getTokenDecodedData } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { isUnrestrictedFileTypes, type CustomFieldType } from '@/services/custom-field-settings';

interface CustomFieldRendererProps {
    type: CustomFieldType | string;
    name: string;
    value?: string;
    onChange?: (value: string) => void;
    options?: string[];
    required?: boolean;
    disabled?: boolean;
    config?: {
        defaultValue?: string;
        allowedFileTypes?: string[];
        maxSizeMB?: number;
        description?: string;
    };
    onFileUpload?: (file: File) => void;
}

export const CustomFieldRenderer = ({
    type,
    name,
    value,
    onChange,
    options = [],
    required = false,
    disabled = false,
    config,
    onFileUpload,
}: CustomFieldRendererProps) => {
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const { uploadFile, getPublicUrl } = useFileUpload();

    const handleChange = (newValue: string) => {
        onChange?.(newValue);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedFileTypes = config?.allowedFileTypes;
        if (!isUnrestrictedFileTypes(allowedFileTypes) && allowedFileTypes) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            if (!allowedFileTypes.some((t) => t.toLowerCase() === ext)) {
                alert(`File type .${ext} is not allowed. Allowed: ${allowedFileTypes.join(', ')}`);
                e.target.value = '';
                return;
            }
        }

        if (config?.maxSizeMB && file.size > config.maxSizeMB * 1024 * 1024) {
            alert(`File size must be less than ${config.maxSizeMB}MB`);
            e.target.value = '';
            return;
        }

        try {
            let userId = 'anonymous';
            try {
                const token = getTokenFromCookie(TokenKey.accessToken);
                const decoded = token ? getTokenDecodedData(token) : null;
                if (decoded?.user) userId = decoded.user;
            } catch {
                // ignore — fallback to anonymous
            }

            setIsUploading(true);
            const fileId = await uploadFile({
                file,
                setIsUploading,
                userId,
                source: 'CUSTOM_FIELD',
                sourceId: 'CUSTOM_FIELD_VALUE',
                publicUrl: true,
            });

            if (fileId) {
                const publicUrl = await getPublicUrl(fileId);
                const finalValue = publicUrl || fileId;
                setUploadedFileName(file.name);
                handleChange(finalValue);
                onFileUpload?.(file);
            }
        } catch (err) {
            console.error('File upload failed:', err);
            alert('File upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const effectiveType = type === 'textfield' ? 'text' : type;

    switch (effectiveType) {
        case 'text':
            return (
                <MyInput
                    inputType="text"
                    inputPlaceholder={`Enter ${name}`}
                    input={value || ''}
                    onChangeFunction={(e) => handleChange(e.target.value)}
                    size="large"
                    className="w-full"
                    disabled={disabled}
                    required={required}
                />
            );

        case 'number':
            return (
                <MyInput
                    inputType="number"
                    inputPlaceholder={`Enter ${name}`}
                    input={value || ''}
                    onChangeFunction={(e) => handleChange(e.target.value)}
                    size="large"
                    className="w-full"
                    disabled={disabled}
                    required={required}
                />
            );

        case 'email':
            return (
                <MyInput
                    inputType="email"
                    inputPlaceholder={`Enter ${name}`}
                    input={value || ''}
                    onChangeFunction={(e) => handleChange(e.target.value)}
                    size="large"
                    className="w-full"
                    disabled={disabled}
                    required={required}
                />
            );

        case 'url':
            return (
                <MyInput
                    inputType="url"
                    inputPlaceholder={`Enter ${name}`}
                    input={value || ''}
                    onChangeFunction={(e) => handleChange(e.target.value)}
                    size="large"
                    className="w-full"
                    disabled={disabled}
                    required={required}
                />
            );

        case 'phone':
            return (
                <PhoneNumberInput
                    name={name}
                    label=""
                    value={value || ''}
                    onChange={(_n, val) => handleChange(val)}
                    placeholder={`Enter ${name}`}
                    required={required}
                    disabled={disabled}
                />
            );

        case 'date':
            return (
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={disabled}
                            className="flex w-full items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <CalendarBlank size={16} className="text-neutral-500" />
                            {value ? (
                                format(new Date(value), 'PPP')
                            ) : (
                                <span className="text-neutral-400">Pick a date</span>
                            )}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={value ? new Date(value) : undefined}
                            onSelect={(date) => {
                                if (date) {
                                    handleChange(date.toISOString().split('T')[0] ?? '');
                                }
                                setDatePickerOpen(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>
            );

        case 'textarea':
            return (
                <textarea
                    placeholder={`Enter ${name}`}
                    value={value || ''}
                    onChange={(e) => handleChange(e.target.value)}
                    disabled={disabled}
                    required={required}
                    rows={3}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
            );

        case 'checkbox': {
            // Optional long body (e.g. Terms & Conditions) shown above the box.
            // whitespace-pre-line preserves the admin's line breaks; scrolls if long.
            const description = config?.description;
            return (
                <div className="flex flex-col gap-2">
                    {description && (
                        <div className="max-h-60 overflow-y-auto whitespace-pre-line rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                            {description}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={value === 'true'}
                            onCheckedChange={(checked) =>
                                handleChange(checked === true ? 'true' : 'false')
                            }
                            disabled={disabled}
                        />
                        <Label className="text-sm">
                            {name}
                            {required && <span className="text-danger-600"> *</span>}
                        </Label>
                    </div>
                </div>
            );
        }

        case 'dropdown':
            return (
                <Select
                    value={value || ''}
                    onValueChange={handleChange}
                    disabled={disabled}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Select ${name}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((opt, idx) => (
                            <SelectItem key={idx} value={opt}>
                                {opt}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );

        case 'radio':
            // Wrapped in a div so FormControl's Slot doesn't merge
            // id/aria-* directly onto the Radix RadioGroup root.
            return (
                <div>
                    <RadioGroup
                        value={value || ''}
                        onValueChange={handleChange}
                        disabled={disabled}
                        className="flex flex-col gap-2"
                    >
                        {options.map((opt, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                                <RadioGroupItem value={opt} id={`${name}-${idx}`} />
                                <Label htmlFor={`${name}-${idx}`}>{opt}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
            );

        case 'multi_select': {
            // Multi-select checkboxes: value is a JSON array like ["Option1","Option3"]
            let selected: string[] = [];
            try {
                selected = value ? JSON.parse(value) : [];
            } catch {
                selected = value ? [value] : [];
            }
            const toggleOption = (opt: string) => {
                const next = selected.includes(opt)
                    ? selected.filter((s) => s !== opt)
                    : [...selected, opt];
                handleChange(JSON.stringify(next));
            };
            return (
                <div className="flex flex-col gap-2">
                    {options.map((opt, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                            <Checkbox
                                checked={selected.includes(opt)}
                                onCheckedChange={() => toggleOption(opt)}
                                disabled={disabled}
                                id={`${name}-ms-${idx}`}
                            />
                            <Label htmlFor={`${name}-ms-${idx}`}>{opt}</Label>
                        </div>
                    ))}
                </div>
            );
        }

        case 'file': {
            const fileTypes = config?.allowedFileTypes;
            const acceptAttr = isUnrestrictedFileTypes(fileTypes)
                ? undefined
                : fileTypes!.map((t) => `.${t}`).join(',');
            const isValidUrl = value && (value.startsWith('http://') || value.startsWith('https://'));
            return (
                <div className="flex flex-col gap-2">
                    <input
                        type="file"
                        accept={acceptAttr}
                        disabled={disabled || isUploading}
                        onChange={handleFileChange}
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-primary-50 file:px-4 file:py-1 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {isUploading && (
                        <div className="flex items-center gap-2 text-sm text-neutral-600">
                            <Spinner className="size-4 animate-spin" />
                            Uploading...
                        </div>
                    )}
                    {!isUploading && uploadedFileName && (
                        <div className="text-xs text-success-600">
                            Uploaded: {uploadedFileName}
                        </div>
                    )}
                    {!isUploading && !uploadedFileName && isValidUrl && (
                        <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-500 underline"
                        >
                            View current file
                        </a>
                    )}
                    {!isUnrestrictedFileTypes(fileTypes) && (
                        <p className="text-xs text-neutral-500">
                            Allowed: {fileTypes!.join(', ')}
                            {config?.maxSizeMB && ` · Max ${config.maxSizeMB}MB`}
                        </p>
                    )}
                </div>
            );
        }

        default:
            return (
                <MyInput
                    inputType="text"
                    inputPlaceholder={`Enter ${name}`}
                    input={value || ''}
                    onChangeFunction={(e) => handleChange(e.target.value)}
                    size="large"
                    className="w-full"
                    disabled={disabled}
                    required={required}
                />
            );
    }
};
