import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DEFAULT_DRIP_SCHEDULE,
    type DripConditionBehavior,
    type DripConditionContentLevel,
    type DripConditionsSettings,
    type DripScheduleDefaults,
} from '@/types/course-settings';
import { Drop, Info, Warning } from '@phosphor-icons/react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DripConditionsCardProps {
    settings: DripConditionsSettings;
    onUpdate: (settings: DripConditionsSettings) => void;
}

const LEVEL_OPTIONS: Array<{ value: DripConditionContentLevel; label: string }> = [
    { value: 'subject', label: 'Subject' },
    { value: 'module', label: 'Module' },
    { value: 'chapter', label: 'Chapter' },
    { value: 'slide', label: 'Slide' },
];

/**
 * Institute-wide drip controls: the master switch, plus the starting point the
 * per-course "Schedule Unlock" generator opens with. Setting the house rule
 * here means a 30-day course is three clicks in the course itself.
 */
export const DripConditionsCard: React.FC<DripConditionsCardProps> = ({ settings, onUpdate }) => {
    const schedule: DripScheduleDefaults = {
        ...DEFAULT_DRIP_SCHEDULE,
        ...settings.scheduleDefaults,
    };

    const updateSchedule = (patch: Partial<DripScheduleDefaults>) =>
        onUpdate({ ...settings, scheduleDefaults: { ...schedule, ...patch } });

    // Rules already saved for this institute. Most were written while nothing
    // read them, so the admin needs to see the number before switching them on.
    const savedRuleCount = Array.isArray(settings.conditions) ? settings.conditions.length : 0;
    const isEnforcing = settings.applyConfiguredRules === true;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Drop className="size-5 text-blue-600" />
                        <CardTitle>Drip Conditions</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="drip-global-toggle">
                            {settings.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                            id="drip-global-toggle"
                            checked={settings.enabled}
                            onCheckedChange={(enabled) => onUpdate({ ...settings, enabled })}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                        Releases course content gradually instead of all at once. Set the schedule
                        per course from Course Details → Schedule Unlock, or per item from its
                        three-dot menu.
                    </AlertDescription>
                </Alert>

                {settings.enabled && (
                    <div className="space-y-4">
                        <div className="rounded-md border border-neutral-200 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="drip-enforce" className="font-medium">
                                        Apply unlock rules to learners
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Off means you can set rules up and preview them without
                                        anything changing for learners. Turn it on when the
                                        schedule is ready to go live.
                                    </p>
                                </div>
                                <Switch
                                    id="drip-enforce"
                                    checked={isEnforcing}
                                    onCheckedChange={(applyConfiguredRules) =>
                                        onUpdate({ ...settings, applyConfiguredRules })
                                    }
                                />
                            </div>

                            {!isEnforcing && savedRuleCount > 0 && (
                                <Alert className="mt-3 border-warning-300 bg-warning-50">
                                    <Warning className="size-4 text-warning-600" />
                                    <AlertDescription className="text-sm">
                                        This institute already has{' '}
                                        <strong>
                                            {savedRuleCount} saved rule
                                            {savedRuleCount === 1 ? '' : 's'}
                                        </strong>
                                        . Some may be old or unfinished — they have never affected
                                        learners. Switching this on applies all of them at once, so
                                        review them in each course first.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-neutral-900">
                                Default schedule
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                What the per-course scheduler starts from. Every course can still
                                override it.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="drip-level">Release one</Label>
                                <Select
                                    value={schedule.level}
                                    onValueChange={(value) =>
                                        updateSchedule({
                                            level: value as DripConditionContentLevel,
                                        })
                                    }
                                >
                                    <SelectTrigger id="drip-level">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LEVEL_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="drip-interval">Every … days</Label>
                                <Input
                                    id="drip-interval"
                                    type="number"
                                    min={1}
                                    value={schedule.intervalDays}
                                    onChange={(e) =>
                                        updateSchedule({
                                            intervalDays: Math.max(
                                                1,
                                                parseInt(e.target.value, 10) || 1
                                            ),
                                        })
                                    }
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="drip-start-day">First one opens on day</Label>
                                <Input
                                    id="drip-start-day"
                                    type="number"
                                    min={1}
                                    value={schedule.startDay}
                                    onChange={(e) =>
                                        updateSchedule({
                                            startDay: Math.max(
                                                1,
                                                parseInt(e.target.value, 10) || 1
                                            ),
                                        })
                                    }
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="drip-anchor">Counted from</Label>
                                <Select
                                    value={schedule.anchor}
                                    onValueChange={(value) =>
                                        updateSchedule({
                                            anchor: value as DripScheduleDefaults['anchor'],
                                        })
                                    }
                                >
                                    <SelectTrigger id="drip-anchor">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enrollment">
                                            Each learner&apos;s enrollment date
                                        </SelectItem>
                                        <SelectItem value="session_start">
                                            The batch start date
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="drip-time">Opens at</Label>
                                <Input
                                    id="drip-time"
                                    type="time"
                                    value={schedule.unlockTime}
                                    onChange={(e) =>
                                        updateSchedule({ unlockTime: e.target.value || '00:00' })
                                    }
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="drip-behavior">Until then</Label>
                                <Select
                                    value={schedule.behavior}
                                    onValueChange={(value) =>
                                        updateSchedule({ behavior: value as DripConditionBehavior })
                                    }
                                >
                                    <SelectTrigger id="drip-behavior">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lock">Show locked</SelectItem>
                                        <SelectItem value="hide">Hide completely</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
