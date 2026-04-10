// CallInitStudyLibraryIfNull.tsx
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getInstituteId } from '@/constants/helper';
import { useModulesWithChaptersQuery } from '@/routes/study-library/courses/-services/getModulesWithChapters';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import * as Sentry from '@sentry/react';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export const ModulesWithChaptersProvider = ({ children }: { children: React.ReactNode }) => {
    const { getPackageSessionId, instituteDetails } = useInstituteDetailsStore();
    const router = useRouter();
    const { courseId, levelId, subjectId, sessionId } = router.state.location.search;
    const newPackageSessionId = getPackageSessionId({
        courseId: courseId || '',
        sessionId: sessionId || '',
        levelId: levelId || '',
    });

    const myPackageSessionId = newPackageSessionId;

    // Log to Sentry if module-with-chapter API won't trigger due to missing params
    const sentryLoggedRef = useRef(false);
    useEffect(() => {
        if (sentryLoggedRef.current) return;
        if (!subjectId || !myPackageSessionId) {
            sentryLoggedRef.current = true;
            const tokenData = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
            Sentry.captureMessage('modules-with-chapters API not triggered: missing params', {
                level: 'warning',
                extra: {
                    packageId: courseId || null,
                    psId: myPackageSessionId || null,
                    instituteName: instituteDetails?.institute_name || null,
                    instituteId: getInstituteId() || null,
                    username: tokenData?.username || null,
                    userId: tokenData?.sub || null,
                    missingSubjectId: !subjectId,
                    missingPackageSessionId: !myPackageSessionId,
                },
            });
        }
    }, [subjectId, myPackageSessionId]);

    // Always call the query hook, but control its execution with enabled
    const { isLoading, refetch } = useModulesWithChaptersQuery(
        subjectId || '',
        myPackageSessionId || ''
    );

    useEffect(() => {
        if (subjectId && myPackageSessionId) {
            refetch(); // ← Refetch on subjectId change, even if it's cached
        }
    }, [subjectId, myPackageSessionId]);

    return <div>{isLoading ? <DashboardLoader /> : children}</div>;
};
