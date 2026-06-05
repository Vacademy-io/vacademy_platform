import {
    User,
    GraduationCap,
    Phone,
    MapPin,
    Users,
    HandCoinsIcon,
    Tag,
    Folders,
    FileText,
    DownloadSimple,
    MonitorPlay,
} from '@phosphor-icons/react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { OverViewData, OverviewDetailsType } from './overview';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useStudentCredentialsStore } from '@/stores/students/students-list/useStudentCredentialsStore';
import { useGetStudentDetails } from '@/services/get-student-details';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { StudentTable } from '@/types/student-table-types';
import { getFieldsForLocation, type FieldForLocation } from '@/lib/custom-fields/utils';
import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';
import type { FieldGroup } from '@/services/custom-field-settings';
import { getPublicUrl } from '@/services/upload_file';
import { ProfileSectionCard, ProfileFieldRow, ProfileEmpty } from '../profile-ui';
import { OverviewHeader } from './overview-header';
import { OverviewNeedsAttention } from './overview-needs-attention';
import { OverviewQuickActions } from './overview-quick-actions';
import { OverviewBottomGrid } from './overview-bottom-grid';
import { OverviewContinueLearning } from './overview-continue-learning';
import { useLeadProfiles } from '@/hooks/use-lead-profiles';
import { useQuery } from '@tanstack/react-query';
import { fetchUserInvoices } from '@/services/invoice-service';
import { useLearnerPackagesQuery } from '@/routes/manage-students/students-list/-services/getLearnerPackages';
import { getInstituteId } from '@/constants/helper';

