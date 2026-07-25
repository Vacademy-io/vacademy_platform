import { useCallback } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { type CodingTestCase, effectiveAccepted } from '../utils/code-editor-types';

interface Props {
    testCases: CodingTestCase[];
    onChange: (next: CodingTestCase[]) => void;
    maxPoints?: number;
    disabled?: boolean;
}

function newCase(idx: number, visible: boolean): CodingTestCase {
    return {
        id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `tc-${Date.now()}-${idx}`,
        label: visible ? `Sample ${idx + 1}` : `Hidden ${idx + 1}`,
        stdin: '',
        expectedStdout: '',
        visible,
    };
}

export function TestCaseList({ testCases, onChange, maxPoints, disabled }: Props) {
    const add = useCallback(
        (visible: boolean) => {
            const sameKind = testCases.filter((t) => t.visible === visible).length;
            onChange([...testCases, newCase(sameKind, visible)]);
        },
        [testCases, onChange]
    );

    const update = useCallback(
        (id: string, patch: Partial<CodingTestCase>) => {
            onChange(testCases.map((t) => (t.id === id ? { ...t, ...patch } : t)));
        },
        [testCases, onChange]
    );

    const remove = useCallback(
        (id: string) => {
            onChange(testCases.filter((t) => t.id !== id));
        },
        [testCases, onChange]
    );

    const sampleCount = testCases.filter((t) => t.visible).length;
    const hiddenCount = testCases.length - sampleCount;
    const perHiddenMark =
        maxPoints && hiddenCount > 0 ? Number((maxPoints / hiddenCount).toFixed(2)) : null;
    const perSampleMark =
        maxPoints && sampleCount > 0 ? Number((maxPoints / sampleCount).toFixed(2)) : null;

    return (
        <div className="space-y-3">
            {testCases.length > 0 &&
                (hiddenCount > 0 ? (
                    <div className="rounded-md border border-primary-100 bg-primary-50 p-3 text-xs text-neutral-600">
                        <span className="font-semibold text-primary-600">How this is graded: </span>
                        Marks are awarded on the {hiddenCount} hidden test case
                        {hiddenCount === 1 ? '' : 's'}
                        {perHiddenMark !== null
                            ? ` — ${maxPoints} marks ÷ ${hiddenCount} = ${perHiddenMark} per hidden test passed`
                            : ' — full marks split equally across hidden tests'}
                        . Sample tests only let learners check their output format and do not affect
                        the score.
                    </div>
                ) : (
                    <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
                        <span className="font-semibold">⚠ No hidden test cases. </span>
                        Marks will fall back to your {sampleCount} sample test
                        {sampleCount === 1 ? '' : 's'}
                        {perSampleMark !== null
                            ? ` (${maxPoints} marks ÷ ${sampleCount} = ${perSampleMark} each)`
                            : ''}
                        {' '}— but learners can see sample expected outputs, so they can score full
                        marks without solving the problem. Add a hidden test case.
                    </div>
                ))}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {sampleCount} sample · {hiddenCount} hidden · {testCases.length} total
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => add(true)}
                        disabled={disabled}
                    >
                        <Plus className="mr-1 size-3" />
                        Sample
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => add(false)}
                        disabled={disabled}
                    >
                        <Plus className="mr-1 size-3" />
                        Hidden
                    </Button>
                </div>
            </div>

            {testCases.length === 0 ? (
                <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No test cases yet. Add at least one sample case so learners can see the expected
                    input/output format.
                </div>
            ) : (
                <div className="space-y-3">
                    {testCases.map((tc, i) => (
                        <div key={tc.id} className="rounded border bg-card p-3 shadow-sm">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                    #{i + 1}
                                </span>
                                <Input
                                    value={tc.label || ''}
                                    onChange={(e) => update(tc.id, { label: e.target.value })}
                                    placeholder="Label (optional)"
                                    className="h-7 max-w-[200px] text-sm"
                                    disabled={disabled}
                                />
                                <div className="ml-auto flex items-center gap-2">
                                    <Label className="flex items-center gap-1 text-xs">
                                        {tc.visible ? (
                                            <Eye className="size-3 text-green-600" />
                                        ) : (
                                            <EyeOff className="size-3 text-gray-500" />
                                        )}
                                        {tc.visible ? 'Sample' : 'Hidden'}
                                    </Label>
                                    <Switch
                                        checked={tc.visible}
                                        onCheckedChange={(v) => update(tc.id, { visible: v })}
                                        disabled={disabled}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => remove(tc.id)}
                                        disabled={disabled}
                                        className="text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <div>
                                    <Label className="text-xs">Standard Input</Label>
                                    <Textarea
                                        value={tc.stdin}
                                        onChange={(e) => update(tc.id, { stdin: e.target.value })}
                                        placeholder="(empty)"
                                        rows={3}
                                        className="font-mono text-xs"
                                        disabled={disabled}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Accepted outputs</Label>
                                    <div className="space-y-1">
                                        {effectiveAccepted(tc).map((out, idx) => (
                                            <div key={idx} className="flex items-start gap-1">
                                                <Textarea
                                                    value={out}
                                                    onChange={(e) => {
                                                        const arr = [...effectiveAccepted(tc)];
                                                        arr[idx] = e.target.value;
                                                        update(tc.id, {
                                                            acceptedOutputs: arr,
                                                            expectedStdout: arr[0] ?? '',
                                                        });
                                                    }}
                                                    placeholder={
                                                        idx === 0
                                                            ? 'Expected program output'
                                                            : 'Alternative accepted output'
                                                    }
                                                    rows={3}
                                                    className="font-mono text-xs"
                                                    disabled={disabled}
                                                />
                                                {effectiveAccepted(tc).length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            const arr = effectiveAccepted(tc).filter(
                                                                (_, i) => i !== idx
                                                            );
                                                            update(tc.id, {
                                                                acceptedOutputs: arr,
                                                                expectedStdout: arr[0] ?? '',
                                                            });
                                                        }}
                                                        disabled={disabled}
                                                        className="text-red-600 hover:bg-red-50"
                                                        title="Remove this accepted output"
                                                    >
                                                        <Trash2 className="size-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const arr = [...effectiveAccepted(tc), ''];
                                            update(tc.id, {
                                                acceptedOutputs: arr,
                                                expectedStdout: arr[0] ?? '',
                                            });
                                        }}
                                        disabled={disabled}
                                        className="mt-1"
                                    >
                                        <Plus className="mr-1 size-3" />
                                        Add acceptable output
                                    </Button>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Passes if the program output matches any listed value (after
                                        trimming).
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
