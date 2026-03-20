import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LockKey } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/locked-feature')({
    component: LockedFeaturePage,
    validateSearch: (search: Record<string, unknown>) => ({
        feature: (search.feature as string) || 'Unknown Feature',
    }),
});

function LockedFeaturePage() {
    const { feature } = Route.useSearch();
    const navigate = useNavigate();

    return (
        <div className="flex size-full flex-col items-center justify-center bg-muted/10 p-4">
            <Card className="mx-auto w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center pb-4">
                        <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                            <LockKey size={48} className="text-muted-foreground" weight="duotone" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Feature Locked</CardTitle>
                    <CardDescription className="text-lg">
                        The <strong>{feature}</strong> feature is currently locked for your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-6 text-sm text-muted-foreground">
                        Please contact your administrator to request access to this feature.
                    </p>
                    <Button onClick={() => navigate({ to: '/dashboard' })}>Go to Dashboard</Button>
                </CardContent>
            </Card>
        </div>
    );
}
