import React from 'react';
import InstallmentPlansTab from './InstallmentPlansTab';

export default function FeeManagementMain() {
    return (
        <div className="flex h-full flex-col rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
            <InstallmentPlansTab />
        </div>
    );
}
