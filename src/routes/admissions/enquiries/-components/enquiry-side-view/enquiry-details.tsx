import { useQuery } from '@tanstack/react-query';
import { handleFetchEnquiryDetails } from '../../-services/get-enquiry-details';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { format } from 'date-fns';
import { TimelinePanel } from './timeline-panel';
import { toast } from 'sonner';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex flex-col gap-0.5 border-b border-neutral-100 py-2 last:border-0">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {label}
        </span>
        <span className="text-sm text-neutral-800">{value || '—'}</span>
    </div>
);

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <div className="h-3.5 w-1 rounded-full bg-primary-500" />
            {title}
        </h4>
        {children}
    </div>
);

const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
        NEW: 'bg-blue-100 text-blue-700',
        CONTACTED: 'bg-green-100 text-green-700',
        QUALIFIED: 'bg-purple-100 text-purple-700',
        NOT_ELIGIBLE: 'bg-red-100 text-red-700',
        ENQUIRY: 'bg-amber-100 text-amber-700',
        APPLICATION: 'bg-indigo-100 text-indigo-700',
    };
    const cls = colors[status] ?? 'bg-gray-100 text-gray-700';
    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
};

const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
        return format(new Date(dateStr), 'd MMM yyyy');
    } catch {
        return dateStr;
    }
};

export const EnquiryDetails = ({ enquiryId }: { enquiryId: string | null }) => {
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const { data, isLoading, error } = useQuery({
        ...handleFetchEnquiryDetails(enquiryId),
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center gap-3 py-12">
                <DashboardLoader />
                <p className="animate-pulse text-sm text-neutral-500">Loading enquiry details…</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex h-40 items-center justify-center rounded-xl border border-red-100 bg-red-50">
                <p className="text-sm text-red-500">Failed to load enquiry details.</p>
            </div>
        );
    }

    const customFieldEntries = Object.entries(data.custom_fields || {}).filter(
        ([, v]) => v !== null && v !== undefined && v !== ''
    );

    const packageDetails = data.campaign?.destination_package_session_id
        ? getDetailsFromPackageSessionId({
              packageSessionId: data.campaign.destination_package_session_id,
          })
        : null;

    const applyingForClass = packageDetails
        ? `${packageDetails.package_dto.package_name} - ${packageDetails.level.level_name}`
        : data.child?.applying_for_class ?? null;

    const academicYear = packageDetails
        ? packageDetails.session.session_name
        : data.child?.academic_year ?? null;

    return (
        <div className="flex flex-col gap-4">
            {/* Header Card */}
            <div className="rounded-xl border border-neutral-100 bg-gradient-to-r from-neutral-50 to-primary-50/20 p-4 shadow-sm">
                {/* Tracking ID */}
                {data.tracking_id && (
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                                Tracking ID
                            </p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-neutral-800">
                                {data.tracking_id}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(data.tracking_id!);
                                toast.success('Tracking ID copied!');
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-500 shadow-sm transition hover:border-primary-300 hover:text-primary-600"
                        >
                            <svg
                                className="size-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                        </button>
                    </div>
                )}

                {/* Status Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/70 px-3 py-2.5 shadow-sm">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                            Enquiry Status
                        </p>
                        <StatusBadge status={data.enquiry_status} />
                    </div>
                    {data.overall_status && (
                        <div className="rounded-lg bg-white/70 px-3 py-2.5 shadow-sm">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                                Overall Status
                            </p>
                            <StatusBadge status={data.overall_status} />
                        </div>
                    )}
                </div>
            </div>

            {/* Child Info */}
            <SectionCard title="Student / Child">
                <InfoRow label="Name" value={data.child?.name} />
                <InfoRow label="Date of Birth" value={formatDate(data.child?.dob)} />
                <InfoRow label="Gender" value={data.child?.gender} />
                <InfoRow label="Applying For Class" value={applyingForClass} />
                <InfoRow label="Academic Year" value={academicYear} />
                <InfoRow label="Previous School" value={data.child?.previous_school_name} />
            </SectionCard>

            {/* Parent / Guardian Info */}
            <SectionCard title="Parent / Guardian">
                <InfoRow label="Name" value={data.parent?.name} />
                <InfoRow label="Email" value={data.parent?.email} />
                <InfoRow label="Phone" value={data.parent?.phone} />
                <InfoRow label="Address" value={data.parent?.address_line} />
                <InfoRow label="City" value={data.parent?.city} />
                <InfoRow label="Pin Code" value={data.parent?.pin_code} />
            </SectionCard>

            {/* Enquiry Metadata */}
            <SectionCard title="Enquiry Info">
                <InfoRow label="Mode" value={data.mode} />
                <InfoRow label="Reference Source" value={data.reference_source} />
                <InfoRow label="Interest Score" value={data.interest_score?.toString()} />
                <InfoRow label="Fee Range Expectation" value={data.fee_range_expectation} />
                <InfoRow label="Transport Requirement" value={data.transport_requirement} />
                <InfoRow label="Current Stage" value={data.current_stage_name} />
                <InfoRow label="Created At" value={formatDate(data.enquiry_created_at)} />
                <InfoRow label="Updated At" value={formatDate(data.enquiry_updated_at)} />
                {data.notes && <InfoRow label="Notes" value={data.notes} />}
            </SectionCard>

            {/* Campaign Info */}
            {data.campaign && (
                <SectionCard title="Enquiry">
                    <InfoRow label="Enquiry" value={data.campaign.campaign_name} />
                    <InfoRow label="Source" value={data.campaign.source_type} />
                    <InfoRow label="Class / Level" value={data.campaign.level_name} />
                    <InfoRow label="Session" value={data.campaign.package_session_name} />
                </SectionCard>
            )}

            {/* Activity & Notes Timeline */}
            {data.enquiry_id && <TimelinePanel entityType="ENQUIRY" entityId={data.enquiry_id} />}

            {/* Application Status */}
            <SectionCard title="Application Status">
                <InfoRow label="Applied" value={data.already_applied ? 'Yes' : 'No'} />
                <InfoRow label="Applicant ID" value={data.applicant_id} />
                <InfoRow label="Assigned Counselor" value={data.assigned_counselor} />
            </SectionCard>

            {/* Custom Fields */}
            {customFieldEntries.length > 0 && (
                <SectionCard title="Custom Fields">
                    {customFieldEntries.map(([key, value]) => (
                        <InfoRow key={key} label={key} value={value as string} />
                    ))}
                </SectionCard>
            )}
        </div>
    );
};
