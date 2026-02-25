import React, { useState } from 'react';
import { MOCK_FEE_TYPES } from './FeeTypesTab';

const MOCK_PLANS = {
    'Tuition Fee': [
        { id: 'p1', name: 'Annual', installments: 1, split: '100%', isDefault: false },
        { id: 'p2', name: 'Term-wise', installments: 3, split: '33% each', isDefault: false },
        { id: 'p3', name: 'Quarterly', installments: 4, split: '25% each', isDefault: true },
        { id: 'p4', name: 'Monthly', installments: 12, split: '8.33% each', isDefault: false },
    ],
    'Bus Fee': [
        { id: 'p5', name: 'Annual', installments: 1, split: '100%', isDefault: true },
        { id: 'p6', name: 'Term-wise', installments: 3, split: '33% each', isDefault: false },
    ],
    'Hostel Fee': [
        { id: 'p7', name: 'Quarterly', installments: 4, split: '25% each', isDefault: false },
        { id: 'p8', name: 'Monthly', installments: 12, split: '8.33% each', isDefault: true },
    ]
};

export default function InstallmentPlansTab() {
    const [selectedType, setSelectedType] = useState('Tuition Fee');
    const [isAddPlanOpen, setAddPlanOpen] = useState(false);
    const [splitType, setSplitType] = useState<'Equal' | 'Custom'>('Equal');
    const [installments, setInstallments] = useState(4);

    const currentPlans = MOCK_PLANS[selectedType as keyof typeof MOCK_PLANS] || [];

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Fee Type:</span>
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="rounded-md border-gray-300 py-1.5 px-3 w-64 text-sm focus:ring-blue-600 focus:border-blue-600 outline-none font-medium"
                    >
                        {MOCK_FEE_TYPES.map(f => (
                            <option key={f.id} value={f.name}>{f.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => setAddPlanOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Add Installment Plan
                </button>
            </div>

            {/* Plans Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse bg-white">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Plan Name</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Installments</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Split</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase text-center">Default</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                        {currentPlans.length > 0 ? currentPlans.map((plan) => (
                            <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{plan.name}</td>
                                <td className="px-6 py-4 text-gray-600">{plan.installments} payment{plan.installments > 1 ? 's' : ''}</td>
                                <td className="px-6 py-4 text-gray-600">{plan.split}</td>
                                <td className="px-6 py-4 text-center">
                                    {plan.isDefault ? <span className="text-yellow-500 text-lg" title="Default Plan">⭐</span> : ''}
                                </td>
                                <td className="px-6 py-4 text-right space-x-3">
                                    <button className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                    <button className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-500">
                                    No installment plans configured for this fee type.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Installment Plan Modal Simulation */}
            {isAddPlanOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col mx-4">

                        <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">
                                Add Installment Plan - {selectedType}
                            </h3>
                            <button onClick={() => setAddPlanOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name <span className="text-red-500">*</span></label>
                                <input type="text" placeholder="E.g., Quarterly, Half-yearly, Custom" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-600 focus:border-blue-600 outline-none" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Installments <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={installments}
                                    onChange={(e) => setInstallments(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-600 focus:border-blue-600 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Split Type</label>
                                <div className="flex gap-4 p-3 border border-gray-200 rounded-md bg-gray-50/50">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="splitType"
                                            checked={splitType === 'Equal'}
                                            onChange={() => setSplitType('Equal')}
                                            className="text-blue-600 focus:ring-blue-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Equal Split</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="splitType"
                                            checked={splitType === 'Custom'}
                                            onChange={() => setSplitType('Custom')}
                                            className="text-blue-600 focus:ring-blue-600"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Custom Split (%)</span>
                                    </label>
                                </div>
                            </div>

                            {splitType === 'Custom' && installments > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
                                    {Array.from({length: installments}).map((_, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600 font-medium">Installment {i + 1}:</span>
                                            <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white">
                                                <input type="number" defaultValue={Math.floor(100/installments)} className="w-16 px-2 py-1 outline-none text-right" />
                                                <span className="bg-gray-100 text-gray-500 px-2 py-1 border-l">%</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-semibold border-t border-gray-200 pt-3 mt-3 text-sm">
                                        <span>Total:</span>
                                        <span className="text-green-600 flex items-center gap-1">100% <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm font-semibold text-gray-700">Set as Default Plan:</span>
                                <label className="flex items-center gap-2 cursor-pointer border p-2 rounded-md hover:bg-gray-50">
                                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-600" defaultChecked />
                                    <span className="text-sm font-medium text-gray-700">Yes</span>
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setAddPlanOpen(false)} className="px-4 py-2 border border-gray-300 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button onClick={() => setAddPlanOpen(false)} className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700 shadow-sm">Save Plan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
