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
            try {
                const result = await handleLoginOAuthCallback();

            if (result.success) {
                // Check if we need to redirect to institute selection
                const urlParams = new URLSearchParams(window.location.search);
                const error = urlParams.get('error');

                if (error === 'student_access_denied') {
                    window.location.href = '/login?error=student_access_denied';
                    return;
                }

                // Check if result indicates institute selection is needed
                if (result.shouldShowInstituteSelection) {
                    // Use window.location.href to ensure navigation happens
                    window.location.href = '/login?showInstituteSelection=true';
                    return;
                }

                // Use the redirect URL from the result or default to dashboard
                const redirectUrl = result.redirectUrl || '/dashboard';
                navigate({ to: redirectUrl });
                return;
            } else {
                toast.error('OAuth failed. Redirecting to login...');
                navigate({ to: '/login' });
            }
            } catch (error) {
                toast.error('OAuth processing failed. Redirecting to login...');
                navigate({ to: '/login' });
            }
        };

        processOAuth();
    }, [navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <p className="text-lg font-medium">Handling OAuth redirect...</p>
        </div>
    );
}
