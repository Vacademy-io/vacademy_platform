import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { UploadFileInS3 } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    findActiveMode,
    offlinePaymentDetailsError,
    useOfflinePaymentModes,
    type OfflineExtraField,
    type OfflinePaymentDetails,
} from '@/services/offline-payment-modes';

interface Props {
    value: OfflinePaymentDetails;
    onChange: (next: OfflinePaymentDetails) => void;
    /** Reports what blocks submitting (translated), or null; only on change. */
    onErrorChange?: (message: string | null) => void;
    /** Show a reference input (hide when the dialog already has its own). Default true. */
    showReference?: boolean;
    /** The dialog's own reference/transaction-id value, when `showReference` is false. */
    externalReference?: string | null;
    /** Show a payment-date input. Default false (most dialogs have their own or use today). */
    showDate?: boolean;
    /** Show a notes input. Default false. */
    showNotes?: boolean;
    /** Smaller text for dense panels (the Enroll wizard's fee panel). */
    compact?: boolean;
    instituteId?: string;
}

/**
 * "How was it paid?" for every admin record-payment dialog: mode chips from the institute's
 * offline payment modes (Settings → Payment Settings), then the mode's options (e.g. PhonePe
 * under UPI), a reference labelled for the mode, the mode's extra fields (cheque date, bank,
 * payer) and an optional proof upload. Optional unless the institute requires a mode.
 */
