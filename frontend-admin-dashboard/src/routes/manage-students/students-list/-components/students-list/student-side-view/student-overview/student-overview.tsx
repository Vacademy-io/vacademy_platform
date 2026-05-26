import {
    User,
    GraduationCap,
    Phone,
    MapPin,
    Users,
    Clock,
    HandCoins,
    Tag,
    Folders,
    FileText,
    DownloadSimple,
    MonitorPlay,
    Hourglass,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OverViewData, OverviewDetailsType, OverviewField } from './overview';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { EditStudentDetails } from './EditStudentDetails';
import { useStudentCredentialsStore } from '@/stores/students/students-list/useStudentCredentialsStore';
import { useGetStudentDetails } from '@/services/get-student-details';
import { getUserPlans, type UserPlan } from '@/services/user-plan';
import { getInstituteId } from '@/constants/helper';
import { StudentTable } from '@/types/student-table-types';
import { getFieldsForLocation, type FieldForLocation } from '@/lib/custom-fields/utils';
import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';
import type { FieldGroup } from '@/services/custom-field-settings';
import { getPublicUrl } from '@/services/upload_file';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileFieldRow,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHero,
    ProfileMiniBar,
} from '../profile-ui';

const DAY_MS = 1000 * 60 * 60 * 24;

// Per-section icon, keyed by the stable section id from OverViewData. Styling is
// uniform (neutral chip) — icons aid scanning, not decoration.
const SECTION_ICONS: Record<string, PhosphorIcon> = {
    general: GraduationCap,
    liveSession: MonitorPlay,
    referral: HandCoins,
    contact: Phone,
    location: MapPin,
    parents: Users,
};

const SessionExpiryCard = ({ plan }: { plan: UserPlan }) => {
    const now = Date.now();
    const endMs = plan.end_date ? new Date(plan.end_date).getTime() : null;
    const startMs = plan.start_date
        ? new Date(plan.start_date).getTime()
        : plan.created_at
          ? new Date(plan.created_at).getTime()
          : null;

    const daysLeft = endMs != null ? Math.max(0, Math.floor((endMs - now) / DAY_MS)) : 0;

    // Truthful "% of the plan window still remaining". Uses the real
    // start→end span when available; otherwise falls back to a 365-day window.
    let pctRemaining = 0;
    if (endMs != null && startMs != null && endMs > startMs) {
        pctRemaining = ((endMs - now) / (endMs - startMs)) * 100;
    } else if (endMs != null) {
        pctRemaining = (daysLeft / 365) * 100;
    }
    pctRemaining = Math.min(100, Math.max(0, pctRemaining));

    const tone = pctRemaining >= 50 ? 'success' : pctRemaining >= 15 ? 'warning' : 'danger';
    const toneText =
        tone === 'success'
            ? 'text-success-600'
            : tone === 'warning'
              ? 'text-warning-600'
              : 'text-danger-600';
    const toneBar =
        tone === 'success'
            ? 'bg-success-500'
            : tone === 'warning'
              ? 'bg-warning-500'
              : 'bg-danger-500';
    const status =
        tone === 'success'
            ? 'Active'
            : tone === 'warning'
              ? 'Renewal due soon'
              : 'Urgent renewal required';

    const label = plan.enroll_invite?.name?.trim() || 'Session';
    const expiryDisplay = endMs != null ? new Date(endMs).toLocaleDateString() : '—';

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-100">
                        <Clock className="size-4 text-neutral-500" />
                    </span>
                    <div className="min-w-0">
                        <h4
                            className="truncate text-sm font-semibold text-neutral-800"
                            title={label}
                        >
                            {label}
                        </h4>
                        <p className="text-xs text-neutral-500">Expires {expiryDisplay}</p>
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <span className={cn('text-base font-bold', toneText)}>{daysLeft}</span>
                    <span className="ml-1 text-xs text-neutral-500">days left</span>
                </div>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                {/* Width is data-driven (remaining fraction of the plan window) — inline style required for dynamic %. */}
                <div
                    className={cn('h-full rounded-full transition-all duration-500', toneBar)}
                    style={{ width: `${pctRemaining}%` }} // design-lint-ignore: inline-style — dynamic data-driven width
                />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-neutral-500">{status}</span>
                <span className="text-xs text-neutral-400">{Math.round(pctRemaining)}% remaining</span>
            </div>
        </div>
    );
};

