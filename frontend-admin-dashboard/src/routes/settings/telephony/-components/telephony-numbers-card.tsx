import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Phone, Plus, Trash, Check, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    createTelephonyNumber,
    deleteTelephonyNumber,
    fetchTelephonyNumbers,
    updateTelephonyNumber,
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
    const [newLabel, setNewLabel] = useState('');
    const [newRegion, setNewRegion] = useState('');
    const [newPriority, setNewPriority] = useState('100');

    const createMutation = useMutation({
        mutationFn: createTelephonyNumber,
        onSuccess: () => {
            toast.success('Number added');
            setNewNumber('');
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

    const items = numbersQuery.data ?? [];

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
                <Button size="sm" variant="outline" onClick={() => setAddOpen((v) => !v)}>
                    <Plus className="mr-1.5 size-4" />
                    Add number
                </Button>
            </div>

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
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function NumberRow({
    item,
    onToggle,
    onDelete,
    onLabelChange,
    onRegionChange,
    onPriorityChange,
}: {
    item: TelephonyProviderNumber;
    onToggle: (enabled: boolean) => void;
    onDelete: () => void;
    onLabelChange: (label: string) => void;
    onRegionChange: (region: string) => void;
    onPriorityChange: (priority: number) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(item.label ?? '');
    const [region, setRegion] = useState(item.region ?? '');
    const [priority, setPriority] = useState(String(item.priority ?? 100));

    return (
        <div className="grid grid-cols-12 items-center gap-3 p-3 text-sm">
            <div className="col-span-3 flex items-center gap-2">
                <Phone className="size-4 text-neutral-400" />
                <span className="font-medium text-neutral-800">{item.phoneNumber}</span>
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
    );
}
