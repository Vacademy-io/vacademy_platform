import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    addUsersToTagByName,
    getUserTags,
    deactivateUserTags,
    type TagItem,
} from '@/services/tag-management';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { Users } from '@phosphor-icons/react';

export const StudentUserTagging = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();
    const [userTags, setUserTags] = useState<{ active: TagItem[]; inactive: TagItem[] } | null>(
        null
    );
    const [newTagInput, setNewTagInput] = useState('');
    const [tagsLoading, setTagsLoading] = useState(false);

    useEffect(() => {
        const loadUserTags = async () => {
            const id = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;
            if (!id) return;
            setTagsLoading(true);
            try {
                const res = await getUserTags(id);
                setUserTags({ active: res.activeTags || [], inactive: res.inactiveTags || [] });
            } catch (e) {
                setUserTags({ active: [], inactive: [] });
            } finally {
                setTagsLoading(false);
            }
        };
        loadUserTags();
    }, [selectedStudent?.id, selectedStudent?.user_id, isSubmissionTab]);

    const handleAddTag = async () => {
        if (!selectedStudent || !newTagInput.trim()) return;
        setTagsLoading(true);
        try {
            await addUsersToTagByName(newTagInput.trim(), [
                isSubmissionTab ? selectedStudent.id : selectedStudent.user_id,
            ]);
            const res = await getUserTags(
                isSubmissionTab ? selectedStudent.id : selectedStudent.user_id
            );
            setUserTags({
                active: res.activeTags || [],
                inactive: res.inactiveTags || [],
            });
            setNewTagInput('');
            toast.success('Tag added successfully');
        } catch (e) {
            toast.error('Failed to add tag');
        } finally {
            setTagsLoading(false);
        }
    };

    const handleRemoveTag = async (tagId: string) => {
        if (!selectedStudent) return;
        setTagsLoading(true);
        try {
            await deactivateUserTags(
                isSubmissionTab ? selectedStudent.id : selectedStudent.user_id,
                [tagId]
            );
            const res = await getUserTags(
                isSubmissionTab ? selectedStudent.id : selectedStudent.user_id
            );
            setUserTags({
                active: res.activeTags || [],
                inactive: res.inactiveTags || [],
            });
            toast.success('Tag removed successfully');
        } catch (err) {
            toast.error('Failed to remove tag');
        } finally {
            setTagsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Add Tag Section */}
            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-purple-50/30 p-4 transition-all duration-200 hover:border-purple-200/50 hover:shadow-md">
                <div className="mb-4 flex items-center gap-2">
                    <div className="rounded-md bg-gradient-to-br from-purple-50 to-purple-100 p-1.5">
                        <Users className="size-5 text-purple-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-neutral-700">Add User Tag</h4>
                </div>
                
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Label className="text-xs text-neutral-600">Tag name</Label>
                        <Input
                            className="mt-1 h-9 text-sm"
                            placeholder="e.g. VIP Student, High Performer"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddTag();
                                }
                            }}
                            disabled={tagsLoading}
                        />
                    </div>
                    <Button
                        size="sm"
                        disabled={tagsLoading || !newTagInput.trim() || !selectedStudent}
                        onClick={handleAddTag}
                        className="h-9"
                    >
                        {tagsLoading ? 'Adding...' : 'Add Tag'}
                    </Button>
                </div>
            </div>

            {/* Active Tags */}
            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-green-50/20 p-4 transition-all duration-200 hover:border-green-200/50 hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-neutral-700">Active Tags</h4>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {userTags?.active.length || 0}
                    </span>
                </div>
                {tagsLoading ? (
                    <div className="text-sm text-neutral-500">Loading...</div>
                ) : userTags && userTags.active.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {userTags.active.map((t) => (
                            <div
                                key={t.id}
                                className="group flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-800 transition-all hover:border-green-300 hover:bg-green-100"
                            >
                                <span className="font-medium">{t.tagName}</span>
                                {!t.defaultTag && (
                                    <button
                                        type="button"
                                        className="rounded-full p-0.5 text-green-600 transition-colors hover:bg-green-200 hover:text-green-800"
                                        onClick={() => handleRemoveTag(t.id)}
                                        disabled={tagsLoading}
                                        aria-label="Remove tag"
                                    >
                                        ×
                                    </button>
                                )}
                                {t.defaultTag && (
                                    <span className="text-xs text-green-600">(default)</span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-8">
                        <Users className="mb-2 size-8 text-neutral-400" />
                        <p className="text-sm text-neutral-500">No active tags</p>
                        <p className="text-xs text-neutral-400">Add a tag to get started</p>
                    </div>
                )}
            </div>

            {/* Inactive Tags */}
            <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-neutral-50/30 p-4 transition-all duration-200 hover:border-neutral-300/50 hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-neutral-700">Inactive Tags</h4>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        {userTags?.inactive.length || 0}
                    </span>
                </div>
                {tagsLoading ? (
                    <div className="text-sm text-neutral-500">Loading...</div>
                ) : userTags && userTags.inactive.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {userTags.inactive.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-600"
                            >
                                <span>{t.tagName}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-6">
                        <p className="text-sm text-neutral-500">No inactive tags</p>
                    </div>
                )}
            </div>
        </div>
    );
};