export function OfflinePaymentFields({
    value,
    onChange,
    onErrorChange,
    showReference = true,
    externalReference,
    showDate = false,
    showNotes = false,
    compact = false,
    instituteId,
}: Props) {
    const { t } = useTranslation('commonOfflinePaymentFields');
    const { data: modes, isLoading } = useOfflinePaymentModes(instituteId);
    const [uploading, setUploading] = useState(false);
    const [proofName, setProofName] = useState<string | null>(null);

    // Preselect the institute's default mode whenever nothing has been chosen yet (undefined) —
    // also after a parent resets the value on reopen. Clearing a choice sets null, so this
    // never fights the admin.
    useEffect(() => {
        if (modes && value.mode === undefined) {
            onChange({ ...value, mode: findActiveMode(modes, modes.default_mode)?.code ?? null });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modes, value.mode]);

    const errorKey = offlinePaymentDetailsError(
        showReference ? value : { ...value, reference: externalReference ?? null },
        modes
    );
    const errorText = errorKey ? t(errorKey) : null;
    // Report on mount and on every change, and clear on unmount: a parent that hides these
    // fields must not keep blocking on an error nobody can see any more.
    const reported = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (reported.current === errorText) return;
        reported.current = errorText;
        onErrorChange?.(errorText);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errorText]);
    useEffect(
        () => () => onErrorChange?.(null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    if (isLoading || !modes) {
        return <p className="text-xs text-neutral-500">{t('loading')}</p>;
    }

    const activeModes = modes.modes.filter((m) => m.active);
    const mode = findActiveMode(modes, value.mode);
    const activeSubs = (mode?.sub_modes ?? []).filter((s) => s.active);
    const text = compact ? 'text-2xs' : 'text-xs';
    const set = (patch: Partial<OfflinePaymentDetails>) => onChange({ ...value, ...patch });
    const setExtra = (key: OfflineExtraField, v: string) => set({ extra: { ...(value.extra ?? {}), [key]: v } });

    const chip = (selected: boolean) =>
        cn(
            'rounded-full border px-2.5 py-0.5 font-medium transition',
            text,
            selected
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
        );

    const uploadProof = async (file: File) => {
        const id = getCurrentInstituteId() ?? '';
        const fileId = await UploadFileInS3(file, setUploading, getUserId(), 'INSTITUTE', id, false);
        if (fileId) {
            setProofName(file.name);
            set({ proof_file_id: fileId });
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div>
                <Label className={cn('mb-1 block font-medium text-neutral-500', text)}>
                    {t('modeLabel')}
                    {modes.require_mode && <span className="text-danger-600"> *</span>}
                </Label>
                <div role="radiogroup" aria-label={t('modeLabel')} className="flex flex-wrap gap-1.5">
                    {activeModes.map((m) => (
                        <button
                            key={m.code ?? m.label}
                            type="button"
                            role="radio"
                            aria-checked={value.mode === m.code}
                            onClick={() =>
                                set({
                                    mode: value.mode === m.code && !modes.require_mode ? null : (m.code ?? null),
                                    sub_mode: null,
                                    extra: {},
                                })
                            }
                            className={chip(value.mode === m.code)}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {mode && activeSubs.length > 0 && (
                <div>
                    <Label className={cn('mb-1 block font-medium text-neutral-500', text)}>{t('subModeLabel')}</Label>
                    <div role="radiogroup" aria-label={t('subModeLabel')} className="flex flex-wrap gap-1.5">
                        {activeSubs.map((s) => (
                            <button
                                key={s.code ?? s.label}
                                type="button"
                                role="radio"
                                aria-checked={value.sub_mode === s.code}
                                onClick={() => set({ sub_mode: value.sub_mode === s.code ? null : (s.code ?? null) })}
                                className={chip(value.sub_mode === s.code)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-start gap-3">
                {showReference && (
                    <div className="min-w-40 flex-1">
                        <Label className={cn('mb-1 block font-medium text-neutral-500', text)}>
                            {mode?.reference_label || t('referenceLabel')}
                            {mode?.reference_required && <span className="text-danger-600"> *</span>}
                        </Label>
                        <Input
                            value={value.reference ?? ''}
                            onChange={(e) => set({ reference: e.target.value })}
                            placeholder={t('referencePlaceholder')}
                            className={text}
                        />
                    </div>
                )}
                {showDate && (
                    <div>
                        <Label className={cn('mb-1 block font-medium text-neutral-500', text)}>{t('dateLabel')}</Label>
                        <Input
                            type="date"
                            value={value.payment_date ?? ''}
                            onChange={(e) => set({ payment_date: e.target.value || null })}
                            className={cn('w-40', text)}
                        />
                    </div>
                )}
                {(mode?.extra_fields ?? []).map((f) => (
                    <div key={f} className={f === 'cheque_date' ? '' : 'min-w-40 flex-1'}>
                        <Label className={cn('mb-1 block font-medium text-neutral-500', text)}>
                            {t(`extra.${f}`)}
                        </Label>
                        <Input
                            type={f === 'cheque_date' ? 'date' : 'text'}
                            value={value.extra?.[f] ?? ''}
                            onChange={(e) => setExtra(f, e.target.value)}
                            className={cn(f === 'cheque_date' ? 'w-40' : '', text)}
                        />
                    </div>
                ))}
            </div>

            {showNotes && (
                <div>
                    <Label className={cn('mb-1 block font-medium text-neutral-500', text)}>{t('notesLabel')}</Label>
                    <Input value={value.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} className={text} />
                </div>
            )}

            {mode && (
                <div className={cn('flex flex-wrap items-center gap-2 text-neutral-600', text)}>
                    <label className="cursor-pointer font-medium text-primary-600 hover:underline">
                        {value.proof_file_id ? t('proof.replace') : t('proof.attach')}
                        {mode.proof_required && <span className="text-danger-600"> *</span>}
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadProof(file);
                                e.target.value = '';
                            }}
                        />
                    </label>
                    {uploading && <span>{t('proof.uploading')}</span>}
                    {!uploading && value.proof_file_id && (
                        <span>
                            {proofName ?? t('proof.attached')}{' '}
                            <button
                                type="button"
                                onClick={() => {
                                    setProofName(null);
                                    set({ proof_file_id: null });
                                }}
                                className="text-neutral-500 hover:underline"
                            >
                                {t('proof.remove')}
                            </button>
                        </span>
                    )}
                </div>
            )}

            {errorText && (
                <p role="alert" className={cn('font-medium text-danger-600', text)}>
                    {errorText}
                </p>
            )}
        </div>
    );
}
