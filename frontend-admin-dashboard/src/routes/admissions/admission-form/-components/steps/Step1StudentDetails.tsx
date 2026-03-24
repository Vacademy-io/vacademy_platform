import React, { useMemo } from 'react';
import { AdmissionFormData } from '../AdmissionFormWizard';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';

interface PackageSessionOption {
    id: string;
    label: string;
    sessionId: string;
}

interface Props {
    formData: AdmissionFormData;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    packageSessionOptions: PackageSessionOption[];
    allBatches: BatchForSessionType[];
    onFormDataUpdate: (updates: Partial<AdmissionFormData>) => void;
}

export default function Step1StudentDetails({
    formData,
    handleChange,
    packageSessionOptions,
    allBatches,
    onFormDataUpdate,
}: Props) {
    // Track selected parent class separately so section dropdown stays stable
    const [selectedParentId, setSelectedParentId] = React.useState<string>(() => {
        // Initialize: if destinationPackageSessionId is a child, find its parent
        const current = allBatches.find((b) => b.id === formData.destinationPackageSessionId);
        if (current?.parent_id) return current.parent_id;
        return formData.destinationPackageSessionId || '';
    });

    // Derive section (child) options based on selected parent class
    const sectionOptions = useMemo(() => {
        if (!selectedParentId) return [];
        return allBatches
            .filter((b) => b.parent_id === selectedParentId)
            .map((b) => ({
                id: b.id,
                label: b.name || b.level.level_name,
            }));
    }, [allBatches, selectedParentId]);

    const handleClassChange = (packageSessionId: string) => {
        const selected = packageSessionOptions.find((opt) => opt.id === packageSessionId);
        setSelectedParentId(packageSessionId);
        onFormDataUpdate({
            destinationPackageSessionId: packageSessionId,
            studentClass: selected?.label || packageSessionId,
            sessionId: selected?.sessionId || formData.sessionId,
            section: '',
        });
    };

    const handleSectionChange = (sectionPackageSessionId: string) => {
        if (!sectionPackageSessionId) {
            // Reset to parent when "Select Section" is chosen
            onFormDataUpdate({
                destinationPackageSessionId: selectedParentId,
                section: '',
            });
            return;
        }
        const selected = sectionOptions.find((opt) => opt.id === sectionPackageSessionId);
        onFormDataUpdate({
            destinationPackageSessionId: sectionPackageSessionId,
            section: selected?.label || '',
        });
    };

    return (
        <div className="grid grid-cols-1 gap-6 duration-200 animate-in fade-in zoom-in-95 md:grid-cols-2 lg:grid-cols-3">
            <div className="col-span-full border-b border-gray-100 pb-2">
                <h2 className="text-lg font-semibold text-gray-800">Student Details</h2>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                    Student First Name <span className="text-red-500">*</span>
                </label>
                <input
                    name="studentFirstName"
                    value={formData.studentFirstName}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    placeholder="Enter First Name"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Middle Name</label>
                <input
                    name="studentMiddleName"
                    value={formData.studentMiddleName}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    placeholder="Enter Middle Name"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                    Last Name <span className="text-red-500">*</span>
                </label>
                <input
                    name="studentLastName"
                    value={formData.studentLastName}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    placeholder="Enter Last Name"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Application Number</label>
                <input
                    name="applicationNumber"
                    value={formData.applicationNumber}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    placeholder="Auto Generated / Editable"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                    Class <span className="text-red-500">*</span>
                </label>
                <select
                    value={selectedParentId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                >
                    <option value="">Select Class</option>
                    {packageSessionOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {sectionOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Section</label>
                    <select
                        value={
                            sectionOptions.some(
                                (opt) => opt.id === formData.destinationPackageSessionId
                            )
                                ? formData.destinationPackageSessionId
                                : ''
                        }
                        onChange={(e) => handleSectionChange(e.target.value)}
                        className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    >
                        <option value="">Select Section</option>
                        {sectionOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Date of Admission</label>
                <input
                    type="date"
                    name="dateOfAdmission"
                    value={formData.dateOfAdmission}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                    Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Residential Phone No</label>
                <input
                    name="residentialPhone"
                    value={formData.residentialPhone}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    placeholder="Enter Phone Number"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Student Type</label>
                <select
                    name="studentType"
                    value={formData.studentType}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                >
                    <option value="">Select Type</option>
                    <option value="Regular">Regular</option>
                    <option value="Transfer">Transfer</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Admission Type</label>
                <select
                    name="admissionType"
                    value={formData.admissionType}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                >
                    <option value="">Select Type</option>
                    <option value="Day Scholar">Day Scholar</option>
                    <option value="Hostel">Hostel</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Transport Required</label>
                <select
                    name="transport"
                    value={formData.transport}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Student Aadhaar Type</label>
                <select
                    name="aadhaarType"
                    value={formData.aadhaarType}
                    onChange={handleChange}
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                >
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
                    className="focus:border-primary focus:ring-primary rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:ring-1"
                    placeholder="XXXX-XXXX-XXXX"
                />
            </div>
        </div>
    );
}
