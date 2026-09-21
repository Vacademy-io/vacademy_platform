import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MyButton } from '@/components/design-system/button';
import {
    DEFAULT_ENGAGEMENT_SETTINGS,
    getEngagementSettings,
    normalizeEngagementSettings,
    saveEngagementSettings,
    type EngagementSettings as Settings,
} from '../-services/engagement-settings';

/**
 * Settings → Daily Engagement.
 *
 * The knobs behind the learner home-page tasks. Each explains its consequence, because
 * the numbers are easy to set badly: a cap of 20 buries learners in several batches,
 * and a 0-second read gate turns readings into free points.
 */
export default function EngagementSettings() {
    const queryClient = useQueryClient();
    const { data: saved, isLoading } = useQuery({
        queryKey: ['engagement-settings'],
        queryFn: getEngagementSettings,
    });

    const [form, setForm] = useState<Settings>(DEFAULT_ENGAGEMENT_SETTINGS);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (saved) {
            setForm(saved);
            setDirty(false);
        }
    }, [saved]);

    function patch(p: Partial<Settings>) {
        setForm((f) => ({ ...f, ...p }));
        setDirty(true);
    }

    async function save() {
        setSaving(true);
        try {
            await saveEngagementSettings(normalizeEngagementSettings(form));
            await queryClient.invalidateQueries({ queryKey: ['engagement-settings'] });
            setDirty(false);
            toast.success('Daily engagement settings saved');
        } catch {
            toast.error('Could not save the settings');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
                        <Sparkle size={20} /> Daily Engagement
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        How the home-page tasks behave for every learner in this institute.
                    </p>
                </div>
                <div className="flex gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        onClick={() => {
                            setForm(DEFAULT_ENGAGEMENT_SETTINGS);
                            setDirty(true);
                        }}
                    >
                        Reset to defaults
                    </MyButton>
                    <MyButton type="button" disable={!dirty || saving || isLoading} onClick={save}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </MyButton>
                </div>
            </div>

            {dirty && (
                <p className="rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-700">
                    You have unsaved changes.
                </p>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Daily load</CardTitle>
                    <CardDescription>
                        A learner in several batches could otherwise face a dozen tasks on a Monday
                        and bounce. Tasks hidden by the cap are not counted as missed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="eng-cap">Tasks per day, across all batches</Label>
                        <Input
                            id="eng-cap"
                            type="number"
                            min={1}
                            max={50}
                            value={form.dailyItemCap}
                            onChange={(e) => patch({ dailyItemCap: Number(e.target.value) })}
                        />
                        <p className="text-xs text-neutral-500">Default 5.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">What counts as reading</CardTitle>
                    <CardDescription>
                        Readings earn points once BOTH thresholds are met. Dwell time and scroll
                        depth are a patience signal, not a comprehension one — keep reading points
                        small relative to questions, or the leaderboard measures idling.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="eng-scroll">Scroll depth required (%)</Label>
                        <Input
                            id="eng-scroll"
                            type="number"
                            min={0}
                            max={100}
                            value={form.minScrollPercent}
                            onChange={(e) => patch({ minScrollPercent: Number(e.target.value) })}
                        />
                        <p className="text-xs text-neutral-500">Default 80.</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="eng-read">Time on the page required (seconds)</Label>
                        <Input
                            id="eng-read"
                            type="number"
                            min={0}
                            max={3600}
                            value={form.minReadSeconds}
                            onChange={(e) => patch({ minReadSeconds: Number(e.target.value) })}
                        />
                        <p className="text-xs text-neutral-500">Default 15.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Games and self-reported scores</CardTitle>
                    <CardDescription>
                        A teacher-uploaded game reports its own score, and anyone with devtools can
                        report any number. By default such scores earn completion points only. Turn
                        this on to let the score also earn a proportional bonus — and accept that
                        the leaderboard can then be gamed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <Switch
                            id="eng-unverified"
                            checked={form.allowUnverifiedScoreBonus}
                            onCheckedChange={(v) => patch({ allowUnverifiedScoreBonus: v })}
                        />
                        <Label htmlFor="eng-unverified">
                            Let self-reported game scores earn bonus points
                        </Label>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
