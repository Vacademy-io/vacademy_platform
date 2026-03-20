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
                />
            )}
        </div>
    );

    const renderParentForm = (
        type: 'fatherInfo' | 'motherInfo' | 'guardianInfo',
        title: string
    ) => {
        const data = (formData[type] as any) || {};

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
                    {renderField(
                        'Mobile Number',
                        data.mobile || '',
                        (v) => updateParentInfo(type, 'mobile', v),
                        '+91 XXXXX XXXXX',
                        true,
                        'tel'
                    )}
                    {renderField(
                        'Email Address',
                        data.email || '',
                        (v) => updateParentInfo(type, 'email', v),
                        'example@email.com',
                        type === 'fatherInfo',
                        'email'
                    )}
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
