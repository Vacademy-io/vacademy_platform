import React from 'react';
import { Registration, AddressInfo } from '../../../-types/registration-types';
import { MapPin } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface SectionProps {
    formData: Partial<Registration>;
    updateFormData: (data: Partial<Registration>) => void;
}

export const AddressSection: React.FC<SectionProps> = ({ formData, updateFormData }) => {
    const updateAddress = (
        type: 'currentAddress' | 'permanentAddress',
        field: keyof AddressInfo,
        value: string
    ) => {
        const currentAddress = formData[type] || {
            city: '',
            state: '',
            pinCode: '',
            country: 'India',
        };
        const updatedAddress = {
            ...currentAddress,
            [field]: value,
        } as AddressInfo;

        const updates: Partial<Registration> = {
            [type]: updatedAddress as AddressInfo,
        };

        updateFormData(updates);
    };

    const renderAddressForm = (
        type: 'currentAddress' | 'permanentAddress',
        title: string,
        disabled: boolean = false
    ) => {
        const data: Partial<AddressInfo> = formData[type] || {};
        const updateField = (field: keyof AddressInfo, value: string) =>
            updateAddress(type, field, value);

        return (
            <div className="space-y-4 pt-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-neutral-500">
                    <MapPin className="size-4" />
                    {title}
                </h4>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            House No / Flat No / Building Name{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                            placeholder="e.g., 12-A, Sunrise Apartments"
                            value={data.houseNo || ''}
                            onChange={(e) => updateField('houseNo', e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Street / Road Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                            placeholder="e.g., M.G. Road"
                            value={data.street || ''}
                            onChange={(e) => updateField('street', e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Area / Locality / Sector <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                            placeholder="e.g., Arera Colony"
                            value={data.area || ''}
                            onChange={(e) => updateField('area', e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Landmark
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                            placeholder="e.g., Near City Mall"
                            value={data.landmark || ''}
                            onChange={(e) => updateField('landmark', e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-700">
                                City <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                                placeholder="e.g., Bhopal"
                                value={data.city || ''}
                                onChange={(e) => updateField('city', e.target.value)}
                                disabled={disabled}
                            />
                        </div>
                        <div>
                            <Label className="mb-1 block text-sm font-medium text-neutral-700">
                                State <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={data.state || ''}
                                onValueChange={(value) => updateField('state', value)}
                                disabled={disabled}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Madhya Pradesh">Madhya Pradesh</SelectItem>
                                    <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                                    <SelectItem value="Delhi">Delhi</SelectItem>
                                    {/* Add more states as needed */}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Pincode <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                            placeholder="e.g., 462001"
                            value={data.pinCode || ''}
                            onChange={(e) => {
                                updateField('pinCode', e.target.value);
                            }}
                            disabled={disabled}
                        />
                        <p className="mt-1 text-xs text-neutral-500">6 digits</p>
                    </div>
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Country
                        </Label>
                        <Select
                            value={data.country || 'India'}
                            onValueChange={(value) => updateField('country', value)}
                            disabled={disabled}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="India">India</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="space-y-6">
                {renderAddressForm('currentAddress', 'Residential Address (Current)')}
            </div>
        </div>
    );
};
