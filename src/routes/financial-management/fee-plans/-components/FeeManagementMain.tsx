import React from 'react';
import InstallmentPlansTab from './InstallmentPlansTab';

export default function FeeManagementMain() {
    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <InstallmentPlansTab />
        </div>
    );
}
