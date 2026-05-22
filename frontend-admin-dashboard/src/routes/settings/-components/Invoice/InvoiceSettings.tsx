import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, FileText, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { COUNTRIES, countryCodeToFlag, findCountry } from '../../-utils/countries';
import {
    CURRENCY_OPTIONS,
    COUNTRY_TAX_PRESETS,
    COUNTRY_DEFAULT_CURRENCY,
    DEFAULT_INVOICE_SETTINGS,
    PACKAGE_TYPES,
    fetchInvoiceSettings,
    saveInvoiceSettings,
    type InvoiceSettingsData,
    type TaxComponent,
} from './invoice-settings-service';
import { InvoiceTemplatesSection } from './InvoiceTemplatesSection';

const INJECTABLE_PLACEHOLDERS: Array<{ tag: string; description: string }> = [
    { tag: '{{country}}', description: 'Operating country name' },
    { tag: '{{country_code}}', description: 'ISO country code (e.g. IN)' },
    { tag: '{{tax_registration_number}}', description: 'GSTIN / VAT number' },
    { tag: '{{hsn_code}}', description: 'HSN / SAC code' },
    { tag: '{{tax_components}}', description: 'Tax components table (label, rate, amount)' },
    { tag: '{{tax_label}}', description: 'Tax line label' },
    { tag: '{{tax_rate}}', description: 'Default tax rate %' },
];

