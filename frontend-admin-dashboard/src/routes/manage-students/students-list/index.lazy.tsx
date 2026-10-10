import { createLazyFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { StudentsListSection } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/students-list-section';
import { Helmet } from 'react-helmet';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const Route = createLazyFileRoute('/manage-students/students-list/')({
    component: StudentsList,
});

export function StudentsList() {
    const learnersLabel = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner);

    // The list reads its filters (?batch=, ?status=, …) from the URL once, on
    // mount. Sidebar sub-tabs that open this same page with a different query
    // (all learners vs ?batch=[…]) therefore kept whatever filter loaded first.
    // Remount on every navigation into this page. The list's own filter edits
    // write the URL with a raw history.replaceState (a REPLACE), so they don't.
    const router = useRouter();
    const [navCount, setNavCount] = useState(0);
    useEffect(
        () =>
            router.history.subscribe(({ action, location }) => {
                if (action.type === 'REPLACE') return;
                if (!location.pathname.startsWith('/manage-students/students-list')) return;
                setNavCount((n) => n + 1);
            }),
        [router]
    );

    return (
        <LayoutContainer>
            {/* <EmptyDashboard /> */}
            <Helmet>
                <title>{learnersLabel}</title>
                <meta
                    name="description"
                    content={`This page shows all the ${learnersLabel.toLowerCase()} of the institute.`}
                />
            </Helmet>
            <StudentsListSection key={navCount} />
        </LayoutContainer>
    );
}
