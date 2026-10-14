/**
 * Settings → Payment Settings → Offline payment modes: the options admins pick from when
 * they record a payment by hand (Cash, UPI via PhonePe / Google Pay, bank transfer into a
 * given account, cheque ...). Stored per institute by OfflinePaymentModeService, not in the
 * settings blob (it can name bank accounts). See docs/OFFLINE_PAYMENT_RECORDING.md.
 *
 * Saved modes and options are switched off rather than deleted, so past payments keep
 * pointing at them; only rows added in this session can be removed.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Money, Plus, Trash } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MyButton } from '@/components/design-system/button';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    OFFLINE_EXTRA_FIELDS,
    useOfflinePaymentModes,
    useSaveOfflinePaymentModes,
    type OfflinePaymentMode,
    type OfflinePaymentModes,
} from '@/services/offline-payment-modes';

const validate = (draft: OfflinePaymentModes): string | null => {
    if (draft.modes.some((m) => !m.label.trim())) return 'errors.modeLabel';
    if (draft.modes.some((m) => (m.sub_modes ?? []).some((s) => !s.label.trim()))) return 'errors.subModeLabel';
    if (!draft.modes.some((m) => m.active)) return 'errors.noActive';
    return null;
};

export default function OfflinePaymentModesSettings() {
    const { t } = useTranslation('settingsOfflinePaymentModes');
    const instituteId = getCurrentInstituteId();
    const { data, isLoading } = useOfflinePaymentModes(instituteId);
    const { mutate: save, isPending: saving } = useSaveOfflinePaymentModes();
    const [draft, setDraft] = useState<OfflinePaymentModes | null>(null);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (data) {
            setDraft(structuredClone(data));
            setDirty(false);
        }
    }, [data]);

    const update = (next: OfflinePaymentModes) => {
        setDraft(next);
        setDirty(true);
    };
    const updateMode = (index: number, patch: Partial<OfflinePaymentMode>) => {
        if (!draft) return;
        update({ ...draft, modes: draft.modes.map((m, i) => (i === index ? { ...m, ...patch } : m)) });
    };

    const errorKey = draft ? validate(draft) : null;

    const onSave = () => {
        if (!draft || !instituteId || errorKey) return;
        save(
            { instituteId, modes: draft },
            {
                onSuccess: () => toast.success(t('toasts.saved')),
                onError: (e: unknown) => {
                    const message =
                        (e as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
                        (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
                    toast.error(message || t('toasts.saveError'));
                },
            }
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Money className="size-5" />
                    {t('title')}
                </CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading || !draft ? (
                    <div className="text-body text-neutral-500">{t('loading')}</div>
                ) : (
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-start gap-6">
                            <div className="flex items-start gap-3">
                                <Switch
                                    id="offline-require-mode"
                                    checked={draft.require_mode}
                                    onCheckedChange={(v) => update({ ...draft, require_mode: v })}
                                />
                                <div>
                                    <Label htmlFor="offline-require-mode" className="cursor-pointer">
                                        {t('requireMode.label')}
                                    </Label>
                                    <p className="mt-0.5 text-xs text-neutral-500">{t('requireMode.hint')}</p>
                                </div>
                            </div>
                            <div>
                                <Label className="mb-1 block text-xs text-neutral-500">{t('defaultMode')}</Label>
                                <select
                                    value={draft.default_mode ?? ''}
                                    onChange={(e) => update({ ...draft, default_mode: e.target.value || null })}
                                    className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
                                >
                                    <option value="">{t('noDefault')}</option>
                                    {draft.modes
                                        .filter((m) => m.active && m.code)
                                        .map((m) => (
                                            <option key={m.code!} value={m.code!}>
                                                {m.label}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {draft.modes.map((mode, index) => (
                                <div
                                    key={mode.code ?? `new-${index}`}
                                    className="rounded-lg border border-neutral-200 p-3"
                                >
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Switch
                                            checked={mode.active}
                                            onCheckedChange={(v) => updateMode(index, { active: v })}
                                            aria-label={t('mode.active')}
                                        />
                                        <Input
                                            value={mode.label}
                                            onChange={(e) => updateMode(index, { label: e.target.value })}
                                            placeholder={t('mode.labelPlaceholder')}
                                            className="w-56"
                                        />
                                        <Input
                                            value={mode.reference_label ?? ''}
                                            onChange={(e) => updateMode(index, { reference_label: e.target.value })}
                                            placeholder={t('mode.referenceLabelPlaceholder')}
                                            className="w-52"
                                        />
                                        {!mode.code && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    update({ ...draft, modes: draft.modes.filter((_, i) => i !== index) })
                                                }
                                                aria-label={t('mode.remove')}
                                                className="text-neutral-500 hover:text-danger-600"
                                            >
                                                <Trash className="size-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-700">
                                        <label className="flex items-center gap-2">
                                            <Checkbox
                                                checked={!!mode.reference_required}
                                                onCheckedChange={(v) => updateMode(index, { reference_required: v === true })}
                                            />
                                            {t('mode.referenceRequired')}
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <Checkbox
                                                checked={!!mode.proof_required}
                                                onCheckedChange={(v) => updateMode(index, { proof_required: v === true })}
                                            />
                                            {t('mode.proofRequired')}
                                        </label>
                                        {OFFLINE_EXTRA_FIELDS.map((f) => (
                                            <label key={f} className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={(mode.extra_fields ?? []).includes(f)}
                                                    onCheckedChange={(v) =>
                                                        updateMode(index, {
                                                            extra_fields:
                                                                v === true
                                                                    ? [...(mode.extra_fields ?? []), f]
                                                                    : (mode.extra_fields ?? []).filter((x) => x !== f),
                                                        })
                                                    }
                                                />
                                                {t(`extra.${f}`)}
                                            </label>
                                        ))}
                                    </div>

                                    <div className="mt-3">
                                        <p className="mb-1 text-xs font-medium text-neutral-500">{t('subModes.heading')}</p>
                                        <div className="flex flex-col gap-2">
                                            {(mode.sub_modes ?? []).map((sub, si) => (
                                                <div key={sub.code ?? `new-${si}`} className="flex items-center gap-2">
                                                    <Switch
                                                        checked={sub.active}
                                                        onCheckedChange={(v) =>
                                                            updateMode(index, {
                                                                sub_modes: (mode.sub_modes ?? []).map((s, j) =>
                                                                    j === si ? { ...s, active: v } : s
                                                                ),
                                                            })
                                                        }
                                                        aria-label={t('subModes.active')}
                                                    />
                                                    <Input
                                                        value={sub.label}
                                                        onChange={(e) =>
                                                            updateMode(index, {
                                                                sub_modes: (mode.sub_modes ?? []).map((s, j) =>
                                                                    j === si ? { ...s, label: e.target.value } : s
                                                                ),
                                                            })
                                                        }
                                                        placeholder={t('subModes.placeholder')}
                                                        className="w-64"
                                                    />
                                                    {!sub.code && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateMode(index, {
                                                                    sub_modes: (mode.sub_modes ?? []).filter((_, j) => j !== si),
                                                                })
                                                            }
                                                            aria-label={t('subModes.remove')}
                                                            className="text-neutral-500 hover:text-danger-600"
                                                        >
                                                            <Trash className="size-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateMode(index, {
                                                        sub_modes: [...(mode.sub_modes ?? []), { label: '', active: true }],
                                                    })
                                                }
                                                className="flex w-fit items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                                            >
                                                <Plus className="size-3.5" />
                                                {t('subModes.add')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    update({
                                        ...draft,
                                        modes: [...draft.modes, { label: '', active: true, extra_fields: [], sub_modes: [] }],
                                    })
                                }
                                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
                            >
                                <Plus className="size-4" />
                                {t('addMode')}
                            </button>
                            <div className="flex items-center gap-3">
                                {errorKey && (
                                    <span role="alert" className="text-xs font-medium text-danger-600">
                                        {t(errorKey)}
                                    </span>
                                )}
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={onSave}
                                    disable={!dirty || saving || !!errorKey}
                                >
                                    {saving ? t('saving') : t('save')}
                                </MyButton>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
