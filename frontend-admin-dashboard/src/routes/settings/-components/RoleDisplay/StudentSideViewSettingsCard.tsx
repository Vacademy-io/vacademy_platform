import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type {
    StudentSideViewSettings,
    StudentSideViewVisibilityKey,
    StudentSideViewTabId,
} from '@/types/display-settings';
import {
    VISIBILITY_KEY_TO_TAB_ID,
    STUDENT_SIDE_VIEW_TAB_LABELS,
} from '@/constants/display-settings/student-side-view-tabs';

interface SideViewOption {
    key: StudentSideViewVisibilityKey;
    label: string;
}

interface StudentSideViewSettingsCardProps {
    options: SideViewOption[];
    settings: StudentSideViewSettings;
    defaults: StudentSideViewSettings;
    onChange: (next: StudentSideViewSettings) => void;
}

// Render a tab's order index. Tabs without an explicit order land at the
// end of the list (Number.MAX_SAFE_INTEGER) but keep relative input order.
const orderOf = (tabId: StudentSideViewTabId, orders?: StudentSideViewSettings['tabOrders']) =>
    orders?.[tabId] ?? Number.MAX_SAFE_INTEGER;

// Sort options by current `tabOrders` so the UI reflects the saved order.
function sortOptionsByOrder(
    opts: SideViewOption[],
    orders?: StudentSideViewSettings['tabOrders']
): SideViewOption[] {
    return [...opts].sort((a, b) => {
        const oa = orderOf(VISIBILITY_KEY_TO_TAB_ID[a.key], orders);
        const ob = orderOf(VISIBILITY_KEY_TO_TAB_ID[b.key], orders);
        return oa - ob;
    });
}

// Rebuild a tabOrders map from a sorted array so order numbers stay
// contiguous after a swap.
function buildOrdersFromSorted(opts: SideViewOption[]): StudentSideViewSettings['tabOrders'] {
    const next: StudentSideViewSettings['tabOrders'] = {};
    opts.forEach((opt, idx) => {
        next[VISIBILITY_KEY_TO_TAB_ID[opt.key]] = idx + 1;
    });
    return next;
}

export const StudentSideViewSettingsCard = ({
    options,
    settings,
    defaults,
    onChange,
}: StudentSideViewSettingsCardProps) => {
    const sortedOptions = useMemo(
        () => sortOptionsByOrder(options, settings.tabOrders),
        [options, settings.tabOrders]
    );

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= sortedOptions.length) return;
        const next = [...sortedOptions];
        [next[index], next[target]] = [next[target]!, next[index]!];
        onChange({
            ...settings,
            tabOrders: buildOrdersFromSorted(next),
        });
    };

    const setVisibility = (key: StudentSideViewVisibilityKey, visible: boolean) => {
        onChange({
            ...settings,
            [key]: visible,
        });
    };

    const setDefaultTab = (tabId: StudentSideViewTabId) => {
        onChange({
            ...settings,
            defaultTab: tabId,
        });
    };

    // Only tabs that are visible can be the default. Fall back to first
    // visible tab if the saved default is now hidden.
    const visibleTabs = sortedOptions.filter((opt) => {
        const v = settings[opt.key];
        return typeof v === 'boolean' ? v : (defaults[opt.key] as boolean);
    });

    const currentDefault: StudentSideViewTabId | undefined =
        settings.defaultTab &&
        visibleTabs.some((o) => VISIBILITY_KEY_TO_TAB_ID[o.key] === settings.defaultTab)
            ? settings.defaultTab
            : visibleTabs.length > 0
              ? VISIBILITY_KEY_TO_TAB_ID[visibleTabs[0]!.key]
              : undefined;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Student Side View Options</CardTitle>
                <CardDescription>
                    Configure which tabs are visible, their order, and which one opens by default in
                    the student side view.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {sortedOptions.map(({ key, label }, idx) => {
                    const visible = settings[key];
                    const checked =
                        typeof visible === 'boolean' ? visible : (defaults[key] as boolean);
                    return (
                        <div
                            key={key}
                            className="flex items-center justify-between gap-3 rounded border p-3"
                        >
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={() => move(idx, -1)}
                                    disabled={idx === 0}
                                    aria-label={`Move ${label} up`}
                                >
                                    <ArrowUp className="size-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={() => move(idx, 1)}
                                    disabled={idx === sortedOptions.length - 1}
                                    aria-label={`Move ${label} down`}
                                >
                                    <ArrowDown className="size-3.5" />
                                </Button>
                                <span className="ml-2 text-sm">{label}</span>
                            </div>
                            <Switch
                                checked={checked}
                                onCheckedChange={(v) => setVisibility(key, v)}
                            />
                        </div>
                    );
                })}

                <div className="mt-4 flex items-center justify-between gap-3 rounded border bg-neutral-50/50 p-3">
                    <div>
                        <Label className="text-sm font-medium">Default Tab</Label>
                        <p className="text-xs text-muted-foreground">
                            The tab that opens when the side view is first shown.
                        </p>
                    </div>
                    <Select
                        value={currentDefault ?? ''}
                        onValueChange={(v) => setDefaultTab(v as StudentSideViewTabId)}
                        disabled={visibleTabs.length === 0}
                    >
                        <SelectTrigger className="w-56">
                            <SelectValue placeholder="Select a tab" />
                        </SelectTrigger>
                        <SelectContent>
                            {visibleTabs.map((opt) => {
                                const tabId = VISIBILITY_KEY_TO_TAB_ID[opt.key];
                                return (
                                    <SelectItem key={tabId} value={tabId}>
                                        {STUDENT_SIDE_VIEW_TAB_LABELS[tabId] ?? opt.label}
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
};
