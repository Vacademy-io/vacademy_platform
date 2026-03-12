import React, { useState, useMemo, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConcessionDialog } from './ConcessionDialog';
import { ConcessionBadge } from './ConcessionBadge';
import {
    ConcessionRequest,
    ConcessionFormValues,
    CONCESSION_CATEGORIES,
} from '@/routes/admissions/-types/fee-concession-types';
import { createCPO, getInstituteId } from '@/routes/financial-management/fee-plans/-services/cpo-services';
import type { CreateCPORequest } from '@/routes/financial-management/fee-plans/-types/cpo-types';

// Generate installments with valid due dates based on plan type
function generateInstallmentsForFee(amount: number, plan: string) {
    const planMap: Record<string, { count: number; months: number[] }> = {
        Annual: { count: 1, months: [4] }, // April
        'Half-Yearly': { count: 2, months: [4, 10] }, // Apr, Oct
        Quarterly: { count: 4, months: [4, 7, 10, 1] }, // Apr, Jul, Oct, Jan
        Monthly: { count: 12, months: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] },
    };
    const defaultConfig = { count: 1, months: [4] };
    const config = planMap[plan] ?? defaultConfig;
    const perInstallment = Math.floor(amount / config.count);
    const remainder = amount - perInstallment * config.count;

    return config.months.map((month, i) => {
        const year = month >= 4 ? 2026 : 2027;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        return {
            installmentNumber: i + 1,
            amount: i === 0 ? perInstallment + remainder : perInstallment,
            dueDate: dateStr,
        };
    });
}

// Shared data with global schema
interface AssignedFee {
    id: string;
    name: string;
    amount: number;
    plan: string;
    isMandatory: boolean;
    dueDetails: string;
}

