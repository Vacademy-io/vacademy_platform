import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';

const SlidesEditorComponent = lazy(() => import('@/components/common/slides/SlideEditorComponent'));

interface AddPresentParams {
    title: string;
    description: string;
    id: string;
    isEdit: boolean;
}

export const Route = createFileRoute('/study-library/present/add/')({
    component: RouteComponent,
    validateSearch: (search: Record<string, unknown>): AddPresentParams => {
        return {
            title: search.title as string,
            description: search.description as string,
            id: search.id as string,
            isEdit: search.isEdit as boolean,
        };
    },
});

function RouteComponent() {
    const { title = '', description = '', id, isEdit } = Route.useSearch();

    return (
        <Suspense
            fallback={
                <div className="flex size-full items-center justify-center">
                    <DashboardLoader />
                </div>
            }
        >
            <SlidesEditorComponent
                metaData={{ title, description }}
                presentationId={id}
                isEdit={isEdit}
            />
        </Suspense>
    );
}
