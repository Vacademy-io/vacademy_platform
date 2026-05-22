import React, { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Loader2, Plus, Trash2, Edit, Eye, FileText, Mail, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { MessageTemplate } from '@/types/message-template-types';
import {
    getMessageTemplatesByType,
    getMessageTemplate,
    deleteMessageTemplate,
    createMessageTemplate,
} from '@/services/message-template-service';
import { TemplatePreview } from '@/components/templates/shared/TemplatePreview';
import { toast } from 'sonner';

interface InvoiceTemplatesSectionProps {
    /** DB template type: INVOICE = PDF layout, INVOICE_EMAIL = email body. */
    type: 'INVOICE' | 'INVOICE_EMAIL';
}

const TYPE_META: Record<
    InvoiceTemplatesSectionProps['type'],
    { title: string; description: string; icon: typeof FileText }
> = {
    INVOICE: {
        title: 'Invoice PDF Templates',
        description: 'Layout used to render the invoice PDF — branding, line items table and totals.',
        icon: FileText,
    },
    INVOICE_EMAIL: {
        title: 'Invoice Email Templates',
        description: 'Email body sent to the learner with the invoice PDF attached.',
        icon: Mail,
    },
};

const PAGE_SIZE = 5;

export const InvoiceTemplatesSection: React.FC<InvoiceTemplatesSectionProps> = ({ type }) => {
    const navigate = useNavigate();
    const meta = TYPE_META[type];
    const Icon = meta.icon;

    const [allTemplates, setAllTemplates] = useState<MessageTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(0);

    const [showPreview, setShowPreview] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            // Type-filtered endpoint so this list only ever shows `type` templates
            // (the paginated all-templates endpoint ignores the type filter).
            const list = await getMessageTemplatesByType(type);
            setAllTemplates(list);
            setPage(0);
        } catch (error) {
            console.error(`Error loading ${type} templates:`, error);
            toast.error('Failed to load templates. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    const totalElements = allTemplates.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
    const templates = allTemplates.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const handleCreate = () => {
        navigate({ to: '/templates/create', search: { type } });
    };

    // Sparkle: generate a ready-made sample template (MJML + HTML, saved exactly like
    // the easy-email editor does) with all invoice variables pre-placed, then open it.
    const handleGenerateSample = async () => {
        setIsGenerating(true);
        try {
            const { buildSampleInvoiceTemplate } = await import('./sample-invoice-templates');
            const sample = buildSampleInvoiceTemplate(type);
            const created = await createMessageTemplate({
                name: sample.name,
                type,
                subject: sample.subject,
                content: sample.content,
                variables: sample.variables,
                templateType: type,
                mjml: sample.mjml,
                previewText: sample.previewText,
            });
            toast.success('Sample template created — opening editor…');
            navigate({ to: '/templates/edit/$templateId', params: { templateId: created.id } });
        } catch (error) {
            console.error(`Error generating sample ${type} template:`, error);
            toast.error('Failed to generate sample template. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleEdit = (template: MessageTemplate) => {
        navigate({ to: '/templates/edit/$templateId', params: { templateId: template.id } });
    };

    const handlePreview = async (template: MessageTemplate) => {
        try {
            const full = await getMessageTemplate(template.id);
            setPreviewTemplate(full);
        } catch (error) {
            console.error('Error loading template:', error);
            setPreviewTemplate(template);
        }
        setShowPreview(true);
    };

    const handleDelete = async (templateId: string) => {
        setIsDeleting(true);
        try {
            await deleteMessageTemplate(templateId);
            toast.success('Template deleted successfully!');
            setDeleteId(null);
            await loadTemplates();
        } catch (error) {
            console.error('Error deleting template:', error);
            toast.error('Failed to delete template. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const goToPage = (next: number) => {
        if (next >= 0 && next < totalPages) {
            setPage(next);
        }
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Icon className="size-5" />
                            {meta.title}
                        </CardTitle>
                        <CardDescription>{meta.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateSample}
                            disabled={isGenerating}
                            title="Generate a sample template with all invoice variables pre-filled"
                        >
                            {isGenerating ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 size-4 text-amber-500" />
                            )}
                            {isGenerating ? 'Generating…' : 'Generate sample'}
                        </Button>
                        <MyButton buttonType="primary" scale="medium" onClick={handleCreate}>
                            <Plus className="mr-2 size-4" />
                            Create Template
                        </MyButton>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-5 animate-spin" />
                        <span className="ml-2 text-sm">Loading templates…</span>
                    </div>
                ) : templates.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-8 text-center">
                        <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
                        <p className="mb-3 text-sm text-muted-foreground">
                            No {type === 'INVOICE' ? 'invoice PDF' : 'invoice email'} templates yet.
                            The built-in default will be used until you create one.
                        </p>
                        <MyButton buttonType="secondary" scale="medium" onClick={handleCreate}>
                            <Plus className="mr-2 size-4" />
                            Create your first template
                        </MyButton>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border">
                        <Table className="min-w-[480px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs sm:text-sm">Name</TableHead>
                                    <TableHead className="hidden text-xs sm:table-cell sm:text-sm">
                                        Subject
                                    </TableHead>
                                    <TableHead className="hidden text-xs md:table-cell sm:text-sm">
                                        Created
                                    </TableHead>
                                    <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium text-xs sm:text-sm">
                                            {template.name}
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="max-w-xs truncate text-xs sm:text-sm text-muted-foreground">
                                                {template.subject || (
                                                    <span className="italic">No subject</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden text-xs md:table-cell sm:text-sm">
                                            {formatDate(template.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handlePreview(template)}
                                                    className="p-1 sm:p-2"
                                                    title="Preview"
                                                >
                                                    <Eye className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(template)}
                                                    className="p-1 sm:p-2"
                                                    title="Edit"
                                                >
                                                    <Edit className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeleteId(template.id)}
                                                    className="p-1 text-destructive hover:text-destructive sm:p-2"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {!isLoading && totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            {totalElements} template{totalElements === 1 ? '' : 's'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={page === 0}
                                onClick={() => goToPage(page - 1)}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <span className="text-xs">
                                Page {page + 1} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={page >= totalPages - 1}
                                onClick={() => goToPage(page + 1)}
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            {showPreview && previewTemplate && (
                <TemplatePreview
                    template={previewTemplate}
                    isOpen={showPreview}
                    onClose={() => {
                        setShowPreview(false);
                        setPreviewTemplate(null);
                    }}
                />
            )}

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Template</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this template? This action cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteId(null)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteId && handleDelete(deleteId)}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Deleting…
                                </>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

export default InvoiceTemplatesSection;
