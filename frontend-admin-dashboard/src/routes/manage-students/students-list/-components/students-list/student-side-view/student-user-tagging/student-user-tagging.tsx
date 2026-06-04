import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import {
    addUsersToTagByName,
    getUserTags,
    deactivateUserTags,
    type TagItem,
} from '@/services/tag-management';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { Tag, X, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
    ProfileHero,
    ProfileSectionCard,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
} from '../profile-ui';

export const StudentUserTagging = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();
    const [userTags, setUserTags] = useState<{ active: TagItem[]; inactive: TagItem[] } | null>(
        null
    );
    const [newTagInput, setNewTagInput] = useState('');
    const [tagsLoading, setTagsLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;

    const loadUserTags = async () => {
        if (!userId) return;
        setTagsLoading(true);
        setLoadError(false);
        try {
            const res = await getUserTags(userId);
            setUserTags({ active: res.activeTags || [], inactive: res.inactiveTags || [] });
        } catch {
            setLoadError(true);
        } finally {
            setTagsLoading(false);
        }
    };

    useEffect(() => {
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
        } catch {
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
        } catch {
            toast.error('Failed to remove tag');
        } finally {
            setTagsLoading(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (tagsLoading && userTags === null) {
        return <ProfileSkeleton blocks={2} />;
    }

    // ── Error state ───────────────────────────────────────────────────────────
    if (loadError) {
        return (
            <ProfileError
                title="Couldn't load tags"
                hint="Something went wrong while fetching tags for this learner."
                onRetry={loadUserTags}
            />
        );
    }

    const activeTags = userTags?.active ?? [];
    const inactiveTags = userTags?.inactive ?? [];
    const activeCount = activeTags.length;
    const heroTitle =
        activeCount === 0
            ? 'No tags yet'
            : `${activeCount} active tag${activeCount === 1 ? '' : 's'}`;

    return (
        <div className="flex flex-col gap-3">
            {/* Hero: eyebrow + count title + type-ahead input */}
            <ProfileHero
                eyebrow="TAGS"
                title={heroTitle}
                subtitle="Search or add a tag"
                icon={Tag as PhosphorIcon}
                tone="primary"
            >
                <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                        <MyInput
                            label="Tag name"
                            inputPlaceholder="e.g. VIP Student, High Performer"
                            input={newTagInput}
                            onChangeFunction={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTag();
                            }}
                            disabled={tagsLoading}
                            className="w-full"
                        />
                    </div>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={tagsLoading || !newTagInput.trim() || !selectedStudent}
                        onAsyncClick={handleAddTag}
                        className="shrink-0 self-end"
                    >
                        Add
                    </MyButton>
                </div>
            </ProfileHero>

            {/* Active Tags */}
            <ProfileSectionCard
                icon={Tag as PhosphorIcon}
                heading="Active Tags"
                action={
                    activeCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
                            {activeCount}
                        </span>
                    ) : undefined
                }
            >
                {activeCount > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {activeTags.map((t) => (
                            <span
                                key={t.id}
                                className={cn(
                                    'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1',
                                    'bg-primary-50 text-xs font-medium text-primary-700 ring-1 ring-primary-200'
                                )}
                                title={t.tagName}
                            >
                                <span className="truncate">{t.tagName}</span>
                                {t.defaultTag ? (
                                    <span className="shrink-0 text-primary-400">(default)</span>
                                ) : (
                                    <button
                                        type="button"
                                        className="shrink-0 rounded-full p-0.5 text-primary-500 hover:bg-primary-100 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
                                        onClick={() => handleRemoveTag(t.id)}
                                        disabled={tagsLoading}
                                        aria-label={`Remove tag ${t.tagName}`}
                                    >
                                        <X className="size-3" />
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                ) : (
                    <ProfileEmpty
                        icon={Tag as PhosphorIcon}
                        title="No active tags"
                        hint="Add a tag above to get started"
                    />
                )}
            </ProfileSectionCard>

            {/* Inactive Tags */}
            {inactiveTags.length > 0 && (
                <ProfileSectionCard
                    icon={Tag as PhosphorIcon}
                    heading="Inactive Tags"
                    action={
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200">
                            {inactiveTags.length}
                        </span>
                    }
                >
                    <div className="flex flex-wrap gap-2">
                        {inactiveTags.map((t) => (
                            <span
                                key={t.id}
                                className="inline-flex max-w-full items-center truncate rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200"
                                title={t.tagName}
                            >
                                {t.tagName}
                            </span>
                        ))}
                    </div>
                </ProfileSectionCard>
            )}
        </div>
    );
};
