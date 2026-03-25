import { createFileRoute } from '@tanstack/react-router';

interface StudentListSearchParams {
    session?: string;
    batch?: string | string[];
    package_session_id?: string;
    role?: string | string[];
    gender?: string | string[];
    status?: string | string[];
    sessionExpiry?: number | number[];
    name?: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/manage-students/students-list/')({
    validateSearch: (search): StudentListSearchParams => ({
        session: search.session as string | undefined,
        batch: search.batch as string | string[] | undefined,
        package_session_id: search.package_session_id as string | undefined,
        role: search.role as string | string[] | undefined,
        gender: search.gender as string | string[] | undefined,
        status: search.status as string | string[] | undefined,
        sessionExpiry: search.sessionExpiry as number | number[] | undefined,
        name: search.name as string | undefined,
    }),
});
