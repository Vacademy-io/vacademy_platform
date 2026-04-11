import React from 'react';
import { AdmissionFormData } from '../AdmissionFormWizard';
import {
    MAX_LENGTH,
    PREVIOUS_CLASS_OPTIONS,
    BOARD_OPTIONS,
} from '@/utils/form-validation';

interface Props {
    formData: AdmissionFormData;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    errors?: Record<string, string>;
}

export default function Step2PreviousSchool({ formData, handleChange, errors = {} }: Props) {
    const inputClass = (field?: string) =>
        `rounded-md border px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 ${
            field && errors[field]
                ? 'border-red-400 focus:border-red-500 focus:ring-red-300'
                : 'border-gray-300 focus:border-primary focus:ring-primary'
        }`;

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
                        maxLength={MAX_LENGTH.SCHOOL_NAME}
                        className={inputClass()}
                        placeholder="Enter Previous School Name"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Previous Class</label>
                    <select
                        name="previousClass"
                        value={formData.previousClass}
                        onChange={handleChange}
                        className={inputClass()}
                    >
                        <option value="">Select Class</option>
                        {PREVIOUS_CLASS_OPTIONS.map((cls) => (
                            <option key={cls} value={cls}>
                                {cls}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Board</label>
                    <select
                        name="board"
                        value={formData.board}
                        onChange={handleChange}
                        className={inputClass()}
                    >
                        <option value="">Select Board</option>
                        {BOARD_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Year of Passing</label>
                    <input
                        name="yearOfPassing"
                        value={formData.yearOfPassing}
                        onChange={handleChange}
                        maxLength={MAX_LENGTH.YEAR}
                        inputMode="numeric"
                        className={inputClass('yearOfPassing')}
                        placeholder="YYYY"
                    />
                    {errors.yearOfPassing && (
                        <span className="text-xs text-red-500">{errors.yearOfPassing}</span>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Percentage</label>
                    <input
                        name="percentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.percentage}
                        onChange={handleChange}
                        className={inputClass('percentage')}
                        placeholder="%"
                    />
                    {errors.percentage && (
                        <span className="text-xs text-red-500">{errors.percentage}</span>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Percentage in Science</label>
                    <input
                        name="percentageScience"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.percentageScience}
                        onChange={handleChange}
                        className={inputClass('percentageScience')}
                        placeholder="%"
                    />
                    {errors.percentageScience && (
                        <span className="text-xs text-red-500">{errors.percentageScience}</span>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Percentage in Maths</label>
                    <input
                        name="percentageMaths"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.percentageMaths}
                        onChange={handleChange}
                        className={inputClass('percentageMaths')}
                        placeholder="%"
                    />
                    {errors.percentageMaths && (
                        <span className="text-xs text-red-500">{errors.percentageMaths}</span>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Previous Admission No</label>
                    <input
                        name="previousAdmissionNo"
                        value={formData.previousAdmissionNo}
                        onChange={handleChange}
                        maxLength={MAX_LENGTH.PREVIOUS_ADMISSION_NO}
                        className={inputClass()}
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
                        maxLength={MAX_LENGTH.RELIGION}
                        className={inputClass()}
                        placeholder="Enter Religion"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Caste</label>
                    <input
                        name="caste"
                        value={formData.caste}
                        onChange={handleChange}
                        maxLength={MAX_LENGTH.CASTE}
                        className={inputClass()}
                        placeholder="Enter Caste"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Mother Tongue</label>
                    <input
                        name="motherTongue"
                        value={formData.motherTongue}
                        onChange={handleChange}
                        maxLength={MAX_LENGTH.MOTHER_TONGUE}
                        className={inputClass()}
                        placeholder="Enter Mother Tongue"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Blood Group</label>
                    <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className={inputClass()}>
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
                        maxLength={MAX_LENGTH.NATIONALITY}
                        className={inputClass()}
                        placeholder="e.g. Indian"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">How did you come to know about us</label>
                    <select name="howDidYouKnow" value={formData.howDidYouKnow} onChange={handleChange} className={inputClass()}>
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
