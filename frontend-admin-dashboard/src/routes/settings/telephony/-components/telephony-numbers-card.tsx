import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Phone,
    Plus,
    Trash,
    Check,
    X,
    ArrowsClockwise,
    CheckCircle,
    WarningCircle,
    XCircle,
    Link as LinkIcon,
    Star,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    createTelephonyNumber,
    deleteTelephonyNumber,
    fetchTelephonyNumbers,
    fetchExotelExoPhones,
    retryAttachTelephonyNumber,
    updateTelephonyNumber,
    type ExotelExoPhone,
    type TelephonyProviderNumber,
} from '../-services/telephony-admin';

/**
 * Multi-ExoPhone management. Sales-ops sees the entire fleet of provider
 * numbers, can add new ones, label them by region, set priorities for
 * round-robin / sticky selectors, and toggle them on/off without deletion.
 */
export function TelephonyNumbersCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const numbersQuery = useQuery({
        queryKey: ['telephony-numbers', instituteId],
        queryFn: () => fetchTelephonyNumbers(instituteId),
        enabled: !!instituteId,
    });

    const [addOpen, setAddOpen] = useState(false);
    const [newNumber, setNewNumber] = useState('');
    const [newSid, setNewSid] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newRegion, setNewRegion] = useState('');
    const [newPriority, setNewPriority] = useState('100');
    const [syncPickerOpen, setSyncPickerOpen] = useState(false);

    const createMutation = useMutation({
        mutationFn: createTelephonyNumber,
        onSuccess: () => {
            toast.success('Number added');
            setNewNumber('');
            setNewSid('');
            setNewLabel('');
            setNewRegion('');
            setNewPriority('100');
            setAddOpen(false);
            queryClient.invalidateQueries({ queryKey: ['telephony-numbers', instituteId] });
        },
        onError: () => toast.error('Failed to add number'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: Partial<TelephonyProviderNumber> }) =>
            updateTelephonyNumber(id, patch),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telephony-numbers', instituteId] }),
        onError: () => toast.error('Failed to update'),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteTelephonyNumber,
        onSuccess: () => {
            toast.success('Number removed');
            queryClient.invalidateQueries({ queryKey: ['telephony-numbers', instituteId] });
        },
        onError: () => toast.error('Failed to remove'),
    });

    const attachMutation = useMutation({
        mutationFn: retryAttachTelephonyNumber,
        onSuccess: (data) => {
            if (data.flowAttachStatus === 'ATTACHED') {
                toast.success('Attached to inbound flow');
            } else if (data.flowAttachStatus === 'PENDING') {
                toast.message(data.flowAttachError ?? 'Attach pending — see status');
            } else {
                toast.error(data.flowAttachError ?? 'Attach failed');
            }
            queryClient.invalidateQueries({ queryKey: ['telephony-numbers', instituteId] });
        },
        onError: () => toast.error('Could not reach the server'),
    });

    const items = numbersQuery.data ?? [];
    // The currently-recommended number is the enabled row with the lowest
    // priority (id breaks ties — matches the backend's ORDER BY clause).
    // Strategies fall back to this when they have no other signal (e.g.
    // STICKY_PER_LEAD on a fresh lead). Lets us highlight a single "default"
    // row in the UI and offer a one-click way to pick a different one.
    const recommendedId =
        items
            .filter((n) => n.enabled !== false)
            .slice()
            .sort((a, b) => {
                const pa = a.priority ?? 100;
                const pb = b.priority ?? 100;
                return pa !== pb ? pa - pb : a.id.localeCompare(b.id);
            })[0]?.id ?? null;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between">
                <div>
                    <h2 className="text-base font-semibold text-neutral-900">Your calling numbers</h2>
                    <p className="text-sm text-neutral-500">
                        Add the phone numbers you've set up with your calling service. These
                        are the numbers leads will see when you call them. The setting above
                        decides which one is picked for each call.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSyncPickerOpen((v) => !v)}
                    >
                        <ArrowsClockwise className="mr-1.5 size-4" />
                        Sync from Exotel
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAddOpen((v) => !v)}>
                        <Plus className="mr-1.5 size-4" />
                        Add number
                    </Button>
                </div>
            </div>

            {syncPickerOpen && (
                <ExotelSyncPicker
                    instituteId={instituteId}
                    existing={items}
                    onPick={(p) => {
                        setNewNumber(p.phone_number ?? '');
                        setNewSid(p.sid ?? '');
                        setNewLabel(p.friendly_name ?? '');
                        setAddOpen(true);
                        setSyncPickerOpen(false);
                    }}
                    onClose={() => setSyncPickerOpen(false)}
                />
            )}

            {addOpen && (
                <div className="mb-4 rounded-md border border-dashed border-neutral-300 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label>Phone number</Label>
                            <Input
                                value={newNumber}
                                onChange={(e) => setNewNumber(e.target.value)}
                                placeholder="+91xxxxxxxxxx"
                            />
                            <p className="text-xs text-neutral-500">
                                Include the country code (e.g. +91 for India).
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Exotel ExoPhone Sid</Label>
                            <Input
                                value={newSid}
                                onChange={(e) => setNewSid(e.target.value)}
                                placeholder="e.g. KX_xxx"
                            />
                            <p className="text-xs text-neutral-500">
                                The Sid from Exotel's ExoPhones page — required for
                                auto-attach. Use <strong>Sync from Exotel</strong> to fill
                                this in automatically.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Nickname</Label>
                            <Input
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="Sales · Delhi"
                            />
                            <p className="text-xs text-neutral-500">
                                A short name so your team can tell numbers apart.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Region</Label>
                            <Input
                                value={newRegion}
                                onChange={(e) => setNewRegion(e.target.value)}
                                placeholder="e.g. DL, MH, 080"
                            />
                            <p className="text-xs text-neutral-500">
                                Used by the “Match the lead's region” option above.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Preference order</Label>
                            <Input
                                type="number"
                                value={newPriority}
                                onChange={(e) => setNewPriority(e.target.value)}
                            />
                            <p className="text-xs text-neutral-500">
                                Lower number = picked first. Used to break ties when
                                multiple numbers can be chosen. Default is 100.
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!newNumber || createMutation.isPending}
                            onClick={() =>
                                createMutation.mutate({
                                    instituteId,
                                    phoneNumber: newNumber,
                                    providerResourceId: newSid || undefined,
                                    label: newLabel || undefined,
                                    region: newRegion || undefined,
                                    priority: Number(newPriority) || 100,
                                })
                            }
                        >
                            {createMutation.isPending ? 'Adding…' : 'Add'}
                        </Button>
                    </div>
                </div>
            )}

            {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                    No numbers added yet. Add one to start placing calls.
                </div>
            ) : (
                <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
                    {items.map((n) => (
                        <NumberRow
                            key={n.id}
                            item={n}
                            isRecommended={n.id === recommendedId}
                            isAttaching={
                                attachMutation.isPending &&
                                attachMutation.variables === n.id
                            }
                            onToggle={(enabled) =>
                                updateMutation.mutate({ id: n.id, patch: { enabled } })
                            }
                            onDelete={() => deleteMutation.mutate(n.id)}
                            onLabelChange={(label) =>
                                updateMutation.mutate({ id: n.id, patch: { label } })
                            }
                            onRegionChange={(region) =>
                                updateMutation.mutate({ id: n.id, patch: { region } })
                            }
                            onPriorityChange={(priority) =>
                                updateMutation.mutate({ id: n.id, patch: { priority } })
                            }
                            onSidSave={(sid) =>
                                updateMutation.mutate({
                                    id: n.id,
                                    patch: { providerResourceId: sid },
                                })
                            }
                            onAttach={() => attachMutation.mutate(n.id)}
                            onMakeRecommended={() =>
                                updateMutation.mutate({
                                    id: n.id,
                                    // Priority 1 wins the lowest-priority sort the routing
                                    // strategies use. Other numbers keep their existing
                                    // priorities; the user can manually demote if they
                                    // want a strict ordering.
                                    patch: { priority: 1 },
                                })
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/** Pull a flow id out of an Exotel voice_url like
 *  "https://my.exotel.in/Exotel/exoml/start_voice/1234567". Returns null
 *  when the URL is empty or doesn't match the pattern. */
function flowSidFromVoiceUrl(voiceUrl?: string | null): string | null {
    if (!voiceUrl) return null;
    const m = voiceUrl.match(/start_voice\/([A-Za-z0-9_-]+)/);
    return m && m[1] ? m[1] : null;
}

function NumberRow({
    item,
    isRecommended,
    isAttaching,
    onToggle,
    onDelete,
    onLabelChange,
    onRegionChange,
    onPriorityChange,
    onSidSave,
    onAttach,
    onMakeRecommended,
}: {
    item: TelephonyProviderNumber;
    isRecommended: boolean;
    isAttaching: boolean;
    onToggle: (enabled: boolean) => void;
    onDelete: () => void;
    onLabelChange: (label: string) => void;
    onRegionChange: (region: string) => void;
    onPriorityChange: (priority: number) => void;
    onSidSave: (sid: string) => void;
    onAttach: () => void;
    onMakeRecommended: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(item.label ?? '');
    const [region, setRegion] = useState(item.region ?? '');
    const [priority, setPriority] = useState(String(item.priority ?? 100));
    const [sid, setSid] = useState(item.providerResourceId ?? '');

    const needsSid = !item.providerResourceId;

    return (
        <div className="flex flex-col gap-2 p-3 text-sm">
        <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-3 flex items-center gap-2">
                <Phone className="size-4 text-neutral-400" />
                <span className="font-medium text-neutral-800">{item.phoneNumber}</span>
                <AttachStatusPill item={item} />
                {isRecommended && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-1.5 py-0.5 text-caption font-medium text-warning-700"
                        title="This number is currently picked first by the routing strategy when no other rule applies. Counsellors see it pre-selected in the Call picker."
                    >
                        <Star weight="fill" className="size-3" /> Recommended
                    </span>
                )}
            </div>
            <div className="col-span-3">
                {editing ? (
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} />
                ) : (
                    <span className="text-neutral-700">{item.label || <em className="text-neutral-400">No label</em>}</span>
                )}
            </div>
            <div className="col-span-2">
                {editing ? (
                    <Input value={region} onChange={(e) => setRegion(e.target.value)} />
                ) : (
                    <span className="text-neutral-700">{item.region || '—'}</span>
                )}
            </div>
            <div className="col-span-2">
                {editing ? (
                    <Input
                        type="number"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                    />
                ) : (
                    <span
                        className="text-neutral-700"
                        title="Lower number = picked first when multiple numbers can be used."
                    >
                        Preference: {item.priority ?? 100}
                    </span>
                )}
            </div>
            <div className="col-span-2 flex items-center justify-end gap-2">
                {!isRecommended && item.enabled !== false && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onMakeRecommended}
                        aria-label="Set as recommended"
                        title="Set this number as the default — pre-selected in the Call picker when no other rule applies."
                        className="h-8 px-2"
                    >
                        <Star className="size-4 text-neutral-400 hover:text-warning-500" />
                    </Button>
                )}
                <Switch
                    checked={item.enabled !== false}
                    onCheckedChange={onToggle}
                    aria-label="Enable number"
                />
                {editing ? (
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                onLabelChange(label);
                                onRegionChange(region);
                                onPriorityChange(Number(priority) || 100);
                                setEditing(false);
                            }}
                            aria-label="Save"
                        >
                            <Check className="size-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(false)}
                            aria-label="Cancel"
                        >
                            <X className="size-4" />
                        </Button>
                    </>
                ) : (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                        Edit
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDelete}
                    aria-label="Delete number"
                >
                    <Trash className="size-4 text-danger-600" />
                </Button>
            </div>
        </div>

        {/* Secondary row: ExoPhone Sid + Attach action. Only renders when
            something useful is going on (missing Sid, attach error, etc.) so
            the Numbers card stays tidy for already-attached rows. */}
        {(needsSid ||
            item.flowAttachStatus === 'FAILED' ||
            item.flowAttachStatus === 'PENDING') && (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
                <LinkIcon className="size-4 shrink-0 text-neutral-400" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 text-neutral-500">Sid:</span>
                    <Input
                        value={sid}
                        onChange={(e) => setSid(e.target.value)}
                        placeholder="KX_xxx (from Exotel)"
                        className="h-7 text-xs"
                    />
                    {sid !== (item.providerResourceId ?? '') && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => onSidSave(sid)}
                        >
                            Save Sid
                        </Button>
                    )}
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    disabled={isAttaching || !item.providerResourceId}
                    onClick={onAttach}
                >
                    {isAttaching ? 'Attaching…' : 'Attach'}
                </Button>
                {item.flowAttachStatus === 'FAILED' && item.flowAttachError && (
                    <span
                        className="max-w-xs truncate text-danger-600"
                        title={item.flowAttachError}
                    >
                        {item.flowAttachError}
                    </span>
                )}
            </div>
        )}
        </div>
    );
}

