import { useQuery } from '@tanstack/react-query';
import { fetchApplicantList } from '@/routes/admissions/-services/applicant-services';
import { format } from 'date-fns';
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

interface ApplicationDetailsProps {
    applicantId: string | null;
}

const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
        return format(new Date(dateStr), 'd MMM yyyy');
    } catch {
        return dateStr;
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'SUBMITTED':
            return 'bg-blue-100 text-blue-800';
        case 'ADMITTED':
        case 'APPROVED':
            return 'bg-green-100 text-green-800';
        case 'PENDING':
            return 'bg-orange-100 text-orange-800';
        case 'REJECTED':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-neutral-100 text-neutral-800';
    }
};

export const ApplicationDetails = ({ applicantId }: ApplicationDetailsProps) => {
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id || '';

    const { data, isLoading, error } = useQuery({
        queryKey: ['applicant-details', applicantId, instituteId],
        queryFn: async () => {
            const response = await fetchApplicantList(
                {
                    institute_id: instituteId,
                    search: '',
                },
                0,
                100
            );
            const applicant = response.content.find((app) => app.applicant_id === applicantId);
            if (!applicant) throw new Error('Applicant not found');
            return applicant;
        },
        enabled: !!applicantId && !!instituteId,
    });

    if (!applicantId) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center">
                <svg
                    className="mb-2 size-10 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m0 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p className="text-sm text-neutral-600">No application found</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-6">
                <div className="text-neutral-500">Loading application details...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center">
                <svg
                    className="mb-2 size-10 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m0 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p className="text-sm text-neutral-600">Failed to load application details</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Status Badge */}
            <SectionCard title="Status">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-600">Overall Status:</span>
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                            data.overall_status
                        )}`}
                    >
                        {data.overall_status}
                    </span>
                </div>
            </SectionCard>

            {/* Student Information */}
            <SectionCard title="Student Information">
                <InfoRow label="Full Name" value={data.student_data?.full_name || 'N/A'} />
                <InfoRow
                    label="Date of Birth"
                    value={formatDate(data.student_data?.date_of_birth) || 'N/A'}
                />
                <InfoRow label="Gender" value={data.student_data?.gender || 'N/A'} />
                <InfoRow
                    label="Class Applied For"
                    value={data.package_session?.level_name || 'N/A'}
                />
                {data.student_data?.father_name && (
                    <InfoRow label="Father Name" value={data.student_data.father_name} />
                )}
                {data.student_data?.mother_name && (
                    <InfoRow label="Mother Name" value={data.student_data.mother_name} />
                )}
                {data.student_data?.applying_for_class && (
                    <InfoRow
                        label="Applying For Class"
                        value={data.student_data.applying_for_class}
                    />
                )}
                {data.student_data?.academic_year && (
                    <InfoRow label="Academic Year" value={data.student_data.academic_year} />
                )}
            </SectionCard>

            {/* Parent Information */}
            <SectionCard title="Parent Information">
                <InfoRow label="Full Name" value={data.parent_data?.full_name || 'N/A'} />
                <InfoRow label="Email" value={data.parent_data?.email || 'N/A'} />
                <InfoRow label="Mobile Number" value={data.parent_data?.mobile_number || 'N/A'} />
                {data.parent_data?.address_line && (
                    <InfoRow label="Address" value={data.parent_data.address_line} />
                )}
            </SectionCard>

            {/* Application Timeline */}
            <SectionCard title="Application Timeline">
                <div className="space-y-2">
                    <InfoRow label="Tracking ID" value={data.tracking_id} />
                    <InfoRow
                        label="Current Stage"
                        value={data.application_stage?.stage_name || 'N/A'}
                    />
                    <InfoRow label="Stage Status" value={data.application_stage_status || 'N/A'} />
                    <InfoRow
                        label="Created At"
                        value={format(new Date(data.created_at), 'd MMM yyyy, h:mm a')}
                    />
                    <InfoRow
                        label="Last Updated"
                        value={format(new Date(data.updated_at), 'd MMM yyyy, h:mm a')}
                    />
                </div>
            </SectionCard>
        </div>
    );
};
