import React from 'react';
import { Registration } from '../../../-types/registration-types';
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

export const PaymentSection: React.FC<SectionProps> = ({ formData, updateFormData }) => {
    const isPaid = formData.feeStatus === 'PAID';

    return (
        <div className="space-y-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-neutral-500">
                <span className="i-ph-credit-card size-4" />
                Application Fee Payment
            </h4>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="block text-sm font-medium text-neutral-500">
                            Application Fee
                        </span>
                        <span className="text-2xl font-bold text-neutral-900">₹ 500.00</span>
                    </div>
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                        ${
                            isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}
                    >
                        {isPaid ? 'PAID' : 'PENDING'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                    <Label className="mb-1 block text-sm font-medium text-neutral-700">
                        Payment Mode <span className="text-red-500">*</span>
                    </Label>
                    <Select
                        value={formData.paymentMode || ''}
                        onValueChange={(value) => updateFormData({ paymentMode: value })}
                        disabled={isPaid}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="UPI">UPI</SelectItem>
                            <SelectItem value="CARD">Credit/Debit Card</SelectItem>
                            <SelectItem value="NET_BANKING">Net Banking</SelectItem>
                            <SelectItem value="CHEQUE">Cheque/DD</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Transaction / Reference ID
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                        placeholder="Enter transaction ID"
                        value={formData.transactionId || ''}
                        onChange={(e) => updateFormData({ transactionId: e.target.value })}
                        disabled={isPaid}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                        value={formData.paymentDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => updateFormData({ paymentDate: e.target.value })}
                        disabled={isPaid}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Payer Name
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                        placeholder="Enter payer name"
                        value={formData.payerName || ''}
                        onChange={(e) => updateFormData({ payerName: e.target.value })}
                        disabled={isPaid}
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="markAsPaid"
                    className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    checked={isPaid}
                    onChange={(e) =>
                        updateFormData({ feeStatus: e.target.checked ? 'PAID' : 'PENDING' })
                    }
                />
                <label htmlFor="markAsPaid" className="text-sm text-neutral-700">
                    Mark as Paid (For admin use only)
                </label>
            </div>
        </div>
    );
};
