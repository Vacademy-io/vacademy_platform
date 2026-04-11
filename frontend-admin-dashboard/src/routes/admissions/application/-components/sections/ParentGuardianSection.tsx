import React from 'react';
import { Registration } from '../../../-types/registration-types';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MAX_LENGTH, isValidEmail } from '@/utils/form-validation';
import PhoneNumberInput from '@/components/design-system/phone-number-input';

interface SectionProps {
    formData: Partial<Registration>;
    updateFormData: (data: Partial<Registration>) => void;
}

export const ParentGuardianSection: React.FC<SectionProps> = ({ formData, updateFormData }) => {
    const [activeTab, setActiveTab] = React.useState<'FATHER' | 'MOTHER' | 'GUARDIAN'>('FATHER');

    const updateParentInfo = (
        parentType: 'fatherInfo' | 'motherInfo' | 'guardianInfo',
        field: string,
        value: string
    ) => {
        const currentInfo = (formData[parentType] as any) || {};
        updateFormData({
            [parentType]: {
                ...currentInfo,
                [field]: value,
            },
        });
    };

    const getMaxLength = (type: string, label: string): number | undefined => {
        if (type === 'email') return MAX_LENGTH.EMAIL;
        if (type === 'tel') return MAX_LENGTH.PHONE;
        if (label.toLowerCase().includes('name')) return MAX_LENGTH.NAME;
        return MAX_LENGTH.GENERAL;
    };

    const renderField = (
        label: string,
        value: string,
        onChange: (val: string) => void,
        placeholder: string = '',
        required: boolean = false,
        type: string = 'text',
        options?: string[]
    ) => (
        <div>
            <Label className="mb-1 block text-sm font-medium text-neutral-700">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {options ? (
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                                {opt}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <Input
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={getMaxLength(type, label)}
                />
            )}
        </div>
    );

    const renderParentForm = (
        type: 'fatherInfo' | 'motherInfo' | 'guardianInfo',
        title: string
    ) => {
        const data = (formData[type] as any) || {};
        const emailValue = data.email || '';
        const showEmailError = emailValue.length > 0 && !isValidEmail(emailValue);

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {renderField(
                        'Full Name',
                        data.name || '',
                        (v) => updateParentInfo(type, 'name', v),
                        `${title}'s full name`,
                        true
                    )}
                    <PhoneNumberInput
                        name={`${type}.mobile`}
                        value={data.mobile || ''}
                        onChange={(_name, value) => updateParentInfo(type, 'mobile', value)}
                        label="Mobile Number"
                        required
                        placeholder="Enter mobile number"
                    />
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Email Address{' '}
                            {type === 'fatherInfo' && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                            type="email"
                            placeholder="example@email.com"
                            value={emailValue}
                            onChange={(e) => updateParentInfo(type, 'email', e.target.value)}
                            maxLength={MAX_LENGTH.EMAIL}
                            className={showEmailError ? 'border-red-400 focus:border-red-500 focus:ring-red-300' : ''}
                        />
                        {showEmailError && (
                            <span className="text-xs text-red-500">Enter a valid email address</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="border-b border-neutral-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {[
                        { id: 'FATHER', name: 'Father Details' },
                        { id: 'MOTHER', name: 'Mother Details' },
                        { id: 'GUARDIAN', name: 'Guardian Details' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                                ${
                                    activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
                                }
                            `}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="mt-4">
                {activeTab === 'FATHER' && renderParentForm('fatherInfo', 'Father')}
                {activeTab === 'MOTHER' && renderParentForm('motherInfo', 'Mother')}
                {activeTab === 'GUARDIAN' && renderParentForm('guardianInfo', 'Guardian')}
            </div>
        </div>
    );
};
