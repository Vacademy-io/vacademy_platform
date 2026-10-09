import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Plus } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { cn } from '@/lib/utils';
import { getAllProductPages } from '../../product-pages/-services/product-pages-service';
import { useFolderLibraryStore } from '../../-stores/folder-library-store';
import {
    flattenFolders,
    folderLibrariesQueryKey,
    folderTreeQueryKey,
    getFolderTree,
    listFolderLibraries,
    nodeLabel,
} from '../../-services/folder-library-service';
import type { LearningPathProps } from '../../-types/editor-types';
import { ColorPickerField } from '../ColorPickerField';

/**
 * Property panel of a Learning Path section.
 *
 * One path = one product page shown as numbered steps (its courses in the
 * order set on the product page). List mode shows the product pages of a
 * folder library as path cards; "View path" opens one in place (?path=code).
 * Course data is always read live; only codes and ids are stored.
 */

interface LearningPathEditorProps {
    component: { id: string; props: LearningPathProps };
    pageId: string;
    updateComponent: (pageId: string, componentId: string, patch: { props: LearningPathProps }) => void;
}

const Toggle = ({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) => (
    <div className="flex items-start justify-between gap-3">
        <div>
            <Label className="text-xs">{label}</Label>
            {hint && <p className="text-caption text-neutral-500">{hint}</p>}
        </div>
        <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
);

const TextField = ({
    label,
    value,
    placeholder,
    onChange,
    hint,
}: {
    label: string;
    value: string;
    placeholder?: string;
    onChange: (v: string) => void;
    hint?: string;
}) => {
    const id = useId();
    return (
        <div>
            <Label htmlFor={id} className="text-xs">
                {label}
            </Label>
            <Input
                id={id}
                className="mt-1"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                aria-describedby={hint ? `${id}-hint` : undefined}
            />
            {hint && (
                <p id={`${id}-hint`} className="mt-1 text-caption text-neutral-500">
                    {hint}
                </p>
            )}
        </div>
    );
};

export const LearningPathEditor = ({ component, pageId, updateComponent }: LearningPathEditorProps) => {
    const instituteId = getCurrentInstituteId();
    const uid = useId();
    const { props } = component;
    const mode: 'single' | 'list' = props.mode === 'list' ? 'list' : 'single';
    const patch = (next: Partial<LearningPathProps>) =>
        updateComponent(pageId, component.id, { props: { ...props, ...next } });
    const set = <K extends keyof LearningPathProps>(key: K, value: LearningPathProps[K]) =>
        patch({ [key]: value } as Pick<LearningPathProps, K>);
    const openForSection = useFolderLibraryStore((s) => s.openForSection);

    const { data: pages, isLoading: pagesLoading } = useQuery({
        queryKey: ['PRODUCT_PAGES_FOR_CATALOGUE', instituteId],
        queryFn: () => getAllProductPages(instituteId!),
        enabled: mode === 'single' && !!instituteId,
        staleTime: 60_000,
    });
    const pageList = Array.isArray(pages) ? pages : [];
    const code: string = props.productPageCode || '';
    const selectedPage = pageList.find((p) => p.code === code);

    const { data: libraries, isLoading: librariesLoading } = useQuery({
        queryKey: folderLibrariesQueryKey(instituteId),
        queryFn: () => listFolderLibraries(instituteId!),
        enabled: mode === 'list' && !!instituteId,
        staleTime: 30_000,
    });
    const libraryList = Array.isArray(libraries) ? libraries : [];
    const libraryId: string = props.libraryId || '';
    const selectedLibrary = libraryList.find((l) => l.id === libraryId);
    const { data: tree } = useQuery({
        queryKey: folderTreeQueryKey(instituteId, libraryId),
        queryFn: () => getFolderTree(instituteId!, libraryId),
        enabled: mode === 'list' && !!instituteId && !!libraryId,
    });
    // Guard the shape: an unexpected body must not take the whole property panel down.
    const roots = tree && Array.isArray(tree.roots) ? tree.roots : null;
    const folders = roots ? flattenFolders(roots) : [];
    const folderMissing = !!props.folderId && !!roots && !folders.some((f) => f.node.id === props.folderId);
    // The site does not open a coming-soon folder, so no path from it shows yet.
    const folderComingSoon = folders.some((f) => f.node.id === props.folderId && f.node.coming_soon);
    const wireLibrary = (id: string, name: string) => patch({ libraryId: id, libraryName: name, folderId: '' });

    return (
        <div className="space-y-5">
            <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-caption text-neutral-500">
                A learning path is a product page whose courses are taken in order. Show one path as numbered
                steps, or list the paths kept in a folder library so visitors can open one.
            </div>

            {/* Mode */}
            <div>
                <Label className="text-xs">Show</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                    {(
                        [
                            { value: 'single', label: 'One path' },
                            { value: 'list', label: 'A list of paths' },
                        ] as const
                    ).map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => set('mode', o.value)}
                            className={cn(
                                'rounded px-2.5 py-1 text-caption font-medium',
                                mode === o.value ? 'bg-primary-100 text-primary-500' : 'bg-neutral-100 text-neutral-600'
                            )}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            {mode === 'single' ? (
                <div className="space-y-2">
                    <Label htmlFor={`${uid}-page`} className="text-xs">
                        Product page (the path)
                    </Label>
                    <select
                        id={`${uid}-page`}
                        className="w-full rounded border px-2 py-1.5 text-xs"
                        value={selectedPage ? selectedPage.code : code}
                        onChange={(e) => {
                            const picked = pageList.find((p) => p.code === e.target.value);
                            patch({ productPageCode: picked?.code || '', productPageName: picked?.name || '' });
                        }}
                    >
                        <option value="">{pagesLoading ? 'Loading product pages…' : 'Select a product page'}</option>
                        {code && !selectedPage && !pagesLoading && (
                            <option value={code}>{props.productPageName || code} (not found)</option>
                        )}
                        {pageList.map((p) => (
                            <option key={p.id} value={p.code}>
                                {p.name}
                                {p.status !== 'ACTIVE' ? ` (${String(p.status).toLowerCase()})` : ''}
                            </option>
                        ))}
                    </select>
                    {code && !selectedPage && !pagesLoading && (
                        <p className="text-caption text-warning-600">
                            This product page was deleted, so the section shows nothing. Pick another.
                        </p>
                    )}
                    {selectedPage && selectedPage.status !== 'ACTIVE' && (
                        <p className="text-caption text-warning-600">
                            This product page is a draft. Visitors can still check out through it, but make it active
                            when the path is ready.
                        </p>
                    )}
                    <p className="text-caption text-neutral-500">
                        Steps follow the order of the courses on the product page — reorder them there with the
                        arrows. A course offered in several languages is one step.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor={`${uid}-library`} className="text-xs">
                            Folder library
                        </Label>
                        <select
                            id={`${uid}-library`}
                            className="w-full rounded border px-2 py-1.5 text-xs"
                            value={libraryId}
                            onChange={(e) => {
                                const lib = libraryList.find((l) => l.id === e.target.value);
                                patch({ libraryId: e.target.value, libraryName: lib?.name || '', folderId: '' });
                            }}
                        >
                            <option value="">{librariesLoading ? 'Loading libraries…' : 'Select a library'}</option>
                            {libraryList.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                        {libraryId && !librariesLoading && libraries && !selectedLibrary && (
                            <p className="text-caption text-warning-600">
                                This library was deleted. Pick another — the section shows nothing until you do.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {libraryId && selectedLibrary && (
                                <MyButton buttonType="primary" scale="small" onClick={() => openForSection(libraryId, wireLibrary)}>
                                    <FolderOpen className="size-4" /> Manage folders
                                </MyButton>
                            )}
                            <MyButton buttonType="secondary" scale="small" onClick={() => openForSection(null, wireLibrary)}>
                                <Plus className="size-4" /> {libraryList.length ? 'New or other library' : 'Create a library'}
                            </MyButton>
                        </div>
                        <p className="text-caption text-neutral-500">
                            Every product page in the library is a path. Put each under its stream folder.
                        </p>
                    </div>

                    {libraryId && selectedLibrary && (
                        <div>
                            <Label htmlFor={`${uid}-folder`} className="text-xs">
                                Paths from
                            </Label>
                            <select
                                id={`${uid}-folder`}
                                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
                                value={props.folderId || ''}
                                onChange={(e) => set('folderId', e.target.value)}
                            >
                                <option value="">Every stream</option>
                                {folders.map(({ node, depth }) => (
                                    <option key={node.id} value={node.id}>
                                        {`${'— '.repeat(depth + 1)}${nodeLabel(node)}${node.coming_soon ? ' (coming soon)' : ''}`}
                                    </option>
                                ))}
                            </select>
                            {folderMissing && (
                                <p className="mt-1 text-caption text-warning-600">
                                    That folder was deleted, so the section shows nothing. Pick another.
                                </p>
                            )}
                            {folderComingSoon && (
                                <p className="mt-1 text-caption text-warning-600">
                                    This folder is marked coming soon, so the site shows no paths from it until it
                                    launches.
                                </p>
                            )}
                        </div>
                    )}

                    <Toggle
                        label="Follow the stream tab"
                        hint="On /courses?stream=… show only that stream’s paths (the folder whose link key matches). Without a stream, the choice above applies."
                        checked={!!props.streamFromUrl}
                        onChange={(v) => set('streamFromUrl', v)}
                    />
                    <TextField
                        label="Address parameter for an open path"
                        value={props.pathParam ?? ''}
                        placeholder="path"
                        onChange={(v) => set('pathParam', v.replace(/[^\w.-]/g, ''))}
                        hint="“View path” opens a path in place as ?path=<code>. Change only if another section already uses ?path=."
                    />
                </div>
            )}

            {/* Heading */}
            <div className="space-y-3 border-t border-neutral-100 pt-4">
                <TextField label="Title" value={props.title || ''} onChange={(v) => set('title', v)} />
                <div>
                    <Label htmlFor={`${uid}-subtitle`} className="text-xs">
                        Subtitle
                    </Label>
                    <Textarea
                        id={`${uid}-subtitle`}
                        className="mt-1"
                        rows={2}
                        value={props.subtitle || ''}
                        onChange={(e) => set('subtitle', e.target.value)}
                    />
                </div>
            </div>

            {/* Steps */}
            <div className="space-y-3 border-t border-neutral-100 pt-4">
                <p className="text-sm font-semibold text-neutral-700">Steps</p>
                <Toggle
                    label="Step numbers"
                    checked={props.showStepNumbers !== false}
                    onChange={(v) => set('showStepNumbers', v)}
                />
                <Toggle
                    label="Path total"
                    hint="The sum of the steps’ prices."
                    checked={props.showTotal !== false}
                    onChange={(v) => set('showTotal', v)}
                />
            </div>

            {/* Labels */}
            <div className="space-y-3 border-t border-neutral-100 pt-4">
                <p className="text-sm font-semibold text-neutral-700">Button labels</p>
                <TextField
                    label="With the site cart on"
                    value={props.addAllLabel || ''}
                    placeholder="Add whole path to cart"
                    onChange={(v) => set('addAllLabel', v)}
                    hint="Adds every step to the site cart (Global Settings → Site cart)."
                />
                <TextField
                    label="Without a site cart"
                    value={props.enrolLabel || ''}
                    placeholder="Enrol in this path"
                    onChange={(v) => set('enrolLabel', v)}
                    hint="Opens the product page’s checkout with every step selected."
                />
                {mode === 'list' && (
                    <TextField
                        label="Path card button"
                        value={props.viewPathLabel || ''}
                        placeholder="View path"
                        onChange={(v) => set('viewPathLabel', v)}
                    />
                )}
                <TextField
                    label="When there is nothing to show"
                    value={props.emptyText || ''}
                    placeholder="New learning paths will appear here."
                    onChange={(v) => set('emptyText', v)}
                />
            </div>

            {/* Background */}
            <div className="space-y-2 border-t border-neutral-100 pt-4">
                {props.backgroundColor ? (
                    <>
                        <ColorPickerField
                            label="Background colour"
                            value={props.backgroundColor}
                            onChange={(c) => set('backgroundColor', c)}
                        />
                        <MyButton buttonType="text" scale="small" onClick={() => set('backgroundColor', '')}>
                            Use the page background
                        </MyButton>
                    </>
                ) : (
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <Label className="text-xs">Background colour</Label>
                            <p className="text-caption text-neutral-500">Same as the page.</p>
                        </div>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => set('backgroundColor', '#F8FAFC')} // design-lint-ignore: colour-editor seed value
                        >
                            Set colour
                        </MyButton>
                    </div>
                )}
            </div>
        </div>
    );
};