export const StudentOverview = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();

    const [overviewData, setOverviewData] = useState<OverviewDetailsType[] | null>(null);
    const [copiedField, setCopiedField] = useState<string>('');
    const [customFields, setCustomFields] = useState<FieldForLocation[]>([]);
    const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
    const [tncFileUrl, setTncFileUrl] = useState<string | null>(null);
    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;
    const {
        data: studentDetails,
        isLoading,
        isError,
        error,
        refetch,
    } = useGetStudentDetails(userId || '');

    // Fetch all ACTIVE plans for this user; render one Session Expiry card per plan
    // that has a real expiry date set. Empty array → no cards (e.g., buy-only books).
    const instituteIdForPlans = getInstituteId();
    const { data: userPlansResponse } = useQuery({
        queryKey: ['STUDENT_OVERVIEW_USER_PLANS', userId, instituteIdForPlans],
        queryFn: () => getUserPlans(1, 50, ['ACTIVE'], userId || '', instituteIdForPlans || ''),
        enabled: !!userId && !!instituteIdForPlans,
        staleTime: 60_000,
    });
    const expiringPlans: UserPlan[] = (userPlansResponse?.content || []).filter(
        (plan) => plan.end_date != null
    );

    const { getDetailsFromPackageSessionId, instituteDetails } = useInstituteDetailsStore();
    const { getCredentials } = useStudentCredentialsStore();
    const [password, setPassword] = useState(
        getCredentials(isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '')
            ?.password || 'password not found'
    );

    // Load custom fields and groups for Learner Profile location
    useEffect(() => {
        const fields = getFieldsForLocation('Learner Profile');
        const settings = getCustomFieldSettingsFromCache();

        if (settings) {
            const visibilityKey = 'learnerProfile';
            const visibleGroups = settings.fieldGroups.filter((group) =>
                group.fields.some((field) => field.visibility[visibilityKey])
            );
            const filteredGroups = visibleGroups.map((group) => ({
                ...group,
                fields: group.fields.filter((field) => field.visibility[visibilityKey]),
            }));
            const fieldIdsInGroups = new Set(
                filteredGroups.flatMap((group) => group.fields.map((f) => f.id))
            );
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

    const handleCopy = async (value: string, label: string, isSecret?: boolean) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(label);
            // Never echo secret values (e.g. passwords) into the toast.
            toast.success(isSecret ? 'Copied to clipboard' : `${label} copied to clipboard`);
            setTimeout(() => setCopiedField(''), 2000);
        } catch {
            toast.error(`Failed to copy ${label}`);
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
        // @ts-expect-error - partial StudentTable assembled from two sources
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
            parents_mobile_number:
                studentDetails?.parents_mobile_number ||
                selectedStudent?.parents_mobile_number ||
                '',
            parents_email: studentDetails?.parents_email || selectedStudent?.parents_email || '',
            linked_institute_name:
                studentDetails?.linked_institute_name ||
                selectedStudent?.linked_institute_name ||
                '',
            created_at: studentDetails?.created_at || selectedStudent?.created_at || '',
            updated_at: studentDetails?.updated_at || selectedStudent?.updated_at || '',
            package_session_id: selectedStudent?.package_session_id || '',
            institute_enrollment_id:
                studentDetails?.institute_enrollment_id ||
                selectedStudent?.institute_enrollment_id ||
                '',
            institute_enrollment_number:
                studentDetails?.institute_enrollment_number ||
                selectedStudent?.institute_enrollment_number ||
                '',
            status: selectedStudent?.status || 'ACTIVE',
            session_expiry_days: selectedStudent?.session_expiry_days || 0,
            institute_id: selectedStudent?.institute_id || '',
            expiry_date: selectedStudent?.expiry_date || 0,
            face_file_id: studentDetails?.face_file_id || selectedStudent?.face_file_id || '',
            attempt_id: '',
            parents_to_mother_mobile_number:
                studentDetails?.parents_to_mother_mobile_number ||
                selectedStudent?.parents_to_mother_mobile_number ||
                '',
            parents_to_mother_email:
                studentDetails?.parents_to_mother_email ||
                selectedStudent?.parents_to_mother_email ||
                '',
            package_id: selectedStudent?.package_id || '',
            country: studentDetails?.country || selectedStudent?.country || '',
            attendance_percent:
                studentDetails?.attendance_percentage ||
                studentDetails?.attendance_percent ||
                selectedStudent?.attendance_percent ||
                0,
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
        return <ProfileSkeleton blocks={4} />;
    }

    if (isError) {
        console.error(error);
        return (
            <ProfileError
                title="Couldn't load profile details"
                hint="Something went wrong while fetching this learner. Please try again."
                onRetry={() => refetch()}
            />
        );
    }

    const hasCustom = customFields.length > 0 || fieldGroups.length > 0;

    return (
        <div className="flex flex-col gap-3 text-neutral-600">
            {/* Action row — Edit lives here, scoped to the whole profile. */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Profile details
                </span>
                <EditStudentDetails />
            </div>

            {/* Renewal-urgency hero + remaining expiry cards.
                The earliest-expiring plan is promoted to a ProfileHero so the
                2-second-glance answer ("how long is this student's plan valid?")
                is the first thing the admin sees. Subsequent plans stay as the
                compact SessionExpiryCard. */}
            {(() => {
                const sorted = expiringPlans.slice().sort((a, b) => {
                    const ad = a.end_date ? new Date(a.end_date).getTime() : Infinity;
                    const bd = b.end_date ? new Date(b.end_date).getTime() : Infinity;
                    return ad - bd;
                });
                const [hero, ...rest] = sorted;
                if (!hero) return null;
                const now = Date.now();
                const endMs = hero.end_date ? new Date(hero.end_date).getTime() : null;
                const startMs = hero.start_date
                    ? new Date(hero.start_date).getTime()
                    : hero.created_at
                      ? new Date(hero.created_at).getTime()
                      : null;
                const daysLeft =
                    endMs != null ? Math.max(0, Math.floor((endMs - now) / DAY_MS)) : 0;

                let pctRemaining = 0;
                if (endMs != null && startMs != null && endMs > startMs) {
                    pctRemaining = ((endMs - now) / (endMs - startMs)) * 100;
                } else if (endMs != null) {
                    pctRemaining = (daysLeft / 365) * 100;
                }
                pctRemaining = Math.min(100, Math.max(0, pctRemaining));

                const tone =
                    pctRemaining >= 50 ? 'success' : pctRemaining >= 15 ? 'warning' : 'danger';
                const planName = hero.enroll_invite?.name?.trim() || 'Session';
                const formattedExpiry =
                    endMs != null ? new Date(endMs).toLocaleDateString() : '—';

                return (
                    <>
                        <ProfileHero
                            eyebrow="ACTIVE PLAN"
                            title={`${daysLeft} days remaining`}
                            subtitle={`${planName} · Expires ${formattedExpiry}`}
                            icon={Hourglass}
                            tone={tone}
                        >
                            <ProfileMiniBar value={pctRemaining} tone={tone} />
                        </ProfileHero>

                        {rest.map((plan) => (
                            <SessionExpiryCard key={plan.id} plan={plan} />
                        ))}
                    </>
                );
            })()}

            {/* Overview sections */}
            {selectedStudent != null ? (
                overviewData
                    ?.filter((section) => section.id !== 'credentials')
                    .map((section) => {
                        const Icon = SECTION_ICONS[section.id] ?? User;
                        return (
                            <ProfileSectionCard
                                key={section.id}
                                icon={Icon}
                                heading={section.heading}
                            >
                                {section.content.length > 0 ? (
                                    <dl className="divide-y divide-neutral-100">
                                        {section.content.map((field: OverviewField, i) => (
                                            <ProfileFieldRow
                                                key={i}
                                                label={field.label}
                                                value={field.value}
                                                copied={copiedField === field.label}
                                                onCopy={() =>
                                                    handleCopy(
                                                        field.value,
                                                        field.label,
                                                        field.isSecret
                                                    )
                                                }
                                            />
                                        ))}
                                    </dl>
                                ) : (
                                    <p className="py-2 text-xs italic text-neutral-400">
                                        No details available
                                    </p>
                                )}
                            </ProfileSectionCard>
                        );
                    })
            ) : (
                <ProfileEmpty icon={User} title="No overview data available" />
            )}

            {/* Custom field groups + individual custom fields */}
            {hasCustom && (
                <>
                    {fieldGroups.map((group) => (
                        <ProfileSectionCard key={group.id} icon={Folders} heading={group.name}>
                            <dl className="divide-y divide-neutral-100">
                                {group.fields.map((field) => {
                                    const value =
                                        selectedStudent?.custom_fields?.[field.id] || 'N/A';
                                    return (
                                        <ProfileFieldRow
                                            key={field.id}
                                            label={field.name}
                                            value={value}
                                            copied={copiedField === field.name}
                                            onCopy={() => handleCopy(value, field.name)}
                                        />
                                    );
                                })}
                            </dl>
                        </ProfileSectionCard>
                    ))}

                    {customFields.length > 0 && (
                        <ProfileSectionCard icon={Tag} heading="Custom Fields">
                            <dl className="divide-y divide-neutral-100">
                                {customFields.map((field) => {
                                    const value =
                                        selectedStudent?.custom_fields?.[field.id] || 'N/A';
                                    return (
                                        <ProfileFieldRow
                                            key={field.id}
                                            label={field.name}
                                            value={value}
                                            copied={copiedField === field.name}
                                            onCopy={() => handleCopy(value, field.name)}
                                        />
                                    );
                                })}
                            </dl>
                        </ProfileSectionCard>
                    )}
                </>
            )}

            {/* Terms & Conditions */}
            <ProfileSectionCard icon={FileText} heading="Terms & Conditions">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 py-1">
                        <span className="text-xs text-neutral-500">Status</span>
                        {selectedStudent?.tnc_accepted ? (
                            <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700 ring-1 ring-success-200">
                                Signed
                            </span>
                        ) : (
                            <span className="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-700 ring-1 ring-warning-200">
                                Not Signed
                            </span>
                        )}
                    </div>

                    {selectedStudent?.tnc_accepted && selectedStudent?.tnc_accepted_date && (
                        <div className="flex items-center justify-between gap-3 py-1">
                            <span className="text-xs text-neutral-500">Signed on</span>
                            <span className="text-sm text-neutral-800">
                                {new Date(selectedStudent.tnc_accepted_date).toLocaleDateString()}
                            </span>
                        </div>
                    )}

                    {selectedStudent?.tnc_accepted && tncFileUrl && (
                        <a
                            href={tncFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                        >
                            <DownloadSimple className="size-4" />
                            Download Signed PDF
                        </a>
                    )}
                </div>
            </ProfileSectionCard>
        </div>
    );
};
