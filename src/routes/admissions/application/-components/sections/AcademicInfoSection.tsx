import React from 'react';
import { Registration } from '../../../-types/registration-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface SectionProps {
    formData: Partial<Registration>;
    updateFormData: (data: Partial<Registration>) => void;
}

export const AcademicInfoSection: React.FC<SectionProps> = ({ formData, updateFormData }) => {
    // Get package sessions from institute store
    const { instituteDetails } = useInstituteDetailsStore();
    const [packageSessions, setPackageSessions] = React.useState<
        Array<{
            id: string;
            name: string;
            levelName: string;
        }>
    >([]);
    const [sessionName, setSessionName] = React.useState('');

    React.useEffect(() => {
        if (instituteDetails?.batches_for_sessions) {
            const sessions = instituteDetails.batches_for_sessions.map((batch) => ({
                id: batch.id,
                name: `${batch.package_dto.package_name} - ${batch.level.level_name}`,
                levelName: batch.level.level_name,
            }));
            setPackageSessions(sessions);
        }

        // Get session name from URL
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('sessionId');
        if (sessionId && instituteDetails?.sessions) {
            const session = instituteDetails.sessions.find((s) => s.id === sessionId);
            if (session) {
                setSessionName(session.session_name);
                updateFormData({ academicYear: session.session_name });
            }
        }
    }, [instituteDetails, updateFormData]);

    return (
        <div className="space-y-6">
            {/* Current/Previous School Details */}
            <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-neutral-500">
                    <span className="i-ph-graduation-cap size-4" />
                    Current / Previous School Details
                </h4>

                <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700">
                        Previous School Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="Enter previous school name"
                        value={formData.previousSchoolName || ''}
                        onChange={(e) => updateFormData({ previousSchoolName: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Previous School Board <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.previousSchoolBoard || ''}
                            onValueChange={(value) =>
                                updateFormData({ previousSchoolBoard: value })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select board" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CBSE">CBSE</SelectItem>
                                <SelectItem value="ICSE">ICSE</SelectItem>
                                <SelectItem value="State Board">State Board</SelectItem>
                                <SelectItem value="IB">IB</SelectItem>
                                <SelectItem value="IGCSE">IGCSE</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-neutral-500">CBSE / ICSE</p>
                    </div>
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Last Class Attended <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.lastClassAttended || ''}
                            onValueChange={(value) => updateFormData({ lastClassAttended: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((cls) => (
                                    <SelectItem key={cls} value={cls.toString()}>
                                        Class {cls}
                                    </SelectItem>
                                ))}
                                <SelectItem value="Kindergarten">Kindergarten</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div>
                    <Label className="mb-1 block text-sm font-medium text-neutral-700">
                        Academic Year <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        type="text"
                        value={sessionName || formData.academicYear || ''}
                        readOnly
                        disabled
                        className="bg-neutral-50"
                        placeholder="Session will be auto-filled"
                    />
                    <p className="mt-1 text-xs text-neutral-500">Based on selected session</p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Last Exam Result / Percentage
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            placeholder="E.g., 85% or A1 Grade or 9 CGPA"
                            value={formData.lastExamResult || ''}
                            onChange={(e) => updateFormData({ lastExamResult: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            Subjects Studied (Previous Class)
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            placeholder="E.g., English, Hindi, Maths, Science, Social Science"
                            value={formData.subjectsStudied || ''}
                            onChange={(e) => updateFormData({ subjectsStudied: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Transfer Certificate Details */}
            <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-neutral-500">
                    <span className="i-ph-file-text size-4" />
                    Transfer Certificate (TC) Details
                </h4>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            TC Number
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            placeholder="Enter TC number"
                            value={formData.tcNumber || ''}
                            onChange={(e) => updateFormData({ tcNumber: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                            TC Issue Date
                        </label>
                        <input
                            type="date"
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            value={formData.tcIssueDate || ''}
                            onChange={(e) => updateFormData({ tcIssueDate: e.target.value })}
                        />
                    </div>
                </div>

                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
                    <label className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            className="mt-1 size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                            checked={formData.tcPending || false}
                            onChange={(e) => updateFormData({ tcPending: e.target.checked })}
                        />
                        <div>
                            <span className="block text-sm font-medium text-yellow-900">
                                TC Pending / Will be submitted later
                            </span>
                            <span className="block text-xs text-yellow-700">
                                (Admission cannot be confirmed without TC)
                            </span>
                        </div>
                    </label>
                </div>
            </div>

            {/* Applying For */}
            <div className="space-y-4 pt-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold uppercase text-neutral-500">
                    <span className="i-ph-student size-4" />
                    Applying For
                </h4>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Class / Grade Applying For <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.applyingForClass || ''}
                            onValueChange={(value) => {
                                updateFormData({ applyingForClass: value });
                                // Also update applyingForClass for backward compatibility
                                const selected = packageSessions.find((ps) => ps.id === value);
                                if (selected) {
                                    updateFormData({ applyingForClass: selected.levelName });
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select class/package" />
                            </SelectTrigger>
                            <SelectContent>
                                {packageSessions.map((session) => (
                                    <SelectItem key={session.id} value={session.id}>
                                        {session.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-neutral-500">
                            Select the package and level for admission
                        </p>
                    </div>
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-neutral-700">
                            Board Preference <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={formData.preferredBoard || ''}
                            onValueChange={(value) => updateFormData({ preferredBoard: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select board" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CBSE">CBSE</SelectItem>
                                <SelectItem value="ICSE">ICSE</SelectItem>
                                <SelectItem value="State Board">State Board</SelectItem>
                                <SelectItem value="IB">IB</SelectItem>
                                <SelectItem value="IGCSE">IGCSE</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
};
