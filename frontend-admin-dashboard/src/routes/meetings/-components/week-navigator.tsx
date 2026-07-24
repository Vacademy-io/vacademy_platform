import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';

export const weekBoundsFor = (anchor: Date) => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    return { start, end };
};

interface WeekNavigatorProps {
    weekStart: Date;
    onChange: (newAnchor: Date) => void;
}

export const WeekNavigator = ({ weekStart, onChange }: WeekNavigatorProps) => {
    const { start, end } = weekBoundsFor(weekStart);
    const sameYear = start.getFullYear() === end.getFullYear();
    const label = `${format(start, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <MyButton
                type="button"
                buttonType="secondary"
                scale="small"
                layoutVariant="icon"
                title="Previous week"
                onClick={() => onChange(addWeeks(start, -1))}
            >
                <CaretLeft className="size-3.5" />
            </MyButton>
            <MyButton
                type="button"
                buttonType="secondary"
                scale="small"
                className="sm:min-w-0"
                onClick={() => onChange(new Date())}
            >
                Today
            </MyButton>
            <MyButton
                type="button"
                buttonType="secondary"
                scale="small"
                layoutVariant="icon"
                title="Next week"
                onClick={() => onChange(addWeeks(start, 1))}
            >
                <CaretRight className="size-3.5" />
            </MyButton>
            <span className="text-body font-semibold text-neutral-600">{label}</span>
        </div>
    );
};
