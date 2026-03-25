import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BookOpen, Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeItem {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const CATEGORIES = [
    { value: 'event', label: 'Event' },
    { value: 'policy', label: 'Policy' },
    { value: 'process', label: 'Process' },
    { value: 'faq', label: 'FAQ' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'result', label: 'Result' },
    { value: 'general', label: 'General' },
];

const CATEGORY_COLORS: Record<string, string> = {
    event: 'bg-blue-100 text-blue-800',
    policy: 'bg-purple-100 text-purple-800',
    process: 'bg-green-100 text-green-800',
    faq: 'bg-amber-100 text-amber-800',
    announcement: 'bg-red-100 text-red-800',
    result: 'bg-teal-100 text-teal-800',
    general: 'bg-gray-100 text-gray-800',
};

// ─── Component ───────────────────────────────────────────────────────────────

const KnowledgeBase: React.FC = () => {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Search & filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // Form dialog
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState('general');
    const [formContent, setFormContent] = useState('');
    const [formTags, setFormTags] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const instituteId = getInstituteId();

    // ─── Fetch items ─────────────────────────────────────────────────────────

    const fetchItems = useCallback(async () => {
        if (!instituteId) return;
        setIsLoading(true);
        try {
            const response = await authenticatedAxiosInstance.get<KnowledgeItem[]>(
                `${AI_SERVICE_BASE_URL}/knowledge-base/v1/institute/${instituteId}/items`
            );
            setItems(response.data || []);
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Error fetching knowledge base items:', error);
                toast.error('Failed to load knowledge base items');
            }
        } finally {
            setIsLoading(false);
        }
    }, [instituteId]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    // ─── Create / Update ─────────────────────────────────────────────────────

    const openCreateForm = () => {
        setEditingItem(null);
        setFormTitle('');
        setFormCategory('general');
        setFormContent('');
        setFormTags('');
        setIsFormOpen(true);
    };

    const openEditForm = (item: KnowledgeItem) => {
        setEditingItem(item);
        setFormTitle(item.title);
        setFormCategory(item.category);
        setFormContent(item.content);
        setFormTags(item.tags?.join(', ') || '');
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!instituteId) return;
        if (!formTitle.trim()) {
            toast.error('Title is required');
            return;
        }
        if (!formContent.trim()) {
            toast.error('Content is required');
            return;
        }

        setIsSaving(true);
        const tags = formTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

        const payload = {
            title: formTitle.trim(),
            content: formContent.trim(),
            category: formCategory,
            tags,
        };

        try {
            if (editingItem) {
                await authenticatedAxiosInstance.put(
                    `${AI_SERVICE_BASE_URL}/knowledge-base/v1/institute/${instituteId}/items/${editingItem.id}`,
                    payload
                );
                toast.success('Knowledge item updated');
            } else {
                await authenticatedAxiosInstance.post(
                    `${AI_SERVICE_BASE_URL}/knowledge-base/v1/institute/${instituteId}/items`,
                    payload
                );
                toast.success('Knowledge item created');
            }
            setIsFormOpen(false);
            await fetchItems();
        } catch (error) {
            console.error('Error saving knowledge item:', error);
            toast.error('Failed to save knowledge item');
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Toggle active ───────────────────────────────────────────────────────

    const handleToggleActive = async (item: KnowledgeItem) => {
        if (!instituteId) return;
        try {
            await authenticatedAxiosInstance.put(
                `${AI_SERVICE_BASE_URL}/knowledge-base/v1/institute/${instituteId}/items/${item.id}`,
                {
                    title: item.title,
                    content: item.content,
                    category: item.category,
                    tags: item.tags,
                    is_active: !item.is_active,
                }
            );
            setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
            );
            toast.success(`Item ${!item.is_active ? 'activated' : 'deactivated'}`);
        } catch (error) {
            console.error('Error toggling item:', error);
            toast.error('Failed to update item status');
        }
    };

    // ─── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!instituteId || !deleteItemId) return;
        setIsDeleting(true);
        try {
            await authenticatedAxiosInstance.delete(
                `${AI_SERVICE_BASE_URL}/knowledge-base/v1/institute/${instituteId}/items/${deleteItemId}`
            );
            setItems((prev) => prev.filter((i) => i.id !== deleteItemId));
            toast.success('Knowledge item deleted');
        } catch (error) {
            console.error('Error deleting knowledge item:', error);
            toast.error('Failed to delete knowledge item');
        } finally {
            setIsDeleting(false);
            setDeleteItemId(null);
        }
    };

    // ─── Filtered items ──────────────────────────────────────────────────────

    const filteredItems = items.filter((item) => {
        const matchesSearch =
            !searchQuery ||
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <>
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader
                    className="cursor-pointer border-b border-indigo-50 bg-indigo-50/30"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-indigo-500 p-2 text-white">
                                <BookOpen className="size-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Knowledge Base</CardTitle>
                                <CardDescription>
                                    Add institute-specific knowledge for the AI chatbot (events, policies, FAQs, etc.)
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                {items.length} item{items.length !== 1 ? 's' : ''}
                            </span>
                            {isCollapsed ? (
                                <ChevronDown className="size-5 text-gray-400" />
                            ) : (
                                <ChevronUp className="size-5 text-gray-400" />
                            )}
                        </div>
                    </div>
                </CardHeader>

                {!isCollapsed && (
                    <CardContent className="space-y-4 pt-6">
                        {/* Toolbar: Search, Filter, Add */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 gap-2">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search knowledge items..."
                                        className="border-indigo-100 pl-9 focus:border-indigo-300"
                                    />
                                </div>
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger className="w-[150px] border-indigo-100">
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={openCreateForm}
                                className="bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                                <Plus className="mr-1 size-4" />
                                Add Knowledge
                            </Button>
                        </div>

                        {/* Items list */}
                        {isLoading ? (
                            <div className="flex h-32 items-center justify-center">
                                <div className="size-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="py-12 text-center">
                                <BookOpen className="mx-auto mb-3 size-10 text-gray-300" />
                                <p className="text-sm text-gray-500">
                                    {items.length === 0
                                        ? 'No knowledge items yet. Add your first item to make the chatbot smarter.'
                                        : 'No items match your search.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between rounded-lg border border-indigo-50 bg-white p-4 transition-colors hover:bg-indigo-50/30"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="truncate text-sm font-medium text-gray-900">
                                                    {item.title}
                                                </h4>
                                                <Badge
                                                    className={`shrink-0 border-0 text-[10px] ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general}`}
                                                >
                                                    {item.category}
                                                </Badge>
                                                {!item.is_active && (
                                                    <Badge variant="outline" className="shrink-0 text-[10px] text-gray-400">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                                                {item.content}
                                            </p>
                                            {item.tags && item.tags.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {item.tags.map((tag, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-4 flex shrink-0 items-center gap-2">
                                            <Switch
                                                checked={item.is_active}
                                                onCheckedChange={() => handleToggleActive(item)}
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="size-8 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                                                onClick={() => openEditForm(item)}
                                            >
                                                <Pencil className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="size-8 border-red-200 text-red-600 hover:bg-red-50"
                                                onClick={() => setDeleteItemId(item.id)}
                                            >
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* ─── Create / Edit Dialog ─────────────────────────────────────── */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem ? 'Edit Knowledge Item' : 'Add Knowledge Item'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingItem
                                ? 'Update this knowledge item. Changes will be reflected in chatbot responses.'
                                : 'Add a new knowledge item that the AI chatbot can reference during conversations.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="kb-title" className="text-sm font-medium">
                                Title <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="kb-title"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="e.g., Annual Sports Day 2026"
                                className="border-indigo-100 focus:border-indigo-300"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="kb-category" className="text-sm font-medium">
                                Category
                            </Label>
                            <Select value={formCategory} onValueChange={setFormCategory}>
                                <SelectTrigger
                                    id="kb-category"
                                    className="border-indigo-100 focus:border-indigo-300"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="kb-content" className="text-sm font-medium">
                                Content <span className="text-red-500">*</span>
                            </Label>
                            <textarea
                                id="kb-content"
                                value={formContent}
                                onChange={(e) => setFormContent(e.target.value)}
                                placeholder="Enter the knowledge content that the AI chatbot should know about..."
                                rows={6}
                                className="w-full rounded-md border border-indigo-100 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                            />
                            <p className="text-[10px] text-gray-500">
                                This text will be embedded and searched by the AI chatbot during conversations.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="kb-tags" className="text-sm font-medium">
                                Tags
                            </Label>
                            <Input
                                id="kb-tags"
                                value={formTags}
                                onChange={(e) => setFormTags(e.target.value)}
                                placeholder="e.g., sports, annual, 2026 (comma-separated)"
                                className="border-indigo-100 focus:border-indigo-300"
                            />
                            <p className="text-[10px] text-gray-500">
                                Comma-separated tags to help categorize and find this item.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsFormOpen(false)}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            {isSaving ? (
                                <>
                                    <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Saving...
                                </>
                            ) : editingItem ? (
                                'Update Item'
                            ) : (
                                'Add Item'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Delete Confirmation ──────────────────────────────────────── */}
            <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Knowledge Item</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this knowledge item? This action cannot be undone
                            and the chatbot will no longer have access to this information.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {isDeleting ? (
                                <>
                                    <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default KnowledgeBase;
