import { createLazyFileRoute } from '@tanstack/react-router';
import { TemplateEditorEmail } from '@/components/templates/email/TemplateEditorEmail';

export const Route = createLazyFileRoute('/templates/create/')({
    component: TemplateCreatePage,
});

function TemplateCreatePage() {
    return <TemplateEditorEmail templateId={null} />;
}
