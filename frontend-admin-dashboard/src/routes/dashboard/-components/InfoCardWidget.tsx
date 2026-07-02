import { Card } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { Info, Warning, WarningOctagon, ArrowRight } from '@phosphor-icons/react';
import type { DashboardWidget, InfoSeverity } from '@/services/institute-widgets';

const SEVERITY_META: Record<
    InfoSeverity,
    { wrap: string; iconWrap: string; Icon: typeof Info }
> = {
    INFO: {
        wrap: 'border-info-200 bg-info-50',
        iconWrap: 'bg-info-100 text-info-600',
        Icon: Info,
    },
    WARNING: {
        wrap: 'border-warning-200 bg-warning-50',
        iconWrap: 'bg-warning-100 text-warning-600',
        Icon: Warning,
    },
    CRITICAL: {
        wrap: 'border-danger-200 bg-danger-50',
        iconWrap: 'bg-danger-100 text-danger-600',
        Icon: WarningOctagon,
    },
};

export default function InfoCardWidget({ widget }: { widget: DashboardWidget }) {
    const severity: InfoSeverity = widget.payload?.severity ?? 'INFO';
    const meta = SEVERITY_META[severity] ?? SEVERITY_META.INFO;
    const Icon = meta.Icon;
    const { body, imageUrl, ctaLabel, ctaUrl } = widget.payload ?? {};

    return (
        <Card className={`flex w-full gap-3 border p-4 shadow-sm ${meta.wrap}`}>
            <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.iconWrap}`}
            >
                <Icon size={18} weight="duotone" />
            </span>
            <div className="flex w-full flex-col gap-2">
                <h3 className="text-subtitle font-semibold text-neutral-700">{widget.title}</h3>
                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt=""
                        className="max-h-40 w-full rounded-md object-cover"
                    />
                )}
                {body && (
                    <div
                        className="text-body text-neutral-600 [&_a]:text-primary-600 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: body }}
                    />
                )}
                {ctaLabel && ctaUrl && (
                    <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="mt-1">
                        <MyButton buttonType="secondary" scale="small">
                            <span className="flex items-center gap-1">
                                {ctaLabel}
                                <ArrowRight size={12} weight="bold" />
                            </span>
                        </MyButton>
                    </a>
                )}
            </div>
        </Card>
    );
}
