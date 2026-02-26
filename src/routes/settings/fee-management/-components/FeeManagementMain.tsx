import React, { useState } from 'react';
import FeeTypesTab from './FeeTypesTab';
import InstallmentPlansTab from './InstallmentPlansTab';

export default function FeeManagementMain() {
    const [activeTab, setActiveTab] = useState('fee-types');

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-100 p-6">

            {/* Tabs Header */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex gap-6">
                    <button
                        onClick={() => setActiveTab('fee-types')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'fee-types'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Fee Types & Amounts
                    </button>
                    <button
                        onClick={() => setActiveTab('installments')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'installments'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Installment Plans
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto pr-2">
                {activeTab === 'fee-types' && <FeeTypesTab />}
                {activeTab === 'installments' && <InstallmentPlansTab />}
            </div>

        </div>
    );
}
