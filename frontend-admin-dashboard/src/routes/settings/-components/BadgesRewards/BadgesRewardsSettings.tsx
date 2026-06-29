import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    BookOpen,
    Fire,
    Lightning,
    Star,
    Trophy,
    Medal,
    Crown,
    Rocket,
    Target,
    Heart,
    Confetti,
    GraduationCap,
    Lightbulb,
    Sparkle,
    Flag,
    CheckCircle,
    Plus,
    Trash,
    ArrowCounterClockwise,
    FloppyDisk,
    UploadSimple,
    Medal as MedalHeader,
    type IconProps,
} from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    BADGE_ICON_NAMES,
    BadgeDefinitionConfig,
    BadgeTriggerType,
    DEFAULT_BADGE_CONFIG,
    DEFAULT_SCORING,
    makeNewBadge,
    ScoringConfig,
    SCORING_FIELDS,
    TRIGGER_META,
    TRIGGER_OPTIONS,
} from '../../-constants/badge-config';
import { getBadgesRewardsConfig, saveBadgesSettings } from '../../-services/badges-settings';
import { BadgeVisual, isBuiltInBadgeIcon } from '../../-constants/badge-icon-map';
import { UploadFileInS3 } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';

const ICON_MAP: Record<string, React.FC<IconProps>> = {
    BookOpen,
    Fire,
    Lightning,
    Star,
    Trophy,
    Medal,
    Crown,
    Rocket,
    Target,
    Heart,
    Confetti,
    GraduationCap,
    Lightbulb,
    Sparkle,
    Flag,
    CheckCircle,
};

function BadgeIcon({ name, className }: { name: string; className?: string }) {
    const Icon = ICON_MAP[name] ?? Trophy;
    return <Icon weight="fill" className={className} />;
}

