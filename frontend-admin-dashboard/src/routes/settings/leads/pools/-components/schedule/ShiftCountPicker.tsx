/**
 * Quick-create picker for shift blocks. Shown when a multi-shift day (UI A)
 * or the daily template (UI B) is empty. Admin picks 2/3/4 evenly-spaced
 * shifts or "Custom" to fall back to the manual + Add Shift flow.
 *
 * The generated blocks have empty counsellor lists and the last block always
 * ends at 23:59:59 — so the admin never has to figure out the second-precision
 * end-of-day trap by hand.
 */

import { MyButton } from '@/components/design-system/button';
import { END_OF_DAY, cryptoRandom, type EditableShift } from './shared';

interface Props {
    onPick: (shifts: EditableShift[]) => void;
}

export default function ShiftCountPicker({ onPick }: Props) {
    return (
        <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-4">
            <p className="mb-3 text-sm text-neutral-700">
                How many shifts on this day?
            </p>
            <div className="flex flex-wrap gap-2">
                {[2, 3, 4].map((n) => (
                    <MyButton
                        key={n}
                        buttonType="secondary"
                        scale="small"
                        onClick={() => onPick(evenlyDividedBlocks(n))}
                    >
                        {n} shifts
                    </MyButton>
                ))}
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => onPick([customBlock()])}
                >
                    Custom
                </MyButton>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                You can adjust the times and add counsellors after picking.
            </p>
        </div>
    );
}

/**
 * Generate `n` evenly-spaced shift blocks tiling 24h. Hours divide evenly
 * for n ∈ {2, 3, 4} (the only options exposed); the last block always ends
 * at 23:59:59 so the schedule reaches end-of-day cleanly.
 */
export function evenlyDividedBlocks(n: number): EditableShift[] {
    if (n < 1) return [];
    const blocks: EditableShift[] = [];
    for (let i = 0; i < n; i++) {
        const startHour = Math.floor((i * 24) / n);
        const endHour = Math.floor(((i + 1) * 24) / n);
        const isLast = i === n - 1;
        blocks.push({
            localId: cryptoRandom(),
            startTime: `${pad2(startHour)}:00:00`,
            endTime: isLast ? END_OF_DAY : `${pad2(endHour)}:00:00`,
            counselorUserIds: [],
        });
    }
    return blocks;
}

/** Single empty block for the "Custom" path — same default as the previous + Add Shift. */
function customBlock(): EditableShift {
    return {
        localId: cryptoRandom(),
        startTime: '09:00:00',
        endTime: '12:00:00',
        counselorUserIds: [],
    };
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}
