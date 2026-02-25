import React, { useState } from 'react';

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
                            {assignedFees.map(fee => (
                                <tr key={fee.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-500">✓</span>
                                            <span className="font-medium text-gray-900">{fee.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 block mt-0.5 pl-5">({fee.isMandatory ? 'Mandatory' : 'Selected'})</span>
                                    </td>
                                    <td className="px-5 py-4 font-semibold text-gray-800">
                                        ₹ {fee.amount.toLocaleString()}
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
                                        {!fee.isMandatory && (
                                            <button className="text-red-500 hover:text-red-700 font-medium px-2 py-1 ml-2 text-xs">Remove</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50 border-t">
                                <td colSpan={5} className="px-5 py-3">
                                    <button onClick={() => setAddFeeOpen(true)} className="text-blue-600 font-medium flex items-center gap-1.5 hover:text-blue-800 text-sm">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                        Add Optional Fee (Hostel, Mess, Sports, etc.)
                                    </button>
                                </td>
                            </tr>
                        </tbody>
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
                                    <td className="px-4 py-3 text-right font-bold text-gray-900 border-l">₹ 27,500</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-gray-600">10 Jul 2025</td>
                                    <td className="px-4 py-3 text-gray-600">Tuition (Q2)</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700 border-l">₹ 12,500</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-gray-600">10 Oct 2025</td>
                                    <td className="px-4 py-3 text-gray-600">Tuition (Q3)</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700 border-l">₹ 12,500</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-gray-600">10 Jan 2026</td>
                                    <td className="px-4 py-3 text-gray-600">Tuition (Q4)</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700 border-l">₹ 12,500</td>
                                </tr>
                            </tbody>
                            <tfoot className="bg-gray-100 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 font-bold text-gray-800 text-right">TOTAL FEES FOR YEAR:</td>
                                    <td className="px-4 py-3 font-bold text-blue-700 text-right text-lg">₹ 65,000</td>
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
                            <span className="text-xl font-bold text-green-600">₹ 27,500</span>
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
                                    <input type="text" readOnly value="27500" className="w-full border-gray-300 bg-gray-50 rounded px-2 py-1.5 text-sm font-semibold text-gray-800 outline-none" />
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
