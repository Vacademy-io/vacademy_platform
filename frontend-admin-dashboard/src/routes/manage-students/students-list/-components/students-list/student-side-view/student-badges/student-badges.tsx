import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Trophy, X, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { ProfileSectionCard, ProfileSkeleton, ProfileError } from '../profile-ui';
import {
    getStudentAwardedBadges,
    awardBadge,
    revokeBadge,
    type LearnerBadgeAward,
} from '@/services/student-badges';
import { getBadgesSettings } from '@/routes/settings/-services/badges-settings';
import type { BadgeDefinitionConfig } from '@/routes/settings/-constants/badge-config';
import { BadgeVisual } from '@/routes/settings/-constants/badge-icon-map';

function BadgeGlyph({
    name,
    className,
    fill,
}: {
    name: string;
    className?: string;
    fill?: boolean;
}) {
    return <BadgeVisual icon={name} className={className} fill={fill} />;
}

export const StudentBadges = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();
    const [awards, setAwards] = useState<LearnerBadgeAward[] | null>(null);
    const [catalog, setCatalog] = useState<BadgeDefinitionConfig[]>([]);
    const [selectedBadgeId, setSelectedBadgeId] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;

    const load = async () => {
        if (!userId) return;
        setLoading(true);
        setLoadError(false);
        try {
            const [awarded, badges] = await Promise.all([
                getStudentAwardedBadges(userId),
                getBadgesSettings(),
            ]);
            setAwards(awarded);
            setCatalog(badges.filter((b) => b.enabled));
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [selectedStudent?.id, selectedStudent?.user_id, isSubmissionTab]);

    const handleAward = async () => {
        if (!userId || !selectedBadgeId || !reason.trim()) return;
        const badge = catalog.find((b) => b.id === selectedBadgeId);
        if (!badge) return;
        setLoading(true);
        try {
            await awardBadge({
                userIds: [userId],
                badgeId: badge.id,
                badgeName: badge.name,
                badgeIcon: badge.icon,
                badgeDescription: badge.description,
                reason: reason.trim(),
            });
            setAwards(await getStudentAwardedBadges(userId));
            setSelectedBadgeId('');
            setReason('');
            toast.success('Badge awarded');
        } catch {
            toast.error('Failed to award badge');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (badgeId: string) => {
        if (!userId) return;
        setLoading(true);
        try {
            await revokeBadge(userId, badgeId);
            setAwards(await getStudentAwardedBadges(userId));
            toast.success('Badge revoked');
        } catch {
            toast.error('Failed to revoke badge');
        } finally {
            setLoading(false);
        }
    };

    if (loading && awards === null) {
        return <ProfileSkeleton blocks={2} />;
    }

    if (loadError) {
        return (
            <ProfileError
                title="Couldn't load badges"
                hint="Something went wrong while fetching this learner's badges."
                onRetry={load}
            />
        );
    }

    const awarded = awards ?? [];
    const canAward = Boolean(selectedBadgeId) && reason.trim().length > 0 && !loading;

    return (
        <div className="flex flex-col gap-3">
            <ProfileSectionCard
                icon={Trophy as PhosphorIcon}
                heading="Award a badge"
            >
                {catalog.length === 0 ? (
                    <p className="text-caption italic text-muted-foreground">
                        No badges configured yet. Add them in Settings → Badges &amp; Rewards first.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-caption font-medium text-neutral-600">
                                Badge
                            </Label>
                            <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a badge to award" />
                                </SelectTrigger>
                                <SelectContent>
                                    {catalog.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            <span className="flex items-center gap-2">
                                                <BadgeGlyph
                                                    name={b.icon}
                                                    className="size-4 text-primary-500"
                                                />
                                                {b.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <MyInput
                                label="Reason"
                                required
                                inputPlaceholder="e.g. Top scorer in the unit test"
                                input={reason}
                                onChangeFunction={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canAward) handleAward();
                                }}
                                disabled={loading}
                                className="w-full"
                            />
                            {Boolean(selectedBadgeId) && !reason.trim() && (
                                <p className="text-caption text-danger-600">
                                    A reason is required to award this badge.
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                disable={!canAward}
                                onAsyncClick={handleAward}
                            >
                                Award Badge
                            </MyButton>
                        </div>
                    </div>
                )}
            </ProfileSectionCard>

            <ProfileSectionCard
                icon={Trophy as PhosphorIcon}
                heading="Awarded badges"
                action={
                    awarded.length > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-caption font-semibold text-primary-700 ring-1 ring-primary-200">
                            {awarded.length}
                        </span>
                    ) : undefined
                }
            >
                {awarded.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {awarded.map((a) => (
                            <div
                                key={a.id}
                                className="flex items-start gap-3 rounded-lg border border-neutral-200 p-2.5"
                            >
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50">
                                    <BadgeGlyph
                                        name={a.badgeIcon || 'Trophy'}
                                        fill
                                        className="size-5 text-primary-500"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-body font-semibold text-neutral-700">
                                        {a.badgeName || a.badgeId}
                                    </p>
                                    {a.reason && (
                                        <p className="text-caption text-muted-foreground">
                                            {a.reason}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className={cn(
                                        'shrink-0 rounded-full p-1 text-danger-500 hover:bg-danger-50',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-400 disabled:opacity-50'
                                    )}
                                    onClick={() => handleRevoke(a.badgeId)}
                                    disabled={loading}
                                    aria-label={`Revoke ${a.badgeName || 'badge'}`}
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-caption italic text-muted-foreground">
                        No badges awarded yet — recognise this learner with a badge above.
                    </p>
                )}
            </ProfileSectionCard>
        </div>
    );
};
