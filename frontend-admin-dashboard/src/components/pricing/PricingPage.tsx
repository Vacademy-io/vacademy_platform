'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CheckCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pricingPlans, currencies } from '@/config/pricing';
import type { CurrencyCode, BillingCycle } from '@/types/pricing';

export function PricingPage() {
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [currency, setCurrency] = useState<CurrencyCode>('USD');

    const selectedCurrency = currencies.find((c) => c.code === currency);

    return (
        <div className="py-24 sm:py-32">
            <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-base font-semibold leading-7 text-orange-600">Pricing</h2>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                        The right price for you, whoever you are
                    </p>
                </div>
                <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-slate-600">
                    Choose the plan that best fits your needs. All plans include access to our
                    powerful AI tools.
                </p>

                {/* Controls */}
                <div className="mt-16 flex items-center justify-center gap-8">
                    <div className="flex items-center space-x-2">
                        <Label
                            htmlFor="billing-cycle"
                            className={cn(
                                billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'
                            )}
                        >
                            Monthly
                        </Label>
                        <Switch
                            id="billing-cycle"
                            checked={billingCycle === 'yearly'}
                            onCheckedChange={(checked) =>
                                setBillingCycle(checked ? 'yearly' : 'monthly')
                            }
                        />
                        <Label
                            htmlFor="billing-cycle"
                            className={cn(
                                billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-500'
                            )}
                        >
                            Yearly
                            <span className="ml-2 text-xs font-medium text-green-600">
                                (Save up to 25%)
                            </span>
                        </Label>
                    </div>
                    <Select
                        value={currency}
                        onValueChange={(value: CurrencyCode) => setCurrency(value)}
                    >
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                            {currencies.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                    {c.code} ({c.symbol})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Pricing Cards */}
                <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:max-w-7xl lg:grid-cols-3">
                    {pricingPlans.map((plan, index) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={cn(
                                'rounded-3xl p-8 ring-1 xl:p-10',
                                plan.isMostPopular
                                    ? 'bg-orange-50 ring-2 ring-orange-500'
                                    : 'ring-slate-200'
                            )}
                        >
                            <h3 className="text-lg font-semibold leading-8 text-slate-900">
                                {plan.name}
                            </h3>
                            <p className="mt-4 text-sm leading-6 text-slate-600">
                                {plan.description}
                            </p>
                            <p className="mt-6 flex items-baseline gap-x-1">
                                <span className="text-4xl font-bold tracking-tight text-slate-900">
                                    {selectedCurrency?.symbol}
                                    {plan.prices[billingCycle][currency]}
                                </span>
                                <span className="text-sm font-semibold leading-6 text-slate-600">
                                    {plan.prices[billingCycle][currency] > 0 ? '/ month' : ''}
                                </span>
                            </p>
                            {plan.name !== 'Free' && billingCycle === 'yearly' && (
                                <p className="mt-1 text-sm text-slate-500">
                                    Billed as {selectedCurrency?.symbol}
                                    {plan.prices[billingCycle][currency] * 12} per year
                                </p>
                            )}
                            <Button
                                className={cn(
                                    'mt-6 w-full',
                                    plan.isMostPopular
                                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                                        : 'bg-slate-800 text-white hover:bg-slate-700'
                                )}
                            >
                                {plan.buttonText}
                            </Button>
                            <ul
                                role="list"
                                className="mt-8 space-y-3 text-sm leading-6 text-slate-600 xl:mt-10"
                            >
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex gap-x-3">
                                        <CheckCircle
                                            className="h-6 w-5 flex-none text-green-500"
                                            aria-hidden="true"
                                        />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
