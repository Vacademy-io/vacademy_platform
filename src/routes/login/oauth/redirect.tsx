import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { handleLoginOAuthCallback } from '@/hooks/login/oauth-login';

export const Route = createFileRoute('/login/oauth/redirect')({
    component: OAuthRedirectHandler,
});
function OAuthRedirectHandler() {
    const navigate = useNavigate();

    useEffect(() => {
        const processOAuth = async () => {

            const result = await handleLoginOAuthCallback();
                console.log("OAuthRedirectHandler");
            if (result.success) {
                navigate({ to: '/dashboard' });
                return;
            } else {
                toast.error('OAuth failed. Redirecting to login...');
                navigate({ to: '/login' });
            }
        };

        processOAuth();
    }, [navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p className="text-lg font-medium">Handling OAuth redirect...</p>
        </div>
    );
}
