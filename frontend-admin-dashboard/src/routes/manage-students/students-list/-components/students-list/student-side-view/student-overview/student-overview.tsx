import { ProgressBar } from '@/components/design-system/progress-bar';
import {
    Key,
    User,
    GraduationCap,
    Phone,
    Envelope,
    MapPin,
    Users,
    Clock,
    TrendUp,
    Copy,
    Check,
    HandCoinsIcon,
} from '@phosphor-icons/react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { OverViewData, OverviewDetailsType } from './overview';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { EditStudentDetails } from './EditStudentDetails';
import { useStudentCredentialsStore } from '@/stores/students/students-list/useStudentCredentialsStore';
import { useGetStudentDetails } from '@/services/get-student-details';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { StudentTable } from '@/types/student-table-types';
import { getFieldsForLocation, type FieldForLocation } from '@/lib/custom-fields/utils';
import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';
import type { FieldGroup } from '@/services/custom-field-settings';
import { Tag, Folders } from '@phosphor-icons/react';
import { MonitorPlay } from '@phosphor-icons/react';

export const StudentOverview = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();

    const [overviewData, setOverviewData] = useState<OverviewDetailsType[] | null>(null);
    const [daysUntilExpiry, setDaysUntilExpiry] = useState<number>(0);
    const [copiedField, setCopiedField] = useState<string>('');
    const [customFields, setCustomFields] = useState<FieldForLocation[]>([]);
    const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;
    const { data: studentDetails, isLoading, isError, error } = useGetStudentDetails(userId || '');

    const { getDetailsFromPackageSessionId, instituteDetails } = useInstituteDetailsStore();
    const { getCredentials } = useStudentCredentialsStore();
    const [password, setPassword] = useState(
        getCredentials(isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '')
            ?.password || 'password not found'
    );

    // Load custom fields and groups for Learner Profile location
    useEffect(() => {
        // Get all fields for Learner Profile
        const fields = getFieldsForLocation('Learner Profile');
        // Get the full settings to access groups
        const settings = getCustomFieldSettingsFromCache();

        if (settings) {
            // Get the visibility key for Learner Profile
            const visibilityKey = 'learnerProfile';

            // Filter groups that have at least one field visible in Learner Profile
            const visibleGroups = settings.fieldGroups.filter((group) => {
                return group.fields.some((field) => field.visibility[visibilityKey]);
            });

            // For each visible group, filter to only include fields visible in Learner Profile
            const filteredGroups = visibleGroups.map((group) => ({
                ...group,
                fields: group.fields.filter((field) => field.visibility[visibilityKey]),
            }));

            // Get field IDs that are in groups
            const fieldIdsInGroups = new Set(
                filteredGroups.flatMap((group) => group.fields.map((f) => f.id))
            );

            // Filter out fields that are already in groups
            const individualFields = fields.filter((field) => !fieldIdsInGroups.has(field.id));

            setCustomFields(individualFields);
            setFieldGroups(filteredGroups);
        } else {
            setCustomFields(fields);
            setFieldGroups([]);
        }
    }, []);

    // Copy function with feedback
    const handleCopy = async (text: string, fieldName: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            toast.success(`${fieldName} copied to clipboard!`);
            setTimeout(() => setCopiedField(''), 2000);
        } catch (error) {
            toast.error(`Failed to copy ${fieldName}`);
        }
    };

    useEffect(() => {
        if (selectedStudent) {
            const credentials = getCredentials(
                isSubmissionTab ? selectedStudent.id : selectedStudent.user_id
            );
            setPassword(credentials?.password || 'password not found');
        }
    }, [selectedStudent]);

    useEffect(() => {
        const details = getDetailsFromPackageSessionId({
            packageSessionId: isSubmissionTab
                ? selectedStudent?.package_id || ''
                : selectedStudent?.package_session_id || '',
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const student: StudentTable | null = {
            id: studentDetails?.id || selectedStudent?.id || '',
            username: studentDetails?.username || selectedStudent?.username || '',
            user_id: selectedStudent?.id || '',
            email: studentDetails?.email || selectedStudent?.email || '',
            full_name: studentDetails?.full_name || selectedStudent?.full_name || '',
            address_line: studentDetails?.address_line || selectedStudent?.address_line || '',
            region: studentDetails?.region || selectedStudent?.region || '',
            city: studentDetails?.city || selectedStudent?.city || '',
            pin_code: studentDetails?.pin_code || selectedStudent?.pin_code || '',
            mobile_number: studentDetails?.mobile_number || selectedStudent?.mobile_number || '',
            date_of_birth: studentDetails?.date_of_birth || selectedStudent?.date_of_birth || '',
            gender: studentDetails?.gender || selectedStudent?.gender || '',
            fathers_name: studentDetails?.fathers_name || selectedStudent?.fathers_name || '',
            mothers_name: studentDetails?.mothers_name || selectedStudent?.mothers_name || '',
            father_mobile_number: '',
            father_email: '',
            mother_mobile_number: '',
            mother_email: '',
            parents_mobile_number: studentDetails?.parents_mobile_number || selectedStudent?.parents_mobile_number || '',
            parents_email: studentDetails?.parents_email || selectedStudent?.parents_email || '',
            linked_institute_name: studentDetails?.linked_institute_name || selectedStudent?.linked_institute_name || '',
            created_at: studentDetails?.created_at || selectedStudent?.created_at || '',
            updated_at: studentDetails?.updated_at || selectedStudent?.updated_at || '',
            package_session_id: selectedStudent?.package_session_id || '',
            institute_enrollment_id: studentDetails?.institute_enrollment_id || selectedStudent?.institute_enrollment_id || '',
            institute_enrollment_number: studentDetails?.institute_enrollment_number || selectedStudent?.institute_enrollment_number || '',
            status: selectedStudent?.status || 'ACTIVE',
            session_expiry_days: selectedStudent?.session_expiry_days || 0,
            institute_id: selectedStudent?.institute_id || '',
            expiry_date: selectedStudent?.expiry_date || 0,
            face_file_id: studentDetails?.face_file_id || selectedStudent?.face_file_id || '',
            attempt_id: '',
            parents_to_mother_mobile_number: studentDetails?.parents_to_mother_mobile_number || selectedStudent?.parents_to_mother_mobile_number || '',
            parents_to_mother_email: studentDetails?.parents_to_mother_email || selectedStudent?.parents_to_mother_email || '',
            package_id: selectedStudent?.package_id || '',
            country: studentDetails?.country || selectedStudent?.country || '',
            attendance_percent: studentDetails?.attendance_percentage || studentDetails?.attendance_percent || selectedStudent?.attendance_percent || 0,
            referral_count: studentDetails?.referral_count || selectedStudent?.referral_count || 0,
            custom_fields: studentDetails?.custom_fields || selectedStudent?.custom_fields || {},
        };

        const learner = isSubmissionTab
            ? student
            : student
                ? { ...selectedStudent, ...student }
                : selectedStudent;
        setOverviewData(
            OverViewData({
                selectedStudent: learner,
                packageSessionDetails: details,
                password: password,
            })
        );

        // Calculate days until expiry
        if (selectedStudent?.expiry_date) {
            const expiryDate = new Date(selectedStudent.expiry_date);
            const currentDate = new Date();

            // Calculate the difference in milliseconds
            const diffTime = expiryDate.getTime() - currentDate.getTime();

            // Convert to days and round down
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            // Set the days until expiry (0 if negative)
            setDaysUntilExpiry(diffDays > 0 ? diffDays : 0);
        } else {
            setDaysUntilExpiry(0);
        }
    }, [selectedStudent, instituteDetails, password, studentDetails]);

    if (isLoading) {
        return <DashboardLoader />;
    }

    if (isError) {
        console.error(error);
        return <div>Error fetching student details</div>;
    }

    return (
        <div className="animate-fadeIn relative flex flex-col gap-3 text-neutral-600">
            {/* Compact Edit Button */}
            <div className="flex justify-center">
                <EditStudentDetails />
            </div>

            {/* Compact Session Expiry Card */}
            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-3 transition-all duration-200 hover:border-primary-200/50 hover:shadow-md">
                <div className="mb-2 flex items-center gap-2.5">
                    <div className="rounded-md bg-gradient-to-br from-primary-50 to-primary-100 p-1.5">
                        <Clock className="size-4 text-primary-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="mb-0.5 text-xs font-medium text-neutral-700">
                            Session Expiry
                        </h4>
                        <div className="flex items-center gap-1.5">
                            <span
                                className={`text-base font-bold ${
                                    daysUntilExpiry >= 180
                                    ? 'text-success-600'
                                    : daysUntilExpiry >= 30
                                        ? 'text-warning-600'
                                        : 'text-danger-600'
                                    }`}
                            >
                                {daysUntilExpiry}
                            </span>
                            <span className="text-xs text-neutral-500">days</span>
                        </div>
                    </div>
                    <TrendUp
                        className={`size-3.5 ${
                            daysUntilExpiry >= 180
                            ? 'text-success-500'
                            : daysUntilExpiry >= 30
                                ? 'text-warning-500'
                                : 'text-danger-500'
                            }`}
                    />
                </div>
                <div className="relative">
                    <ProgressBar progress={daysUntilExpiry} />
                    <div className="mt-1 text-center text-[10px] leading-tight text-neutral-500">
                        {daysUntilExpiry >= 180
                            ? 'Active session'
                            : daysUntilExpiry >= 30
                                ? 'Renewal due soon'
                                : 'Urgent renewal required'}
                    </div>
                </div>
            </div>

            {/* Compact overview sections */}
            <div className="space-y-2.5">
                {selectedStudent != null ? (
                    overviewData?.map((studentDetail, key) => {
                        // Skip Account Credentials (key === 0) as it's moved to Portal Access tab
                        if (key === 0) return null;

                        // Define icons and colors for each section
                        const sectionConfig = {
                            0: {
                                icon: Key,
                                color: 'primary',
                                bg: 'from-primary-50 to-primary-100',
                            },
                            1: {
                                icon: GraduationCap,
                                color: 'blue',
                                bg: 'from-blue-50 to-blue-100',
                            },
                            2: {
                                icon: MonitorPlay,
                                color: 'blue',
                                bg: 'from-blue-50 to-blue-100',
                            },
                            3: {
                                icon: HandCoinsIcon,
                                color: 'blue',
                                bg: 'from-blue-50 to-blue-100',
                            },
                            4: {
                                icon: Phone,
                                color: 'emerald',
                                bg: 'from-emerald-50 to-emerald-100',
                            },
                            5: {
                                icon: MapPin,
                                color: 'orange',
                                bg: 'from-orange-50 to-orange-100',
                            },
                            6: { icon: Users, color: 'purple', bg: 'from-purple-50 to-purple-100' },
                        }[key] || {
                            icon: User,
                            color: 'neutral',
                            bg: 'from-neutral-50 to-neutral-100',
                        };

                        const IconComponent = sectionConfig.icon;

                        return (
                            <div key={key} className="group">
                                <div
                                    className={`hover:border- rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-2.5 transition-all duration-200 hover:scale-[1.01] hover:shadow-md${sectionConfig.color}-200/50`}
                                >
                                    {/* Compact section header */}
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`rounded-md bg-gradient-to-br p-1 ${sectionConfig.bg} transition-transform duration-200 group-hover:scale-105`}
                                            >
                                                <IconComponent
                                                    className={`text- size-3.5${sectionConfig.color}-600`}
                                                />
                                            </div>
                                            <h3
                                                className={`group-hover:text- text-xs font-semibold text-neutral-700 transition-colors duration-200${sectionConfig.color}-700`}
                                            >
                                                {studentDetail.heading}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Compact content grid */}
                                    <div className="space-y-1">
                                        {studentDetail.content &&
                                            studentDetail.content.length > 0 ? (
                                            studentDetail.content.map((obj, key2) => {
                                                if (!obj) {
                                                    return (
                                                        <div
                                                            key={key2}
                                                            className="group/item flex items-start gap-2 rounded-md px-1.5 py-1"
                                                        >
                                                            <div className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"></div>
                                                            <p className="text-xs italic text-primary-500">
                                                                No data available
                                                            </p>
                                                        </div>
                                                    );
                                                }

                                                const parts = obj.split(':');
                                                const fieldName = parts[0]?.trim();
                                                const value = parts.slice(1).join(':').trim();
                                                const canCopy =
                                                    value &&
                                                    value !== 'N/A' &&
                                                    value !== 'password not found' &&
                                                    value !== 'undefined';

                                                return (
                                                    <div
                                                        key={key2}
                                                        className="flex items-start gap-2 rounded-md px-1.5 py-1"
                                                    >
                                                        <div className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"></div>
                                                        <div className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-700">
                                                            <span className="font-medium text-neutral-600">
                                                                {fieldName}:{' '}
                                                            </span>
                                                            <span className="group/value relative inline-flex items-center text-neutral-800">
                                                                <span>{value}</span>
                                                                {canCopy && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (fieldName) {
                                                                                handleCopy(
                                                                                    value,
                                                                                    fieldName
                                                                                );
                                                                            }
                                                                        }}
                                                                        className="ml-2 cursor-pointer rounded-md p-1 hover:bg-neutral-200"
                                                                        style={{
                                                                            pointerEvents: 'auto',
                                                                        }}
                                                                    >
                                                                        {copiedField ===
                                                                            fieldName ? (
                                                                            <Check className="size-3 text-green-600" />
                                                                        ) : (
                                                                            <Copy className="size-3 text-neutral-500 hover:text-neutral-700" />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="py-3 text-center">
                                                <div className="mb-1 text-neutral-400">
                                                    <IconComponent className="mx-auto size-5 opacity-50" />
                                                </div>
                                                <p className="text-xs italic text-neutral-500">
                                                    No details available
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Minimal separator */}
                                {key < (overviewData?.length || 0) - 1 && (
                                    <div className="flex items-center justify-center py-1">
                                        <div className="h-px w-6 bg-gradient-to-r from-transparent via-neutral-200 to-transparent"></div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="py-6 text-center">
                        <div className="mb-2 text-neutral-400">
                            <User className="mx-auto size-8 opacity-50" />
                        </div>
                        <p className="text-xs text-neutral-500">No overview data available</p>
                    </div>
                )}
            </div>

            {/* Custom Fields Section */}
            {(customFields.length > 0 || fieldGroups.length > 0) && (
                <div className="space-y-2.5">
                    {/* Field Groups */}
                    {fieldGroups.map((group) => (
                        <div key={group.id} className="group">
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-blue-50/20 p-2.5 transition-all duration-200 hover:scale-[1.01] hover:border-blue-200/50 hover:shadow-md">
                                {/* Group header */}
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-md bg-gradient-to-br from-blue-50 to-blue-100 p-1 transition-transform duration-200 group-hover:scale-105">
                                            <Folders className="size-3.5 text-blue-600" />
                                        </div>
                                        <h3 className="text-xs font-semibold text-neutral-700 ">
                                            {group.name}
                                        </h3>
                                    </div>
                                </div>

                                {/* Group fields content */}
                                <div className="space-y-1">
                                    {group.fields.map((field) => {
                                        const value =
                                            selectedStudent?.custom_fields?.[field.id] || 'N/A';
                                        const canCopy =
                                            value &&
                                            value !== 'N/A' &&
                                            value !== 'null' &&
                                            value !== '';

                                        return (
                                            <div
                                                key={field.id}
                                                className="flex items-start gap-2 rounded-md px-1.5 py-1"
                                            >
                                                <div className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"></div>
                                                <div className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-700">
                                                    <span className="font-medium text-neutral-600">
                                                        {field.name}:{' '}
                                                    </span>
                                                    <span className="group/value relative inline-flex items-center text-neutral-800">
                                                        <span>{value}</span>
                                                        {canCopy && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleCopy(value, field.name)
                                                                }
                                                                className="ml-2 cursor-pointer rounded-md p-1 hover:bg-neutral-200"
                                                                style={{
                                                                    pointerEvents: 'auto',
                                                                }}
                                                            >
                                                                {copiedField === field.name ? (
                                                                    <Check className="size-3 text-green-600" />
                                                                ) : (
                                                                    <Copy className="size-3 text-neutral-500 hover:text-neutral-700" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Individual Custom Fields */}
                    {customFields.length > 0 && (
                        <div className="group">
                            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-2.5 transition-all duration-200 hover:scale-[1.01] hover:border-purple-200/50 hover:shadow-md">
                                {/* Section header */}
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-md bg-gradient-to-br from-purple-50 to-purple-100 p-1 transition-transform duration-200 group-hover:scale-105">
                                            <Tag className="size-3.5 text-purple-600" />
                                        </div>
                                        <h3 className="text-xs font-semibold text-neutral-700 transition-colors duration-200 group-hover:text-purple-700">
                                            Custom Fields
                                        </h3>
                                    </div>
                                </div>

                                {/* Custom fields content */}
                                <div className="space-y-1">
                                    {customFields.map((field) => {
                                        // Get the value from student's custom_fields object
                                        const value =
                                            selectedStudent?.custom_fields?.[field.id] || 'N/A';
                                        const canCopy =
                                            value &&
                                            value !== 'N/A' &&
                                            value !== 'null' &&
                                            value !== '';

                                        return (
                                            <div
                                                key={field.id}
                                                className="flex items-start gap-2 rounded-md px-1.5 py-1"
                                            >
                                                <div className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"></div>
                                                <div className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-700">
                                                    <span className="font-medium text-neutral-600">
                                                        {field.name}:{' '}
                                                    </span>
                                                    <span className="group/value relative inline-flex items-center text-neutral-800">
                                                        <span>{value}</span>
                                                        {canCopy && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleCopy(value, field.name)
                                                                }
                                                                className="ml-2 cursor-pointer rounded-md p-1 hover:bg-neutral-200"
                                                                style={{
                                                                    pointerEvents: 'auto',
                                                                }}
                                                            >
                                                                {copiedField === field.name ? (
                                                                    <Check className="size-3 text-green-600" />
                                                                ) : (
                                                                    <Copy className="size-3 text-neutral-500 hover:text-neutral-700" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