export default function BadgesRewardsSettings() {
    const queryClient = useQueryClient();
    const [badges, setBadges] = useState<BadgeDefinitionConfig[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['badges-settings'],
        queryFn: getBadgesRewardsConfig,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setBadges(data.badges);
            setEnabled(data.enabled);
            setScoring(data.scoring);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: (vars: {
            badges: BadgeDefinitionConfig[];
            enabled: boolean;
            scoring: ScoringConfig;
        }) => saveBadgesSettings(vars.badges, vars.enabled, vars.scoring),
        onSuccess: () => {
            toast.success('Badges saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['badges-settings'] });
        },
        onError: () => toast.error('Failed to save badges'),
    });

    const toggleEnabled = (v: boolean) => {
        setEnabled(v);
        setHasChanges(true);
    };

    const updateScoring = (key: keyof ScoringConfig, value: number) => {
        setScoring((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const updateBadge = (index: number, patch: Partial<BadgeDefinitionConfig>) => {
        setBadges((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
        setHasChanges(true);
    };

    const handleIconUpload = async (index: number, file: File | undefined) => {
        if (!file) return;
        try {
            const fileId = await UploadFileInS3(
                file,
                () => {},
                getUserId() || 'admin',
                'BADGE_ICON',
                'INSTITUTE',
                true
            );
            if (fileId) {
                updateBadge(index, { icon: fileId });
                toast.success('Image uploaded');
            }
        } catch {
            toast.error('Failed to upload image');
        }
    };

    const removeBadge = (index: number) => {
        setBadges((prev) => prev.filter((_, i) => i !== index));
        setHasChanges(true);
    };

    const addBadge = () => {
        setBadges((prev) => [...prev, makeNewBadge()]);
        setHasChanges(true);
    };

    const resetDefaults = () => {
        setBadges(DEFAULT_BADGE_CONFIG.badges.map((b) => ({ ...b })));
        setHasChanges(true);
    };

    const handleSave = () => {
        const invalid = badges.find((b) => !b.name.trim());
        if (invalid) {
            toast.error('Every badge needs a name');
            return;
        }
        save({ badges, enabled, scoring });
    };

    if (isLoading) {
        return <div className="flex items-center justify-center p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6 p-2">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="flex items-center gap-2 text-lg font-bold">
                        <MedalHeader className="size-6" weight="fill" />
                        Badges &amp; Rewards
                    </h1>
                    <p className="text-sm text-neutral-500">
                        Define the achievement badges learners can unlock on the gamified
                        dashboard. Pick what each badge is named, how it looks, and the condition
                        that unlocks it.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <MyButton buttonType="secondary" onClick={resetDefaults} disabled={saving}>
                        <ArrowCounterClockwise className="mr-2 size-4" />
                        Reset to defaults
                    </MyButton>
                    <MyButton onClick={handleSave} disabled={saving || !hasChanges}>
                        <FloppyDisk className="mr-2 size-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </MyButton>
                </div>
            </div>

            <Card>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-semibold">
                            Enable Badges &amp; Leaderboard
                        </Label>
                        <p className="text-xs text-neutral-500">
                            Master switch. When off, badges and the course leaderboard are hidden
                            everywhere — across the learner app and the admin Learning Reports
                            leaderboard tab.
                        </p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={toggleEnabled} />
                </CardContent>
            </Card>

            {hasChanges && (
                <div className="rounded-lg border border-warning-200 bg-warning-50 p-3">
                    <p className="text-sm text-warning-700">
                        You have unsaved changes. Don&apos;t forget to save.
                    </p>
                </div>
            )}

            {!enabled && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-600">
                        Badges &amp; leaderboard are currently <strong>disabled</strong> for this
                        institute. Turn the switch on to configure badges, points and the
                        leaderboard.
                    </p>
                </div>
            )}

            {enabled && (
                <>
                    <Card>
                <CardContent className="space-y-4 p-4">
                    <div>
                        <h2 className="text-base font-semibold text-neutral-800">
                            Points &amp; Scoring
                        </h2>
                        <p className="text-sm text-neutral-500">
                            How many points each action is worth. These drive the learner&apos;s
                            points &amp; level and the course leaderboard ranking. Set a factor to 0
                            to ignore it.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {SCORING_FIELDS.map((f) => (
                            <div key={f.key} className="space-y-1.5">
                                <Label className="text-sm">{f.label}</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        value={scoring[f.key]}
                                        onChange={(e) =>
                                            updateScoring(f.key, Number(e.target.value) || 0)
                                        }
                                        className="w-24"
                                    />
                                    <span className="text-xs text-neutral-400">points</span>
                                </div>
                                <p className="text-xs text-neutral-400">{f.help}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {badges.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <Trophy className="size-8 text-neutral-300" weight="fill" />
                        <p className="text-sm text-neutral-500">
                            No badges configured. Add one to get started.
                        </p>
                        <MyButton buttonType="secondary" onClick={addBadge}>
                            <Plus className="mr-2 size-4" />
                            Add Badge
                        </MyButton>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4">
                {badges.map((badge, index) => {
                    const meta = TRIGGER_META[badge.trigger];
                    return (
                        <Card key={badge.id} className={cn(!badge.enabled && 'opacity-60')}>
                            <CardContent className="space-y-4 p-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50">
                                        <BadgeVisual
                                            icon={badge.icon}
                                            fill
                                            className="size-6 text-primary-500"
                                        />
                                    </div>
                                    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-sm">Badge name</Label>
                                            <Input
                                                value={badge.name}
                                                placeholder="e.g. First Steps"
                                                onChange={(e) =>
                                                    updateBadge(index, { name: e.target.value })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm">Icon</Label>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <Select
                                                        value={
                                                            isBuiltInBadgeIcon(badge.icon)
                                                                ? badge.icon
                                                                : ''
                                                        }
                                                        onValueChange={(v) =>
                                                            updateBadge(index, { icon: v })
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Custom image" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {BADGE_ICON_NAMES.map((name) => (
                                                                <SelectItem key={name} value={name}>
                                                                    <span className="flex items-center gap-2">
                                                                        <BadgeIcon
                                                                            name={name}
                                                                            className="size-4 text-primary-500"
                                                                        />
                                                                        {name}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <label
                                                    title="Upload a custom image"
                                                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                                                >
                                                    <UploadSimple className="size-4" />
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) =>
                                                            handleIconUpload(
                                                                index,
                                                                e.target.files?.[0]
                                                            )
                                                        }
                                                    />
                                                </label>
                                            </div>
                                            {!isBuiltInBadgeIcon(badge.icon) && badge.icon && (
                                                <p className="text-xs text-neutral-400">
                                                    Custom image uploaded.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3 pt-7">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={badge.enabled}
                                                onCheckedChange={(v) =>
                                                    updateBadge(index, { enabled: v })
                                                }
                                            />
                                            <span className="text-xs text-neutral-500">
                                                {badge.enabled ? 'On' : 'Off'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeBadge(index)}
                                            className="rounded-md p-2 text-danger-500 hover:bg-danger-50"
                                            aria-label="Delete badge"
                                        >
                                            <Trash className="size-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm">Description</Label>
                                    <Input
                                        value={badge.description}
                                        placeholder="Shown on hover, e.g. Maintain a 7-day streak"
                                        onChange={(e) =>
                                            updateBadge(index, { description: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm">Unlocks based on</Label>
                                        <Select
                                            value={badge.trigger}
                                            onValueChange={(v) =>
                                                updateBadge(index, {
                                                    trigger: v as BadgeTriggerType,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TRIGGER_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm">
                                            Threshold ({meta.unit})
                                        </Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={badge.threshold}
                                            onChange={(e) =>
                                                updateBadge(index, {
                                                    threshold: Number(e.target.value) || 0,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-400">{meta.help}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {badges.length > 0 && (
                <MyButton buttonType="secondary" onClick={addBadge}>
                    <Plus className="mr-2 size-4" />
                    Add Badge
                </MyButton>
            )}
                </>
            )}
        </div>
    );
}
