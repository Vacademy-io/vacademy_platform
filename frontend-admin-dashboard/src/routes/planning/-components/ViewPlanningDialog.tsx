import { useState, useEffect } from 'react';
import type { PlanningLog } from '../-types/types';
import { MyInput } from '@/components/design-system/input';
import { MyLabel } from '@/components/design-system/my-label';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, X, Share2 } from 'lucide-react';
import { unwrapContentFromHTML, wrapContentInHTML } from '../-utils/templateLoader';
import { lazy, Suspense } from 'react';
const TipTapEditor = lazy(() => import('@/components/tiptap/TipTapEditor').then(module => ({ default: module.TipTapEditor })));
import { useUpdatePlanningLog } from '../-services/updatePlanningLog';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { formatIntervalTypeId } from '../-utils/intervalTypeIdFormatter';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ViewPlanningDialogProps {
    log: PlanningLog | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function ViewPlanningDialog({
    log,
    open,
    onOpenChange,
    onSuccess,
}: ViewPlanningDialogProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedDescription, setEditedDescription] = useState('');
    const [editedContent, setEditedContent] = useState('');
    const [editedIsSharedWithStudent, setEditedIsSharedWithStudent] = useState(false);

    const updateMutation = useUpdatePlanningLog();

    useEffect(() => {
        if (log) {
            setEditedTitle(log.title);
            setEditedDescription(log.description || '');
            setEditedContent(unwrapContentFromHTML(log.content_html));
            setEditedIsSharedWithStudent(log.is_shared_with_student);
            setIsEditing(false);
        }
    }, [log]);

    const handleSave = async () => {
        if (!log) return;

        try {
            const wrappedContent = wrapContentInHTML(editedContent);
            await updateMutation.mutateAsync({
                logId: log.id,
                data: {
                    title: editedTitle,
                    description: editedDescription,
                    content_html: wrappedContent,
                    is_shared_with_student: editedIsSharedWithStudent,
                },
            });

            setIsEditing(false);
            onSuccess();
        } catch (error) {
            console.error('Failed to update planning log:', error);
        }
    };

    const handleCancel = () => {
        if (log) {
            setEditedTitle(log.title);
            setEditedDescription(log.description || '');
            setEditedContent(unwrapContentFromHTML(log.content_html));
            setEditedIsSharedWithStudent(log.is_shared_with_student);
        }
        setIsEditing(false);
    };

    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'MMMM dd, yyyy');
        } catch {
            console.error('Invalid date format:', dateString);
            return dateString;
        }
    };

    if (!log) return null;

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={isEditing ? 'Edit Log' : 'View Log'}
            dialogWidth="max-w-4xl"
            headerActions={
                <div className="flex gap-2">
                    <Badge variant="outline" className="capitalize">
                        {log.interval_type}
                    </Badge>
                    <Badge variant="outline">{formatIntervalTypeId(log.interval_type_id)}</Badge>
                    {log.is_shared_with_student && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            <Share2 className="size-3" />
                            Shared
                        </Badge>
                    )}
                    <Badge variant={log.status === 'ACTIVE' ? 'default' : 'destructive'}>
                        {log.status}
                    </Badge>
                </div>
            }
            footer={
                isEditing ? (
                    <>
                        <MyButton
                            buttonType="secondary"
                            onClick={handleCancel}
                            disabled={updateMutation.isPending}
                        >
                            <X className="mr-2 size-4" />
                            Cancel
                        </MyButton>
                        <MyButton onClick={handleSave} disabled={updateMutation.isPending}>
                            <Save className="mr-2 size-4" />
                            {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </MyButton>
                    </>
                ) : (
                    <MyButton onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 size-4" />
                        Edit
                    </MyButton>
                )
            }
        >
            <div className="space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium">Created By:</span>{' '}
                        <span className="text-muted-foreground">{log.created_by}</span>
                    </div>
                    <div>
                        <span className="font-medium">Created:</span>{' '}
                        <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
                    </div>
                </div>

                {/* Title */}
                <div>
                    {isEditing ? (
                        <MyInput
                            label="Title"
                            required
                            inputType="text"
                            inputPlaceholder="Enter title"
                            input={editedTitle}
                            onChangeFunction={(e) => setEditedTitle(e.target.value)}
                            className="w-full"
                        />
                    ) : (
                        <>
                            <MyLabel>Title</MyLabel>
                            <p className="mt-1 text-lg font-medium">{log.title}</p>
                        </>
                    )}
                </div>

                {/* Description */}
                {(isEditing || log.description) && (
                    <div>
                        {isEditing ? (
                            <>
                                <MyLabel>Description</MyLabel>
                                <Textarea
                                    value={editedDescription}
                                    onChange={(e) => setEditedDescription(e.target.value)}
                                    placeholder="Enter description (optional)"
                                    rows={3}
                                    className="mt-1"
                                />
                            </>
                        ) : (
                            <>
                                <MyLabel>Description</MyLabel>
                                <p className="mt-1 text-muted-foreground">{log.description}</p>
                            </>
                        )}
                    </div>
                )}

                {/* Share with learner */}
                {isEditing && (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="edit-share-with-learner"
                            checked={editedIsSharedWithStudent}
                            onCheckedChange={(checked) =>
                                setEditedIsSharedWithStudent(checked === true)
                            }
                        />
                        <label
                            htmlFor="edit-share-with-learner"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Share with learner
                        </label>
                    </div>
                )}

                {/* Content */}
                <div>
                    <MyLabel required>Content</MyLabel>
                    <div className="mt-2">
                        <Suspense fallback={<div className="h-32 w-full animate-pulse rounded bg-muted" />}>
                            <TipTapEditor
                                value={
                                    isEditing ? editedContent : unwrapContentFromHTML(log.content_html)
                                }
                                onChange={isEditing ? (html) => setEditedContent(html) : () => { }}
                                editable={isEditing}
                                placeholder="Enter content..."
                            />
                        </Suspense>
                    </div>
                </div>
            </div>
        </MyDialog>
    );
}
