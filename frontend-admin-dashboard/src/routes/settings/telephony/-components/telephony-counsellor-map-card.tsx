import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IdentificationBadge, Trash, Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useLeadCounsellorOptions } from '@/hooks/use-lead-counsellor-options';
import {
    fetchTelephonyConfig,
    fetchTelephonyProviders,
    fetchCounsellorEndpoints,
    upsertCounsellorEndpoint,
    deleteCounsellorEndpoint,
    type TelephonyCounsellorEndpoint,
} from '../-services/telephony-admin';

/**
 * Per-counsellor extension/DID mapping for providers without a number pool
 * (Airtel). Hidden for pooled providers (Exotel uses the Numbers card instead).
 * Pick a counsellor and enter the extension their provider gave them — outbound
 * calls dial from it, and inbound CDRs/recordings are attributed back through it.
 */
export function TelephonyCounsellorMapCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const configQuery = useQuery({
        queryKey: ['telephony-config', instituteId],
        queryFn: () => fetchTelephonyConfig(instituteId),
        enabled: !!instituteId,
    });
    const providersQuery = useQuery({
        queryKey: ['telephony-providers'],
        queryFn: fetchTelephonyProviders,
    });

    const providerType = configQuery.data?.providerType ?? '';
    const provider = providersQuery.data?.find((p) => p.providerType === providerType);
    // Only no-pool outbound providers need a per-counsellor extension map.
    const needsMap =
        !!provider &&
        provider.capabilities.includes('OUTBOUND_CALL') &&
        !provider.capabilities.includes('NUMBER_POOL');

    const { options: counsellors, isLoading: counsellorsLoading } = useLeadCounsellorOptions();
    const nameById = useMemo(
        () => new Map(counsellors.map((c) => [c.id, c.full_name])),
        [counsellors]
    );

    const endpointsQuery = useQuery({
        queryKey: ['telephony-counsellor-endpoints', instituteId, providerType],
        queryFn: () => fetchCounsellorEndpoints(instituteId, providerType),
        enabled: !!instituteId && needsMap && !!providerType,
    });

    const [counsellorUserId, setCounsellorUserId] = useState('');
    const [extension, setExtension] = useState('');
    const [providerUserId, setProviderUserId] = useState('');
    const [did, setDid] = useState('');

    const resetForm = () => {
        setCounsellorUserId('');
        setExtension('');
        setProviderUserId('');
        setDid('');
    };

    const invalidate = () =>
        queryClient.invalidateQueries({
            queryKey: ['telephony-counsellor-endpoints', instituteId, providerType],
        });

    const saveMutation = useMutation({
        mutationFn: (input: TelephonyCounsellorEndpoint) =>
            upsertCounsellorEndpoint(instituteId, input),
        onSuccess: () => {
            toast.success('Counsellor mapping saved');
            resetForm();
            invalidate();
        },
        onError: () => toast.error('Failed to save mapping'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteCounsellorEndpoint(id),
        onSuccess: () => {
            toast.success('Mapping removed');
            invalidate();
        },
        onError: () => toast.error('Failed to remove mapping'),
    });

    // When a counsellor with an existing mapping is picked, pre-fill the form.
    const onPickCounsellor = (id: string) => {
        setCounsellorUserId(id);
        const existing = endpointsQuery.data?.find((e) => e.counsellorUserId === id);
        setExtension(existing?.extension ?? '');
        setProviderUserId(existing?.providerUserId ?? '');
        setDid(existing?.did ?? '');
    };

    const onSave = () => {
        if (!counsellorUserId) {
            toast.error('Pick a counsellor');
            return;
        }
        if (!extension.trim()) {
            toast.error('Enter the counsellor’s extension');
            return;
        }
        saveMutation.mutate({
            counsellorUserId,
            providerType,
            extension: extension.trim(),
            providerUserId: providerUserId.trim() || null,
            did: did.trim() || null,
            enabled: true,
        });
    };

    if (!needsMap) return null;

    const endpoints = endpointsQuery.data ?? [];

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
                <IdentificationBadge className="size-5 text-primary-600" />
                <div>
                    <h2 className="text-base font-semibold text-neutral-900">
                        Counsellor extensions
                    </h2>
                    <p className="text-sm text-neutral-500">
                        Map each counsellor to the extension {provider?.displayName} gave them.
                        Calls dial from it, and recordings are matched back to the right person.
                    </p>
                </div>
            </div>

            {/* Existing mappings */}
            {endpoints.length > 0 ? (
                <div className="mb-4 divide-y divide-neutral-100 rounded-md border border-neutral-200">
                    {endpoints.map((e) => (
                        <div key={e.id} className="flex items-center justify-between px-3 py-2">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-neutral-900">
                                    {nameById.get(e.counsellorUserId) ?? e.counsellorUserId}
                                </span>
                                <span className="text-xs text-neutral-500">
                                    Ext {e.extension}
                                    {e.did ? ` · DID ${e.did}` : ''}
                                    {e.providerUserId ? ` · ${e.providerUserId}` : ''}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => e.id && deleteMutation.mutate(e.id)}
                                disabled={deleteMutation.isPending}
                                aria-label="Remove mapping"
                            >
                                <Trash className="size-4 text-danger-600" />
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mb-4 text-sm text-neutral-500">
                    No counsellors mapped yet — add one below so they can place calls.
                </p>
            )}

            {/* Add / edit a mapping */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Counsellor</Label>
                    <Select value={counsellorUserId} onValueChange={onPickCounsellor}>
                        <SelectTrigger className="h-10">
                            <SelectValue
                                placeholder={counsellorsLoading ? 'Loading…' : 'Select a counsellor'}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {counsellors.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.full_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>Extension</Label>
                    <Input
                        value={extension}
                        onChange={(e) => setExtension(e.target.value)}
                        placeholder="e.g. 447"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label>Caller-ID number / DID (optional)</Label>
                    <Input
                        value={did}
                        onChange={(e) => setDid(e.target.value)}
                        placeholder="The number the lead sees"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label>Provider user id (optional)</Label>
                    <Input
                        value={providerUserId}
                        onChange={(e) => setProviderUserId(e.target.value)}
                        placeholder="e.g. SauravSN"
                    />
                    <p className="text-xs text-neutral-500">
                        Helps match recordings when a record carries the user id but not the
                        extension.
                    </p>
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <Button onClick={onSave} disabled={saveMutation.isPending}>
                    <Plus className="mr-1 size-4" />
                    {saveMutation.isPending ? 'Saving…' : 'Save mapping'}
                </Button>
            </div>
        </div>
    );
}
