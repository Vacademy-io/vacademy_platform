import { createFileRoute, redirect } from '@tanstack/react-router';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { isNullOrEmptyOrUndefined } from '@/lib/utils';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { getSelectedInstitute } from '@/lib/auth/instituteUtils';

export const Route = createFileRoute('/login/')({
    loader: ({ location }) => {
        // Check if we should show institute selection from search params
        if (location.search && typeof location.search === 'string' && location.search.includes('showInstituteSelection=true')) {
            return;
        }

        // Check if location.search is an object with the parameter
        if (location.search && typeof location.search === 'object' && 'showInstituteSelection' in location.search) {
            return;
        }

        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        if (!isNullOrEmptyOrUndefined(accessToken)) {
            const instituteId = getSelectedInstitute();
            if (hasFacultyAssignedPermission(instituteId || '')) {
                throw redirect({ to: '/study-library/courses' });
            }
            throw redirect({ to: '/dashboard' });
        }

        return;
    },
});