interface Props {
    formData: any;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

export default function Step5AFeeAssignment({ formData, handleChange }: Props) {
    const [assignedFees, setAssignedFees] = useState<AssignedFee[]>([
        { id: 'f1', name: 'Tuition Fee', amount: 50000, plan: 'Quarterly', isMandatory: true, dueDetails: '4 payments of ₹12,500' },
        { id: 'f2', name: 'Bus Fee', amount: 12000, plan: 'Annual', isMandatory: false, dueDetails: '1 payment of ₹12,000' },
        { id: 'f3', name: 'Computer Fee', amount: 3000, plan: 'Annual', isMandatory: true, dueDetails: '1 payment of ₹3,000' }
    ]);

    const [isChangePlanOpen, setChangePlanOpen] = useState(false);
    const [isAddFeeOpen, setAddFeeOpen] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('Paid');

    // Concession state
    const [concessionDialogOpen, setConcessionDialogOpen] = useState(false);
    const [selectedFeeForConcession, setSelectedFeeForConcession] = useState<AssignedFee | null>(null);
    const [concessions, setConcessions] = useState<Map<string, ConcessionRequest>>(new Map());

    // Compute adjusted amounts
    const getAdjustedAmount = useCallback((fee: AssignedFee) => {
        const concession = concessions.get(fee.id);
        if (!concession) return fee.amount;
        return concession.adjustedAmount;
    }, [concessions]);

    const totalOriginal = useMemo(() => assignedFees.reduce((sum, f) => sum + f.amount, 0), [assignedFees]);
    const totalConcessions = useMemo(() => {
        let total = 0;
        concessions.forEach((c) => { total += c.originalAmount - c.adjustedAmount; });
        return total;
    }, [concessions]);
    const totalNet = totalOriginal - totalConcessions;

    // Compute dynamic payment schedule
    const firstPaymentDue = useMemo(() => {
        let amount = 0;
        assignedFees.forEach((fee) => {
            const adjusted = getAdjustedAmount(fee);
            if (fee.plan === 'Quarterly') {
                amount += adjusted / 4;
            } else {
                amount += adjusted;
            }
        });
        return Math.round(amount);
    }, [assignedFees, getAdjustedAmount]);

    const tuitionQuarterlyAmount = useMemo(() => {
        const tuition = assignedFees.find((f) => f.id === 'f1');
        if (!tuition) return 12500;
        return Math.round(getAdjustedAmount(tuition) / 4);
    }, [assignedFees, getAdjustedAmount]);

    // CPO create mutation for concession submission
    const concessionMutation = useMutation({
        mutationFn: (payload: CreateCPORequest) => createCPO(payload),
        onSuccess: (response, _variables) => {
            // Update local concession state with CPO info
            const fee = selectedFeeForConcession;
            if (!fee) return;
            const cpoStatus = response.status; // ACTIVE or PENDING_APPROVAL
            const concessionStatus = cpoStatus === 'ACTIVE' ? 'APPROVED' : 'PENDING';

            setConcessions((prev) => {
                const next = new Map(prev);
                const existing = next.get(fee.id);
                if (existing) {
                    next.set(fee.id, { ...existing, status: concessionStatus as any, cpoId: response.id, cpoStatus: cpoStatus });
                }
                return next;
            });

            toast.success(
                cpoStatus === 'ACTIVE'
                    ? `Concession approved for ${fee.name}`
                    : `Concession submitted for ${fee.name}`,
                {
                    description: cpoStatus === 'ACTIVE'
                        ? 'Discount applied immediately.'
                        : 'Sent for admin approval.',
                }
            );
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Failed to submit concession');
        },
    });

    const handleConcessionSubmit = (values: ConcessionFormValues) => {
        if (!selectedFeeForConcession) return;

        const fee = selectedFeeForConcession;
        let adjustedAmount: number;
        if (values.concessionType === 'PERCENTAGE') {
            adjustedAmount = Math.max(fee.amount - (fee.amount * values.concessionValue) / 100, 0);
        } else {
            adjustedAmount = Math.max(fee.amount - values.concessionValue, 0);
        }
        adjustedAmount = Math.round(adjustedAmount);

        const categoryLabel = CONCESSION_CATEGORIES.find((c) => c.value === values.category)?.label || values.category;

        // Save concession locally first (as PENDING)
        const newConcession: ConcessionRequest = {
            id: `conc_${fee.id}_${Date.now()}`,
            feeId: fee.id,
            feeName: fee.name,
            originalAmount: fee.amount,
            concessionType: values.concessionType,
            concessionValue: values.concessionValue,
            adjustedAmount,
            reason: values.reason,
            category: values.category,
            status: 'PENDING',
            requestedBy: 'Current User',
            requestedAt: new Date().toISOString(),
        };

        setConcessions((prev) => {
            const next = new Map(prev);
            next.set(fee.id, newConcession);
            return next;
        });

        // Build CPO payload and submit to backend
        const instituteId = getInstituteId();
        if (!instituteId) {
            toast.error('Institute ID not found');
            return;
        }

        const installments = generateInstallmentsForFee(adjustedAmount, fee.plan);
        const discountType = values.concessionType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT';

        const cpoPayload: CreateCPORequest = {
            name: `Concession - ${fee.name} - ${categoryLabel}`,
            instituteId,
            feeTypes: [{
                name: fee.name,
                code: `FEE_${fee.name.replace(/\s+/g, '_').toUpperCase()}_DISC`,
                description: `${fee.name} with ${values.concessionType === 'PERCENTAGE' ? `${values.concessionValue}%` : `₹${values.concessionValue}`} discount. Reason: ${values.reason}`,
                status: 'ACTIVE',
                assignedFeeValue: {
                    amount: adjustedAmount,
                    original_amount: fee.amount,
                    discount_type: discountType,
                    discount_value: values.concessionValue,
                    noOfInstallments: installments.length,
                    hasInstallment: installments.length > 1,
                    isRefundable: false,
                    hasPenalty: false,
                    status: 'ACTIVE',
                    installments,
                },
            }],
        };

        concessionMutation.mutate(cpoPayload);
    };

    const getConcessionActionLabel = (feeId: string) => {
        const concession = concessions.get(feeId);
        if (!concession) return 'Apply Concession';
        if (concession.status === 'PENDING') return 'Edit Concession';
        return 'View Concession';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header Information Box */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-5 flex flex-wrap gap-8 items-center text-sm">
                <div>
                    <span className="text-gray-500 font-medium block text-xs">Student</span>
                    <strong className="text-gray-900">{formData.studentFirstName} {formData.studentLastName || formData.fatherName}</strong>
                </div>
                <div>
                    <span className="text-gray-500 font-medium block text-xs">Class</span>
                    <strong className="text-gray-900">{formData.studentClass || 'Class 1'}</strong>
                </div>
                <div>
                    <span className="text-gray-500 font-medium block text-xs">Admission Type</span>
                    <strong className="text-gray-900">{formData.admissionType || 'Day Scholar'}</strong>
                </div>
                <div>
                    <span className="text-gray-500 font-medium block text-xs">Transport</span>
                    <strong className="text-gray-900">{formData.transport || 'Yes'}</strong>
                </div>
                <div className="ml-auto text-right">
                    <span className="text-gray-500 font-medium block text-xs">Academic Year</span>
                    <strong className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded">2025-26</strong>
                </div>
            </div>

            {/* Applicable Fees Section */}
            <div>
                <h3 className="text-base font-semibold text-gray-800 border-b pb-2 mb-4">ASSIGNED FEES</h3>
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-5 py-3 font-semibold text-gray-600">Fee Type</th>
                                <th className="px-5 py-3 font-semibold text-gray-600">Amount</th>
                                <th className="px-5 py-3 font-semibold text-gray-600">Installment Plan</th>
                                <th className="px-5 py-3 font-semibold text-gray-600">Details</th>
                                <th className="px-5 py-3 font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {assignedFees.map(fee => {
                                const concession = concessions.get(fee.id);
                                return (
                                    <tr key={fee.id} className="hover:bg-gray-50">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-500">✓</span>
                                                <span className="font-medium text-gray-900">{fee.name}</span>
                                            </div>
                                            <span className="text-xs text-gray-500 block mt-0.5 pl-5">({fee.isMandatory ? 'Mandatory' : 'Selected'})</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {concession ? (
                                                <div>
                                                    <span className="text-gray-400 line-through text-xs">
                                                        ₹ {fee.amount.toLocaleString()}
                                                    </span>
                                                    <div className="font-semibold text-green-700">
                                                        ₹ {concession.adjustedAmount.toLocaleString()}
                                                    </div>
                                                    <ConcessionBadge status={concession.status} />
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-gray-800">
                                                    ₹ {fee.amount.toLocaleString()}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium border border-blue-100">{fee.plan}</span>
                                                <span className="text-yellow-500" title="Default">⭐</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-gray-600">
                                            {fee.dueDetails} <br/>
                                            <span className="text-xs text-gray-400">Due: Starts April</span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button onClick={() => setChangePlanOpen(true)} className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition text-xs border border-transparent hover:border-blue-200">
                                                Change Plan
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedFeeForConcession(fee);
                                                    setConcessionDialogOpen(true);
                                                }}
                                                className="text-purple-600 hover:text-purple-800 font-medium px-2 py-1 ml-1 rounded hover:bg-purple-50 transition text-xs border border-transparent hover:border-purple-200"
                                            >
                                                {getConcessionActionLabel(fee.id)}
                                            </button>
                                            {!fee.isMandatory && (
                                                <button className="text-red-500 hover:text-red-700 font-medium px-2 py-1 ml-1 text-xs">Remove</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-gray-50 border-t">
                                <td colSpan={5} className="px-5 py-3">
                                    <button onClick={() => setAddFeeOpen(true)} className="text-blue-600 font-medium flex items-center gap-1.5 hover:text-blue-800 text-sm">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                        Add Optional Fee (Hostel, Mess, Sports, etc.)
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                        {/* Fee Totals Summary */}
                        {totalConcessions > 0 && (
                            <tfoot className="bg-purple-50/50 border-t-2 border-purple-100">
                                <tr>
                                    <td className="px-5 py-2 text-xs text-gray-600" colSpan={1}>Total Original:</td>
                                    <td className="px-5 py-2 text-xs font-medium text-gray-700" colSpan={4}>₹ {totalOriginal.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="px-5 py-2 text-xs text-gray-600" colSpan={1}>Total Concessions:</td>
                                    <td className="px-5 py-2 text-xs font-medium text-red-600" colSpan={4}>- ₹ {totalConcessions.toLocaleString()}</td>
                                </tr>
                                <tr className="border-t border-purple-200">
                                    <td className="px-5 py-2 text-sm font-bold text-gray-800" colSpan={1}>Net Payable:</td>
                                    <td className="px-5 py-2 text-sm font-bold text-green-700" colSpan={4}>₹ {totalNet.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Schedule Summary Section (Left) */}
                <div>
                    <h3 className="text-base font-semibold text-gray-800 border-b pb-2 mb-4">PAYMENT SCHEDULE (2025-26)</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-2 font-semibold text-gray-600">Due Date</th>
                                    <th className="px-4 py-2 font-semibold text-gray-600">Items</th>
                                    <th className="px-4 py-2 font-semibold text-gray-600 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr>
                                    <td className="px-4 py-3 font-medium text-red-600">10 Apr 2025</td>
                                    <td className="px-4 py-3 text-gray-600">Tuition (Q1), Bus, Computer</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900 border-l">₹ {firstPaymentDue.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-gray-600">10 Jul 2025</td>
                                    <td className="px-4 py-3 text-gray-600">Tuition (Q2)</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700 border-l">₹ {tuitionQuarterlyAmount.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-gray-600">10 Oct 2025</td>
                                    <td className="px-4 py-3 text-gray-600">Tuition (Q3)</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700 border-l">₹ {tuitionQuarterlyAmount.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-gray-600">10 Jan 2026</td>
                                    <td className="px-4 py-3 text-gray-600">Tuition (Q4)</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700 border-l">₹ {tuitionQuarterlyAmount.toLocaleString()}</td>
                                </tr>
                            </tbody>
                            <tfoot className="bg-gray-100 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 font-bold text-gray-800 text-right">TOTAL FEES FOR YEAR:</td>
                                    <td className="px-4 py-3 font-bold text-blue-700 text-right text-lg">₹ {totalNet.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* First Payment Record (Right) */}
                <div>
                    <h3 className="text-base font-semibold text-gray-800 border-b pb-2 mb-4 text-green-700">RECORD FIRST PAYMENT (Due Now)</h3>
                    <div className="border-2 border-green-100 bg-green-50/30 rounded-lg p-5 shadow-sm space-y-5">
                        <div className="flex justify-between items-center bg-white p-3 rounded border shadow-sm">
                            <span className="font-semibold text-gray-700">Amount Due Today:</span>
                            <span className="text-xl font-bold text-green-600">₹ {firstPaymentDue.toLocaleString()}</span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status <span className="text-red-500">*</span></label>
                            <div className="flex gap-4">
                                {['Paid', 'Partial Payment', 'Payment Pending'].map(status => (
                                    <label key={status} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border rounded shadow-sm hover:border-blue-400">
                                        <input type="radio" checked={paymentStatus === status} onChange={() => setPaymentStatus(status)} className="text-blue-600 focus:ring-blue-600 w-4 h-4" />
                                        <span className="text-sm font-medium text-gray-700">{status}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {paymentStatus === 'Paid' && (
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-green-200">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Mode</label>
                                    <select className="w-full border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-blue-600 focus:border-blue-600">
                                        <option>Online Payment</option>
                                        <option>Cash</option>
                                        <option>Cheque / DD</option>
                                        <option>Bank Transfer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Amount Paid (₹)</label>
                                    <input type="text" readOnly value={firstPaymentDue} className="w-full border-gray-300 bg-gray-50 rounded px-2 py-1.5 text-sm font-semibold text-gray-800 outline-none" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction ID / Ref. No.</label>
                                    <input type="text" placeholder="e.g. TXN123456789" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-blue-600 focus:ring-blue-600 outline-none" />
                                </div>
                            </div>
                        )}

                        {paymentStatus === 'Partial Payment' && (
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-green-200">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Amount Paid Now (₹) *</label>
                                    <input type="text" placeholder="15000" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-blue-600 focus:ring-blue-600 outline-none font-semibold text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Remaining Balance expected by</label>
                                    <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 outline-none" />
                                </div>
                            </div>
                        )}

                        {paymentStatus === 'Payment Pending' && (
                            <div className="pt-2 border-t border-red-100 flex items-center gap-2 text-yellow-700 bg-yellow-50 p-2 text-sm rounded border border-yellow-200">
                                <span className="font-bold text-lg">⚠️</span> Admission will proceed, but invoice will be marked as unpaid.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Concession Dialog */}
            {selectedFeeForConcession && (
                <ConcessionDialog
                    open={concessionDialogOpen}
                    onOpenChange={setConcessionDialogOpen}
                    fee={selectedFeeForConcession}
                    onSubmit={handleConcessionSubmit}
                />
            )}

            {/* Change Installment Plan Modal (Mock) */}
            {isChangePlanOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between border-b px-5 py-4 bg-gray-50">
                            <h3 className="font-bold text-gray-800">Change Installment Plan</h3>
                            <button onClick={() => setChangePlanOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600 mb-2">Changing plan for: <strong>Tuition Fee</strong></p>
                            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="plan" className="mt-1" />
                                <div><strong className="block text-sm">Annual</strong><span className="text-xs text-gray-500">1 payment of ₹50,000</span></div>
                            </label>
                             <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="plan" className="mt-1" />
                                <div><strong className="block text-sm">Term-wise</strong><span className="text-xs text-gray-500">3 payments of ₹16,666</span></div>
                            </label>
                            <label className="flex items-start gap-3 p-3 border border-blue-500 bg-blue-50 rounded-lg cursor-pointer">
                                <input type="radio" name="plan" checked readOnly className="mt-1 text-blue-600" />
                                <div className="flex-1"><strong className="block text-sm text-blue-800">Quarterly ⭐ Recommended</strong><span className="text-xs text-blue-600 block">4 payments of ₹12,500</span></div>
                            </label>
                             <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="plan" className="mt-1" />
                                <div><strong className="block text-sm">Monthly</strong><span className="text-xs text-gray-500">12 payments of ₹4,166</span></div>
                            </label>
                        </div>
                        <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2">
                             <button onClick={() => setChangePlanOpen(false)} className="px-4 py-2 bg-white border rounded text-sm font-medium hover:bg-gray-50">Cancel</button>
                             <button onClick={() => setChangePlanOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Apply Plan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Fee Modal (Mock) */}
            {isAddFeeOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
                        <div className="flex items-center justify-between border-b px-5 py-4 bg-gray-50">
                            <h3 className="font-bold text-gray-800">Add Optional Fee</h3>
                            <button onClick={() => setAddFeeOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Select Fee Type</label>
                                <select className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-blue-600">
                                    <option>Hostel Fee (₹ 60,000)</option>
                                    <option>Mess Fee (₹ 24,000)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Payment Plan</label>
                                <select className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-blue-600">
                                    <option>Monthly (12 payments of ₹5,000) ⭐</option>
                                    <option>Quarterly (4 payments of ₹15,000)</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2">
                             <button onClick={() => setAddFeeOpen(false)} className="px-4 py-2 bg-white border rounded text-sm font-medium hover:bg-gray-50">Cancel</button>
                             <button onClick={() => setAddFeeOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Add Fee</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
