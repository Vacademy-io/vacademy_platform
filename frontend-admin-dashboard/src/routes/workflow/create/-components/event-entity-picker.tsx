import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    AUDIENCE_CAMPAIGNS_LIST,
    GET_LIVE_SESSIONS,
    GET_INVITE_LIST,
} from '@/constants/urls';

interface EventEntityPickerProps {
    eventAppliedType: string;
    value: string | undefined;
    onChange: (id: string | undefined) => void;
    instituteId: string;
}

interface EntityOption {
    id: string;
    label: string;
    subtitle?: string;
}

async function fetchAudiences(instituteId: string): Promise<EntityOption[]> {
    try {
        const response = await authenticatedAxiosInstance.post(AUDIENCE_CAMPAIGNS_LIST, {
            institute_id: instituteId,
            page: 0,
            size: 100,
        });
        const content = response.data?.content ?? response.data ?? [];
        if (!Array.isArray(content)) return [];
        return content.map((item: Record<string, string>) => ({
            id: item.campaign_id ?? item.id ?? '',
            label: item.campaign_name ?? item.name ?? item.id ?? 'Unknown',
            subtitle: item.campaign_type ?? undefined,
        }));
    } catch {
        return [];
    }
}

async function fetchLiveSessions(instituteId: string): Promise<EntityOption[]> {
    try {
        const response = await authenticatedAxiosInstance.get(GET_LIVE_SESSIONS, {
            params: { instituteId },
        });
        const data = response.data ?? [];
        if (!Array.isArray(data)) return [];
        const sessions: EntityOption[] = [];
        for (const item of data) {
            if (item.sessions && Array.isArray(item.sessions)) {
                for (const s of item.sessions) {
                    sessions.push({
                        id: s.sessionId ?? s.session_id ?? s.id ?? '',
                        label: s.title ?? 'Untitled Session',
                        subtitle: s.subject ?? undefined,
                    });
                }
            } else {
                sessions.push({
                    id: item.sessionId ?? item.session_id ?? item.id ?? '',
                    label: item.title ?? 'Untitled Session',
                    subtitle: item.subject ?? undefined,
                });
            }
        }
        return sessions;
    } catch {
        return [];
    }
}

async function fetchEnrollInvites(instituteId: string): Promise<EntityOption[]> {
    try {
        const response = await authenticatedAxiosInstance.post(GET_INVITE_LIST, {
            institute_id: instituteId,
            page_no: 0,
            page_size: 100,
        });
        const content = response.data?.content ?? response.data ?? [];
        if (!Array.isArray(content)) return [];
        return content.map((item: Record<string, string>) => ({
            id: item.id ?? '',
            label: item.name ?? item.inviteCode ?? item.id ?? 'Unknown',
            subtitle: item.inviteCode ? `Code: ${item.inviteCode}` : undefined,
        }));
    } catch {
        return [];
    }
}

function useEntityOptions(eventAppliedType: string, instituteId: string) {
    return useQuery({
        queryKey: ['workflow-entity-picker', eventAppliedType, instituteId],
        queryFn: async (): Promise<EntityOption[]> => {
            switch (eventAppliedType) {
                case 'AUDIENCE':
                    return fetchAudiences(instituteId);
                case 'LIVE_SESSION':
                    return fetchLiveSessions(instituteId);
                case 'ENROLL_INVITE':
                    return fetchEnrollInvites(instituteId);
                default:
                    return [];
            }
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!instituteId && ['AUDIENCE', 'LIVE_SESSION', 'ENROLL_INVITE'].includes(eventAppliedType),
        retry: false,
    });
}

const TYPE_LABELS: Record<string, string> = {
    PACKAGE_SESSION: 'Batch / Package Session',
    AUDIENCE: 'Audience / Campaign',
    LIVE_SESSION: 'Live Session',
    ENROLL_INVITE: 'Enrollment Invite',
    INSTITUTE: 'Institute',
    ASSESSMENT: 'Assessment',
    USER_PLAN: 'Membership / User Plan',
    PAYMENT: 'Payment',
};

export function EventEntityPicker({ eventAppliedType, value, onChange, instituteId }: EventEntityPickerProps) {
    const [showManual, setShowManual] = useState(false);
    const hasDropdownSupport = ['AUDIENCE', 'LIVE_SESSION', 'ENROLL_INVITE'].includes(eventAppliedType);
    const { data: options = [], isLoading, isError } = useEntityOptions(eventAppliedType, instituteId);

    const typeLabel = TYPE_LABELS[eventAppliedType] ?? eventAppliedType.replace(/_/g, ' ').toLowerCase();

    // For INSTITUTE — no entity picker needed
    if (eventAppliedType === 'INSTITUTE') {
        return (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                This trigger applies to the entire institute. No specific entity selection needed.
            </div>
        );
    }

    // For types without dropdown support (PACKAGE_SESSION, ASSESSMENT, USER_PLAN, PAYMENT) — manual input
    if (!hasDropdownSupport || showManual || isError) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600">
                        Restrict to a specific {typeLabel} (optional)
                    </Label>
                    {hasDropdownSupport && !isError && (
                        <button
                            type="button"
                            className="text-[10px] text-primary-500 hover:underline"
                            onClick={() => setShowManual(false)}
                        >
                            Pick from list
                        </button>
                    )}
                </div>
                <Input
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value || undefined)}
                    className="text-sm"
                    placeholder={`Enter ${typeLabel} ID or leave empty for all`}
                />
                <p className="text-[10px] text-gray-400">
                    {value
                        ? `This workflow will only fire for this specific ${typeLabel}.`
                        : `Leave empty and the workflow fires for every ${typeLabel} in your institute.`
                    }
                </p>
            </div>
        );
    }

    // Dropdown mode for supported types
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-600">
                    Restrict to a specific {typeLabel} (optional)
                </Label>
                <button
                    type="button"
                    className="text-[10px] text-primary-500 hover:underline"
                    onClick={() => setShowManual(true)}
                >
                    Enter ID manually
                </button>
            </div>

            <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value || undefined)}
            >
                <option value="">All {typeLabel}s (no restriction)</option>
                {isLoading && <option disabled>Loading...</option>}
                {options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.label}{opt.subtitle ? ` — ${opt.subtitle}` : ''}
                    </option>
                ))}
                {!isLoading && options.length === 0 && (
                    <option disabled>No {typeLabel}s found</option>
                )}
            </select>

            <p className="text-[10px] text-gray-400">
                {value
                    ? `This workflow will only fire for the selected ${typeLabel}.`
                    : `Leave as "All" and the workflow fires for every ${typeLabel} in your institute.`
                }
            </p>
        </div>
    );
}
