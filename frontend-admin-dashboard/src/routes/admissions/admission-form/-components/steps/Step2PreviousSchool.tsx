import React from 'react';
import { AdmissionFormData } from '../AdmissionFormWizard';

interface Props {
    formData: AdmissionFormData;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export default function Step2PreviousSchool({ formData, handleChange }: Props) {
    return (
        <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Previous School Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full pb-2 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">Previous School Details</h2>
                </div>

                <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <label className="text-sm font-medium text-gray-700">School Name</label>
                    <input
                        name="schoolName"
                        value={formData.schoolName}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Previous School Name"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Previous Class</label>
                    <input
                        name="previousClass"
                        value={formData.previousClass}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="e.g. Class 2"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Board</label>
                    <select name="board" value={formData.board} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                        <option value="">Select Board</option>
                        <option value="SSC">SSC</option>
                        <option value="CBSE">CBSE</option>
                        <option value="ICSE">ICSE</option>
                        <option value="IGCSE">IGCSE</option>
                        <option value="IB">IB</option>
                        <option value="Others">Others</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Year of Passing</label>
                    <input
                        name="yearOfPassing"
                        value={formData.yearOfPassing}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="YYYY"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Percentage</label>
                    <input
                        name="percentage"
                        type="number"
                        value={formData.percentage}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="%"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Percentage in Science</label>
                    <input
                        name="percentageScience"
                        type="number"
                        value={formData.percentageScience}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="%"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Percentage in Maths</label>
                    <input
                        name="percentageMaths"
                        type="number"
                        value={formData.percentageMaths}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="%"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Previous Admission No</label>
                    <input
                        name="previousAdmissionNo"
                        value={formData.previousAdmissionNo}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Number"
                    />
                </div>
            </div>

            {/* Other Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full pb-2 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">Other Details</h2>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Religion</label>
                    <input
                        name="religion"
                        value={formData.religion}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Religion"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Caste</label>
                    <input
                        name="caste"
                        value={formData.caste}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Caste"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Mother Tongue</label>
                    <input
                        name="motherTongue"
                        value={formData.motherTongue}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="Enter Mother Tongue"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Blood Group</label>
                    <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                        <option value="">Select Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Nationality</label>
                    <input
                        name="nationality"
                        value={formData.nationality}
                        onChange={handleChange}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                        placeholder="e.g. Indian"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">How did you come to know about us</label>
                    <select name="howDidYouKnow" value={formData.howDidYouKnow} onChange={handleChange} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow">
                        <option value="">Select Option</option>
                        <option value="Social Media">Social Media</option>
                        <option value="Friends/Family">Friends/Family</option>
                        <option value="Advertisement">Advertisement</option>
                        <option value="Website">Website</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
