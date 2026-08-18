import { Money } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { resolveGatewayBranding } from '@/routes/settings/-constants/payment-gateway-branding';
import { resolveGatewayLogo } from '@/routes/settings/-constants/payment-gateway-logos';

/**
 * Payment-gateway brandmark shown wherever a payment method appears. Gateways we have an official
 * logo for (`payment-gateway-logos`) render that logo on a neutral chip; anything else falls back to
 * the letter badge from the shared branding source of truth that lives with Institute Settings →
 * Payment Gateways (`payment-gateway-branding`), so what shows here matches what the institute
 * configures there. `vendor` is the free-form `payment_log.vendor` string.
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
    const Logo = resolveGatewayLogo(vendor);
    const isOffline = meta.mark === '';
    const box = size === 'sm' ? 'size-6 text-caption' : 'size-7 text-body';
    const glyphSize = size === 'sm' ? 13 : 15;

    return (
        <span className={cn('flex min-w-0 items-center gap-2', className)}>
            <span
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-md border font-semibold',
                    box,
                    // A real logo carries its own brand colour, so it sits on a neutral chip.
                    Logo ? 'border-neutral-200 bg-white' : meta.badgeClass
                )}
                title={meta.label}
                aria-label={meta.label}
            >
                {Logo ? (
                    <Logo size={glyphSize} />
                ) : isOffline ? (
                    <Money size={glyphSize} weight="duotone" />
                ) : (
                    meta.mark
                )}
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
