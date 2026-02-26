import React from 'react';
import { AdmissionFormData } from '../AdmissionFormWizard';

interface Props {
    formData: AdmissionFormData;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    admissionId: string;
}

export default function Step6Finish({ formData, handleChange, admissionId }: Props) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6 shadow-sm border border-green-200">
                <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Submit</h2>
            <p className="text-lg text-gray-600 mb-6 max-w-xl">
                You have reached the end of the <span className="font-semibold text-gray-800">Admission Form</span>.
                Please review all details before final submission.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 w-full max-w-md mb-8">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Admission Summary</h3>
                <div className="flex flex-col gap-3 text-left">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Admission ID:</span>
                        <span className="font-semibold text-primary">{admissionId}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Student Name:</span>
                        <span className="font-medium text-gray-800">{formData.studentFirstName} {formData.studentLastName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Class:</span>
                        <span className="font-medium text-gray-800">{formData.studentClass || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Father Name:</span>
                        <span className="font-medium text-gray-800">{formData.fatherName || '-'}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 text-left w-full max-w-md border border-gray-200 p-5 rounded-lg bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center shrink-0">
                        <input
                            type="checkbox"
                            name="sendSms"
                            checked={formData.sendSms}
                            onChange={handleChange}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-1 transition duration-150 ease-in-out cursor-pointer"
                        />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        Send SMS confirmation to parent mobile number
                    </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center shrink-0">
                        <input
                            type="checkbox"
                            name="sendEmail"
                            checked={formData.sendEmail}
                            onChange={handleChange}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-1 transition duration-150 ease-in-out cursor-pointer"
                        />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        Send Email confirmation to parent email address
                    </span>
                </label>
            </div>

            <div className="mt-8 text-sm text-gray-500">
                Click <span className="font-semibold text-gray-700">Submit Admission</span> below to finalize this record.
            </div>
        </div>
    );
}
