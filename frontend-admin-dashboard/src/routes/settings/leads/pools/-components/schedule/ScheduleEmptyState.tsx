/**
 * Empty state for the Schedule tab: shows when the pool has TIME_BASED mode
 * but no shifts saved yet. Admin picks one of two authoring patterns. The
 * pattern is persisted to counselor_pool.schedule_pattern via PATCH and the
 * Schedule tab then renders the matching editor.
 *
 * Once any shift is saved, the pattern is locked. To change it, admin must
 * clear the schedule first (handled inside each editor).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import { useUpdatePool, type SchedulePattern } from '@/services/counselor-pool';
import { extractError } from './shared';

interface Props {
    poolId: string;
    /** Called after pattern is saved so parent can switch to the matching editor. */
    onPatternChosen: (pattern: SchedulePattern) => void;
}

export default function ScheduleEmptyState({ poolId, onPatternChosen }: Props) {
    const { mutate: updatePool, isPending } = useUpdatePool(poolId);
    const [pending, setPending] = useState<SchedulePattern | null>(null);

    const pick = (pattern: SchedulePattern) => {
        setPending(pattern);
        updatePool(
            { schedule_pattern: pattern },
            {
                onSuccess: () => {
                    setPending(null);
                    onPatternChosen(pattern);
                },
                onError: (err) => {
                    setPending(null);
                    toast.error(extractError(err) ?? 'Failed to set schedule pattern');
                },
            }
        );
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Choose a schedule pattern</CardTitle>
                    <CardDescription>
                        Pick how you want to author this pool&apos;s weekly schedule. You can
                        change this later, but only after clearing the schedule.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <PatternCard
                    title="Custom per day"
                    description="Each day of the week is authored independently. Each day can be one whole-day block or split into multiple shifts."
                    example="Mon 09:00–18:00 Amit, Tue 09:00–13:00 Bhavna + 13:00–18:00 Charlie, Wed 09:00–18:00 Diya, …"
                    onChoose={() => pick('PER_DAY')}
                    isPending={isPending && pending === 'PER_DAY'}
                />
                <PatternCard
                    title="Same hours every day"
                    description="Define one set of blocks that repeats across all 7 days. Useful when shifts don't vary by day."
                    example="09:00–12:00 Amit, 12:00–18:00 Bhavna, 18:00–09:00 Charlie — applied to Mon through Sun."
                    onChoose={() => pick('SAME_HOURS_ALL_DAYS')}
                    isPending={isPending && pending === 'SAME_HOURS_ALL_DAYS'}
                />
            </div>
        </div>
    );
}

interface PatternCardProps {
    title: string;
    description: string;
    example: string;
    onChoose: () => void;
    isPending: boolean;
}

function PatternCard({ title, description, example, onChoose, isPending }: PatternCardProps) {
    return (
        <Card className="flex h-full flex-col">
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="rounded bg-neutral-50 p-3 text-xs text-muted-foreground">
                    <span className="block font-medium text-neutral-700">Example</span>
                    {example}
                </p>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={onChoose}
                    disable={isPending}
                >
                    {isPending ? 'Setting…' : `Use ${title}`}
                </MyButton>
            </CardContent>
        </Card>
    );
}
