import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getAllProductPages } from '../../product-pages/-services/product-pages-service';
import { ImageUploadField } from '../ImageUploadField';
import { FolderViewFields } from './FolderViewFields';
import type { FolderNode, FolderNodeInput, FolderNodeType, FolderView } from '../../-services/folder-library-service';

/**
 * Create / edit one item of a folder library: a folder (title, description,
 * image, and optionally its own way of showing its contents) or a product
 * page leaf (which product page, plus an optional display title and image).
 */

interface FolderNodeEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    nodeType: FolderNodeType;
    /** null = create. */
    node: FolderNode | null;
    /** Shown in the heading so the admin knows where the item lands. */
    parentLabel: string;
    onSubmit: (input: FolderNodeInput) => Promise<void>;
}

export const FolderNodeEditorDialog = ({
    open,
    onOpenChange,
    nodeType,
    node,
    parentLabel,
    onSubmit,
}: FolderNodeEditorDialogProps) => {
    const instituteId = getCurrentInstituteId();
    const isFolder = nodeType === 'FOLDER';
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [productPageId, setProductPageId] = useState('');
    const [visible, setVisible] = useState(true);
    const [customView, setCustomView] = useState(false);
    const [view, setView] = useState<FolderView>({});
    const [error, setError] = useState<string | null>(null);

    // Re-seed every time the dialog opens, so a cancelled edit never leaks into the next one.
    useEffect(() => {
        if (!open) return;
        setTitle(node?.title || '');
        setDescription(node?.description || '');
        setImageUrl(node?.image_url || '');
        setProductPageId(node?.product_page_id || '');
        setVisible((node?.status || 'ACTIVE') === 'ACTIVE');
        const hasView = !!node?.view && Object.keys(node.view).length > 0;
        setCustomView(hasView);
        // Only what the admin sets is stored; everything else keeps following the section.
        setView(node?.view || {});
        setError(null);
    }, [open, node]);

    const { data: pages, isLoading: pagesLoading } = useQuery({
        queryKey: ['PRODUCT_PAGES_FOR_CATALOGUE', instituteId],
        queryFn: () => getAllProductPages(instituteId!),
        enabled: open && !isFolder && !!instituteId,
        staleTime: 60_000,
    });
    const selectedPage = (pages || []).find((p) => p.id === productPageId);

    const submit = async () => {
        if (isFolder && !title.trim()) {
            setError('Give the folder a title.');
            return;
        }
        if (!isFolder && !productPageId) {
            setError('Choose a product page.');
            return;
        }
        setError(null);
        const input: FolderNodeInput = {
            title: title.trim(),
            description: description.trim(),
            image_url: imageUrl.trim(),
            status: visible ? 'ACTIVE' : 'HIDDEN',
        };
        // Only a changed link is sent: re-sending one whose product page was
        // deleted would be rejected, and the item could not even be renamed.
        if (!isFolder && productPageId !== (node?.product_page_id || '')) input.product_page_id = productPageId;
        // {} clears an existing override; omitting `view` would keep it.
        if (isFolder) input.view = customView ? view : {};
        try {
            await onSubmit(input);
            onOpenChange(false);
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { ex?: string; message?: string } } })?.response?.data;
            setError(msg?.ex || msg?.message || 'Could not save. Please try again.');
        }
    };

    const heading = node
        ? isFolder
            ? 'Edit folder'
            : 'Edit product page item'
        : isFolder
          ? `New folder in ${parentLabel}`
          : `Add a product page to ${parentLabel}`;

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={heading}
            dialogWidth="max-w-xl"
            footerLeft={error ? <p className="text-xs text-danger-600">{error}</p> : undefined}
            footer={
                <div className="flex gap-2">
                    <MyButton buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton buttonType="primary" scale="medium" onAsyncClick={submit} loadingText="Saving…">
                        {node ? 'Save' : isFolder ? 'Create folder' : 'Add'}
                    </MyButton>
                </div>
            }
        >
            <div className="space-y-4 p-1">
                {!isFolder && (
                    <div>
                        <Label className="text-xs">Product page</Label>
                        <select
                            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
                            value={productPageId}
                            onChange={(e) => setProductPageId(e.target.value)}
                        >
                            <option value="">{pagesLoading ? 'Loading product pages…' : 'Select a product page'}</option>
                            {(pages || []).map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p.status !== 'ACTIVE' ? ` (${p.status.toLowerCase()})` : ''}
                                </option>
                            ))}
                        </select>
                        {selectedPage && selectedPage.status !== 'ACTIVE' && (
                            <p className="mt-1 text-caption text-warning-600">
                                This product page is not active yet, so students will not see it here until it is.
                            </p>
                        )}
                        {!pagesLoading && (pages || []).length === 0 && (
                            <p className="mt-1 text-caption text-neutral-500">
                                No product pages yet. Create one under Manage Pages → Product pages first.
                            </p>
                        )}
                        <p className="mt-1 text-caption text-neutral-500">
                            Opening this folder shows the product page&apos;s courses, with add to cart and checkout.
                        </p>
                    </div>
                )}

                <div>
                    <Label className="text-xs">{isFolder ? 'Title' : 'Display title (optional)'}</Label>
                    <Input
                        className="mt-1"
                        value={title}
                        maxLength={255}
                        autoFocus={isFolder}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={isFolder ? 'e.g. Class 10' : selectedPage?.name || 'Uses the product page name'}
                    />
                </div>
                <div>
                    <Label className="text-xs">Description (optional)</Label>
                    <Textarea
                        className="mt-1"
                        rows={2}
                        maxLength={2000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={isFolder ? 'One line on what is inside' : 'Shown above the courses'}
                    />
                </div>
                <ImageUploadField
                    label="Image (optional)"
                    value={imageUrl}
                    onChange={setImageUrl}
                    placeholder="Upload or paste an image address"
                />
                <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
                    <div>
                        <p className="text-sm font-medium text-neutral-700">Visible to students</p>
                        <p className="text-caption text-neutral-500">
                            Hidden {isFolder ? 'folders (and everything inside them)' : 'items'} stay here for you but
                            disappear from your site.
                        </p>
                    </div>
                    <Switch checked={visible} onCheckedChange={setVisible} />
                </div>

                {isFolder && (
                    <div className="rounded-md border border-neutral-200 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-neutral-700">Custom look for this folder</p>
                                <p className="text-caption text-neutral-500">
                                    Off: its contents use the section&apos;s layout. On: change any of these just for
                                    this folder&apos;s contents — anything you leave alone still follows the section.
                                </p>
                            </div>
                            <Switch checked={customView} onCheckedChange={setCustomView} />
                        </div>
                        {customView && (
                            <div className="mt-3 border-t border-neutral-100 pt-3">
                                <FolderViewFields value={view} onChange={setView} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MyDialog>
    );
};
