// @ts-nocheck
import React, { useEffect, useState } from 'react';
import type { CreateCPOPayload } from '../-types/cpo-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// ─── Types for the form ─────────────────────────────────────────────────────────

export interface InstallmentForm {
    id: number;
    amount: number | string;
    startDate?: string;
    dueDate: string;
    endDate?: string;
}

export interface FeeTypeForm {
    id: number;
    name: string;
    code: string;
    description: string;
    amount: number | string;
    hasInstallment: boolean;
    isRefundable: boolean;
    hasPenalty: boolean;
    penaltyPercentage: number | string;
    noOfInstallments: number | string;
    installments: InstallmentForm[];
}

export interface CPOForm {
    name: string;
    status: string;
    packageSessionId: string;
    feeTypes: FeeTypeForm[];
}

export interface BatchOption {
    id: string;
    label: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const INSTALLMENT_PRESETS = [
    { label: 'Annual', count: 1 },
    { label: 'Half-Yearly', count: 2 },
    { label: 'Quarterly', count: 4 },
    { label: 'Monthly', count: 12 },
    { label: 'Custom', count: null },
];

const FEE_TYPE_PRESETS = [
    {
        label: 'Tuition Fee',
        name: 'Tuition Fee',
        code: 'TUITION_FEE',
        description: 'Regular tuition charges for the academic year',
        hasInstallment: true,
        isRefundable: false,
        hasPenalty: true,
        penaltyPercentage: 5,
        noOfInstallments: 4,
    },
    {
        label: 'Exam Fee',
        name: 'Exam Fee',
        code: 'EXAM_FEE',
        description: 'Examination and assessment charges',
        hasInstallment: false,
        isRefundable: false,
        hasPenalty: false,
        penaltyPercentage: '',
        noOfInstallments: 1,
    },
    {
        label: 'Library Fee',
        name: 'Library Fee',
        code: 'LIBRARY_FEE',
        description: 'Library access and resource charges',
        hasInstallment: false,
        isRefundable: false,
        hasPenalty: false,
        penaltyPercentage: '',
        noOfInstallments: 1,
    },
    {
        label: 'Transport Fee',
        name: 'Transport Fee',
        code: 'TRANSPORT_FEE',
        description: 'School transportation charges',
        hasInstallment: true,
        isRefundable: false,
        hasPenalty: false,
        penaltyPercentage: '',
        noOfInstallments: 12,
    },
    {
        label: 'Hostel Fee',
        name: 'Hostel Fee',
        code: 'HOSTEL_FEE',
        description: 'Hostel accommodation charges',
        hasInstallment: true,
        isRefundable: true,
        hasPenalty: false,
        penaltyPercentage: '',
        noOfInstallments: 2,
    },
    {
        label: 'Lab Fee',
        name: 'Lab Fee',
        code: 'LAB_FEE',
        description: 'Laboratory usage and material charges',
        hasInstallment: false,
        isRefundable: false,
        hasPenalty: false,
        penaltyPercentage: '',
        noOfInstallments: 1,
    },
];

// ─── Payload builder ────────────────────────────────────────────────────────────

export function buildCreateCPOPayload(form: CPOForm): CreateCPOPayload {
    return {
        id: null,
        name: form.name,
        institute_id: '',
        default_payment_option_id: null,
        status: form.status,
        created_by: null,
        approved_by: null,
        fee_types: form.feeTypes.map((ft) => ({
            id: null,
            name: ft.name,
            code: ft.code || ft.name.toUpperCase().replace(/\s+/g, '_'),
            description: ft.description,
            status: 'ACTIVE',
            assigned_fee_value: {
                id: null,
                amount: parseFloat(ft.amount as string) || 0,
                no_of_installments: ft.hasInstallment ? ft.installments.length : 1,
                has_installment: ft.hasInstallment,
                is_refundable: ft.isRefundable,
                has_penalty: ft.hasPenalty,
                penalty_percentage: ft.hasPenalty
                    ? parseFloat(ft.penaltyPercentage as string) || 0
                    : null,
                status: 'ACTIVE',
                installments: ft.hasInstallment
                    ? ft.installments.map((inst, idx) => ({
                          id: null,
                          installment_number: idx + 1,
                          amount: parseFloat(inst.amount as string) || 0,
                          status: 'PENDING',
                          start_date: inst.startDate || null,
                          end_date: inst.endDate || inst.dueDate || null,
                          due_date: inst.dueDate || null,
                      }))
                    : [],
                original_amount: parseFloat(ft.amount as string) || 0,
                discount_type: null,
                discount_value: 0,
            },
        })),
        package_session_links: [
            {
                enroll_invite_id: null,
                package_session_id: form.packageSessionId,
            },
        ],
    };
}

function generateInstallments(count: number, totalAmount: number): InstallmentForm[] {
    const today = new Date();
    const perInstallment = totalAmount ? Math.floor(totalAmount / count) : 0;
    const remainder = totalAmount ? totalAmount - perInstallment * count : 0;
    return Array.from({ length: count }, (_, i) => {
        const startDay = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const dueDay = new Date(today.getFullYear(), today.getMonth() + i, 10);
        const startDate = startDay.toISOString().split('T')[0];
        const dueDate = dueDay.toISOString().split('T')[0];
        return {
            id: i + 1,
            amount: i === 0 ? perInstallment + remainder : perInstallment,
            startDate,
            dueDate,
            endDate: dueDate,
        };
    });
}

function createEmptyFeeType(id: number): FeeTypeForm {
    return {
        id,
        name: '',
        code: '',
        description: '',
        amount: '',
        hasInstallment: true,
        isRefundable: false,
        hasPenalty: false,
        penaltyPercentage: '',
        noOfInstallments: 4,
        installments: generateInstallments(4, 0),
    };
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div
            onClick={() => onChange(!value)}
            className="relative flex-shrink-0 cursor-pointer"
            style={{ width: 38, height: 20 }}
        >
            <div
                className={`rounded-full transition-colors ${value ? 'bg-primary-500' : 'bg-gray-300'}`}
                style={{
                    width: 38,
                    height: 20,
                }}
            />
            <div
                className="absolute top-0.5 rounded-full bg-white shadow transition-all"
                style={{
                    width: 16,
                    height: 16,
                    left: value ? 20 : 2,
                }}
            />
        </div>
    );
}

