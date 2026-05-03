import { createFileRoute, Link } from '@tanstack/react-router';

function VimLoginPlaceholder() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="max-w-md space-y-4 text-center">
                <h1 className="text-2xl font-semibold">Vimotion login</h1>
                <p className="text-sm text-muted-foreground">
                    Login UI is on the way. For now, head to onboarding to create an account.
                </p>
                <Link
                    to="/vim/onboarding"
                    className="inline-flex items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white"
                >
                    Go to onboarding
                </Link>
            </div>
        </div>
    );
}

export const Route = createFileRoute('/vim/login')({
    component: VimLoginPlaceholder,
});
