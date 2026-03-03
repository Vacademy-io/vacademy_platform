import { useEditorStore } from '../-stores/editor-store';
import { Button } from '@/components/ui/button';
import { Settings, Plus, Copy, Trash2, MoreVertical, Globe, EyeOff } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export const PageTabs = () => {
    const {
        config,
        selectPage,
        selectedPageId,
        selectGlobalSettings,
        selectedGlobalSettings,
        addPage,
        deletePage,
        duplicatePage,
        togglePagePublished,
    } = useEditorStore();

    const [showAddDialog, setShowAddDialog] = useState(false);
    const [newPageRoute, setNewPageRoute] = useState('');
    const [newPageTitle, setNewPageTitle] = useState('');

    if (!config) return null;

    const handleAddPage = () => {
        if (!newPageRoute.trim()) return;
        const newPage = {
            id: `page-${Date.now()}`,
            route: newPageRoute.trim().toLowerCase().replace(/\s+/g, '-'),
            title: newPageTitle.trim() || undefined,
            components: [],
        };
        addPage(newPage);
        setNewPageRoute('');
        setNewPageTitle('');
        setShowAddDialog(false);
    };

    const handleDeletePage = (pageId: string) => {
        if (config.pages.length <= 1) {
            alert('Cannot delete the last page');
            return;
        }
        if (confirm('Are you sure you want to delete this page?')) {
            deletePage(pageId);
        }
    };

    return (
        <>
            <div className="flex gap-1 overflow-x-auto p-1">
                <Button
                    variant={selectedGlobalSettings ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => selectGlobalSettings()}
                    className="gap-1"
                >
                    <Settings className="size-4" />
                    Global Settings
                </Button>
                <div className="mx-2 h-8 w-px bg-gray-300" />
                {config.pages.map((page) => (
                    <div key={page.id} className="group flex items-center">
                        <Button
                            variant={selectedPageId === page.id ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => selectPage(page.id)}
                            className="gap-1.5 pr-1"
                        >
                            <span
                                className={`size-2 rounded-full ${page.published ? 'bg-green-500' : 'bg-gray-300'}`}
                                title={page.published ? 'Published' : 'Draft'}
                            />
                            {page.title || page.route}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-6 p-0 opacity-0 group-hover:opacity-100"
                                >
                                    <MoreVertical className="size-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => togglePagePublished(page.id)}>
                                    {page.published ? (
                                        <>
                                            <EyeOff className="mr-2 size-4" />
                                            Set as Draft
                                        </>
                                    ) : (
                                        <>
                                            <Globe className="mr-2 size-4 text-green-600" />
                                            Publish
                                        </>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicatePage(page.id)}>
                                    <Copy className="mr-2 size-4" />
                                    Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleDeletePage(page.id)}
                                    className="text-red-600"
                                >
                                    <Trash2 className="mr-2 size-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddDialog(true)}
                    className="gap-1 text-gray-500 hover:text-gray-700"
                >
                    <Plus className="size-4" />
                    Add Page
                </Button>
            </div>

            {/* Add Page Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Page</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="route">Route Slug *</Label>
                            <Input
                                id="route"
                                value={newPageRoute}
                                onChange={(e) => setNewPageRoute(e.target.value)}
                                placeholder="e.g., about-us"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title">Page Title (Optional)</Label>
                            <Input
                                id="title"
                                value={newPageTitle}
                                onChange={(e) => setNewPageTitle(e.target.value)}
                                placeholder="e.g., About Us"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddPage} disabled={!newPageRoute.trim()}>
                            Add Page
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
