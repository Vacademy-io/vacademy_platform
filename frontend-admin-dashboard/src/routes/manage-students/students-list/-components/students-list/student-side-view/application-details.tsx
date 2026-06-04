import { useQuery } from '@tanstack/react-query';
import { fetchApplicantList } from '@/routes/admissions/-services/applicant-services';
import { format } from 'date-fns';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    ClipboardText,
    Student,
    Users,
    CheckCircle,
    Clock,
    XCircle,
    Spinner,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileFieldRow,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHero,
} from './profile-ui';

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

const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
        return format(new Date(dateStr), 'd MMM yyyy, h:mm a');
    } catch {
        return dateStr ?? '—';
    }
};

// Derive the hero tone and display label from the raw overall_status value.
type StatusConfig = {
    tone: 'success' | 'danger' | 'warning' | 'neutral';
    label: string;
    icon: PhosphorIcon;
    pillBg: string;
    pillText: string;
    pillRing: string;
};

const getStatusConfig = (status: string): StatusConfig => {
    switch (status) {
        case 'ADMITTED':
        case 'APPROVED':
            return {
                tone: 'success',
                label: status === 'ADMITTED' ? 'Admitted' : 'Approved',
                icon: CheckCircle,
                pillBg: 'bg-success-50',
                pillText: 'text-success-700',
                pillRing: 'ring-success-200',
            };
        case 'REJECTED':
            return {
                tone: 'danger',
                label: 'Rejected',
                icon: XCircle,
                pillBg: 'bg-danger-50',
                pillText: 'text-danger-700',
                pillRing: 'ring-danger-200',
            };
        case 'PENDING':
            return {
                tone: 'warning',
                label: 'Pending',
                icon: Clock,
                pillBg: 'bg-warning-50',
                pillText: 'text-warning-700',
                pillRing: 'ring-warning-200',
            };
        case 'UNDER_REVIEW':
        case 'SUBMITTED':
            return {
                tone: 'warning',
                label: status === 'UNDER_REVIEW' ? 'Under Review' : 'Submitted',
                icon: Spinner,
                pillBg: 'bg-warning-50',
                pillText: 'text-warning-700',
                pillRing: 'ring-warning-200',
            };
        default:
            return {
                tone: 'neutral',
                label: status || '—',
                icon: ClipboardText,
                pillBg: 'bg-neutral-100',
                pillText: 'text-neutral-700',
                pillRing: 'ring-neutral-200',
            };
    }
};

// ── Stage progress indicator ──────────────────────────────────────────────────
//
// Derives a 3-step funnel from the raw overall_status: Submitted → Under Review
// → terminal (Approved / Rejected / Admitted). "current" step is highlighted with
// the tone colour; prior steps show success; future steps are muted neutral.

type StepState = 'done' | 'current' | 'upcoming';

interface Step {
    key: string;
    label: string;
}

const STAGE_STEPS: Step[] = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'review', label: 'Under Review' },
    { key: 'terminal', label: 'Decision' },
];

const deriveStepIndex = (status: string): number => {
    switch (status) {
        case 'SUBMITTED':
            return 0;
        case 'UNDER_REVIEW':
        case 'PENDING':
            return 1;
        case 'APPROVED':
        case 'ADMITTED':
        case 'REJECTED':
            return 2;
        default:
            return 0;
    }
};

