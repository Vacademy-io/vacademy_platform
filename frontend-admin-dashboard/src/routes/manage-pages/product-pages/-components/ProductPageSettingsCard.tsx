import { Input } from '@/components/ui/input';
import {
    BookOpen,
    ShoppingCart,
    CreditCard,
    ChevronRight,
    CheckCircle2,
    FileText,
    Mail,
    MessageCircle,
    Receipt,
    Sparkles,
    ArrowLeftRight,
    Tag,
} from 'lucide-react';
import type { ProductPageSettings } from '../-types/product-page-types';

interface ProductPageSettingsCardProps {
    settings: ProductPageSettings;
    onChange: (updated: ProductPageSettings) => void;
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            checked ? 'bg-primary-500' : 'bg-neutral-200'
        }`}
    >
        <span
            className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition-transform ${
                checked ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
    </button>
);

// ─── Step preview illustrations ───────────────────────────────────────────────

const CatalogIllustration = () => (
    <div className="w-full space-y-1.5">
        <div className="grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-neutral-100 bg-white p-1.5 shadow-sm">
                    <div className="mb-1 h-6 w-full rounded bg-neutral-100" />
                    <div className="h-1.5 w-3/4 rounded bg-neutral-200" />
                    <div className="mt-1 h-1.5 w-1/2 rounded bg-primary-200" />
                </div>
            ))}
        </div>
        <div className="flex gap-1">
            {['All', 'Level', 'Price'].map((f) => (
                <div key={f} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[8px] text-neutral-400">
                    {f}
                </div>
            ))}
        </div>
    </div>
);

const CartIllustration = () => (
    <div className="w-full space-y-1.5">
        <div className="rounded-md border border-neutral-100 bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded bg-neutral-100" />
                <div className="flex-1 space-y-1">
                    <div className="h-1.5 w-3/4 rounded bg-neutral-200" />
                    <div className="h-1.5 w-1/2 rounded bg-primary-200" />
                </div>
                <div className="h-3 w-3 rounded-full bg-primary-100" />
            </div>
        </div>
        <div className="rounded-md border border-neutral-100 bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded bg-neutral-100" />
                <div className="flex-1 space-y-1">
                    <div className="h-1.5 w-2/3 rounded bg-neutral-200" />
                    <div className="h-1.5 w-1/3 rounded bg-primary-200" />
                </div>
                <div className="h-3 w-3 rounded-full bg-primary-400" />
            </div>
        </div>
        <div className="h-5 w-full rounded-md bg-primary-500" />
    </div>
);

const PaymentIllustration = () => (
    <div className="w-full space-y-1.5">
        <div className="rounded-md border border-neutral-100 bg-white p-2 shadow-sm">
            <div className="mb-1 h-1.5 w-1/3 rounded bg-neutral-200" />
            <div className="h-4 rounded bg-neutral-100" />
        </div>
        <div className="grid grid-cols-2 gap-1">
            <div className="rounded-md border border-neutral-100 bg-white p-2 shadow-sm">
                <div className="mb-1 h-1.5 w-2/3 rounded bg-neutral-200" />
                <div className="h-3 rounded bg-neutral-100" />
            </div>
            <div className="rounded-md border border-neutral-100 bg-white p-2 shadow-sm">
                <div className="mb-1 h-1.5 w-1/2 rounded bg-neutral-200" />
                <div className="h-3 rounded bg-neutral-100" />
            </div>
        </div>
        <div className="h-5 w-full rounded-md bg-primary-500" />
    </div>
);

const STEPS = [
    {
        id: 'CATALOG' as const,
        label: 'Catalog',
        icon: BookOpen,
        description: 'Browse & select courses',
        illustration: CatalogIllustration,
        color: 'blue',
    },
    {
        id: 'CART' as const,
        label: 'Cart',
        icon: ShoppingCart,
        description: 'Review selected courses',
        illustration: CartIllustration,
        color: 'violet',
    },
    {
        id: 'PAYMENT' as const,
        label: 'Payment',
        icon: CreditCard,
        description: 'Complete payment',
        illustration: PaymentIllustration,
        color: 'emerald',
    },
] as const;

// ─── Settings card ────────────────────────────────────────────────────────────

export const ProductPageSettingsCard = ({ settings, onChange }: ProductPageSettingsCardProps) => {
    const update = (patch: Partial<ProductPageSettings>) => onChange({ ...settings, ...patch });
    const selectedStepIndex = STEPS.findIndex((s) => s.id === settings.defaultStep);

    return (
        <div className="space-y-5">

            {/* ── Default Landing Step ──────────────────────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-neutral-100 bg-neutral-50/60 px-6 py-4">
                    <h3 className="text-sm font-semibold text-neutral-800">Default Landing Step</h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                        Choose which step learners land on when they open the page link.
                    </p>
                </div>

                {/* Step flow indicator */}
                <div className="px-6 pt-5 pb-3">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-4">
                        <span className={selectedStepIndex >= 0 ? 'text-primary-500' : ''}>Catalog</span>
                        <ChevronRight className="size-3 text-neutral-300" />
                        <span className={selectedStepIndex >= 1 ? 'text-primary-500' : ''}>Cart</span>
                        <ChevronRight className="size-3 text-neutral-300" />
                        <span className={selectedStepIndex >= 2 ? 'text-primary-500' : ''}>Payment</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {STEPS.map((step, idx) => {
                            const isSelected = settings.defaultStep === step.id;
                            const Icon = step.icon;
                            const Illustration = step.illustration;
                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => update({ defaultStep: step.id })}
                                    className={`group relative flex flex-col rounded-xl border-2 p-3 text-left transition-all ${
                                        isSelected
                                            ? 'border-primary-500 bg-primary-50 shadow-md shadow-primary-100'
                                            : 'border-neutral-200 bg-white hover:border-primary-200 hover:bg-primary-50/30'
                                    }`}
                                >
                                    {/* Selected check */}
                                    {isSelected && (
                                        <div className="absolute right-2.5 top-2.5">
                                            <CheckCircle2 className="size-4 text-primary-500" />
                                        </div>
                                    )}

                                    {/* Step number badge */}
                                    <div className={`mb-2.5 flex items-center gap-1.5`}>
                                        <div className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                            isSelected ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-500'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Icon className={`size-3.5 ${isSelected ? 'text-primary-500' : 'text-neutral-400'}`} />
                                            <span className={`text-xs font-semibold ${isSelected ? 'text-primary-700' : 'text-neutral-600'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Mini illustration */}
                                    <div className={`mb-2.5 rounded-lg p-2 ${isSelected ? 'bg-white/80' : 'bg-neutral-50'}`}>
                                        <Illustration />
                                    </div>

                                    <p className={`text-[10px] leading-snug ${isSelected ? 'text-primary-600' : 'text-neutral-400'}`}>
                                        {step.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Flow label */}
                    <div className="mt-3 flex items-center gap-1 rounded-lg bg-neutral-50 px-3 py-2">
                        <span className="text-[10px] text-neutral-400">Learner flow:</span>
                        {STEPS.map((step, idx) => (
                            <span key={step.id} className="flex items-center gap-1">
                                <span className={`text-[10px] font-medium ${step.id === settings.defaultStep ? 'text-primary-600 underline underline-offset-2' : 'text-neutral-500'}`}>
                                    {step.label}
                                </span>
                                {idx < STEPS.length - 1 && <ChevronRight className="size-3 text-neutral-300" />}
                            </span>
                        ))}
                        <span className="ml-1 text-[10px] text-neutral-400">· starts at <span className="font-semibold text-primary-600">{STEPS.find(s => s.id === settings.defaultStep)?.label}</span></span>
                    </div>
                </div>
            </div>

            {/* ── Toggle settings ───────────────────────────────────────────── */}
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">
                {[
                    {
                        icon: ShoppingCart,
                        color: 'text-primary-500 bg-primary-50',
                        label: 'Course Deselection',
                        description: 'Learners can remove pre-selected courses',
                        checked: settings.allowCourseDeselection,
                        onChange: () => update({ allowCourseDeselection: !settings.allowCourseDeselection }),
                    },
                    {
                        icon: ArrowLeftRight,
                        color: 'text-rose-500 bg-rose-50',
                        label: 'Disable Back Navigation',
                        description: 'Hide back button on cart, form & payment',
                        checked: !!settings.disableBackNavigation,
                        onChange: () => update({ disableBackNavigation: !settings.disableBackNavigation }),
                    },
                    {
                        icon: FileText,
                        color: 'text-amber-500 bg-amber-50',
                        label: 'Terms & Conditions',
                        description: 'Require T&C acceptance on registration',
                        checked: settings.tnc.enabled,
                        onChange: () => update({ tnc: { ...settings.tnc, enabled: !settings.tnc.enabled } }),
                    },
                    {
                        icon: Sparkles,
                        color: 'text-violet-500 bg-violet-50',
                        label: 'Suggested Courses',
                        description: 'Show "people also buy" upsell in the cart',
                        checked: settings.suggestedCourses.enabled,
                        onChange: () => update({ suggestedCourses: { ...settings.suggestedCourses, enabled: !settings.suggestedCourses.enabled } }),
                    },
                    {
                        icon: Tag,
                        color: 'text-orange-500 bg-orange-50',
                        label: 'Coupon Code',
                        description: 'Accept discount codes at checkout',
                        checked: settings.coupon?.enabled ?? false,
                        onChange: () => update({ coupon: { enabled: !(settings.coupon?.enabled ?? false) } }),
                    },
                    {
                        icon: Receipt,
                        color: 'text-emerald-500 bg-emerald-50',
                        label: 'Invoice / Receipt',
                        description: 'Send a receipt after successful payment',
                        checked: settings.invoice.enabled,
                        onChange: () => update({ invoice: { ...settings.invoice, enabled: !settings.invoice.enabled } }),
                    },
                ].map(({ icon: Icon, color, label, description, checked, onChange }) => (
                    <div key={label} className="flex items-center gap-4 px-5 py-4">
                        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${checked ? color : 'bg-neutral-100 text-neutral-400'}`}>
                            <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-neutral-800">{label}</p>
                            <p className="text-xs text-neutral-400">{description}</p>
                        </div>
                        <Toggle checked={checked} onChange={onChange} />
                    </div>
                ))}

                {/* Invoice delivery channels */}
                {settings.invoice.enabled && (
                    <div className="bg-neutral-50/60 px-5 py-3 pl-[3.75rem]">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Channels</p>
                        <div className="flex gap-2">
                            {([
                                { id: 'EMAIL' as const, label: 'Email', icon: Mail },
                                { id: 'WHATSAPP' as const, label: 'WhatsApp', icon: MessageCircle },
                            ]).map(({ id, label, icon: Icon }) => {
                                const isChecked = settings.invoice.channels.includes(id);
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => {
                                            const channels = isChecked
                                                ? settings.invoice.channels.filter((c) => c !== id)
                                                : [...settings.invoice.channels, id];
                                            update({ invoice: { ...settings.invoice, channels } });
                                        }}
                                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                                            isChecked
                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                                : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                                        }`}
                                    >
                                        <Icon className={`size-3.5 ${isChecked ? 'text-emerald-500' : 'text-neutral-400'}`} />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* T&C expanded config */}
            {settings.tnc.enabled && (
                <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm space-y-3">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">T&C Content</p>
                    <textarea
                        rows={3}
                        placeholder="<p>By enrolling you agree to our <a href='...'>terms</a>.</p>"
                        value={settings.tnc.content}
                        onChange={(e) => update({ tnc: { ...settings.tnc, content: e.target.value } })}
                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                    />
                    <Input
                        placeholder="Or paste an external URL — https://yoursite.com/terms"
                        value={settings.tnc.externalUrl}
                        onChange={(e) => update({ tnc: { ...settings.tnc, externalUrl: e.target.value } })}
                        className="text-xs border-neutral-200 focus:border-amber-400 focus:ring-amber-300"
                    />
                </div>
            )}

            {/* Suggested Courses expanded config */}
            {settings.suggestedCourses.enabled && (
                <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm space-y-3">
                    <div>
                        <p className="mb-2 text-xs font-semibold text-violet-700 uppercase tracking-wide">Section Heading</p>
                        <Input
                            placeholder="People also buy"
                            value={settings.suggestedCourses.heading}
                            onChange={(e) => update({ suggestedCourses: { ...settings.suggestedCourses, heading: e.target.value } })}
                            className="border-neutral-200 bg-neutral-50 focus:border-violet-400 focus:ring-violet-300"
                        />
                    </div>
                    <div>
                        <p className="mb-2 text-xs font-semibold text-violet-700 uppercase tracking-wide">Show On Step</p>
                        <div className="flex gap-2">
                            {(['CART', 'FORM', 'BOTH'] as const).map((val) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => update({ suggestedCourses: { ...settings.suggestedCourses, showOn: val } })}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                                        (settings.suggestedCourses.showOn ?? 'BOTH') === val
                                            ? 'border-violet-300 bg-violet-50 text-violet-700'
                                            : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                                    }`}
                                >
                                    {val === 'CART' ? 'Cart' : val === 'FORM' ? 'Details' : 'Both'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