export const StudentOverview = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();

    const [overviewData, setOverviewData] = useState<OverviewDetailsType[] | null>(null);
    const [copiedField, setCopiedField] = useState<string>('');
    const [customFields, setCustomFields] = useState<FieldForLocation[]>([]);
    const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
    const [tncFileUrl, setTncFileUrl] = useState<string | null>(null);
    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;
    const { data: studentDetails, isLoading, isError, error } = useGetStudentDetails(userId || '');
    // Lead score for the Snapshot tile. Reuses the cached batch query so other
    // tables don't refetch when Overview opens. Skips when no user is selected.
    const { profiles: leadProfiles } = useLeadProfiles(userId ? [userId] : [], !!userId);
    const leadProfile = userId ? leadProfiles[userId] : undefined;

    // Outstanding amount — sum of unpaid invoices. Same key + service the
    // Payment History tab uses, so opening Overview reuses the cached result.
    const { data: invoicesData } = useQuery({
        queryKey: ['user-invoices', userId],
        queryFn: () => fetchUserInvoices(userId || ''),
        staleTime: 60000,
        enabled: !!userId,
    });
    const outstandingAmount = useMemo(() => {
        const invoices = (invoicesData as { content?: Array<{ status: string; total_amount: number }> } | undefined)?.content;
        if (!invoices) return undefined;
        return invoices
            .filter((inv) => {
                const s = inv.status?.toUpperCase();
                return s === 'UNPAID' || s === 'OVERDUE' || s === 'PARTIAL';
            })
            .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    }, [invoicesData]);

    // Active courses / progress — same query the Courses tab uses, page 0,
    // small size. percentage_completed averaged across in-progress packages.
    const { data: progressPackagesData } = useLearnerPackagesQuery({
        instituteId: getInstituteId() || '',
        userId: userId || '',
        page: 0,
        size: 10,
        type: 'PROGRESS',
    });
    const progressInfo = useMemo(() => {
        const packages = progressPackagesData?.content;
        if (!packages || packages.length === 0) return undefined;
        const avg =
            packages.reduce((s, p) => s + (p.percentage_completed || 0), 0) /
            packages.length;
        // "Behind" = active courses with <25% progress (handoff doesn't define
        // a threshold per-subject without a deeper API; mirror the value the
        // Lead Profile inactivity rule uses).
        const behindCount = packages.filter(
            (p) => (p.percentage_completed || 0) < 25
        ).length;
        // First in-progress course = "Continue Learning" anchor.
        const firstActive = packages[0];
        return {
            averagePercent: avg,
            behindCount,
            primary: firstActive,
        };
    }, [progressPackagesData]);

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

    // Fetch signed TnC PDF URL when student changes
    useEffect(() => {
        setTncFileUrl(null);
        if (selectedStudent?.tnc_accepted && selectedStudent?.tnc_file_id) {
            getPublicUrl(selectedStudent.tnc_file_id).then((url) => {
                if (url) setTncFileUrl(url);
            });
        }
    }, [selectedStudent?.tnc_file_id]);

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

    }, [selectedStudent, instituteDetails, password, studentDetails]);

    if (isLoading) {
        return <DashboardLoader />;
    }

    if (isError) {
        console.error(error);
        return <div>Error fetching student details</div>;
    }

    const SECTION_ICONS: Record<number, typeof User> = {
        1: GraduationCap,
        2: HandCoinsIcon,
        3: Phone,
        4: MapPin,
        5: Users,
    };

    // Helper: a row is meaningful if its value isn't empty/N/A/0 — keeps the
    // Overview tab signal-only, never showing a wall of em-dashes.
    const isMeaningfulRow = (row: string | null | undefined): boolean => {
        if (!row) return false;
        const colonIdx = row.indexOf(':');
        const rawValue = colonIdx >= 0 ? row.slice(colonIdx + 1).trim() : row.trim();
        if (!rawValue) return false;
        const lower = rawValue.toLowerCase();
        if (lower === 'n/a' || lower === 'undefined' || lower === 'null') return false;
        // For "Count: 0" type rows — drop when numeric value is 0.
        if (rawValue === '0' || rawValue === '0.0' || rawValue === '0%') return false;
        return true;
    };

    // Pull Course/Level/Session for the rich OverviewHeader. The same call powers
    // the General Details card body below — react-query/Zustand both stay stable.
    const headerDetails = getDetailsFromPackageSessionId({
        packageSessionId: isSubmissionTab
            ? selectedStudent?.package_id || ''
            : selectedStudent?.package_session_id || '',
    });
    const headerAttendance =
        studentDetails?.attendance_percentage ??
        studentDetails?.attendance_percent ??
        selectedStudent?.attendance_percent;

    return (
        <div className="flex flex-col gap-3 text-card-foreground">
            {/* Rich Overview Header — Course chip + 4-stat health strip */}
            <OverviewHeader
                student={selectedStudent}
                course={headerDetails?.package_dto?.package_name}
                level={headerDetails?.level?.level_name}
                session={headerDetails?.session?.session_name}
                attendancePercent={
                    typeof headerAttendance === 'number' ? headerAttendance : undefined
                }
                progressPercent={progressInfo?.averagePercent}
                outstandingAmount={outstandingAmount}
                leadScore={
                    typeof leadProfile?.best_score === 'number'
                        ? leadProfile.best_score
                        : undefined
                }
            />

            {/* Needs Attention card — action-first triage strip per design handoff. */}
            <OverviewNeedsAttention
                student={selectedStudent}
                tncAccepted={selectedStudent?.tnc_accepted ?? undefined}
                outstandingAmount={outstandingAmount}
                behindCount={progressInfo?.behindCount}
            />

            {/* Quick Actions: every common admin action 1-click from Overview. */}
            <OverviewQuickActions student={selectedStudent} />

            {/* Continue Learning card — shows only when the learner has active courses. */}
            {progressInfo && (
                <OverviewContinueLearning
                    averagePercent={progressInfo.averagePercent}
                    primaryCourseName={progressInfo.primary?.package_name}
                    primaryLevel={progressInfo.primary?.level_name}
                    primarySession={headerDetails?.session?.session_name}
                    behindCount={progressInfo.behindCount}
                />
            )}

            {/* 2-col bottom grid: Enrolment Details (left) + Contact (right). */}
            <OverviewBottomGrid
                student={selectedStudent}
                course={headerDetails?.package_dto?.package_name}
                level={headerDetails?.level?.level_name}
                session={headerDetails?.session?.session_name}
                onCopy={handleCopy}
                copiedField={copiedField}
            />

            {/* Overview sections — hide-when-empty + row-level filtering.
                General Details (key=1) and Contact Information (key=3) are
                absorbed into the OverviewBottomGrid above; skip them here so
                the data isn't shown twice. */}
            {selectedStudent != null ? (
                overviewData?.map((studentDetail, key) => {
                    if (key === 0) return null; // Account Credentials → Portal Access tab
                    if (key === 1) return null; // General Details → OverviewBottomGrid
                    if (key === 3) return null; // Contact Information → OverviewBottomGrid
                    const SectionIcon = SECTION_ICONS[key] ?? User;
                    const meaningfulRows = (studentDetail.content || []).filter(
                        isMeaningfulRow
                    );

                    // Hide empty sections entirely. Edit Details now lives in
                    // the Quick Actions row, so even General Details can hide
                    // when nothing's filled.
                    if (meaningfulRows.length === 0) return null;

                    return (
                        <ProfileSectionCard
                            key={key}
                            icon={SectionIcon}
                            heading={studentDetail.heading}
                        >
                            <dl className="divide-y divide-border">
                                {meaningfulRows.map((obj, key2) => {
                                    const colonIdx = obj.indexOf(':');
                                    const fieldName =
                                        colonIdx >= 0
                                            ? obj.slice(0, colonIdx).trim()
                                            : obj.trim();
                                    const value =
                                        colonIdx >= 0 ? obj.slice(colonIdx + 1).trim() : '';
                                    const canCopy = !!value;
                                    return (
                                        <ProfileFieldRow
                                            key={key2}
                                            label={fieldName}
                                            value={value}
                                            copied={copiedField === fieldName}
                                            onCopy={
                                                canCopy
                                                    ? () => handleCopy(value, fieldName)
                                                    : undefined
                                            }
                                        />
                                    );
                                })}
                            </dl>
                        </ProfileSectionCard>
                    );
                })
            ) : (
                <ProfileEmpty icon={User} title="No overview data available" />
            )}

            {/* Custom field groups */}
            {fieldGroups.map((group) => (
                <ProfileSectionCard key={group.id} icon={Folders} heading={group.name}>
                    <dl className="divide-y divide-border">
                        {group.fields.map((field) => {
                            const value =
                                selectedStudent?.custom_fields?.[field.id] || 'N/A';
                            const canCopy =
                                !!value &&
                                value !== 'N/A' &&
                                value !== 'null' &&
                                value !== '';
                            return (
                                <ProfileFieldRow
                                    key={field.id}
                                    label={field.name}
                                    value={value}
                                    copied={copiedField === field.name}
                                    onCopy={
                                        canCopy ? () => handleCopy(value, field.name) : undefined
                                    }
                                />
                            );
                        })}
                    </dl>
                </ProfileSectionCard>
            ))}

            {/* Individual custom fields */}
            {customFields.length > 0 && (
                <ProfileSectionCard icon={Tag} heading="Custom Fields">
                    <dl className="divide-y divide-border">
                        {customFields.map((field) => {
                            const value =
                                selectedStudent?.custom_fields?.[field.id] || 'N/A';
                            const canCopy =
                                !!value &&
                                value !== 'N/A' &&
                                value !== 'null' &&
                                value !== '';
                            return (
                                <ProfileFieldRow
                                    key={field.id}
                                    label={field.name}
                                    value={value}
                                    copied={copiedField === field.name}
                                    onCopy={
                                        canCopy ? () => handleCopy(value, field.name) : undefined
                                    }
                                />
                            );
                        })}
                    </dl>
                </ProfileSectionCard>
            )}

            {/* Terms & Conditions — only render the card when SIGNED (compact
                proof + PDF link). When unsigned, the OverviewAlerts strip at
                top already shows the warning chip, so this card is redundant. */}
            {selectedStudent?.tnc_accepted && (
                <ProfileSectionCard icon={FileText} heading="Terms & Conditions">
                    <dl className="divide-y divide-border">
                        <ProfileFieldRow
                            label="Status"
                            value={
                                <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-caption font-semibold text-success-700 ring-1 ring-success-200">
                                    Signed
                                </span>
                            }
                        />
                        {selectedStudent?.tnc_accepted_date && (
                            <ProfileFieldRow
                                label="Signed on"
                                value={new Date(
                                    selectedStudent.tnc_accepted_date
                                ).toLocaleDateString()}
                            />
                        )}
                        {tncFileUrl && (
                            <ProfileFieldRow
                                label="Signed PDF"
                                value={
                                    <a
                                        href={tncFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-body font-medium text-primary-600 hover:text-primary-800 hover:underline"
                                    >
                                        <DownloadSimple className="size-3.5" />
                                        Download
                                    </a>
                                }
                            />
                        )}
                    </dl>
                </ProfileSectionCard>
            )}
        </div>
    );
};
