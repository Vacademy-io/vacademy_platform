import React from 'react';
import { AdmissionFormData } from '../AdmissionFormWizard';

interface Props {
    formData: AdmissionFormData;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export default function Step3ParentDetails({ formData, handleChange }: Props) {
    return (
        <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Father Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full pb-2 border-b border-gray-100 flex items-center gap-2">
                    <span className="p-1 rounded-md bg-blue-50 text-blue-600">
                        {/* Simple icon or text indicator */}
                        Father
                    </span>
                    <h2 className="text-lg font-semibold text-gray-800">Details</h2>
                </div>

                <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Father Name <span className="text-red-500">*</span></label>
                    <input
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Father's Name"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Mobile Number <span className="text-red-500">*</span></label>
                    <input
                        name="fatherMobile"
                        value={formData.fatherMobile}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Mobile Number"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                    <input
                        name="fatherEmail"
                        type="email"
                        value={formData.fatherEmail}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Email"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Aadhaar No</label>
                    <input
                        name="fatherAadhaar"
                        value={formData.fatherAadhaar}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="XXXX-XXXX-XXXX"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Qualification</label>
                    <input
                        name="fatherQualification"
                        value={formData.fatherQualification}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Qualification"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Occupation</label>
                    <input
                        name="fatherOccupation"
                        value={formData.fatherOccupation}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Occupation"
                    />
                </div>
            </div>

            {/* Mother Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full pb-2 border-b border-gray-100 flex items-center gap-2">
                    <span className="p-1 rounded-md bg-pink-50 text-pink-600">
                        Mother
                    </span>
                    <h2 className="text-lg font-semibold text-gray-800">Details</h2>
                </div>

                <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Mother Name</label>
                    <input
                        name="motherName"
                        value={formData.motherName}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Mother's Name"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Mobile Number</label>
                    <input
                        name="motherMobile"
                        value={formData.motherMobile}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Mobile Number"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                    <input
                        name="motherEmail"
                        type="email"
                        value={formData.motherEmail}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Email"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Aadhaar No</label>
                    <input
                        name="motherAadhaar"
                        value={formData.motherAadhaar}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="XXXX-XXXX-XXXX"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Qualification</label>
                    <input
                        name="motherQualification"
                        value={formData.motherQualification}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Qualification"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Occupation</label>
                    <input
                        name="motherOccupation"
                        value={formData.motherOccupation}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Occupation"
                    />
                </div>
            </div>

            {/* Guardian Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full pb-2 border-b border-gray-100 flex items-center gap-2">
                    <span className="p-1 rounded-md bg-green-50 text-green-600">
                        Guardian
                    </span>
                    <h2 className="text-lg font-semibold text-gray-800">Details</h2>
                </div>

                <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Guardian Name</label>
                    <input
                        name="guardianName"
                        value={formData.guardianName}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Guardian's Name"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Guardian Mobile</label>
                    <input
                        name="guardianMobile"
                        value={formData.guardianMobile}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Mobile Number"
                    />
                </div>
            </div>

        </div>
    );
}
