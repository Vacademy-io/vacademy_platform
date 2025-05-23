import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
// import { EmptyDashboard } from "@/components/common/students/empty-dashboard/empty-dashboard";
import { StudentsListSection } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/students-list-section';
import { Helmet } from 'react-helmet';

interface StudentListSearchParams {
    batch?: string;
    package_session_id?: string;
}
export const Route = createFileRoute('/manage-students/students-list/')({
    component: StudentsList,
    validateSearch: (search): StudentListSearchParams => ({
        batch: search.batch as string | undefined,
        package_session_id: search.package_session_id as string | undefined,
    }),
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