const ApplicationStageProgress = ({
    status,
}: {
    status: string;
}) => {
    const currentIdx = deriveStepIndex(status);
    const isRejected = status === 'REJECTED';

    return (
        <div className="flex items-center gap-0">
            {STAGE_STEPS.map((step, i) => {
                const state: StepState =
                    i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming';

                // Terminal step label: show actual decision text instead of generic "Decision"
                const label =
                    i === STAGE_STEPS.length - 1 && state === 'current'
                        ? status === 'REJECTED'
                            ? 'Rejected'
                            : status === 'APPROVED'
                              ? 'Approved'
                              : status === 'ADMITTED'
                                ? 'Admitted'
                                : step.label
                        : step.label;

                const dotCn = cn(
                    'size-3 shrink-0 rounded-full ring-2',
                    state === 'done'
                        ? 'bg-success-500 ring-success-200'
                        : state === 'current' && isRejected
                          ? 'bg-danger-500 ring-danger-200'
                          : state === 'current'
                            ? 'bg-primary-500 ring-primary-200'
                            : 'bg-neutral-200 ring-neutral-100'
                );

                const labelCn = cn(
                    'text-xs font-medium',
                    state === 'done'
                        ? 'text-success-600'
                        : state === 'current' && isRejected
                          ? 'text-danger-600'
                          : state === 'current'
                            ? 'text-primary-600'
                            : 'text-neutral-400'
                );

                const connectorCn = cn(
                    'h-px flex-1 mx-1',
                    i < currentIdx ? 'bg-success-300' : 'bg-neutral-200'
                );

                return (
                    <div key={step.key} className="flex min-w-0 flex-1 items-center">
                        {/* Step node */}
                        <div className="flex shrink-0 flex-col items-center gap-1">
                            <span className={dotCn} />
                            <span className={labelCn}>{label}</span>
                        </div>
                        {/* Connector line — not after last step */}
                        {i < STAGE_STEPS.length - 1 && (
                            <div className={connectorCn} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

export const ApplicationDetails = ({ applicantId }: ApplicationDetailsProps) => {
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id || '';

    const { data, isLoading, isError, refetch } = useQuery({
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
            <ProfileEmpty
                icon={ClipboardText}
                title="No application found"
                hint="No application is linked to this learner yet."
            />
        );
    }

    if (isLoading) {
        return <ProfileSkeleton blocks={4} />;
    }

    if (isError || !data) {
        return (
            <ProfileError
                title="Couldn't load application details"
                hint="Something went wrong while fetching the application. Please try again."
                onRetry={() => refetch()}
            />
        );
    }

    const cfg = getStatusConfig(data.overall_status);
    const stageName = data.application_stage?.stage_name;
    const heroSubtitle = [
        data.tracking_id ? `Tracking ID: ${data.tracking_id}` : null,
        stageName ? `Stage: ${stageName}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <div className="flex flex-col gap-3">
            {/* Hero — status at a glance */}
            <ProfileHero
                eyebrow="ADMISSION APPLICATION"
                title={
                    <span
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full px-3 py-1 text-lg font-bold ring-1',
                            cfg.pillBg,
                            cfg.pillText,
                            cfg.pillRing
                        )}
                    >
                        <cfg.icon className="size-5" weight="duotone" />
                        {cfg.label}
                    </span>
                }
                subtitle={heroSubtitle || undefined}
                icon={ClipboardText}
                tone={cfg.tone}
            >
                {/* Stage progress steps */}
                <ApplicationStageProgress status={data.overall_status} />
            </ProfileHero>

            {/* Student Information */}
            <ProfileSectionCard icon={Student} heading="Student Information">
                <dl className="divide-y divide-neutral-100">
                    <ProfileFieldRow
                        label="Full Name"
                        value={data.student_data?.full_name || 'N/A'}
                    />
                    <ProfileFieldRow
                        label="Date of Birth"
                        value={formatDate(data.student_data?.date_of_birth) || 'N/A'}
                    />
                    <ProfileFieldRow
                        label="Gender"
                        value={data.student_data?.gender || 'N/A'}
                    />
                    <ProfileFieldRow
                        label="Class Applied For"
                        value={data.package_session?.level_name || 'N/A'}
                    />
                    {data.student_data?.father_name && (
                        <ProfileFieldRow
                            label="Father Name"
                            value={data.student_data.father_name}
                        />
                    )}
                    {data.student_data?.mother_name && (
                        <ProfileFieldRow
                            label="Mother Name"
                            value={data.student_data.mother_name}
                        />
                    )}
                    {data.student_data?.applying_for_class && (
                        <ProfileFieldRow
                            label="Applying For Class"
                            value={data.student_data.applying_for_class}
                        />
                    )}
                    {data.student_data?.academic_year && (
                        <ProfileFieldRow
                            label="Academic Year"
                            value={data.student_data.academic_year}
                        />
                    )}
                </dl>
            </ProfileSectionCard>

            {/* Parent Information */}
            <ProfileSectionCard icon={Users} heading="Parent Information">
                <dl className="divide-y divide-neutral-100">
                    <ProfileFieldRow
                        label="Full Name"
                        value={data.parent_data?.full_name || 'N/A'}
                    />
                    <ProfileFieldRow
                        label="Email"
                        value={data.parent_data?.email || 'N/A'}
                    />
                    <ProfileFieldRow
                        label="Mobile Number"
                        value={data.parent_data?.mobile_number || 'N/A'}
                    />
                    {data.parent_data?.address_line && (
                        <ProfileFieldRow
                            label="Address"
                            value={data.parent_data.address_line}
                        />
                    )}
                </dl>
            </ProfileSectionCard>

            {/* Application Timeline */}
            <ProfileSectionCard icon={ClipboardText} heading="Application Timeline">
                <dl className="divide-y divide-neutral-100">
                    <ProfileFieldRow label="Tracking ID" value={data.tracking_id} />
                    <ProfileFieldRow
                        label="Current Stage"
                        value={data.application_stage?.stage_name || 'N/A'}
                    />
                    <ProfileFieldRow
                        label="Stage Status"
                        value={data.application_stage_status || 'N/A'}
                    />
                    <ProfileFieldRow
                        label="Created At"
                        value={formatDateTime(data.created_at)}
                    />
                    <ProfileFieldRow
                        label="Last Updated"
                        value={formatDateTime(data.updated_at)}
                    />
                </dl>
            </ProfileSectionCard>
        </div>
    );
};
