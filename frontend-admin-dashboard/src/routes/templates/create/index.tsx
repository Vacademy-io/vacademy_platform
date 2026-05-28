import { createFileRoute } from '@tanstack/react-router';
import { TemplateEditorEmail } from '@/components/templates/email/TemplateEditorEmail';

export type CreateTemplateType = 'EMAIL' | 'WHATSAPP' | 'INVOICE' | 'INVOICE_EMAIL';

const ALLOWED_TYPES: CreateTemplateType[] = ['EMAIL', 'WHATSAPP', 'INVOICE', 'INVOICE_EMAIL'];

export const Route = createFileRoute('/templates/create/')({
    // Optional `type` preselects the template category in the editor (e.g. opening
    // the editor straight into "Invoice (PDF Layout)" from Invoice Settings).
    validateSearch: (search: Record<string, unknown>): { type?: CreateTemplateType } => {
        const t = search.type as string | undefined;
        return { type: t && ALLOWED_TYPES.includes(t as CreateTemplateType) ? (t as CreateTemplateType) : undefined };
    },
    component: TemplateCreatePage,
});

function TemplateCreatePage() {
    const { type } = Route.useSearch();
    return <TemplateEditorEmail templateId={null} initialType={type} />;
}
