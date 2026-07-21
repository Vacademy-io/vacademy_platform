/**
 * "Translate" course action (Phase 1 i18n).
 *
 * Flow: pick target language + mode -> POST ai-service /translation/v1/estimate
 * -> show the credit cost against the institute balance -> confirm -> POST
 * /translation/v1/course/{packageSessionId} -> toast linking to the review
 * screen. English content is never touched; translations land in sidecar rows.
 *
 * A 402 from the start call means the balance moved between the estimate and
 * the confirm — it is surfaced with the app's existing top-up UX rather than a
 * bare error toast.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Translate, Warning } from '@phosphor-icons/react';
import { isAxiosError } from 'axios';

import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyRadioButton } from '@/components/design-system/radio';
import SelectField from '@/components/design-system/select-field';
import { Form } from '@/components/ui/form';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { TopUpModal } from '@/components/common/ai-credits/TopUpModal';
import { getEnabledLocales, getLanguageSetting } from '@/services/language-settings';
import { LOCALE_LABELS, normalizeLocale, type SupportedLocale } from '@/i18n/locales';
import {
    fetchTranslationEstimate,
    startCourseTranslation,
    type TranslationEstimate,
    type TranslationMode,
} from '@/services/translation/translation-services';

const formSchema = z.object({
    targetLocale: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

interface TranslateCourseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    packageSessionId: string;
    courseId: string;
}

export function TranslateCourseDialog({
    open,
    onOpenChange,
    packageSessionId,
    courseId,
}: TranslateCourseDialogProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // The canonical content language — never a translation target.
    const sourceLocale: SupportedLocale = normalizeLocale(
        getLanguageSetting()?.content_source_locale
    );

    const targetOptions = useMemo(
        () =>
            getEnabledLocales()
                .filter((locale) => locale !== sourceLocale)
                .map((locale) => ({
                    _id: locale,
                    value: locale,
                    label: LOCALE_LABELS[locale],
                })),
        [sourceLocale]
    );

    const [mode, setMode] = useState<TranslationMode>('DRAFT');
    const [estimate, setEstimate] = useState<TranslationEstimate | null>(null);
    const [isEstimating, setIsEstimating] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [topUpOpen, setTopUpOpen] = useState(false);
    const [outOfCredits, setOutOfCredits] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { targetLocale: targetOptions[0]?.value ?? '' },
    });

    const targetLocale = form.watch('targetLocale');

    const resetAndClose = (nextOpen: boolean) => {
        if (!nextOpen) {
            setEstimate(null);
            setOutOfCredits(false);
            setMode('DRAFT');
        }
        onOpenChange(nextOpen);
    };

    const handleEstimate = async () => {
        if (!targetLocale) return;
        setIsEstimating(true);
        setOutOfCredits(false);
        try {
            const result = await fetchTranslationEstimate({ packageSessionId, targetLocale });
            setEstimate(result);
        } catch {
            toast.error(t('translation.dialog.estimateFailed'));
        } finally {
            setIsEstimating(false);
        }
    };

    const handleStart = async () => {
        setIsStarting(true);
        try {
            const job = await startCourseTranslation({
                packageSessionId,
                targetLocale,
                sourceLocale,
                mode,
            });
            resetAndClose(false);
            toast.success(t('translation.dialog.started'), {
                action: {
                    label: t('translation.dialog.viewProgress'),
                    onClick: () =>
                        navigate({
                            to: '/study-library/courses/course-details/translation',
                            search: {
                                courseId,
                                packageSessionId,
                                locale: targetLocale,
                                jobId: job.job_id,
                            },
                        }),
                },
            });
        } catch (error) {
            // 402 = the balance no longer covers the run; offer a top-up instead
            // of a dead-end error.
            if (isAxiosError(error) && error.response?.status === 402) {
                setOutOfCredits(true);
            } else {
                toast.error(t('translation.dialog.startFailed'));
            }
        } finally {
            setIsStarting(false);
        }
    };

    const insufficient = outOfCredits || estimate?.sufficient === false;

    const footer = (
        <div className="flex w-full items-center justify-end gap-2">
            <MyButton
                type="button"
                buttonType="secondary"
                scale="medium"
                onClick={() => resetAndClose(false)}
            >
                {t('actions.cancel')}
            </MyButton>
            {estimate === null ? (
                <MyButton
                    type="button"
                    buttonType="primary"
                    scale="medium"
                    disable={!targetLocale || isEstimating}
                    onClick={handleEstimate}
                >
                    {t('translation.dialog.continue')}
                </MyButton>
            ) : insufficient ? (
                <MyButton
                    type="button"
                    buttonType="primary"
                    scale="medium"
                    onClick={() => setTopUpOpen(true)}
                >
                    {t('translation.dialog.topUp')}
                </MyButton>
            ) : (
                <MyButton
                    type="button"
                    buttonType="primary"
                    scale="medium"
                    disable={isStarting}
                    onClick={handleStart}
                >
                    {t('translation.dialog.confirm')}
                </MyButton>
            )}
        </div>
    );

    return (
        <>
            <MyDialog
                open={open}
                onOpenChange={resetAndClose}
                heading={t('translation.dialog.heading')}
                dialogWidth="max-w-lg"
                footer={footer}
            >
                <div className="flex flex-col gap-6 p-6">
                    {targetOptions.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-6 text-center">
                            <Translate size={32} className="text-neutral-400" />
                            <p className="text-body text-neutral-600">
                                {t('translation.dialog.noLanguages')}
                            </p>
                        </div>
                    ) : (
                        <>
                            <Form {...form}>
                                <form className="flex flex-col gap-6">
                                    <SelectField
                                        label={t('translation.dialog.targetLanguage')}
                                        name="targetLocale"
                                        options={targetOptions}
                                        control={form.control}
                                        required
                                        disabled={estimate !== null}
                                        className="w-full"
                                        labelStyle="w-full"
                                    />
                                </form>
                            </Form>

                            <div className="flex flex-col gap-2">
                                <p className="text-subtitle font-medium text-neutral-700">
                                    {t('translation.dialog.mode')}
                                </p>
                                <MyRadioButton
                                    name="translation-mode"
                                    value={mode}
                                    onChange={(value) => setMode(value as TranslationMode)}
                                    disabled={estimate !== null}
                                    className="flex flex-col gap-2"
                                    options={[
                                        {
                                            value: 'DRAFT',
                                            label: t('translation.dialog.modeDraft'),
                                        },
                                        {
                                            value: 'AUTO_PUBLISH',
                                            label: t('translation.dialog.modeAutoPublish'),
                                        },
                                    ]}
                                />
                                <p className="text-caption text-neutral-500">
                                    {mode === 'DRAFT'
                                        ? t('translation.dialog.modeDraftHint')
                                        : t('translation.dialog.modeAutoPublishHint')}
                                </p>
                            </div>

                            {isEstimating && <DashboardLoader />}

                            {estimate !== null && (
                                <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-body text-neutral-600">
                                            {t('translation.dialog.estimatedCost')}
                                        </span>
                                        <span className="text-subtitle font-semibold text-neutral-800">
                                            {t('translation.credits', {
                                                value: estimate.estimated_credits,
                                            })}
                                        </span>
                                    </div>
                                    {estimate.current_balance !== null && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-body text-neutral-600">
                                                {t('translation.dialog.currentBalance')}
                                            </span>
                                            <span className="text-body text-neutral-800">
                                                {t('translation.credits', {
                                                    value: estimate.current_balance,
                                                })}
                                            </span>
                                        </div>
                                    )}
                                    {estimate.balance_after !== null && !insufficient && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-body text-neutral-600">
                                                {t('translation.dialog.balanceAfter')}
                                            </span>
                                            <span className="text-body text-neutral-800">
                                                {t('translation.credits', {
                                                    value: estimate.balance_after,
                                                })}
                                            </span>
                                        </div>
                                    )}
                                    {estimate.items_found > 0 && (
                                        <p className="text-caption text-neutral-500">
                                            {t('translation.dialog.itemsFound', {
                                                value: estimate.items_found,
                                            })}
                                        </p>
                                    )}
                                    {insufficient && (
                                        <div className="flex items-start gap-2 rounded-md bg-danger-50 p-3">
                                            <Warning
                                                size={16}
                                                className="mt-0.5 shrink-0 text-danger-600"
                                            />
                                            <p className="text-caption text-danger-700">
                                                {t('translation.dialog.insufficientCredits')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </MyDialog>

            <TopUpModal open={topUpOpen} onOpenChange={setTopUpOpen} />
        </>
    );
}
