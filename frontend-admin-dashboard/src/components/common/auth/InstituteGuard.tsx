import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useInstitute } from '@/hooks/auth/useInstitute';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { shouldBlockStudentLogin, getInstituteSelectionResult } from '@/lib/auth/instituteUtils';
import { removeCookiesAndLogout } from '@/lib/auth/sessionUtility';
import { InstituteSelection } from '@/routes/login/-components/LoginPages/sections/InstituteSelection';
import { toast } from 'sonner';

interface InstituteGuardProps {
    children: React.ReactNode;
}

export function InstituteGuard({ children }: InstituteGuardProps) {
    const { currentInstituteId, isLoading } = useInstitute();
    const navigate = useNavigate();
    const [showInstituteSelection, setShowInstituteSelection] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAccess = async () => {
            const accessToken = getTokenFromCookie(TokenKey.accessToken);

            if (!accessToken) {
                navigate({ to: '/login' });
                return;
            }

            // Check if user should be blocked from accessing admin portal (only has STUDENT role)
            if (shouldBlockStudentLogin()) {
                console.log('User only has STUDENT role, blocking access to admin portal');

                // Clear tokens and redirect to login
                removeCookiesAndLogout();

                toast.error('Access Denied', {
                    description: 'Students are not allowed to access the admin portal. Please contact your administrator.',
                    duration: 5000,
                });

                window.location.href = '/login?error=student_access_denied';
                return;
            }

            // Check if user needs to select an institute
            const instituteResult = getInstituteSelectionResult();

            if (instituteResult.shouldShowSelection && !currentInstituteId) {
                console.log('User needs to select an institute');
                setShowInstituteSelection(true);
                setIsChecking(false);
                return;
            }

            // User has access to the dashboard
            setIsChecking(false);
        };

        if (!isLoading) {
            checkAccess();
        }
    }, [isLoading, currentInstituteId, navigate]);

    const handleInstituteSelect = (instituteId: string) => {
        setShowInstituteSelection(false);
        // The useInstitute hook will handle the selection
        window.location.reload();
    };

    if (isLoading || isChecking) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    if (showInstituteSelection) {
        return <InstituteSelection onInstituteSelect={handleInstituteSelect} />;
    }

    return <>{children}</>;
}
