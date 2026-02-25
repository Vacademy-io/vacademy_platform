import React from 'react';
import { AdmissionFormData } from '../AdmissionFormWizard';

interface Props {
    formData: AdmissionFormData;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export default function Step1StudentDetails({ formData, handleChange }: Props) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Full Width Section Header */}
            <div className="col-span-full pb-2 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800">Student Details</h2>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Student First Name <span className="text-red-500">*</span></label>
                <input
                    name="studentFirstName"
                    value={formData.studentFirstName}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                    placeholder="Enter First Name"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Middle Name</label>
                <input
                    name="studentMiddleName"
                    value={formData.studentMiddleName}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                    placeholder="Enter Middle Name"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
                <input
                    name="studentLastName"
                    value={formData.studentLastName}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                    placeholder="Enter Last Name"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="">Select Gender</option>
                    <option value="Boy">Boy</option>
                    <option value="Girl">Girl</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Application Number</label>
                <input
                    name="applicationNumber"
                    value={formData.applicationNumber}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                    placeholder="Auto Generated / Editable"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Class <span className="text-red-500">*</span></label>
                <select name="studentClass" value={formData.studentClass} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="">Select Class</option>
                    <option value="Class 1">Class 1</option>
                    <option value="Class 2">Class 2</option>
                    <option value="Class 3">Class 3</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Section <span className="text-red-500">*</span></label>
                <select name="section" value={formData.section} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="">Select Section</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Class Group</label>
                <select name="classGroup" value={formData.classGroup} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="">Select Group</option>
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Date of Admission</label>
                <input
                    type="date"
                    name="dateOfAdmission"
                    value={formData.dateOfAdmission}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Date of Birth <span className="text-red-500">*</span></label>
                <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Residential Phone No</label>
                <input
                    name="residentialPhone"
                    value={formData.residentialPhone}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                    placeholder="Enter Phone Number"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Student Type</label>
                <select name="studentType" value={formData.studentType} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="">Select Type</option>
                    <option value="Regular">Regular</option>
                    <option value="Transfer">Transfer</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Admission Type</label>
                <select name="admissionType" value={formData.admissionType} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="">Select Type</option>
                    <option value="Day Scholar">Day Scholar</option>
                    <option value="Hostel">Hostel</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Transport Required</label>
                <select name="transport" value={formData.transport} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Student Aadhaar Type</label>
                <select name="aadhaarType" value={formData.aadhaarType} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                    <option value="">Select Type</option>
                    <option value="Standard">Standard</option>
                    <option value="Temporary">Temporary</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Aadhaar Number</label>
                <input
                    name="aadhaarNumber"
                    value={formData.aadhaarNumber}
                    onChange={handleChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                    placeholder="XXXX-XXXX-XXXX"
                />
            </div>
        </div>
    );
}
