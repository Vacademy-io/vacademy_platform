import { createFileRoute } from '@tanstack/react-router';
import { GenericErrorPage } from '@/components/core/GenericErrorPage';
import { RuntimeErrorPage } from '@/components/core/RuntimeErrorPage';
import { NetworkErrorPage } from '@/components/core/NetworkErrorPage';
import { OfflineErrorPage } from '@/components/core/OfflineErrorPage';

type Variant = 'generic' | 'runtime' | 'network' | 'offline';

const VARIANTS: { key: Variant; label: string }[] = [
    { key: 'generic', label: 'Generic' },
    { key: 'runtime', label: 'Runtime' },
    { key: 'network', label: 'Network' },
    { key: 'offline', label: 'Offline' },
];

export const Route = createFileRoute('/error-page')({
    component: ErrorPagePreview,
    validateSearch: (search: Record<string, unknown>): { variant: Variant } => {
        const raw = search.variant as string | undefined;
        const variant = (VARIANTS.find((v) => v.key === raw)?.key ?? 'generic') as Variant;
        return { variant };
    },
});

function ErrorPagePreview() {
    const { variant } = Route.useSearch();
    const navigate = Route.useNavigate();

    const previewError = new Error(
        'Preview error: this is a synthetic error rendered from /error-page for testing.'
    );

    return (
        <div className="relative size-full">
            <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur">
                <div className="flex items-center gap-1">
                    <span className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Preview
                    </span>
                    {VARIANTS.map((v) => (
                        <button
                            key={v.key}
                            onClick={() =>
                                navigate({
                                    search: { variant: v.key },
                                    replace: true,
                                })
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                variant === v.key
                                    ? 'bg-orange-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {variant === 'generic' && <GenericErrorPage error={previewError} />}
            {variant === 'runtime' && <RuntimeErrorPage error={previewError} />}
            {variant === 'network' && <NetworkErrorPage />}
            {variant === 'offline' && <OfflineErrorPage />}
        </div>
    );
}
