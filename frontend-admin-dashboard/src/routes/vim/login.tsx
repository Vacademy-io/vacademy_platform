import { createFileRoute, Link } from '@tanstack/react-router';
import { Sparkles, ArrowRight } from 'lucide-react';

function VimLoginPlaceholder() {
    return (
        <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAFAF7] px-6">
            <div className="w-full max-w-md space-y-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
                    <Sparkles className="size-5 text-primary-500" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                        Sign in to Vimotion
                    </h1>
                    <p className="text-sm text-neutral-500">
                        Login is on the way. For now, head to onboarding to create an account.
                    </p>
                </div>
                <Link
                    to="/vim/onboarding"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800"
                >
                    Get started
                    <ArrowRight className="size-4" />
                </Link>
            </div>
        </div>
    );
}

export const Route = createFileRoute('/vim/login')({
    component: VimLoginPlaceholder,
});
