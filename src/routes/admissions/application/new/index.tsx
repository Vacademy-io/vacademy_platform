import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { RegistrationFormPage } from '../-components/RegistrationFormPage';

export const Route = createFileRoute('/admissions/application/new/')({
    component: RegistrationRoute,
});

function RegistrationRoute() {
    return (
        <LayoutContainer>
            <RegistrationFormPage />
        </LayoutContainer>
    );
}
