import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '../-components/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { StudentEnrollment } from './-components/add-student';

export const Route = createFileRoute('/evaluator-ai/students/')({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Learner List</h1>);
    }, []);
    return (
        <main className="flex min-h-screen scroll-mt-10 flex-col">
            <StudentEnrollment />
        </main>
    );
}
