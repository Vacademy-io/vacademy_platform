import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { StudentsListSection } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/students-list-section';
import { Helmet } from 'react-helmet';

export const Route = createLazyFileRoute('/manage-students/students-list/')({
    component: StudentsList,
});

export function StudentsList() {
    return (
        <LayoutContainer>
            {/* <EmptyDashboard /> */}
            <Helmet>
                <title>Students</title>
                <meta
                    name="description"
                    content="This page shows all the students of the institute."
                />
            </Helmet>
            <StudentsListSection />
        </LayoutContainer>
    );
}
