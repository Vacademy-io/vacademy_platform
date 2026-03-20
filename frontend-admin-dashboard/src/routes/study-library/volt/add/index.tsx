import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';

const SlidesEditorComponent = lazy(() => import('@/components/common/slides/SlideEditorComponent'));

interface AddPresentParams {
    title: string;
    description: string;
    id: string;
}

export const Route = createFileRoute('/study-library/volt/add/')({
    component: RouteComponent,
    validateSearch: (search: Record<string, unknown>): AddPresentParams => {
        const validatedParams = {
            title: (search.title as string) || '',
            description: (search.description as string) || '',
            id: (search.id as string) || '',
        };
        return validatedParams;
    },
});

function RouteComponent() {
    const { title = '', description = '', id } = Route.useSearch();

    const isEdit = !!id;

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
