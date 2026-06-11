import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import {
    SLIDE_TYPE_OPTIONS,
    defaultDownloadFor,
    type SlideDownloadPermissionData,
} from '@/constants/slide-download-permission';
import {
    getSlideDownloadPermission,
    saveSlideDownloadPermission,
} from '../../-services/slide-download-permission-service';

interface SlideDownloadCardProps {
    /** Canonical stored role key (e.g. ADMIN / TEACHER / LEARNER or a custom role name, uppercased). */
    roleKey: string;
    /** Display label for this role, used in the card copy (e.g. "learners", "teachers"). */
    roleLabel: string;
}

/**
 * Per-role "Slide Downloads" card, rendered inside each role's Display Settings
 * panel. It edits only this role's column of the shared
 * SLIDE_DOWNLOAD_PERMISSION_SETTING blob (other roles are preserved on save),
 * so the same setting powers every role panel and the learner-app enforcement.
 */
export default function SlideDownloadCard({ roleKey, roleLabel }: SlideDownloadCardProps) {
    const queryClient = useQueryClient();
    const [flags, setFlags] = useState<Record<string, boolean>>({});
    const [dirty, setDirty] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['slide-download-permission'],
        queryFn: getSlideDownloadPermission,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (!data) return;
        const next: Record<string, boolean> = {};
        for (const opt of SLIDE_TYPE_OPTIONS) {
            const stored = data.slideTypes?.[opt.key]?.roles?.[roleKey];
            next[opt.key] =
                typeof stored === 'boolean' ? stored : defaultDownloadFor(roleKey, opt.key);
        }
        setFlags(next);
        setDirty(false);
    }, [data, roleKey]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: async () => {
            // Merge this role's flags into the full blob, preserving every other
            // role's existing values and any slide types not shown here.
            const base: SlideDownloadPermissionData = data
                ? { version: data.version ?? 1, slideTypes: { ...data.slideTypes } }
                : { version: 1, slideTypes: {} };
            const slideTypes = { ...base.slideTypes };
            for (const opt of SLIDE_TYPE_OPTIONS) {
                const existingRoles = slideTypes[opt.key]?.roles ?? {};
                slideTypes[opt.key] = {
                    roles: { ...existingRoles, [roleKey]: !!flags[opt.key] },
                };
            }
            await saveSlideDownloadPermission({ version: base.version, slideTypes });
        },
        onSuccess: () => {
            toast.success('Slide download permissions saved');
            setDirty(false);
            queryClient.invalidateQueries({ queryKey: ['slide-download-permission'] });
        },
        onError: () => {
            toast.error('Failed to save slide download permissions');
        },
    });

    const toggle = (key: string) => {
        setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
        setDirty(true);
    };

    if (isLoading) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Download Permissions</CardTitle>
                <CardDescription>
                    Choose which slide types {roleLabel} can download. Turning a slide type off
                    hides its in-app download control — a best-effort deterrent that cannot block
                    all browser-level saves (e.g. right-click or third-party viewers).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {SLIDE_TYPE_OPTIONS.map((opt) => {
                    const id = `slide-dl-${roleKey}-${opt.key}`;
                    return (
                        <div key={opt.key} className="flex items-center justify-between gap-3">
                            <Label
                                htmlFor={id}
                                className="cursor-pointer text-sm font-medium text-neutral-800"
                            >
                                {opt.label}
                            </Label>
                            <Switch
                                id={id}
                                checked={!!flags[opt.key]}
                                onCheckedChange={() => toggle(opt.key)}
                            />
                        </div>
                    );
                })}
                <div className="flex justify-end border-t pt-4">
                    <MyButton buttonType="primary" onClick={() => save()} disable={saving || !dirty}>
                        {saving ? 'Saving…' : 'Save'}
                    </MyButton>
                </div>
            </CardContent>
        </Card>
    );
}
