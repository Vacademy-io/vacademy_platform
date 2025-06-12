/* eslint-disable */
// @ts-nocheck
'use client';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, FileIcon as FilePresentation, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRouter } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Presentation } from './types';
import { useGetPresntation } from './hooks/useGetPresntation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { FormEvent } from 'react';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { toast } from 'sonner';
import { EDIT_PRESENTATION } from '@/constants/urls';
import { useQueryClient } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';

export default function ManagePresentation() {
    const router = useRouter();
    const { setNavHeading } = useNavHeadingStore();
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const { data, isLoading } = useGetPresntation();
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [editingPresentation, setEditingPresentation] = useState<Presentation | null>(null);
    const [presentationToDelete, setPresentationToDelete] = useState<Presentation | null>(null);

    const handleEditPresentation = (presentation: Presentation) => {
        setEditingPresentation(presentation);
        setIsEditModalOpen(true);
    };

    const handleUpdatePresentation = (e: FormEvent) => {
        e.preventDefault();
        if (!editingPresentation) return;

        router.navigate({
            to: `/study-library/present/add`,
            search: {
                title: editingPresentation.title,
                description: editingPresentation.description,
                id: editingPresentation.id,
                isEdit: true,
            },
        });
        setIsEditModalOpen(false);
    };

    const handleDeletePresentation = (presentation: Presentation) => {
        setPresentationToDelete(presentation);
        setIsDeleteDialogOpen(true);
    };

    const handleCreatePresentation = (e: FormEvent) => {
        e.preventDefault();
        router.navigate({
            to: `/study-library/present/add`,
            search: {
                title: newTitle,
                description: newDescription,
                id: '',
                isEdit: false,
            },
        });
        setIsCreateModalOpen(false);

        setNewTitle('');
        setNewDescription('');
    };

    const filteredPresentations = presentations.filter((presentation) => {
        const matchesSearch =
            presentation?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            presentation?.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            presentation?.category?.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeTab === 'all') return matchesSearch;
        if (activeTab === 'published') return matchesSearch && presentation.status === 'published';
        if (activeTab === 'drafts') return matchesSearch && presentation.status === 'draft';
        if (activeTab === 'archived') return matchesSearch && presentation.status === 'archived';

        return matchesSearch;
    });

    useEffect(() => {
        setNavHeading('Manage Presentation');
    }, []);

    const getStatusColor = (status = 'draft') => {
        switch (status) {
            case 'published':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-amber-100 text-amber-800';
            case 'archived':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    useEffect(() => {
        setPresentations(data ?? []);
    }, [data]);

    const deletePresentation = async () => {
        try {
            setIsSaving(true);
            // 1. Authentication check
            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            if (!accessToken) {
                toast.error('Please login to save presentations');
                return;
            }

            // 2. Get institute ID
            const tokenData = getTokenDecodedData(accessToken);
            const INSTITUTE_ID = tokenData?.authorities && Object.keys(tokenData.authorities)[0];
            // 7. API call
            const response = await authenticatedAxiosInstance.post(
                EDIT_PRESENTATION,
                {
                    ...presentationToDelete,
                    status: 'DELETED',
                    added_slides: [],
                    updated_slides: [],
                    deleted_slides: [],
                },
                {
                    params: { instituteId: INSTITUTE_ID },
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            // 8. Handle response
            await queryClient.refetchQueries({ queryKey: ['GET_PRESNTATIONS'] });
            toast.success('Presentation deleted successfully');
        } catch (error) {
            console.error('Save error:', error);
            toast.error(
                error.response?.data?.message || error.message || 'Failed to save presentation'
            );
        } finally {
            setIsSaving(false);
            setIsDeleteDialogOpen(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-1/2 items-center justify-center">
                <Loader2 className="animate-spin" />
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-8 text-neutral-700">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold">Presentations</h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        Manage and organize your presentation materials
                    </p>
                </div>
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                        <MyButton>
                            <Plus className="mr-2 h-4 w-4" /> New Presentation
                        </MyButton>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold">
                                Create New Presentation
                            </DialogTitle>
                            <DialogDescription>
                                Enter the details for your new presentation. You can edit these
                                later.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreatePresentation}>
                            <div className="mb-4 flex flex-col gap-4">
                                <div className="flex flex-col items-start gap-4">
                                    <Label htmlFor="title" className="text-right">
                                        Title
                                    </Label>
                                    <Input
                                        id="title"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className="col-span-3"
                                        placeholder="Enter presentation title"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col items-start gap-4">
                                    <Label htmlFor="description" className="text-right">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        className="col-span-3"
                                        placeholder="Enter presentation description"
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 "
                                >
                                    Cancel
                                </MyButton>
                                <MyButton type="submit" className="flex-1">
                                    Next
                                </MyButton>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Edit Presentation Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                            Edit Presentation
                        </DialogTitle>
                        <DialogDescription>
                            Update the details for your presentation.
                        </DialogDescription>
                    </DialogHeader>
                    {editingPresentation && (
                        <form onSubmit={handleUpdatePresentation}>
                            <div className="mb-4 flex flex-col gap-4">
                                <div className="flex flex-col items-start gap-4">
                                    <Label htmlFor="edit-title" className="text-right">
                                        Title
                                    </Label>
                                    <Input
                                        id="edit-title"
                                        value={editingPresentation.title}
                                        onChange={(e) =>
                                            setEditingPresentation({
                                                ...editingPresentation,
                                                title: e.target.value,
                                            })
                                        }
                                        className="col-span-3"
                                        placeholder="Enter presentation title"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col items-start gap-4">
                                    <Label htmlFor="edit-description" className="text-right">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="edit-description"
                                        value={editingPresentation.description}
                                        onChange={(e) =>
                                            setEditingPresentation({
                                                ...editingPresentation,
                                                description: e.target.value,
                                            })
                                        }
                                        className="col-span-3"
                                        placeholder="Enter presentation description"
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" variant={'destructive'} className="flex-1">
                                    Next
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                    <Input
                        placeholder="Search presentations..."
                        className="bg-white pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {filteredPresentations.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPresentations.map((presentation) => (
                        <Card
                            key={presentation.id}
                            className="group overflow-hidden border border-neutral-200 transition-all duration-300 hover:shadow-lg"
                        >
                            <div className="h-2 w-full bg-gradient-to-r from-primary-300" />
                            <CardHeader className="pb-2 pt-5">
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle>{presentation.title}</CardTitle>
                                    <div className="flex-1">
                                        <Badge
                                            className={cn(
                                                'mb-2 font-normal',
                                                getStatusColor('published')
                                            )}
                                        >
                                            Published
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="line-clamp-2 min-h-[40px] text-sm text-neutral-600">
                                    {presentation.description}
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className="bg-neutral-50 text-xs font-normal"
                                    >
                                        {presentation?.added_slides_count} slides
                                    </Badge>
                                    {presentation?.updated_at && (
                                        <Badge
                                            variant="outline"
                                            className="bg-neutral-50 text-xs font-normal"
                                        >
                                            Edited{' '}
                                            {new Date(
                                                presentation?.updated_at
                                            ).toLocaleDateString()}
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t border-neutral-100 pb-4 pt-3">
                                <span className="text-xs text-neutral-400">Created 10/02/2025</span>
                                <div className="flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                                        onClick={() => handleEditPresentation(presentation)}
                                    >
                                        <Edit className="h-4 w-4" />
                                        <span className="sr-only">Edit</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                                        onClick={() => {
                                            handleDeletePresentation(presentation);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-16">
                    <FilePresentation className="mb-4 h-12 w-12 text-neutral-300" />
                    <h3 className="text-lg font-medium text-neutral-700">No presentations found</h3>
                    <p className="mt-1 max-w-md text-center text-neutral-500">
                        {searchQuery
                            ? `No presentations match your search "${searchQuery}". Try a different search term.`
                            : 'Get started by creating your first presentation.'}
                    </p>
                    {searchQuery && (
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => setSearchQuery('')}
                        >
                            Clear search
                        </Button>
                    )}
                </div>
            )}

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                            Delete Presentation
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this presentation? This action cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            className="flex-1"
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant={'destructive'}
                            className="flex-1"
                            onClick={deletePresentation}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
}
