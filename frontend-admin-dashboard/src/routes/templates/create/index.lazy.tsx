import { createLazyFileRoute } from '@tanstack/react-router';
import { TemplateEditorEmail } from '@/components/templates/email/TemplateEditorEmail';
import { Route as CreateTemplateRoute } from '.';

export const Route = createLazyFileRoute('/templates/create/')({
    component: TemplateCreatePage,
});

function TemplateCreatePage() {
    const { type } = CreateTemplateRoute.useSearch();
    return <TemplateEditorEmail templateId={null} initialType={type} />;
}
