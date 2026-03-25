import { createLazyFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { LoginForm } from '@/routes/login/-components/LoginPages/sections/login-form';
import { resolveFeatureLanding } from '@/features/feature-landings/registry';

export const Route = createLazyFileRoute('/login/')({
    component: RouteComponent,
});

function RouteComponent() {
    const featureLanding = resolveFeatureLanding();
    const searchParams = new URLSearchParams(window.location.search);
    const forceDefault =
        searchParams.has('forceDefaultLogin') ||
        searchParams.has('showInstituteSelection') ||
        searchParams.has('accessToken') ||
        searchParams.has('error');

    if (featureLanding && !forceDefault) {
        const LandingPage = lazy(featureLanding.load);
        return (
            <Suspense
                fallback={
                    <div className="flex h-screen w-full items-center justify-center">
                        <div className="size-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    </div>
                }
            >
                <LandingPage />
            </Suspense>
        );
    }

    return <LoginForm />;
}
