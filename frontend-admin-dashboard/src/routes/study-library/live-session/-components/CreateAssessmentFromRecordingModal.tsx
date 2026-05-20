import { useEffect, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import {
    FileText,
    Languages,
    Loader2,
    AlertTriangle,
    Users,
    CheckCircle2,
    Sparkles,
    Info,
} from 'lucide-react';
import {
    createAssessmentFromRecording,
    type AssessmentArtifact,
    type CreateAssessmentFromRecordingRequest,
} from '../-services/utils';

interface BatchSummary {
    package_session_id: string;
    package_name: string;
    level_name?: string;
    session_name?: string;
}

interface CreateAssessmentFromRecordingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    scheduleId: string;
    recordingId: string;
    detectedLanguage?: string;
    batches?: BatchSummary[];
}

/**
 * Two-state modal:
 *   - Form state — teacher fills date/marks/visibility, clicks Generate.
 *   - Preview state — shows generated title + questions in a scrollable list.
 *
 * All visual tokens use the institute theme (primary-500/100/50) and shadcn
 * primitives so a re-skinned institute automatically picks up new colors.
 */
export function CreateAssessmentFromRecordingModal({
    open,
    onOpenChange,
    scheduleId,
    recordingId,
    detectedLanguage,
    batches,
}: CreateAssessmentFromRecordingModalProps) {
    const [startDateTime, setStartDateTime] = useState<string>(defaultStartDateTime());
    const [endDateTime, setEndDateTime] = useState<string>(defaultEndDateTime());
    const [marksPerQuestion, setMarksPerQuestion] = useState<number>(4);
    const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState<boolean>(false);
    const [negativeMarkPerQuestion, setNegativeMarkPerQuestion] = useState<number>(1);
    const [numQuestions, setNumQuestions] = useState<number>(20);
    const [durationMinutes, setDurationMinutes] = useState<number>(60);
    const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
    const [result, setResult] = useState<AssessmentArtifact | null>(null);

    useEffect(() => {
        if (!open) {
            setResult(null);
            setStartDateTime(defaultStartDateTime());
            setEndDateTime(defaultEndDateTime());
            setMarksPerQuestion(4);
            setNegativeMarkingEnabled(false);
            setNegativeMarkPerQuestion(1);
            setNumQuestions(20);
            setDurationMinutes(60);
            setVisibility('PRIVATE');
        }
    }, [open]);

    const { mutate, isPending } = useMutation({
        mutationFn: (body: CreateAssessmentFromRecordingRequest) =>
            createAssessmentFromRecording(scheduleId, recordingId, body),
        onSuccess: (data) => {
            setResult(data);
            if (data.status === 'COMPLETED') {
                toast.success(`Generated ${data.questions?.length ?? 0} questions`);
            } else if (data.status === 'FAILED') {
                toast.error(data.errorMessage ?? 'Generation failed');
            }
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
                ?.message;
            toast.error(msg ?? 'Could not create assessment');
        },
    });

    const handleSubmit = () => {
        if (!startDateTime || !endDateTime) {
            toast.error('Start and end datetime are required');
            return;
        }
        if (new Date(endDateTime) <= new Date(startDateTime)) {
            toast.error('End datetime must be after start datetime');
            return;
        }
        if (numQuestions < 1 || numQuestions > 50) {
            toast.error('Number of questions must be between 1 and 50');
            return;
        }
        mutate({
            startDateTime,
            endDateTime,
            marksPerQuestion,
            negativeMarkingEnabled,
            negativeMarkPerQuestion: negativeMarkingEnabled ? negativeMarkPerQuestion : undefined,
            numQuestions,
            durationMinutes,
            assessmentVisibility: visibility,
        });
    };

    const isPreview = result !== null && result.status === 'COMPLETED';
    const isFailed = result !== null && result.status === 'FAILED';
    const isForm = !isPreview && !isFailed && !isPending;

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={isPreview ? 'Assessment Preview' : 'Create Assessment from Recording'}
            dialogWidth="max-w-3xl"
        >
            <div className="flex flex-col gap-4 px-6 py-5">
                {/* Context banners — always visible in form state */}
                {isForm && (
                    <div className="flex flex-col gap-3">
                        {detectedLanguage && (
                            <Alert className="border-primary-200 bg-primary-50 text-primary-700">
                                <Languages className="size-4 text-primary-500" />
                                <AlertDescription className="ml-2 text-sm">
                                    Questions will be generated in the detected language:{' '}
                                    <span className="font-semibold uppercase">{detectedLanguage}</span>
                                </AlertDescription>
                            </Alert>
                        )}

                        {batches && batches.length > 0 ? (
                            <Alert className="border-primary-100 bg-primary-50/60">
                                <Users className="size-4 text-primary-500" />
                                <AlertDescription className="ml-2 text-sm text-neutral-700">
                                    <div className="mb-1.5 font-medium text-neutral-800">
                                        Assigned to {batches.length}{' '}
                                        {batches.length === 1 ? 'batch' : 'batches'}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {batches.map((b) => (
                                            <Badge
                                                key={b.package_session_id}
                                                variant="outline"
                                                className="border-primary-200 bg-white text-xs font-normal text-neutral-700"
                                            >
                                                {b.package_name}
                                                {b.session_name && (
                                                    <span className="ml-1 text-neutral-500">
                                                        · {b.session_name}
                                                    </span>
                                                )}
                                            </Badge>
                                        ))}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ) : batches && batches.length === 0 ? (
                            <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-900">
                                <AlertTriangle className="size-4 text-amber-600" />
                                <AlertDescription className="ml-2 text-sm">
                                    This live session isn&apos;t attached to any batch — the assessment
                                    will be generated but not auto-assigned to learners.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </div>
                )}

                {/* Form fields */}
                {isForm && <FormFields
                    startDateTime={startDateTime}
                    setStartDateTime={setStartDateTime}
                    endDateTime={endDateTime}
                    setEndDateTime={setEndDateTime}
                    marksPerQuestion={marksPerQuestion}
                    setMarksPerQuestion={setMarksPerQuestion}
                    negativeMarkingEnabled={negativeMarkingEnabled}
                    setNegativeMarkingEnabled={setNegativeMarkingEnabled}
                    negativeMarkPerQuestion={negativeMarkPerQuestion}
                    setNegativeMarkPerQuestion={setNegativeMarkPerQuestion}
                    numQuestions={numQuestions}
                    setNumQuestions={setNumQuestions}
                    durationMinutes={durationMinutes}
                    setDurationMinutes={setDurationMinutes}
                    visibility={visibility}
                    setVisibility={setVisibility}
                />}

                {/* Loading state */}
                {isPending && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                        <div className="relative">
                            <div className="absolute inset-0 size-12 animate-ping rounded-full bg-primary-200/60" />
                            <div className="relative flex size-12 items-center justify-center rounded-full bg-primary-50">
                                <Sparkles className="size-5 text-primary-500" />
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-medium text-neutral-800">
                                Generating {numQuestions} questions with AI
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                                Typically takes 15–45 seconds. Please don&apos;t close this window.
                            </div>
                        </div>
                        <Loader2 className="size-4 animate-spin text-primary-500" />
                    </div>
                )}

                {/* Preview pane */}
                {isPreview && <PreviewPane result={result!} batches={batches} />}

                {/* Failure state */}
                {isFailed && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertTriangle className="size-4 text-red-600" />
                        <AlertDescription className="ml-2">
                            <div className="font-medium text-red-800">Generation failed</div>
                            <div className="mt-1 text-xs text-red-700">
                                {result?.errorMessage ?? 'Unknown error'}
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t bg-neutral-50 px-6 py-3">
                <MyButton
                    buttonType="secondary"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                >
                    {isPreview ? 'Close' : 'Cancel'}
                </MyButton>
                {isForm && (
                    <MyButton onClick={handleSubmit} disabled={isPending}>
                        <Sparkles className="size-3.5" />
                        Generate Assessment
                    </MyButton>
                )}
                {isFailed && <MyButton onClick={() => setResult(null)}>Try Again</MyButton>}
            </div>
        </MyDialog>
    );
}

// -------------------------------------------------------------------------
// Form fields
// -------------------------------------------------------------------------

function FormFields(props: {
    startDateTime: string;
    setStartDateTime: (v: string) => void;
    endDateTime: string;
    setEndDateTime: (v: string) => void;
    marksPerQuestion: number;
    setMarksPerQuestion: (v: number) => void;
    negativeMarkingEnabled: boolean;
    setNegativeMarkingEnabled: (v: boolean) => void;
    negativeMarkPerQuestion: number;
    setNegativeMarkPerQuestion: (v: number) => void;
    numQuestions: number;
    setNumQuestions: (v: number) => void;
    durationMinutes: number;
    setDurationMinutes: (v: number) => void;
    visibility: 'PRIVATE' | 'PUBLIC';
    setVisibility: (v: 'PRIVATE' | 'PUBLIC') => void;
}) {
    return (
        <div className="flex flex-col gap-4">
            {/* Section: Schedule */}
            <FieldGroup label="Schedule">
                <div className="grid grid-cols-2 gap-3">
                    <Field id="start-dt" label="Start date & time">
                        <Input
                            id="start-dt"
                            type="datetime-local"
                            value={props.startDateTime}
                            onChange={(e) => props.setStartDateTime(e.target.value)}
                        />
                    </Field>
                    <Field id="end-dt" label="End date & time">
                        <Input
                            id="end-dt"
                            type="datetime-local"
                            value={props.endDateTime}
                            onChange={(e) => props.setEndDateTime(e.target.value)}
                        />
                    </Field>
                </div>
            </FieldGroup>

            <Separator />

            {/* Section: Marking */}
            <FieldGroup label="Marking">
                <div className="grid grid-cols-2 gap-3">
                    <Field id="marks" label="Marks per question">
                        <Input
                            id="marks"
                            type="number"
                            min={1}
                            value={props.marksPerQuestion}
                            onChange={(e) =>
                                props.setMarksPerQuestion(parseInt(e.target.value, 10) || 1)
                            }
                        />
                    </Field>
                    <Field id="duration" label="Duration (minutes)">
                        <Input
                            id="duration"
                            type="number"
                            min={5}
                            value={props.durationMinutes}
                            onChange={(e) =>
                                props.setDurationMinutes(parseInt(e.target.value, 10) || 60)
                            }
                        />
                    </Field>
                </div>

                <Card className="border-dashed">
                    <CardContent className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <Switch
                            id="negmarking"
                            checked={props.negativeMarkingEnabled}
                            onCheckedChange={props.setNegativeMarkingEnabled}
                        />
                        <Label htmlFor="negmarking" className="cursor-pointer text-sm">
                            Enable negative marking
                        </Label>
                        {props.negativeMarkingEnabled && (
                            <div className="ml-auto flex items-center gap-2">
                                <Label
                                    htmlFor="neg"
                                    className="text-xs font-normal text-neutral-500"
                                >
                                    Deduct
                                </Label>
                                <Input
                                    id="neg"
                                    type="number"
                                    min={0}
                                    value={props.negativeMarkPerQuestion}
                                    onChange={(e) =>
                                        props.setNegativeMarkPerQuestion(
                                            parseInt(e.target.value, 10) || 0
                                        )
                                    }
                                    className="w-20"
                                />
                                <span className="text-xs text-neutral-500">per wrong answer</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </FieldGroup>

            <Separator />

            {/* Section: Content & visibility */}
            <FieldGroup label="Content & Access">
                <div className="grid grid-cols-2 gap-3">
                    <Field id="numq" label="Number of questions (1–50)">
                        <Input
                            id="numq"
                            type="number"
                            min={1}
                            max={50}
                            value={props.numQuestions}
                            onChange={(e) =>
                                props.setNumQuestions(parseInt(e.target.value, 10) || 20)
                            }
                        />
                    </Field>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-neutral-700">Visibility</Label>
                        <RadioGroup
                            value={props.visibility}
                            onValueChange={(v) =>
                                props.setVisibility(v as 'PRIVATE' | 'PUBLIC')
                            }
                            className="grid grid-cols-2 gap-2"
                        >
                            <VisibilityOption value="PRIVATE" label="Private" hint="batch-only" />
                            <VisibilityOption value="PUBLIC" label="Public" hint="open access" />
                        </RadioGroup>
                    </div>
                </div>
            </FieldGroup>
        </div>
    );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {label}
            </div>
            {children}
        </div>
    );
}

function Field({
    id,
    label,
    children,
}: {
    id: string;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="text-xs font-medium text-neutral-700">
                {label}
            </Label>
            {children}
        </div>
    );
}

function VisibilityOption({
    value,
    label,
    hint,
}: {
    value: string;
    label: string;
    hint: string;
}) {
    return (
        <Label
            htmlFor={`vis-${value}`}
            className="flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50"
        >
            <RadioGroupItem value={value} id={`vis-${value}`} />
            <div className="flex flex-col">
                <span className="text-sm font-medium text-neutral-800">{label}</span>
                <span className="text-[10px] text-neutral-500">{hint}</span>
            </div>
        </Label>
    );
}

// -------------------------------------------------------------------------
// Preview pane
// -------------------------------------------------------------------------

function PreviewPane({
    result,
    batches,
}: {
    result: AssessmentArtifact;
    batches?: BatchSummary[];
}) {
    return (
        <div className="flex flex-col gap-4">
            {/* Title card */}
            <Card className="border-primary-200 bg-primary-50/40">
                <CardContent className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-500" />
                        <div className="flex-1">
                            <div className="text-base font-semibold text-neutral-800">
                                {result.title ?? 'Untitled'}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Badge
                                    variant="outline"
                                    className="border-primary-200 bg-white text-xs font-normal text-neutral-700"
                                >
                                    {result.numQuestions ?? 0} questions
                                </Badge>
                                {result.targetLanguage && (
                                    <Badge
                                        variant="outline"
                                        className="border-primary-200 bg-white text-xs font-normal uppercase text-neutral-700"
                                    >
                                        {result.targetLanguage}
                                    </Badge>
                                )}
                                {result.modelUsed && (
                                    <Badge
                                        variant="outline"
                                        className="border-neutral-200 bg-white font-mono text-[10px] font-normal text-neutral-500"
                                    >
                                        {result.modelUsed}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {batches && batches.length > 0 && (
                        <>
                            <Separator className="my-1 bg-primary-200/50" />
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Users className="size-3 text-neutral-500" />
                                <span className="text-[11px] font-medium text-neutral-500">
                                    Assigned to
                                </span>
                                {batches.map((b) => (
                                    <Badge
                                        key={b.package_session_id}
                                        variant="outline"
                                        className="border-primary-200 bg-white text-[10px] font-normal text-neutral-700"
                                    >
                                        {b.package_name}
                                    </Badge>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Questions */}
            <ScrollArea className="h-[45vh] pr-3">
                <div className="flex flex-col gap-2.5">
                    {(result.questions ?? []).map((q, i) => (
                        <Card key={q.id} className="border-neutral-200">
                            <CardContent className="px-4 py-3">
                                <div className="mb-2.5 flex items-start gap-2">
                                    <Badge
                                        variant="outline"
                                        className="mt-0.5 shrink-0 border-neutral-300 font-mono text-[10px] font-normal text-neutral-500"
                                    >
                                        Q{i + 1}
                                    </Badge>
                                    <div className="flex-1 text-sm font-medium text-neutral-800">
                                        {q.question}
                                    </div>
                                </div>
                                <ul className="ml-7 space-y-1">
                                    {q.options.map((opt, idx) => {
                                        const correct = idx === q.correctAnswerIndex;
                                        return (
                                            <li
                                                key={idx}
                                                className={`flex items-start gap-2 rounded px-2 py-1 text-xs ${
                                                    correct
                                                        ? 'bg-primary-50 text-primary-700'
                                                        : 'text-neutral-600'
                                                }`}
                                            >
                                                <span className="font-mono text-[10px] uppercase opacity-70">
                                                    {String.fromCharCode(65 + idx)}.
                                                </span>
                                                <span className="flex-1">{opt}</span>
                                                {correct && (
                                                    <CheckCircle2 className="size-3.5 shrink-0 text-primary-500" />
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                                {q.explanation && (
                                    <div className="ml-7 mt-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-neutral-600">
                                        <span className="font-semibold text-neutral-700">
                                            Why:
                                        </span>{' '}
                                        {q.explanation}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </ScrollArea>

            <Alert className="border-amber-200 bg-amber-50">
                <Info className="size-4 text-amber-600" />
                <AlertDescription className="ml-2 text-xs text-amber-900">
                    Questions are saved as a generated artifact. Publishing this assessment so
                    learners can take it is a follow-up step (not yet wired in this build).
                </AlertDescription>
            </Alert>
        </div>
    );
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function defaultStartDateTime(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return localIsoForInput(d);
}

function defaultEndDateTime(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return localIsoForInput(d);
}

function localIsoForInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`;
}
