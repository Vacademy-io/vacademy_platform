import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('engagement');
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
            toast.success(t('settings.saved'));
        } catch {
            toast.error(t('settings.saveError'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
                        <Sparkle size={20} /> {t('settings.title')}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">{t('settings.subtitle')}</p>
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
                        {t('settings.reset')}
                    </MyButton>
                    <MyButton type="button" disable={!dirty || saving || isLoading} onClick={save}>
                        {saving ? t('settings.saving') : t('settings.save')}
                    </MyButton>
                </div>
            </div>

            {dirty && (
                <p className="rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-700">
                    {t('settings.unsaved')}
                </p>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('settings.loadTitle')}</CardTitle>
                    <CardDescription>{t('settings.loadHint')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="eng-cap">{t('settings.cap')}</Label>
                        <Input
                            id="eng-cap"
                            type="number"
                            min={1}
                            max={50}
                            value={form.dailyItemCap}
                            onChange={(e) => patch({ dailyItemCap: Number(e.target.value) })}
                        />
                        <p className="text-xs text-neutral-500">
                            {t('settings.default', { value: 5 })}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('settings.readingTitle')}</CardTitle>
                    <CardDescription>{t('settings.readingHint')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="eng-scroll">{t('settings.scroll')}</Label>
                        <Input
                            id="eng-scroll"
                            type="number"
                            min={0}
                            max={100}
                            value={form.minScrollPercent}
                            onChange={(e) => patch({ minScrollPercent: Number(e.target.value) })}
                        />
                        <p className="text-xs text-neutral-500">
                            {t('settings.default', { value: 80 })}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="eng-read">{t('settings.dwell')}</Label>
                        <Input
                            id="eng-read"
                            type="number"
                            min={0}
                            max={3600}
                            value={form.minReadSeconds}
                            onChange={(e) => patch({ minReadSeconds: Number(e.target.value) })}
                        />
                        <p className="text-xs text-neutral-500">
                            {t('settings.default', { value: 15 })}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('settings.gamesTitle')}</CardTitle>
                    <CardDescription>{t('settings.gamesHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <Switch
                            id="eng-unverified"
                            checked={form.allowUnverifiedScoreBonus}
                            onCheckedChange={(v) => patch({ allowUnverifiedScoreBonus: v })}
                        />
                        <Label htmlFor="eng-unverified">{t('settings.unverified')}</Label>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
