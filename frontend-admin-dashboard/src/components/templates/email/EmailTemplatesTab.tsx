import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Trash2, Search, Edit, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageTemplate, CreateTemplateRequest } from '@/types/message-template-types';
import {
    createMessageTemplate,
    getMessageTemplates,
    getMessageTemplate,
    updateMessageTemplate,
    deleteMessageTemplate,
} from '@/services/message-template-service';
import { templateCacheService } from '@/services/template-cache-service';
import { TemplatePreview } from '../shared/TemplatePreview';
import { TEMPLATE_TYPE_CONFIG, STATUS_CONFIG, TEMPLATE_TYPE_KEYWORDS, DATE_FORMAT_OPTIONS } from '../shared/constants';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';

export const EmailTemplatesTab: React.FC = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredTemplates, setFilteredTemplates] = useState<MessageTemplate[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLast, setIsLast] = useState(true);
    const [isFirst, setIsFirst] = useState(true);

    // Load templates with pagination
    const loadTemplates = async (page: number = currentPage, size: number = pageSize) => {
        setIsLoading(true);
        try {
            const response = await getMessageTemplates('EMAIL', page, size);
            setTemplates(response.templates);
            setFilteredTemplates(response.templates);
            setTotalElements(response.total);
            setTotalPages(response.totalPages || 1);
            setIsLast(response.isLast ?? true);
            setIsFirst(response.isFirst ?? true);
            setCurrentPage(response.page);
        } catch (error) {
            console.error('Error loading templates:', error);
            toast.error('Failed to load templates. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Filter templates based on search query (client-side filtering on current page)
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredTemplates(templates);
        } else {
            const filtered = templates.filter((template) =>
                template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (template.content && template.content.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredTemplates(filtered);
        }
    }, [searchQuery, templates]);

    useEffect(() => {
        loadTemplates(0, pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reload when page or page size changes
    useEffect(() => {
        loadTemplates(currentPage, pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageSize]);

    const handleCreateTemplate = () => {
        navigate({ to: '/templates/create' });
    };

    const handleEditTemplate = (template: MessageTemplate) => {
        navigate({ to: '/templates/edit/$templateId', params: { templateId: template.id } });
    };

    const handlePreviewTemplate = async (template: MessageTemplate) => {
        try {
            // Fetch full template content from API
            const fullTemplate = await getMessageTemplate(template.id);
            setPreviewTemplate(fullTemplate);
            setShowPreview(true);
        } catch (error) {
            console.error('Error loading template:', error);
            toast.error('Failed to load template content. Showing cached version.');
            // Fallback to cached template if API fails
            setPreviewTemplate(template);
            setShowPreview(true);
        }
    };


    const handleDeleteTemplate = async (templateId: string) => {
        setIsDeleting(true);
        try {
            await deleteMessageTemplate(templateId);
            templateCacheService.clearCache('EMAIL');
            await loadTemplates(currentPage, pageSize);
            setShowDeleteDialog(false);
            setDeleteTemplateId(null);
            toast.success('Template deleted successfully!');
        } catch (error) {
            console.error('Error deleting template:', error);
            toast.error('Failed to delete template. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(0); // Reset to first page when changing page size
    };

    const confirmDelete = (templateId: string) => {
        setDeleteTemplateId(templateId);
        setShowDeleteDialog(true);
    };

    const getTemplateType = (template: MessageTemplate): keyof typeof TEMPLATE_TYPE_CONFIG => {
        // Use the templateType field if available, otherwise fall back to name-based detection
        if (template.templateType && template.templateType in TEMPLATE_TYPE_CONFIG) {
            return template.templateType as keyof typeof TEMPLATE_TYPE_CONFIG;
        }

        // Fallback to name-based detection for backward compatibility
        const name = template.name.toLowerCase();
        for (const [type, keywords] of Object.entries(TEMPLATE_TYPE_KEYWORDS)) {
            if (keywords.some(keyword => name.includes(keyword))) {
                return type as keyof typeof TEMPLATE_TYPE_CONFIG;
            }
        }
        return 'utility';
    };

    const getStatusColor = (status: string) => {
        return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800';
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', DATE_FORMAT_OPTIONS);
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg sm:text-xl font-semibold">Email Templates</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Create and manage email templates for bulk communications
                    </p>
                </div>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleCreateTemplate}
                    className="w-full sm:w-auto"
                >
                    <Plus className="mr-2 size-4" />
                    Create Template
                </MyButton>
            </div>

            {/* Search */}
            <div className="flex items-center justify-start">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2 top-2.5 size-3 sm:size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 sm:pl-8 text-xs sm:text-sm"
                    />
                </div>
            </div>

            {/* Templates List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin" />
                    <span className="ml-2 text-sm">Loading templates...</span>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8">
                    <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Search className="size-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-base sm:text-lg font-medium mb-2">
                        {searchQuery ? 'No templates found' : 'No email templates'}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                        {searchQuery
                            ? 'Try adjusting your search terms'
                            : 'Get started by creating your first email template'
                        }
                    </p>
                    {!searchQuery && (
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={handleCreateTemplate}
                            className="w-full sm:w-auto"
                        >
                            <Plus className="mr-2 size-4" />
                            Create Template
                        </MyButton>
                    )}
                </div>
            ) : (
                <div className="border rounded-lg overflow-x-auto">
                    <Table className="w-full min-w-[600px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs sm:text-sm">Template Name</TableHead>
                                <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Subject</TableHead>
                                <TableHead className="text-xs sm:text-sm">Type</TableHead>
                                <TableHead className="text-xs sm:text-sm hidden md:table-cell">Status</TableHead>
                                <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Created</TableHead>
                                <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTemplates.map((template) => {
                                const templateType = getTemplateType(template);
                                const typeConfig = TEMPLATE_TYPE_CONFIG[templateType];

                                return (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="size-2 rounded-full"
                                                    style={{ backgroundColor: typeConfig.color }}
                                                />
                                                <span className="text-xs sm:text-sm break-words">{template.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="max-w-xs truncate text-xs sm:text-sm">
                                                {template.subject || 'No subject'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`${typeConfig.badgeClass} text-xs`}>
                                                {typeConfig.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Badge className="bg-green-100 text-green-800 text-xs">
                                                Active
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                                            {formatDate(template.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handlePreviewTemplate(template)}
                                                    className="p-1 sm:p-2"
                                                >
                                                    <Eye className="size-3 sm:size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditTemplate(template)}
                                                    className="p-1 sm:p-2"
                                                >
                                                    <Edit className="size-3 sm:size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => confirmDelete(template.id)}
                                                    className="text-destructive hover:text-destructive p-1 sm:p-2"
                                                >
                                                    <Trash2 className="size-3 sm:size-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && templates.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} templates
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(Number(value))}>
                                <SelectTrigger className="w-[70px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={isFirst || currentPage === 0}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <div className="flex items-center gap-1 px-2">
                                <span className="text-sm">
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={isLast || currentPage >= totalPages - 1}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Preview Dialog */}
            {showPreview && previewTemplate && (
                <>
                    <TemplatePreview
                        template={previewTemplate}
                        isOpen={showPreview}
                        onClose={() => {
                            setShowPreview(false);
                            setPreviewTemplate(null);
                        }}
                    />
                </>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="w-[95vw] max-w-md sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] 2xl:max-w-md">
                    <DialogHeader className="px-4 sm:px-6">
                        <DialogTitle className="text-lg sm:text-xl">Delete Template</DialogTitle>
                        <DialogDescription className="text-sm sm:text-base break-words">
                            Are you sure you want to delete this template? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isDeleting}
                            className="w-full sm:w-auto text-xs sm:text-sm px-4 py-2 order-2 sm:order-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTemplateId && handleDeleteTemplate(deleteTemplateId)}
                            disabled={isDeleting}
                            className="w-full sm:w-auto text-xs sm:text-sm px-4 py-2 order-1 sm:order-2"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 size-3 sm:size-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