function CountryCombobox({
    code,
    onSelect,
}: {
    code: string;
    onSelect: (code: string, name: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const selected = code ? findCountry(code) : undefined;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex h-9 w-full max-w-sm items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                    {selected ? (
                        <span className="flex items-center gap-2">
                            <span className="text-base leading-none">
                                {countryCodeToFlag(selected.code)}
                            </span>
                            <span>{selected.name}</span>
                            <span className="text-xs uppercase text-slate-400">{selected.code}</span>
                        </span>
                    ) : (
                        <span className="text-slate-500">Select country…</span>
                    )}
                    <ChevronsUpDown className="size-4 text-slate-400" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search countries…" className="h-9" />
                    <CommandList className="max-h-64">
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                            {COUNTRIES.map((country) => {
                                const checked = country.code === code;
                                return (
                                    <CommandItem
                                        key={country.code}
                                        value={`${country.name} ${country.nameFull} ${country.code} ${country.dialCode}`}
                                        onSelect={() => {
                                            onSelect(country.code, country.name);
                                            setOpen(false);
                                        }}
                                        className="flex items-center gap-2"
                                    >
                                        <Check
                                            className={cn(
                                                'size-4',
                                                checked ? 'opacity-100 text-blue-600' : 'opacity-0'
                                            )}
                                        />
                                        <span className="text-base leading-none">
                                            {countryCodeToFlag(country.code)}
                                        </span>
                                        <span className="flex-1 truncate text-sm">
                                            {country.name}
                                        </span>
                                        <span className="text-xs uppercase text-slate-400">
                                            {country.code}
                                        </span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function TaxComponentEditor({
    components,
    onChange,
    emptyHint,
}: {
    components: TaxComponent[];
    onChange: (next: TaxComponent[]) => void;
    emptyHint?: string;
}) {
    const update = (i: number, patch: Partial<TaxComponent>) =>
        onChange(components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    const add = () => onChange([...components, { label: '', rate: 0 }]);
    const remove = (i: number) => onChange(components.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-2">
            {components.length === 0 ? (
                <p className="rounded-md border border-dashed bg-slate-50/50 px-3 py-2 text-xs italic text-slate-400">
                    {emptyHint ?? 'No tax components configured.'}
                </p>
            ) : (
                components.map((comp, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Input
                            className="max-w-[200px]"
                            placeholder="Label (e.g. CGST)"
                            value={comp.label}
                            onChange={(e) => update(index, { label: e.target.value })}
                        />
                        <div className="relative w-28">
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="pr-7"
                                placeholder="Rate"
                                value={String(comp.rate)}
                                onChange={(e) => update(index, { rate: parseFloat(e.target.value) || 0 })}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                %
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                            title="Remove component"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                ))
            )}
            <Button variant="outline" size="sm" className="mt-1" onClick={add}>
                <Plus className="mr-2 size-4" />
                Add tax component
            </Button>
        </div>
    );
}

export default function InvoiceSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<InvoiceSettingsData>(DEFAULT_INVOICE_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);
    const [selectedPkgType, setSelectedPkgType] = useState<string>(PACKAGE_TYPES[0]);

    const { data, isLoading } = useQuery({
        queryKey: ['invoice-settings'],
        queryFn: fetchInvoiceSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveInvoiceSettings,
        onSuccess: () => {
            toast.success('Invoice settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['invoice-settings'] });
        },
        onError: () => toast.error('Failed to save invoice settings'),
    });

    const update = (patch: Partial<InvoiceSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const updateCountry = (patch: Partial<InvoiceSettingsData['country']>) => {
        setSettings((prev) => ({ ...prev, country: { ...prev.country, ...patch } }));
        setHasChanges(true);
    };

    const updateTypeComponents = (type: string, next: TaxComponent[]) => {
        setSettings((prev) => ({
            ...prev,
            country: {
                ...prev.country,
                taxComponentsByPackageType: {
                    ...prev.country.taxComponentsByPackageType,
                    [type]: next,
                },
            },
        }));
        setHasChanges(true);
    };

    const handleCountrySelect = (code: string, name: string) => {
        setSettings((prev) => {
            const next: InvoiceSettingsData = {
                ...prev,
                country: { ...prev.country, code, name },
            };
            // Apply suggested tax components + currency only when nothing is configured yet,
            // so we never clobber an admin's existing edits.
            const preset = COUNTRY_TAX_PRESETS[code];
            if (prev.country.taxComponents.length === 0 && preset) {
                next.country.taxComponents = preset.map((c) => ({ ...c }));
                const suggestedCurrency = COUNTRY_DEFAULT_CURRENCY[code];
                if (suggestedCurrency) {
                    next.currency = suggestedCurrency;
                }
            }
            return next;
        });
        setHasChanges(true);
    };

    const updateTaxComponent = (index: number, patch: Partial<TaxComponent>) => {
        setSettings((prev) => {
            const components = prev.country.taxComponents.map((c, i) =>
                i === index ? { ...c, ...patch } : c
            );
            return { ...prev, country: { ...prev.country, taxComponents: components } };
        });
        setHasChanges(true);
    };

    const addTaxComponent = () => {
        setSettings((prev) => ({
            ...prev,
            country: {
                ...prev.country,
                taxComponents: [...prev.country.taxComponents, { label: '', rate: 0 }],
            },
        }));
        setHasChanges(true);
    };

    const removeTaxComponent = (index: number) => {
        setSettings((prev) => ({
            ...prev,
            country: {
                ...prev.country,
                taxComponents: prev.country.taxComponents.filter((_, i) => i !== index),
            },
        }));
        setHasChanges(true);
    };

    const totalConfiguredTax = useMemo(
        () => settings.country.taxComponents.reduce((sum, c) => sum + (Number(c.rate) || 0), 0),
        [settings.country.taxComponents]
    );

    if (isLoading) {
        return (
            <div className="p-6 text-sm text-muted-foreground">Loading invoice settings…</div>
        );
    }

    return (
        <div className="w-full space-y-6 p-2 sm:p-6">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="flex items-center gap-2 text-lg font-bold">
                    <FileText className="size-6" />
                    Invoice Settings
                </h1>
                <p className="text-sm text-muted-foreground">
                    Configure tax, currency and email behaviour for generated invoices, manage the
                    invoice PDF &amp; email templates, and set the country tax details injected into
                    those templates.
                </p>
            </div>

            {/* General invoice options */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">General</CardTitle>
                    <CardDescription>
                        Tax and currency defaults applied when an invoice is generated.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        {/* Currency */}
                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-currency">Currency</Label>
                            <Select
                                value={settings.currency}
                                onValueChange={(v) => update({ currency: v })}
                            >
                                <SelectTrigger id="invoice-currency" className="max-w-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCY_OPTIONS.map((c) => (
                                        <SelectItem key={c.code} value={c.code}>
                                            {c.symbol} {c.code} — {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tax label */}
                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-tax-label">Tax label</Label>
                            <Input
                                id="invoice-tax-label"
                                className="max-w-xs"
                                placeholder="e.g. GST, VAT, Tax"
                                value={settings.taxLabel}
                                onChange={(e) => update({ taxLabel: e.target.value })}
                            />
                        </div>

                        {/* Tax rate */}
                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-tax-rate">Default tax rate (%)</Label>
                            <Input
                                id="invoice-tax-rate"
                                type="number"
                                min={0}
                                step="0.01"
                                className="max-w-xs"
                                value={String(settings.taxRate)}
                                onChange={(e) =>
                                    update({ taxRate: parseFloat(e.target.value) || 0 })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Applied to invoice totals when no per-plan tax is set.
                            </p>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="invoice-tax-included" className="cursor-pointer">
                                Prices include tax
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                When on, listed prices are treated as tax-inclusive.
                            </p>
                        </div>
                        <Switch
                            id="invoice-tax-included"
                            checked={settings.taxIncluded}
                            onCheckedChange={(v) => update({ taxIncluded: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="invoice-send-email" className="cursor-pointer">
                                Send invoice email automatically
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Email the generated invoice PDF to the learner when a payment is
                                completed.
                            </p>
                        </div>
                        <Switch
                            id="invoice-send-email"
                            checked={settings.sendInvoiceEmail}
                            onCheckedChange={(v) => update({ sendInvoiceEmail: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="invoice-manual-enroll" className="cursor-pointer">
                                Generate invoice on manual / bulk enrollment
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                When an admin enrolls learners manually or in bulk (no payment
                                gateway), generate an invoice for them.
                            </p>
                        </div>
                        <Switch
                            id="invoice-manual-enroll"
                            checked={settings.generateInvoiceOnManualEnroll}
                            onCheckedChange={(v) => update({ generateInvoiceOnManualEnroll: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Country & tax components */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Country &amp; Tax Details</CardTitle>
                    <CardDescription>
                        The operating country, your tax registration number and its tax components.
                        These are injectable into invoice templates.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Country</Label>
                            <CountryCombobox
                                code={settings.country.code}
                                onSelect={handleCountrySelect}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-tax-reg-no">Tax registration number</Label>
                            <Input
                                id="invoice-tax-reg-no"
                                className="max-w-xs"
                                placeholder="e.g. 22AAAAA0000A1Z5"
                                value={settings.country.taxRegistrationNumber}
                                onChange={(e) =>
                                    updateCountry({ taxRegistrationNumber: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="invoice-hsn-sac">HSN / SAC code</Label>
                            <Input
                                id="invoice-hsn-sac"
                                className="max-w-xs"
                                placeholder="e.g. 999293 (education services)"
                                value={settings.country.hsnSacCode}
                                onChange={(e) => updateCountry({ hsnSacCode: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                SAC for services (e.g. courses); HSN for goods.
                            </p>
                        </div>
                    </div>

                    {/* Tax components editor */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Tax components</Label>
                            {settings.country.taxComponents.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    Total: {totalConfiguredTax}%
                                </span>
                            )}
                        </div>

                        {settings.country.taxComponents.length === 0 ? (
                            <p className="rounded-md border border-dashed bg-slate-50/50 px-3 py-2 text-xs italic text-slate-400">
                                No tax components configured. Add one (e.g. CGST 9%, SGST 9%) or pick
                                a country above to load suggested defaults.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {settings.country.taxComponents.map((comp, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input
                                            className="max-w-[200px]"
                                            placeholder="Label (e.g. CGST)"
                                            value={comp.label}
                                            onChange={(e) =>
                                                updateTaxComponent(index, { label: e.target.value })
                                            }
                                        />
                                        <div className="relative w-28">
                                            <Input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                className="pr-7"
                                                placeholder="Rate"
                                                value={String(comp.rate)}
                                                onChange={(e) =>
                                                    updateTaxComponent(index, {
                                                        rate: parseFloat(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                %
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="p-2 text-destructive hover:text-destructive"
                                            onClick={() => removeTaxComponent(index)}
                                            title="Remove component"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-1"
                            onClick={addTaxComponent}
                        >
                            <Plus className="mr-2 size-4" />
                            Add tax component
                        </Button>
                    </div>

                    {/* Tax components by package type */}
                    <div className="space-y-2 rounded-lg border p-3">
                        <Label>Tax components by package type</Label>
                        <p className="text-xs text-muted-foreground">
                            Override the default components for a specific package type. At invoice
                            time, each line item uses its package type&apos;s components, falling back
                            to the default set above.
                        </p>
                        <Select value={selectedPkgType} onValueChange={setSelectedPkgType}>
                            <SelectTrigger className="max-w-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PACKAGE_TYPES.map((t) => {
                                    const count =
                                        settings.country.taxComponentsByPackageType[t]?.length ?? 0;
                                    return (
                                        <SelectItem key={t} value={t}>
                                            {t}
                                            {count > 0 ? ` (${count})` : ''}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <TaxComponentEditor
                            components={
                                settings.country.taxComponentsByPackageType[selectedPkgType] ?? []
                            }
                            onChange={(next) => updateTypeComponents(selectedPkgType, next)}
                            emptyHint={`No override for ${selectedPkgType} — the default components above will apply.`}
                        />
                    </div>

                    {/* Injectable placeholders reference */}
                    <div className="rounded-lg border bg-slate-50/60 p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-600">
                            Injectable in invoice templates
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                            {INJECTABLE_PLACEHOLDERS.map((p) => (
                                <div key={p.tag} className="flex items-center gap-2 text-xs">
                                    <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-700">
                                        {p.tag}
                                    </code>
                                    <span className="text-slate-500">{p.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={() => save(settings)}
                    disable={saving || !hasChanges}
                >
                    {saving ? 'Saving…' : 'Save Invoice Settings'}
                </MyButton>
            </div>

            {/* Templates */}
            <InvoiceTemplatesSection type="INVOICE" />
            <InvoiceTemplatesSection type="INVOICE_EMAIL" />
        </div>
    );
}
