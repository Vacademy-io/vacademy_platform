import React from 'react';
import { Registration } from '../../../-types/registration-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    MAX_LENGTH,
    GENDER_OPTIONS,
    NATIONALITY_OPTIONS,
    RELIGION_OPTIONS,
    CATEGORY_OPTIONS,
    BLOOD_GROUP_OPTIONS,
    MOTHER_TONGUE_OPTIONS,
    ID_TYPE_OPTIONS,
} from '@/utils/form-validation';
import AadhaarInput from '@/components/design-system/aadhaar-input';

interface SectionProps {
    formData: Partial<Registration>;
    updateFormData: (data: Partial<Registration>) => void;
}

export const StudentDetailsSection: React.FC<SectionProps> = ({ formData, updateFormData }) => {
    // Get levels from institute store
    const { getAllLevels } = useInstituteDetailsStore();
    const levels = getAllLevels();

    return (
        <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase text-neutral-500">
                    Basic Information
                </h4>

                <div>
                    <Label className="mb-1 block text-sm font-medium text-neutral-700">
                        Full Name <span className="text-red-500">*</span> (As per Birth Certificate)
                    </Label>
                    <Input
                        type="text"
                        placeholder="Enter student's full name"
                        value={formData.studentName || ''}
                        onChange={(e) => updateFormData({ studentName: e.target.value })}
                        maxLength={MAX_LENGTH.NAME}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Date of Birth <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="date"
                            value={formData.dateOfBirth || ''}
                            onChange={(e) => updateFormData({ dateOfBirth: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Gender <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-4 pt-2">
                            {GENDER_OPTIONS.map((gender) => (
                                <label key={gender} className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="gender"
                                        className="size-4 text-primary-600 focus:ring-primary-500"
                                        checked={formData.gender === gender}
                                        onChange={() => updateFormData({ gender: gender as any })}
                                    />
                                    <span className="text-sm text-neutral-700">
                                        {gender.charAt(0) + gender.slice(1).toLowerCase()}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Demographics */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase text-neutral-500">Demographics</h4>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Nationality <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.nationality || 'Indian'}
                            onValueChange={(value) => updateFormData({ nationality: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select nationality" />
                            </SelectTrigger>
                            <SelectContent>
                                {NATIONALITY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Religion
                        </Label>
                        <Select
                            value={formData.religion || ''}
                            onValueChange={(value) => updateFormData({ religion: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {RELIGION_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Category <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.category || ''}
                            onValueChange={(value) => updateFormData({ category: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-neutral-500">
                            ({CATEGORY_OPTIONS.join('/')})
                        </p>
                    </div>
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Blood Group
                        </Label>
                        <Select
                            value={formData.bloodGroup || ''}
                            onValueChange={(value) => updateFormData({ bloodGroup: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {BLOOD_GROUP_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-neutral-500">
                            ({BLOOD_GROUP_OPTIONS.join('/')})
                        </p>
                    </div>

                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Mother Tongue
                        </Label>
                        <Select
                            value={formData.motherTongue || ''}
                            onValueChange={(value) => updateFormData({ motherTongue: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {MOTHER_TONGUE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Languages Known
                        </label>
                        <div className="flex gap-4 pt-2">
                            {['Hindi', 'English', 'Regional'].map((lang) => (
                                <label key={lang} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-neutral-700">{lang}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Identification */}
            <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-neutral-500">
                    <span className="i-ph-identification-card size-4" />
                    Identification
                </h4>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            ID Type
                        </Label>
                        <Select
                            value={formData.idType || ''}
                            onValueChange={(value) => {
                                updateFormData({ idType: value as any });
                                // Clear ID number when type changes
                                if (value !== formData.idType) {
                                    updateFormData({ idType: value as any, idNumber: '' });
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select ID Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {ID_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        {formData.idType === 'AADHAR_CARD' ? (
                            <AadhaarInput
                                name="idNumber"
                                value={formData.idNumber || ''}
                                onChange={(_name, value) => updateFormData({ idNumber: value })}
                                label="Aadhaar Number"
                            />
                        ) : (
                            <>
                                <label className="mb-1 block text-sm font-medium text-neutral-700">
                                    ID Number
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="Enter ID number"
                                    value={formData.idNumber || ''}
                                    onChange={(e) => updateFormData({ idNumber: e.target.value })}
                                    maxLength={MAX_LENGTH.GENERAL}
                                />
                            </>
                        )}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Languages Known
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            placeholder="E.g., English, Hindi, Marathi"
                            value={formData.languagesKnown || ''}
                            onChange={(e) =>
                                updateFormData({ languagesKnown: e.target.value.split(',') })
                            }
                            maxLength={MAX_LENGTH.GENERAL}
                        />
                    </div>
                </div>
            </div>

            {/* Health Information */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase text-neutral-500">
                    Health Information
                </h4>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Medical Conditions / Allergies (if any)
                        </label>
                        <textarea
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            rows={3}
                            placeholder="E.g., Asthma, Diabetes, Food allergies, etc."
                            value={formData.medicalConditions || ''}
                            onChange={(e) => updateFormData({ medicalConditions: e.target.value })}
                            maxLength={MAX_LENGTH.TEXTAREA}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Dietary Restrictions
                        </label>
                        <textarea
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            rows={3}
                            placeholder="E.g., Vegetarian, No nuts, etc."
                            value={formData.dietaryRestrictions || ''}
                            onChange={(e) =>
                                updateFormData({ dietaryRestrictions: e.target.value })
                            }
                            maxLength={MAX_LENGTH.TEXTAREA}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
