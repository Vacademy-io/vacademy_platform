import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowsClockwise, Globe, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MultiSelect } from '@/components/design-system/multi-select';
import { StatusChip } from '@/components/design-system/status-chips';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CURRENCIES, getCurrencySymbol } from '@/constants/currencies';
import { useRegionalPricing, useRegionalPricingMutations } from '@/services/regional-pricing';
import type { RegionalPriceApi, RegionalPricingPlanApi } from '@/types/payment';

interface RegionalPricingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paymentOptionId: string;
    paymentOptionName: string;
}

const errorMessage = (error: unknown, fallback: string): string => {
    const data = (error as { response?: { data?: { ex?: string; message?: string } } })?.response
        ?.data;
    return data?.ex || data?.message || fallback;
};

const formatMoney = (amount: number | null | undefined, currency: string, locale: string) =>
    amount == null ? '—' : `${getCurrencySymbol(currency)}${amount.toLocaleString(locale)}`;

/**
 * Admin panel for one payment option's regional pricing: the on/off switch, the currencies
 * the system auto-prices every plan in, and per-plan prices the admin can override.
 */
export const RegionalPricingDialog = ({
    open,
    onOpenChange,
    paymentOptionId,
    paymentOptionName,
}: RegionalPricingDialogProps) => {
    const { t, i18n } = useTranslation('settingsRegionalPricing');
    const { data, isLoading, isError, refetch } = useRegionalPricing(paymentOptionId, open);
    const mutations = useRegionalPricingMutations(paymentOptionId);

    const [enabled, setEnabled] = useState(false);
    const [currencies, setCurrencies] = useState<string[]>([]);

    useEffect(() => {
        if (data) {
            setEnabled(data.enabled);
            setCurrencies(data.currencies);
        }
    }, [data]);

    const baseCurrencies = useMemo(
        () => new Set((data?.plans ?? []).map((p) => p.base_currency)),
        [data]
    );
    const currencyOptions = useMemo(
        () =>
            CURRENCIES.filter((c) => !baseCurrencies.has(c.code)).map((c) => ({
                label: `${c.code} — ${c.name}`,
                value: c.code,
            })),
        [baseCurrencies]
    );

    const settingsDirty =
        !!data &&
        (enabled !== data.enabled ||
            [...currencies].sort().join(',') !== [...data.currencies].sort().join(','));

    const saveSettings = async () => {
        try {
            await mutations.updateSettings.mutateAsync({ enabled, currencies });
            toast.success(t('toast.settingsSaved'));
        } catch (e) {
            toast.error(errorMessage(e, t('toast.saveFailed')));
        }
    };

    const refreshRates = async () => {
        try {
            await mutations.refresh.mutateAsync();
            toast.success(t('toast.refreshed'));
        } catch (e) {
            toast.error(errorMessage(e, t('toast.refreshFailed')));
        }
    };

    return (
        <MyDialog
            heading={t('title', { name: paymentOptionName })}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-4xl"
            footer={
                <MyButton buttonType="secondary" onClick={() => onOpenChange(false)}>
                    {t('actions.close')}
                </MyButton>
            }
        >
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            ) : isError || !data ? (
                <Alert variant="destructive">
                    <WarningCircle className="size-4" />
                    <AlertDescription className="flex items-center justify-between gap-4">
                        {t('error.load')}
                        <MyButton buttonType="secondary" scale="small" onClick={() => refetch()}>
                            {t('actions.retry')}
                        </MyButton>
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardContent className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <Label
                                        htmlFor="regional-pricing-enabled"
                                        className="text-subtitle font-semibold"
                                    >
                                        {t('settings.enabledLabel')}
                                    </Label>
                                    <p className="text-caption text-neutral-500">
                                        {t('settings.enabledHelp')}
                                    </p>
                                </div>
                                <Switch
                                    id="regional-pricing-enabled"
                                    checked={enabled}
                                    onCheckedChange={setEnabled}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-body">{t('settings.currenciesLabel')}</Label>
                                <MultiSelect
                                    options={currencyOptions}
                                    selected={currencies}
                                    onChange={setCurrencies}
                                    placeholder={t('settings.currenciesPlaceholder')}
                                    portal={false}
                                    checkboxes
                                />
                                <p className="text-caption text-neutral-500">
                                    {t('settings.currenciesHelp')}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-caption text-neutral-500">
                                    {data.rates_fetched_at
                                        ? t('settings.ratesFetched', {
                                              date: new Date(data.rates_fetched_at).toLocaleString(
                                                  i18n.language
                                              ),
                                          })
                                        : t('settings.ratesNever')}
                                </p>
                                <div className="flex items-center gap-2">
                                    <MyButton
                                        buttonType="text"
                                        scale="medium"
                                        onAsyncClick={refreshRates}
                                        loadingText={t('actions.refreshing')}
                                        disable={!data.enabled}
                                    >
                                        <ArrowsClockwise className="size-4" />
                                        {t('actions.refresh')}
                                    </MyButton>
                                    <MyButton
                                        buttonType="primary"
                                        scale="medium"
                                        onAsyncClick={saveSettings}
                                        loadingText={t('actions.saving')}
                                        disable={!settingsDirty}
                                    >
                                        {t('actions.saveSettings')}
                                    </MyButton>
                                </div>
                            </div>

                            <Alert>
                                <Globe className="size-4" />
                                <AlertDescription className="text-caption">
                                    {t('settings.gatewayNote')}
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>

                    {!data.enabled && (
                        <p className="text-body text-neutral-500">{t('plans.offNote')}</p>
                    )}

                    {data.plans.length === 0 ? (
                        <p className="text-body text-neutral-500">{t('plans.empty')}</p>
                    ) : (
                        data.plans.map((plan) => (
                            <PlanRegionalPrices
                                key={plan.payment_plan_id}
                                plan={plan}
                                paymentOptionId={paymentOptionId}
                            />
                        ))
                    )}
                </div>
            )}
        </MyDialog>
    );
};

