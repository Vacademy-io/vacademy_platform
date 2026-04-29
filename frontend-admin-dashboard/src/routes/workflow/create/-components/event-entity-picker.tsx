import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    AUDIENCE_CAMPAIGNS_LIST,
    GET_LIVE_SESSIONS,
    GET_INVITE_LIST,
    INIT_INSTITUTE,
} from '@/constants/urls';

interface EventEntityPickerProps {
    eventAppliedType: string;
    /** Single value — backward compat (used if multiValue not provided) */
    value?: string | undefined;
    onChange?: (id: string | undefined) => void;
    /** Multi-select mode */
    multiValue?: string[];
    onMultiChange?: (ids: string[]) => void;
    instituteId: string;
}

interface EntityOption {
    id: string;
    label: string;
    subtitle?: string;
}

async function fetchPackageSessions(instituteId: string): Promise<EntityOption[]> {
    try {
        // Use the institute details endpoint which returns batches_for_sessions
        const response = await authenticatedAxiosInstance.get(`${INIT_INSTITUTE}/${instituteId}`);
        const batches = response.data?.batches_for_sessions ?? [];
        if (!Array.isArray(batches)) return [];
        return batches.map((batch: Record<string, unknown>) => {
            const pkg = (batch.package_dto ?? {}) as Record<string, string>;
            const level = (batch.level ?? {}) as Record<string, string>;
            const session = (batch.session ?? {}) as Record<string, string>;
            const packageName = pkg.package_name ?? 'Unknown';
            const levelName = level.level_name ?? '';
            const sessionName = session.session_name ?? '';
            return {
                id: (batch.id as string) ?? '',
                label: `${packageName} — ${levelName} / ${sessionName}`.trim().replace(/— \/ $/, '').replace(/ \/ $/, ''),
                subtitle: (batch.status as string) ?? undefined,
            };
        });
    } catch {
        return [];
    }
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
                case 'PACKAGE_SESSION':
                    return fetchPackageSessions(instituteId);
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
        enabled: !!instituteId && ['PACKAGE_SESSION', 'AUDIENCE', 'LIVE_SESSION', 'ENROLL_INVITE'].includes(eventAppliedType),
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

export function EventEntityPicker({ eventAppliedType, value, onChange, multiValue, onMultiChange, instituteId }: EventEntityPickerProps) {
    const [showManual, setShowManual] = useState(false);
    const [search, setSearch] = useState('');
    const hasDropdownSupport = ['PACKAGE_SESSION', 'AUDIENCE', 'LIVE_SESSION', 'ENROLL_INVITE'].includes(eventAppliedType);
    const { data: options = [], isLoading, isError } = useEntityOptions(eventAppliedType, instituteId);

    const filteredOptions = search
        ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
        : options;

    const typeLabel = TYPE_LABELS[eventAppliedType] ?? eventAppliedType.replace(/_/g, ' ').toLowerCase();

    // Multi-select mode
    const isMulti = !!onMultiChange;
    const selectedIds = multiValue ?? (value ? [value] : []);

    const toggleId = (id: string) => {
        if (!isMulti) {
            // Single mode: just set the value
            onChange?.(id || undefined);
            return;
        }
        const updated = selectedIds.includes(id)
            ? selectedIds.filter((s) => s !== id)
            : [...selectedIds, id];
        onMultiChange?.(updated);
    };

    // For INSTITUTE — no entity picker needed
    if (eventAppliedType === 'INSTITUTE') {
        return (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                This trigger applies to the entire institute. No specific entity selection needed.
            </div>
        );
    }

    // For types without dropdown support — manual input
    if (!hasDropdownSupport || showManual || isError) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600">
                        Restrict to specific {typeLabel}(s) (optional)
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
                    value={isMulti ? selectedIds.join(', ') : (value ?? '')}
                    onChange={(e) => {
                        const raw = e.target.value;
                        if (isMulti) {
                            const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
                            onMultiChange?.(ids);
                        } else {
                            onChange?.(raw || undefined);
                        }
                    }}
                    className="text-sm"
                    placeholder={`Enter ${typeLabel} ID(s), comma-separated, or leave empty for all`}
                />
                <p className="text-[10px] text-gray-400">
                    {selectedIds.length > 0
                        ? `This workflow will fire for ${selectedIds.length} selected ${typeLabel}(s).`
                        : `Leave empty and the workflow fires for every ${typeLabel} in your institute.`
                    }
                </p>
            </div>
        );
    }

    // Checkbox list mode for supported types (multi-select)
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-600">
                    Select {typeLabel}(s) — leave unchecked for all
                </Label>
                <button
                    type="button"
                    className="text-[10px] text-primary-500 hover:underline"
                    onClick={() => setShowManual(true)}
                >
                    Enter ID manually
                </button>
            </div>

            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${typeLabel}s...`}
                className="h-8 text-sm"
            />

            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white">
                {isLoading && (
                    <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
                )}
                {!isLoading && filteredOptions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">
                        {options.length === 0 ? `No ${typeLabel}s found` : `No matches for "${search}"`}
                    </div>
                )}
                {filteredOptions.map((opt) => {
                    const checked = selectedIds.includes(opt.id);
                    return (
                        <label
                            key={opt.id}
                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b last:border-b-0 transition-colors ${
                                checked ? 'bg-primary-50' : 'hover:bg-gray-50'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleId(opt.id)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-800 truncate">{opt.label}</div>
                                {opt.subtitle && (
                                    <div className="text-[10px] text-gray-400">{opt.subtitle}</div>
                                )}
                            </div>
                        </label>
                    );
                })}
            </div>

            {/* Selected count summary */}
            <p className="text-[10px] text-gray-400">
                {selectedIds.length === 0
                    ? `No selection — the workflow fires for every ${typeLabel} in your institute.`
                    : selectedIds.length === 1
                        ? `Workflow fires only for the selected ${typeLabel}.`
                        : `Workflow fires for ${selectedIds.length} selected ${typeLabel}(s). One trigger row will be created per selection.`
                }
            </p>
        </div>
    );
}
