import { createFileRoute } from '@tanstack/react-router';

interface PackageManagementSearchParams {
    sessionId?: string;
    levelId?: string;
    packageId?: string;
    search?: string;
    status?: string | string[];
    sortBy?: string;
    sortDirection?: string;
    page?: number;
}

export const Route = createFileRoute('/admin-package-management/')({
    validateSearch: (search): PackageManagementSearchParams => ({
        sessionId: search.sessionId as string | undefined,
        levelId: search.levelId as string | undefined,
        packageId: search.packageId as string | undefined,
        search: search.search as string | undefined,
        status: search.status as string | string[] | undefined,
        sortBy: search.sortBy as string | undefined,
        sortDirection: search.sortDirection as string | undefined,
        page: search.page as number | undefined,
    }),
});