const PlanRegionalPrices = ({
    plan,
    paymentOptionId,
}: {
    plan: RegionalPricingPlanApi;
    paymentOptionId: string;
}) => {
    const { t, i18n } = useTranslation('settingsRegionalPricing');
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-title">
                    <span>{plan.name}</span>
                    <span className="text-body font-regular text-neutral-500">
                        {t('plans.basePrice', {
                            price: formatMoney(
                                plan.base_actual_price,
                                plan.base_currency,
                                i18n.language
                            ),
                        })}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
                {plan.base_actual_price <= 0 ? (
                    <p className="text-caption text-neutral-500">{t('plans.freePlan')}</p>
                ) : (
                    <>
                        {plan.regional_prices.length === 0 && (
                            <p className="text-caption text-neutral-500">{t('plans.noPrices')}</p>
                        )}
                        {plan.regional_prices.map((row) => (
                            <RegionalPriceRow
                                key={row.id}
                                row={row}
                                paymentOptionId={paymentOptionId}
                            />
                        ))}
                        <AddCountryPrice
                            paymentPlanId={plan.payment_plan_id}
                            paymentOptionId={paymentOptionId}
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
};

const countryName = (code: string, language: string): string => {
    try {
        return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
    } catch {
        return code;
    }
};

const RegionalPriceRow = ({
    row,
    paymentOptionId,
}: {
    row: RegionalPriceApi;
    paymentOptionId: string;
}) => {
    const { t, i18n } = useTranslation('settingsRegionalPricing');
    const mutations = useRegionalPricingMutations(paymentOptionId);
    const [price, setPrice] = useState(String(row.actual_price));
    const [strike, setStrike] = useState(
        row.elevated_price != null ? String(row.elevated_price) : ''
    );
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setPrice(String(row.actual_price));
        setStrike(row.elevated_price != null ? String(row.elevated_price) : '');
    }, [row.actual_price, row.elevated_price]);

    const dirty =
        price !== String(row.actual_price) ||
        strike !== (row.elevated_price != null ? String(row.elevated_price) : '');
    const priceNumber = Number(price);
    const priceInvalid = price.trim() === '' || !(priceNumber > 0);

    const region = row.country_code
        ? `${countryName(row.country_code, i18n.language)} (${row.country_code})`
        : t('row.allCountries', { currency: row.currency });

    const save = async () => {
        try {
            await mutations.upsert.mutateAsync({
                payment_plan_id: row.payment_plan_id,
                currency: row.currency,
                country_code: row.country_code ?? undefined,
                actual_price: priceNumber,
                elevated_price: strike.trim() === '' ? undefined : Number(strike),
            });
            toast.success(t('toast.priceSaved'));
        } catch (e) {
            toast.error(errorMessage(e, t('toast.saveFailed')));
        }
    };

    const run = async (action: () => Promise<unknown>, success: string) => {
        try {
            await action();
            toast.success(success);
        } catch (e) {
            toast.error(errorMessage(e, t('toast.saveFailed')));
        }
    };

    return (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-body font-semibold text-neutral-700">{region}</p>
                <div className="flex flex-wrap items-center gap-2">
                    {row.needs_review ? (
                        <StatusChip
                            text={t('source.review')}
                            textSize="text-caption"
                            status="WARNING"
                        />
                    ) : row.price_source === 'MANUAL' ? (
                        <StatusChip
                            text={t('source.manual')}
                            textSize="text-caption"
                            status="SUCCESS"
                        />
                    ) : (
                        <StatusChip text={t('source.auto')} textSize="text-caption" status="INFO" />
                    )}
                    {row.price_source === 'AUTO' && row.fx_rate_used != null && (
                        <span className="text-caption text-neutral-500">
                            {t('row.rate', { rate: Number(row.fx_rate_used).toPrecision(4) })}
                        </span>
                    )}
                </div>
            </div>
            <MyInput
                inputType="number"
                size="small"
                label={t('row.price', { currency: row.currency })}
                input={price}
                onChangeFunction={(e) => setPrice(e.target.value)}
                error={priceInvalid ? t('row.priceInvalid') : null}
                className="sm:w-32"
                min={0}
            />
            <MyInput
                inputType="number"
                size="small"
                label={t('row.strikePrice')}
                input={strike}
                onChangeFunction={(e) => setStrike(e.target.value)}
                className="sm:w-32"
                min={0}
            />
            <div className="flex flex-wrap items-center gap-1">
                {dirty && (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onAsyncClick={save}
                        disable={priceInvalid}
                    >
                        {t('actions.save')}
                    </MyButton>
                )}
                {row.needs_review && (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onAsyncClick={() =>
                            run(() => mutations.markReviewed.mutateAsync(row.id), t('toast.kept'))
                        }
                    >
                        {t('actions.keep')}
                    </MyButton>
                )}
                {row.price_source === 'MANUAL' && (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onAsyncClick={() =>
                            run(() => mutations.resetToAuto.mutateAsync(row.id), t('toast.reset'))
                        }
                    >
                        {t('actions.resetToAuto')}
                    </MyButton>
                )}
                {row.country_code && (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        layoutVariant="icon"
                        aria-label={t('actions.delete')}
                        onClick={() => setConfirmDelete(true)}
                    >
                        <Trash className="size-4 text-danger-600" />
                    </MyButton>
                )}
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('delete.title', { region })}</AlertDialogTitle>
                        <AlertDialogDescription>{t('delete.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                run(() => mutations.remove.mutateAsync(row.id), t('toast.deleted'))
                            }
                        >
                            {t('actions.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const AddCountryPrice = ({
    paymentPlanId,
    paymentOptionId,
}: {
    paymentPlanId: string;
    paymentOptionId: string;
}) => {
    const { t } = useTranslation('settingsRegionalPricing');
    const mutations = useRegionalPricingMutations(paymentOptionId);
    const [adding, setAdding] = useState(false);
    const [country, setCountry] = useState('');
    const [currency, setCurrency] = useState('');
    const [price, setPrice] = useState('');
    const [auto, setAuto] = useState(false);

    const countryInvalid = !/^[A-Za-z]{2}$/.test(country.trim());
    const currencyInvalid = currency.trim() !== '' && !/^[A-Za-z]{3}$/.test(currency.trim());
    const priceInvalid = !auto && !(Number(price) > 0);

    const reset = () => {
        setAdding(false);
        setCountry('');
        setCurrency('');
        setPrice('');
        setAuto(false);
    };

    const add = async () => {
        try {
            await mutations.upsert.mutateAsync({
                payment_plan_id: paymentPlanId,
                country_code: country.trim().toUpperCase(),
                currency: currency.trim() ? currency.trim().toUpperCase() : undefined,
                actual_price: auto ? undefined : Number(price),
                auto,
            });
            toast.success(t('toast.priceSaved'));
            reset();
        } catch (e) {
            toast.error(errorMessage(e, t('toast.saveFailed')));
        }
    };

    if (!adding) {
        return (
            <MyButton buttonType="text" scale="small" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                {t('add.button')}
            </MyButton>
        );
    }

    return (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <MyInput
                    size="small"
                    label={t('add.country')}
                    inputPlaceholder="NP"
                    input={country}
                    onChangeFunction={(e) => setCountry(e.target.value)}
                    error={country && countryInvalid ? t('add.countryInvalid') : null}
                    className="sm:w-24"
                    maxLength={2}
                />
                <MyInput
                    size="small"
                    label={t('add.currency')}
                    inputPlaceholder={t('add.currencyPlaceholder')}
                    input={currency}
                    onChangeFunction={(e) => setCurrency(e.target.value)}
                    error={currencyInvalid ? t('add.currencyInvalid') : null}
                    className="sm:w-32"
                    maxLength={3}
                />
                {!auto && (
                    <MyInput
                        inputType="number"
                        size="small"
                        label={t('add.price')}
                        input={price}
                        onChangeFunction={(e) => setPrice(e.target.value)}
                        className="sm:w-32"
                        min={0}
                    />
                )}
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id={`auto-${paymentPlanId}`}
                    checked={auto}
                    onCheckedChange={(v) => setAuto(v === true)}
                />
                <Label htmlFor={`auto-${paymentPlanId}`} className="text-body">
                    {t('add.auto')}
                </Label>
            </div>
            <div className="flex items-center gap-2">
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onAsyncClick={add}
                    disable={countryInvalid || currencyInvalid || priceInvalid}
                >
                    {t('add.save')}
                </MyButton>
                <MyButton buttonType="text" scale="small" onClick={reset}>
                    {t('actions.cancel')}
                </MyButton>
            </div>
        </div>
    );
};