function AttachStatusPill({ item }: { item: TelephonyProviderNumber }) {
    const s = item.flowAttachStatus;
    if (s === 'ATTACHED') {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full bg-success-50 px-1.5 py-0.5 text-caption font-medium text-success-700"
                title="Inbound flow attached"
            >
                <CheckCircle weight="fill" className="size-3" /> Attached
            </span>
        );
    }
    if (s === 'PENDING') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-full bg-warning-50 px-1.5 py-0.5 text-caption font-medium text-warning-700'
                )}
                title={item.flowAttachError ?? 'Not yet attached'}
            >
                <WarningCircle weight="fill" className="size-3" /> Pending
            </span>
        );
    }
    if (s === 'FAILED') {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-1.5 py-0.5 text-caption font-medium text-danger-700"
                title={item.flowAttachError ?? 'Attach failed'}
            >
                <XCircle weight="fill" className="size-3" /> Attach failed
            </span>
        );
    }
    return null;
}

interface ExotelSyncPickerProps {
    instituteId: string;
    existing: TelephonyProviderNumber[];
    onPick: (p: ExotelExoPhone) => void;
    onClose: () => void;
}

function ExotelSyncPicker({ instituteId, existing, onPick, onClose }: ExotelSyncPickerProps) {
    const query = useQuery({
        queryKey: ['telephony-exotel-exophones', instituteId],
        queryFn: () => fetchExotelExoPhones(instituteId),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });
    const alreadyAddedSids = new Set(
        existing.map((n) => n.providerResourceId).filter((x): x is string => !!x)
    );

    return (
        <div className="mb-4 rounded-md border border-dashed border-neutral-300 p-4">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-neutral-900">
                        ExoPhones on your Exotel account
                    </p>
                    <p className="text-xs text-neutral-500">
                        Pick a number to copy its details into the “Add number” form below.
                        Numbers already in your list are marked.
                    </p>
                </div>
                <Button size="sm" variant="ghost" onClick={onClose}>
                    Close
                </Button>
            </div>
            {query.isLoading && (
                <div className="py-4 text-center text-xs text-neutral-500">Loading…</div>
            )}
            {query.isError && (
                <div className="rounded-md border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700">
                    Could not fetch ExoPhones — check your Exotel credentials in the
                    Calling Provider card.
                </div>
            )}
            {query.data && query.data.length === 0 && (
                <div className="py-4 text-center text-xs text-neutral-500">
                    No ExoPhones found on this Exotel account.
                </div>
            )}
            {query.data && query.data.length > 0 && (
                <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
                    {query.data.map((p) => {
                        const taken = p.sid && alreadyAddedSids.has(p.sid);
                        const flowAlready = flowSidFromVoiceUrl(p.voice_url);
                        return (
                            <div
                                key={p.sid}
                                className="flex items-center justify-between gap-3 p-3 text-xs"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-neutral-800">
                                            {p.phone_number ?? '—'}
                                        </span>
                                        {p.friendly_name && (
                                            <span className="text-neutral-500">
                                                · {p.friendly_name}
                                            </span>
                                        )}
                                        {taken && (
                                            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-500">
                                                Already added
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-0.5 text-neutral-400">
                                        Sid {p.sid ?? '—'}
                                        {flowAlready && (
                                            <span> · Currently runs flow {flowAlready}</span>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!!taken}
                                    onClick={() => onPick(p)}
                                >
                                    {taken ? 'In list' : 'Use this'}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
