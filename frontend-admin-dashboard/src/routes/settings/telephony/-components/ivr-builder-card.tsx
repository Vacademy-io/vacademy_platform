import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, PencilSimple, Trash, PhoneCall } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    type IvrMenuDTO,
    fetchIvrMenus,
    upsertIvrMenu,
    deleteIvrMenu,
} from '../-services/ivr-admin';
import { IvrMenuEditor } from './ivr-menu-editor';

/**
 * Inbound IVR menu builder for Vacademy Voice (Plivo). Shown only when the active
 * provider declares the IVR_BUILDER capability. Lists the institute's menus and
 * opens the tree editor to create / edit them.
 */
export function IvrBuilderCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const menusQuery = useQuery({
        queryKey: ['ivr-menus', instituteId],
        queryFn: () => fetchIvrMenus(instituteId),
        enabled: !!instituteId,
    });

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingMenu, setEditingMenu] = useState<IvrMenuDTO | null>(null);
    const [deletingMenu, setDeletingMenu] = useState<IvrMenuDTO | null>(null);

    const saveMutation = useMutation({
        mutationFn: (menu: IvrMenuDTO) => upsertIvrMenu(menu),
        onSuccess: () => {
            toast.success('IVR menu saved');
            setEditorOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ivr-menus', instituteId] });
        },
        onError: (err) =>
            toast.error(err instanceof Error ? err.message : 'Could not save the menu'),
    });

    const deleteMutation = useMutation({
        mutationFn: (menuId: string) => deleteIvrMenu(menuId),
        onSuccess: () => {
            toast.success('IVR menu deleted');
            setDeletingMenu(null);
            queryClient.invalidateQueries({ queryKey: ['ivr-menus', instituteId] });
        },
        onError: (err) =>
            toast.error(err instanceof Error ? err.message : 'Could not delete the menu'),
    });

    const openCreate = () => {
        setEditingMenu(null);
        setEditorOpen(true);
    };
    const openEdit = (menu: IvrMenuDTO) => {
        setEditingMenu(menu);
        setEditorOpen(true);
    };

    const menus = menusQuery.data ?? [];

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex flex-col gap-1">
                    <CardTitle className="flex items-center gap-2">
                        <PhoneCall className="text-primary-500" />
                        Inbound call menus (IVR)
                    </CardTitle>
                    <CardDescription>
                        Build the menu callers hear when they dial your number — “press 1 for sales,
                        2 for support” — and route each choice to the right number or voicemail.
                    </CardDescription>
                </div>
                <MyButton buttonType="primary" scale="medium" onClick={openCreate}>
                    <Plus className="mr-1" /> New menu
                </MyButton>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
                {menusQuery.isLoading && (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-14 w-full rounded-lg" />
                        <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                )}

                {menusQuery.isError && (
                    <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-body text-danger-600">
                        Couldn’t load your IVR menus. Please retry.
                    </div>
                )}

                {!menusQuery.isLoading && !menusQuery.isError && menus.length === 0 && (
                    <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-body text-neutral-500">
                        No IVR menus yet. Create one to greet inbound callers and route them with a
                        keypad menu.
                    </div>
                )}

                {menus.map((menu) => (
                    <div
                        key={menu.id ?? menu.name}
                        className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-4"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-subtitle font-semibold text-neutral-800">
                                    {menu.name}
                                </span>
                                {menu.enabled === false && (
                                    <span className="rounded-sm bg-neutral-100 px-2 py-0.5 text-caption text-neutral-500">
                                        Disabled
                                    </span>
                                )}
                            </div>
                            <span className="text-caption text-neutral-500">
                                {menu.dialedNumber?.trim()
                                    ? `Number ${menu.dialedNumber}`
                                    : 'Default menu (all numbers)'}
                                {' · '}
                                {menu.nodes?.length ?? 0}{' '}
                                {(menu.nodes?.length ?? 0) === 1 ? 'step' : 'steps'}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <MyButton
                                buttonType="secondary"
                                layoutVariant="icon"
                                scale="small"
                                onClick={() => openEdit(menu)}
                            >
                                <PencilSimple />
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                layoutVariant="icon"
                                scale="small"
                                onClick={() => setDeletingMenu(menu)}
                            >
                                <Trash className="text-danger-600" />
                            </MyButton>
                        </div>
                    </div>
                ))}
            </CardContent>

            <IvrMenuEditor
                open={editorOpen}
                onOpenChange={setEditorOpen}
                instituteId={instituteId}
                initialMenu={editingMenu}
                onSave={(menu) => saveMutation.mutate(menu)}
                saving={saveMutation.isPending}
            />

            <MyDialog
                heading="Delete IVR menu?"
                open={deletingMenu !== null}
                onOpenChange={(o) => !o && setDeletingMenu(null)}
                dialogWidth="max-w-md"
                footer={
                    <>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setDeletingMenu(null)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            disable={deleteMutation.isPending}
                            onClick={() =>
                                deletingMenu?.id && deleteMutation.mutate(deletingMenu.id)
                            }
                        >
                            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                        </MyButton>
                    </>
                }
            >
                <p className="text-body text-neutral-600">
                    “{deletingMenu?.name}” will be removed. Inbound calls to its number will fall
                    back to routing straight to a counsellor. This can’t be undone.
                </p>
            </MyDialog>
        </Card>
    );
}
