import { Money } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { resolveGatewayBranding } from '@/routes/settings/-constants/payment-gateway-branding';

/**
 * Payment-gateway brandmark shown wherever a payment method appears. The branding (label, mark,
 * colour) comes from the shared source of truth that lives with Institute Settings → Payment
 * Gateways (`payment-gateway-branding`), so what shows here matches what the institute configures
 * there. `vendor` is the free-form `payment_log.vendor` string.
 */

interface GatewayBadgeProps {
    vendor?: string | null;
    /** Render the gateway name beside the mark. */
    showLabel?: boolean;
    /** Secondary line under the label (e.g. the raw method string). */
    subLabel?: string;
    size?: 'sm' | 'md';
    className?: string;
}

export function GatewayBadge({
    vendor,
    showLabel = false,
    subLabel,
    size = 'md',
    className,
}: GatewayBadgeProps) {
    const meta = resolveGatewayBranding(vendor);
    const isOffline = meta.mark === '';
    const box = size === 'sm' ? 'size-6 text-caption' : 'size-7 text-body';

    return (
        <span className={cn('flex min-w-0 items-center gap-2', className)}>
            <span
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-md border font-semibold',
                    box,
                    meta.badgeClass
                )}
                title={meta.label}
                aria-label={meta.label}
            >
                {isOffline ? <Money size={size === 'sm' ? 13 : 15} weight="duotone" /> : meta.mark}
            </span>
            {showLabel && (
                <span className="min-w-0">
                    <span className="block truncate text-body font-medium text-neutral-700">
                        {meta.label}
                    </span>
                    {subLabel && (
                        <span className="block truncate text-caption text-neutral-500">
                            {subLabel}
                        </span>
                    )}
                </span>
            )}
        </span>
    );
}
