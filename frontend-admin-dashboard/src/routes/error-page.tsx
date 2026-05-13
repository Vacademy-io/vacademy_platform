import { createFileRoute, Link } from '@tanstack/react-router';
import { GenericErrorPage } from '@/components/core/GenericErrorPage';
import { RuntimeErrorPage } from '@/components/core/RuntimeErrorPage';
import { NetworkErrorPage } from '@/components/core/NetworkErrorPage';
import RootNotFoundComponent from '@/components/core/default-not-found';

type ErrorType = 'generic' | 'runtime' | 'network' | 'not-found';

const VARIANTS: { value: ErrorType; label: string }[] = [
    { value: 'generic', label: 'Generic' },
    { value: 'runtime', label: 'Runtime' },
    { value: 'network', label: 'Network' },
    { value: 'not-found', label: '404' },
];

export const Route = createFileRoute('/error-page')({
    component: ErrorPageTestRoute,
    validateSearch: (search: Record<string, unknown>): { type: ErrorType } => {
        const raw = String(search.type ?? 'generic');
        const type = (VARIANTS.find((v) => v.value === raw)?.value ?? 'generic') as ErrorType;
        return { type };
    },
});

function ErrorPageTestRoute() {
    const { type } = Route.useSearch();
    const fakeError = new Error(`Test error from /error-page?type=${type}`);

    return (
        <div className="relative">
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-sm flex gap-1 px-2 py-1 text-xs">
                <span className="px-2 py-1 text-gray-500">Test variant:</span>
                {VARIANTS.map((v) => (
                    <Link
                        key={v.value}
                        to="/error-page"
                        search={{ type: v.value }}
                        className={`px-3 py-1 rounded-full transition-colors ${
                            type === v.value
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        {v.label}
                    </Link>
                ))}
            </div>

            {type === 'generic' && <GenericErrorPage error={fakeError} />}
            {type === 'runtime' && <RuntimeErrorPage error={fakeError} />}
            {type === 'network' && <NetworkErrorPage />}
            {type === 'not-found' && <RootNotFoundComponent />}
        </div>
    );
}
