import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { AdmissionStudentsPage } from '../-components/admission-students-page';

export const Route = createLazyFileRoute('/erp/admission/enrolled-batch/')({
    component: () => (
        <LayoutContainer>
            <AdmissionStudentsPage side="enrolled" />
        </LayoutContainer>
    ),
});