// ─── Fee Type Editor ────────────────────────────────────────────────────────────

function FeeTypeEditor({
    feeType,
    index,
    onChange,
    onRemove,
    canRemove,
}: {
    feeType: FeeTypeForm;
    index: number;
    onChange: (updated: FeeTypeForm) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    const update = (field: string, value: any) => {
        onChange({ ...feeType, [field]: value });
    };

    const handlePreset = (count: number | null) => {
        if (count !== null) {
            const total = parseFloat(feeType.amount as string) || 0;
            onChange({
                ...feeType,
                noOfInstallments: count,
                installments: generateInstallments(count, total),
            });
        } else {
            // Custom — just reveal the number input without regenerating installments
            update('noOfInstallments', '');
        }
    };

    const handleInstallmentCountChange = (val: string) => {
        const n = parseInt(val);
        if (n > 0 && n <= 60) {
            const total = parseFloat(feeType.amount as string) || 0;
            onChange({
                ...feeType,
                noOfInstallments: n,
                installments: generateInstallments(n, total),
            });
        } else {
            update('noOfInstallments', val);
        }
    };

    const handleAmountChange = (val: string) => {
        const total = parseFloat(val) || 0;
        const count = feeType.installments.length || 1;
        const perInstallment = total ? Math.floor(total / count) : 0;
        const remainder = total ? total - perInstallment * count : 0;
        onChange({
            ...feeType,
            amount: val,
            // Preserve existing dates — only redistribute amounts
            installments: feeType.installments.map((inst, i) => ({
                ...inst,
                amount: i === 0 ? perInstallment + remainder : perInstallment,
            })),
        });
    };

    const updateInstallment = (id: number, field: string, value: any) => {
        onChange({
            ...feeType,
            installments: feeType.installments.map((inst) => {
                if (inst.id !== id) return inst;
                const updated = { ...inst, [field]: value };
                // Keep endDate in sync with dueDate unless user has already diverged them
                if (field === 'dueDate' && inst.endDate === inst.dueDate) {
                    updated.endDate = value;
                }
                return updated;
            }),
        });
    };

    const applyPreset = (preset: any) => {
        if (!preset.name) return; // Custom — leave blank for manual entry
        const count = preset.noOfInstallments ?? 1;
        const currentAmount = parseFloat(feeType.amount as string) || 0;
        onChange({
            ...feeType,
            name: preset.name,
            code: preset.code ?? '',
            description: preset.description ?? '',
            hasInstallment: preset.hasInstallment ?? false,
            isRefundable: preset.isRefundable ?? false,
            hasPenalty: preset.hasPenalty ?? false,
            penaltyPercentage: preset.penaltyPercentage ?? '',
            noOfInstallments: count,
            installments: generateInstallments(count, currentAmount),
        });
    };

    const installmentTotal = feeType.installments.reduce(
        (sum, i) => sum + (parseFloat(i.amount as string) || 0),
        0
    );
    const totalAmount = parseFloat(feeType.amount as string) || 0;
    const diff = totalAmount - installmentTotal;

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200">
            {/* Fee Type Header */}
            <div
                className="flex cursor-pointer items-center justify-between bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-500">
                        {index + 1}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900">
                            {feeType.name || `Fee Type ${index + 1}`}
                        </div>
                        {feeType.amount && (
                            <div className="text-xs text-gray-500">
                                ₹{parseFloat(feeType.amount as string).toLocaleString('en-IN')} ·{' '}
                                {feeType.installments.length} installment
                                {feeType.installments.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canRemove && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                            Remove
                        </button>
                    )}
                    <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </div>
            </div>

            {/* Fee Type Form */}
            {isExpanded && (
                <div className="flex flex-col gap-4 p-4">
                    {/* Quick Presets */}
                    <div>
                        <div className="flex flex-wrap gap-1.5">
                            {FEE_TYPE_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => applyPreset(preset)}
                                    className="cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-primary-400 hover:bg-primary-100 hover:text-primary-500"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name & Description */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Fee Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                placeholder="e.g. Tuition Fee"
                                value={feeType.name}
                                onChange={(e) => update('name', e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Description
                            </Label>
                            <Input
                                placeholder="Brief description"
                                value={feeType.description}
                                onChange={(e) => update('description', e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Total Amount (₹) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="number"
                            placeholder="e.g. 50000"
                            value={feeType.amount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold outline-none transition focus:border-primary-500"
                        />
                    </div>

                    {/* Toggles Row */}
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Toggle
                                value={feeType.hasInstallment}
                                onChange={(v) => update('hasInstallment', v)}
                            />
                            <span className="text-sm font-medium text-gray-700">
                                Has Installments
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Toggle
                                value={feeType.isRefundable}
                                onChange={(v) => update('isRefundable', v)}
                            />
                            <span className="text-sm font-medium text-gray-700">Refundable</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Toggle
                                value={feeType.hasPenalty}
                                onChange={(v) => update('hasPenalty', v)}
                            />
                            <span className="text-sm font-medium text-gray-700">Late Penalty</span>
                        </div>
                        {feeType.hasPenalty && (
                            <div className="flex items-center gap-1">
                                <Input
                                    type="number"
                                    placeholder="%"
                                    value={feeType.penaltyPercentage}
                                    onChange={(e) => update('penaltyPercentage', e.target.value)}
                                    className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none transition focus:border-primary-500"
                                />
                                <span className="text-xs text-gray-500">%</span>
                            </div>
                        )}
                    </div>

                    {/* Installment Configuration */}
                    {feeType.hasInstallment && (
                        <div className="flex flex-col gap-3">
                            {/* Frequency Presets */}
                            <div>
                                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Payment Frequency
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {INSTALLMENT_PRESETS.map((preset) => {
                                        const isActive =
                                            preset.count !== null &&
                                            Number(feeType.noOfInstallments) === preset.count;
                                        return (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => handlePreset(preset.count)}
                                                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                                    isActive
                                                        ? 'border-primary-500 bg-primary-100 text-primary-500'
                                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {preset.label}
                                                {preset.count && (
                                                    <span className="ml-1 opacity-60">
                                                        ({preset.count}x)
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Custom count input */}
                                {![1, 2, 4, 12].includes(Number(feeType.noOfInstallments)) && (
                                    <Input
                                        type="number"
                                        min={1}
                                        max={60}
                                        placeholder="Number of installments"
                                        value={feeType.noOfInstallments}
                                        onChange={(e) =>
                                            handleInstallmentCountChange(e.target.value)
                                        }
                                        className="mt-2 w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
                                    />
                                )}
                            </div>

                            {/* Installment Table */}
                            <div className="overflow-hidden rounded-lg border border-gray-200">
                                {diff !== 0 && totalAmount > 0 && (
                                    <div
                                        className={`px-3 py-2 text-xs font-medium ${
                                            diff > 0
                                                ? 'border-b border-amber-100 bg-amber-50 text-amber-700'
                                                : 'border-b border-red-100 bg-red-50 text-red-700'
                                        }`}
                                    >
                                        {diff > 0
                                            ? `₹${diff.toLocaleString('en-IN')} remaining to allocate`
                                            : `Exceeds total by ₹${Math.abs(diff).toLocaleString('en-IN')}`}
                                    </div>
                                )}
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50">
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                                #
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                                Amount (₹)
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                                Start Date
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                                End Date
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                                Due Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {feeType.installments.map((inst, idx) => (
                                            <tr key={inst.id} className="border-b border-gray-50">
                                                <td className="w-10 px-3 py-2 font-medium text-gray-400">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="number"
                                                        value={inst.amount}
                                                        onChange={(e) =>
                                                            updateInstallment(
                                                                inst.id,
                                                                'amount',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="date"
                                                        value={inst.startDate ?? ''}
                                                        onChange={(e) =>
                                                            updateInstallment(
                                                                inst.id,
                                                                'startDate',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary-500"
                                                    />
                                                </td>

                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="date"
                                                        value={inst.endDate ?? ''}
                                                        onChange={(e) =>
                                                            updateInstallment(
                                                                inst.id,
                                                                'endDate',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="date"
                                                        value={inst.dueDate}
                                                        onChange={(e) =>
                                                            updateInstallment(
                                                                inst.id,
                                                                'dueDate',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary-500"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50">
                                            <td className="px-3 py-2 font-bold text-gray-700">
                                                Total
                                            </td>
                                            <td
                                                className={`px-3 py-2 font-bold ${
                                                    installmentTotal === totalAmount
                                                        ? 'text-green-600'
                                                        : 'text-gray-800'
                                                }`}
                                            >
                                                ₹{installmentTotal.toLocaleString('en-IN')}
                                            </td>
                                            <td />
                                            <td />
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Dialog ────────────────────────────────────────────────────────────────

export default function CreateCPODialog({
    onSave,
    onClose,
    batchOptions,
    defaultPackageSessionId,
    isSaving = false,
}: {
    onSave: (data: CPOForm) => void;
    onClose: () => void;
    batchOptions: BatchOption[];
    defaultPackageSessionId?: string;
    isSaving?: boolean;
}) {
    const [form, setForm] = useState<CPOForm>({
        name: '',
        status: 'ACTIVE',
        packageSessionId: defaultPackageSessionId ?? '',
        feeTypes: [createEmptyFeeType(1)],
    });

    useEffect(() => {
        if (!form.packageSessionId && batchOptions.length > 0) {
            setForm((prev) => ({ ...prev, packageSessionId: batchOptions[0].id }));
        }
    }, [batchOptions, form.packageSessionId]);

    const addFeeType = () => {
        const nextId = Math.max(...form.feeTypes.map((f) => f.id), 0) + 1;
        setForm((prev) => ({
            ...prev,
            feeTypes: [...prev.feeTypes, createEmptyFeeType(nextId)],
        }));
    };

    const removeFeeType = (id: number) => {
        setForm((prev) => ({
            ...prev,
            feeTypes: prev.feeTypes.filter((f) => f.id !== id),
        }));
    };

    const updateFeeType = (id: number, updated: FeeTypeForm) => {
        setForm((prev) => ({
            ...prev,
            feeTypes: prev.feeTypes.map((f) => (f.id === id ? updated : f)),
        }));
    };

    const isValid =
        form.packageSessionId !== '' &&
        form.name.trim() !== '' &&
        form.feeTypes.length > 0 &&
        form.feeTypes.every((ft) => ft.name.trim() !== '' && parseFloat(ft.amount as string) > 0);

    const totalPackageAmount = form.feeTypes.reduce(
        (sum, ft) => sum + (parseFloat(ft.amount as string) || 0),
        0
    );

    const uniqueInstallmentCount = (() => {
        const uniqueDates = new Set<string>();
        form.feeTypes.forEach((ft, ftIdx) => {
            if (ft.hasInstallment) {
                ft.installments.forEach((inst) => {
                    uniqueDates.add(inst.dueDate || `_empty_${ftIdx}_${inst.id}`);
                });
            } else {
                uniqueDates.add(`_lump_${ft.id}`);
            }
        });
        return uniqueDates.size;
    })();

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center"
            style={{
                background: 'rgba(15,23,42,0.55)',
                backdropFilter: 'blur(4px)',
                fontFamily: "'DM Sans', sans-serif",
            }}
        >
            <div className="max-h-[92vh] w-[min(860px,96vw)] overflow-y-auto rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 pb-4 pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary-500">
                                Create Plan
                            </div>
                            <h2 className="text-xl font-extrabold text-gray-900">New Fee Plan</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Summary Bar */}
                {form.feeTypes.length > 0 && (
                    <div className="mx-4 flex items-center gap-6 rounded-xl border border-primary-100 bg-primary-100 px-4 py-3">
                        <div className="flex items-center gap-x-2">
                            <div className="text-sm font-bold uppercase tracking-wider text-primary-500">
                                Fee Types
                            </div>
                            <div className="text-lg font-extrabold text-primary-500">
                                {form.feeTypes.length}
                            </div>
                        </div>
                        <div className="h-8 w-px bg-primary-200" />
                        <div className="flex items-center gap-x-2">
                            <div className="text-sm font-bold uppercase tracking-wider text-primary-500">
                                Total Amount
                            </div>
                            <div className="text-lg font-extrabold text-primary-500">
                                ₹{totalPackageAmount.toLocaleString('en-IN')}
                            </div>
                        </div>
                        <div className="h-8 w-px bg-primary-200" />
                        <div className="flex items-center gap-x-2">
                            <div className="text-sm font-bold uppercase tracking-wider text-primary-500">
                                Payment Dates
                            </div>
                            <div className="text-lg font-extrabold text-primary-500">
                                {uniqueInstallmentCount}
                            </div>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="flex flex-col gap-5 px-6 py-5">
                    {/* Class / Batch Selector */}
                    <div>
                        <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Select Class / Batch <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={form.packageSessionId}
                            onValueChange={(value) =>
                                setForm((prev) => ({ ...prev, packageSessionId: value }))
                            }
                        >
                            <SelectTrigger className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-200">
                                <SelectValue placeholder="Select a class" />
                            </SelectTrigger>
                            <SelectContent className="z-[1200]">
                                {batchOptions.map((opt) => (
                                    <SelectItem key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Package Name & Status */}
                    <div className="grid grid-cols-[1fr_200px] gap-4">
                        <div>
                            <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Package Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                placeholder="e.g. 2026 Elite Fee Plan"
                                value={form.name}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, name: e.target.value }))
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
                            />
                        </div>
                        <div>
                            <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Status
                            </Label>
                            <Select
                                value={form.status}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, status: value }))
                                }
                            >
                                <SelectTrigger className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[1200]">
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Fee Types Section */}
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <Label className="text-sm font-bold text-gray-800">Fee Types</Label>
                            <button
                                type="button"
                                onClick={addFeeType}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-500 transition hover:bg-primary-100 hover:text-primary-500"
                            >
                                <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                                Add Fee Type
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {form.feeTypes.map((ft, idx) => (
                                <FeeTypeEditor
                                    key={ft.id}
                                    feeType={ft}
                                    index={idx}
                                    onChange={(updated) => updateFeeType(ft.id, updated)}
                                    onRemove={() => removeFeeType(ft.id)}
                                    canRemove={form.feeTypes.length > 1}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 flex items-center justify-between border-t border-gray-100 bg-white px-6 py-4">
                    <button
                        onClick={onClose}
                        className="cursor-pointer rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={!isValid || isSaving}
                        className={`cursor-pointer rounded-lg px-6 py-2.5 text-sm font-bold text-white transition ${
                            isValid && !isSaving
                                ? 'bg-gradient-to-r from-primary-400 to-primary-500 shadow-md hover:opacity-90'
                                : 'cursor-not-allowed bg-gray-300'
                        }`}
                    >
                        {isSaving ? 'Saving...' : 'Save Package'}
                    </button>
                </div>
            </div>
        </div>
    );
}
