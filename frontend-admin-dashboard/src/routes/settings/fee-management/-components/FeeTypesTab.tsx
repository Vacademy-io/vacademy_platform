import React, { useState } from 'react';

// Shared Mock state for Demo
export const MOCK_FEE_TYPES = [
    { id: '1', name: 'Tuition Fee', desc: 'Annual academic fee', status: 'Active', appliesTo: 'All Students' },
    { id: '2', name: 'Bus Fee', desc: 'Transport charges', status: 'Active', appliesTo: 'Transport Students' },
    { id: '3', name: 'Hostel Fee', desc: 'Boarding charges', status: 'Active', appliesTo: 'Hostel Students' },
    { id: '4', name: 'Mess Fee', desc: 'Food charges', status: 'Active', appliesTo: 'Hostel Students' },
    { id: '5', name: 'Computer Fee', desc: 'Lab usage fee', status: 'Active', appliesTo: 'All Students' },
    { id: '6', name: 'Sports Fee', desc: 'Sports activities', status: 'Inactive', appliesTo: 'All Students' },
];

const INIT_CLASS_AMOUNTS = [
    { className: 'Nursery', amount: '30000' },
    { className: 'LKG', amount: '30000' },
    { className: 'UKG', amount: '30000' },
    { className: 'Class 1', amount: '50000' },
    { className: 'Class 2', amount: '50000' },
    { className: 'Class 3', amount: '50000' },
    { className: 'Class 4', amount: '55000' },
    { className: 'Class 5', amount: '55000' },
    { className: 'Class 6', amount: '60000' },
    { className: 'Class 7', amount: '60000' },
    { className: 'Class 8', amount: '60000' },
    { className: 'Class 9', amount: '65000' },
    { className: 'Class 10', amount: '65000' },
    { className: 'Class 11', amount: '70000' },
    { className: 'Class 12', amount: '70000' },
];

export default function FeeTypesTab() {
    const [academicYear, setAcademicYear] = useState('2025-26');
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [selectedFee, setSelectedFee] = useState<any>(null);

    const [classAmounts, setClassAmounts] = useState([...INIT_CLASS_AMOUNTS]);

    const handleEdit = (fee: any) => {
        setSelectedFee(fee);
        setEditModalOpen(true);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Academic Year:</span>
                    <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="rounded-md border-gray-300 py-1.5 px-3 text-sm focus:ring-blue-600 focus:border-blue-600 outline-none"
                    >
                        <option value="2024-25">2024-25</option>
                        <option value="2025-26">2025-26</option>
                        <option value="2026-27">2026-27</option>
                    </select>
                </div>
                <button
                    onClick={() => handleEdit({ name: '', desc: '', status: 'Active', appliesTo: 'All Students' })}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Add Fee Type
                </button>
            </div>

            {/* Fees Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse bg-white">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Fee Type</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Description</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Applies To</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                        {MOCK_FEE_TYPES.map((fee) => (
                            <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{fee.name}</td>
                                <td className="px-6 py-4 text-gray-600">{fee.desc}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                        fee.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${fee.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                        {fee.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600">{fee.appliesTo}</td>
                                <td className="px-6 py-4 text-right space-x-3">
                                    <button onClick={() => handleEdit(fee)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                    <button className="text-red-500 hover:text-red-700 font-medium">Del</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit / Add Modal Simulation */}
            {isEditModalOpen && selectedFee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">

                        {/* Header */}
                        <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">
                                {selectedFee.id ? `Edit Fee Type - ${selectedFee.name}` : 'Add New Fee Type'}
                            </h3>
                            <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fee Name <span className="text-red-500">*</span></label>
                                    <input type="text" defaultValue={selectedFee.name} placeholder="E.g., Lab Fee, Activity Fee" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-600 focus:border-blue-600 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input type="text" defaultValue={selectedFee.desc} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-600 focus:border-blue-600 outline-none" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Applies To <span className="text-red-500">*</span></label>
                                    <div className="space-y-2 border border-gray-200 p-3 rounded-md bg-gray-50/50">
                                        {[
                                            'All Students (Mandatory)',
                                            'Transport Students Only',
                                            'Hostel Students Only',
                                            'Optional (Admin selects per student)'
                                        ].map((opt, i) => (
                                            <label key={i} className="flex items-center gap-3 cursor-pointer">
                                                <input type="radio" name="appliesTo" className="text-blue-600 focus:ring-blue-600 h-4 w-4" defaultChecked={selectedFee.appliesTo?.includes(opt.split(' ')[0]) || (i===0 && !selectedFee.id)} />
                                                <span className="text-sm text-gray-700 font-medium">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-b py-4">
                                    <span className="text-sm font-semibold text-gray-700">Status</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="statusToggle" className="text-blue-600 h-4 w-4" defaultChecked={selectedFee.status === 'Active'} /> Active
                                        <input type="radio" name="statusToggle" className="ml-4 text-gray-600 h-4 w-4" defaultChecked={selectedFee.status !== 'Active'} /> Inactive
                                    </label>
                                </div>

                                    <div className="mt-6">
                                        <h4 className="text-sm font-semibold text-gray-800 mb-3 bg-gray-100 p-2 rounded">CLASS-WISE AMOUNTS (Annual)</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {classAmounts.map((cl, idx) => (
                                                <div key={idx} className="flex items-center justify-between border border-gray-200 p-2 rounded bg-white">
                                                    <span className="text-xs font-medium text-gray-600 w-16">{cl.className}</span>
                                                    <div className="flex items-center text-sm border-l border-gray-200 pl-2">
                                                        <span className="text-gray-400 mr-1">₹</span>
                                                        <input
                                                            type="text"
                                                            value={cl.amount}
                                                            onChange={(e) => {
                                                                const newArr = [...classAmounts];
                                                                if (newArr[idx] !== undefined) {
                                                                    newArr[idx]!.amount = e.target.value;
                                                                    setClassAmounts(newArr);
                                                                }
                                                            }}
                                                            className="w-16 sm:w-20 outline-none text-right font-medium text-gray-800"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700 shadow-sm">
                                {selectedFee.id ? 'Save Fee Type' : 'Create Fee Type'}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
