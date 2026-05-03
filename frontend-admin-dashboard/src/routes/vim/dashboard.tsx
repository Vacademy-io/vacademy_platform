import { createFileRoute } from '@tanstack/react-router';

function VimDashboardPlaceholder() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="max-w-md space-y-3 text-center">
                <h1 className="text-2xl font-semibold">Welcome to Vimotion</h1>
                <p className="text-sm text-muted-foreground">
                    Your studio is ready. The dashboard for AI content creation is coming next —
                    this page is the post-signup landing for now.
                </p>
            </div>
        </div>
    );
}

export const Route = createFileRoute('/vim/dashboard')({
    component: VimDashboardPlaceholder,
});
