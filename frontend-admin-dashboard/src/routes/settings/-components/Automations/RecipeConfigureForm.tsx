/**
 * Inline form shown when the user clicks an Off Switch in the feature
 * dialog. Asks only the questions a non-technical admin can answer:
 *
 *   - Which message to send (one or two templates, depending on recipe)
 *   - For scheduled recipes: a friendly frequency + time picker
 *   - For "days after/before" recipes: one number input with friendly copy
 *
 * On submit it composes a WorkflowBuilderDTO via buildRecipeWorkflow and
 * POSTs through the existing createWorkflow service. There are no triggers,
 * events, SpEL, or cron expressions in the UI here — language is plain
 * English throughout.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkle } from '@phosphor-icons/react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CREATE_MESSAGE_TEMPLATE, MESSAGE_TEMPLATE_EXISTS, INIT_INSTITUTE } from '@/constants/urls';
import { getMessageTemplates } from '@/services/message-template-service';
import { createWorkflow } from '@/services/workflow-service';
import { getInstituteId } from '@/constants/helper';
import { getUserId } from '@/utils/userDetails';
import { SAMPLE_TEMPLATES } from '@/routes/workflow/create/-components/sample-email-templates';
import type { AutomationRecipe } from './automation-recipes';
import { buildRecipeWorkflow, type RecipeFormAnswers, type ScheduleFrequency } from './buildRecipeWorkflow';

function useBatchOptions(instituteId: string) {
    return useQuery({
        queryKey: ['wizard-batches', instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(`${INIT_INSTITUTE}/${instituteId}`);
            const batches = response.data?.batches_for_sessions ?? [];
            if (!Array.isArray(batches)) return [];
            return batches.map((batch: Record<string, unknown>) => {
                const pkg = (batch.package_dto ?? {}) as Record<string, string>;
                const level = (batch.level ?? {}) as Record<string, string>;
                const session = (batch.session ?? {}) as Record<string, string>;
                return {
                    value: (batch.id as string) ?? '',
                    label: `${pkg.package_name ?? 'Unknown'} - ${level.level_name ?? ''} / ${session.session_name ?? ''}`
                        .replace(/ - \/ $/, '')
                        .replace(/ \/ $/, ''),
                };
            });
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!instituteId,
    });
}

function useEmailTemplateOptions() {
    return useQuery({
        queryKey: ['wizard-email-templates'],
        queryFn: async () => {
            const result = await getMessageTemplates('EMAIL', 0, 100);
            return (result.templates ?? []).map((t: { name?: string; id?: string }) => ({
                value: t.name ?? t.id ?? '',
                label: t.name ?? 'Untitled',
            }));
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Creates the sample template (if missing) in the user's library and
 * returns its name so the dropdown can auto-select it. Mirrors
 * use-case-wizard-step.tsx:216-309.
 */
async function ensureSampleTemplate(sampleKey: string): Promise<string | null> {
    const sample = SAMPLE_TEMPLATES[sampleKey];
    if (!sample) return null;
    const instId = getInstituteId();
    let alreadyExists = false;
    try {
        const existsResp = await authenticatedAxiosInstance.get(
            MESSAGE_TEMPLATE_EXISTS(instId ?? '', sample.name),
        );
        alreadyExists = existsResp.data?.exists === true;
    } catch {
        // best-effort — fall through and try create
    }
    if (!alreadyExists) {
        const dynamicParameters: Record<string, string> = {};
        for (const v of sample.variables ?? []) {
            const label = v
                .replace(/[_-]+/g, ' ')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/\b\w/g, (c) => c.toUpperCase());
            dynamicParameters[v] = label;
        }
        try {
            await authenticatedAxiosInstance.post(CREATE_MESSAGE_TEMPLATE, {
                type: 'EMAIL',
                vendorId: 'default',
                instituteId: instId,
                name: sample.name,
                subject: sample.subject,
                content: sample.html,
                contentType: 'text/html',
                settingJson: {
                    variables: sample.variables,
                    isDefault: false,
                    templateType: 'utility',
                },
                dynamicParameters,
                canDelete: true,
                createdBy: 'current-user',
                updatedBy: 'current-user',
            });
        } catch {
            // create may fail if a parallel request created it — name is still valid
        }
    }
    return sample.name;
}

interface Props {
    recipe: AutomationRecipe;
    onCancel: () => void;
    onSaved: () => void;
}

const DAY_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'MON', label: 'Monday' },
    { value: 'TUE', label: 'Tuesday' },
    { value: 'WED', label: 'Wednesday' },
    { value: 'THU', label: 'Thursday' },
    { value: 'FRI', label: 'Friday' },
    { value: 'SAT', label: 'Saturday' },
    { value: 'SUN', label: 'Sunday' },
];

const HOUR_OPTIONS: Array<{ value: string; label: string }> = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    const label =
        i === 0 ? '12:00 AM'
            : i < 12 ? `${i}:00 AM`
                : i === 12 ? '12:00 PM'
                    : `${i - 12}:00 PM`;
    return { value: `${h}:00`, label };
});

export function RecipeConfigureForm({ recipe, onCancel, onSaved }: Props) {
    const queryClient = useQueryClient();
    const instituteIdForBatches = getInstituteId() ?? '';
    const {
        data: templateOptions = [],
        isLoading: templateLoading,
        isError: templateError,
        refetch: refetchTemplates,
    } = useEmailTemplateOptions();
    const { data: batchOptions = [], isLoading: batchLoading } = useBatchOptions(instituteIdForBatches);

    const [primaryTemplate, setPrimaryTemplate] = useState('');
    const [slotAnswers, setSlotAnswers] = useState<Record<string, string>>({});
    const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
    const [timeOfDay, setTimeOfDay] = useState('09:00');
    const [dayOfWeek, setDayOfWeek] = useState('MON');
    const [daysAfter, setDaysAfter] = useState(3);
    const [daysBefore, setDaysBefore] = useState(7);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

    const [creatingSampleKey, setCreatingSampleKey] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleUseSample = async (sampleKey: string, target: 'primary' | string) => {
        setCreatingSampleKey(target);
        try {
            const name = await ensureSampleTemplate(sampleKey);
            await queryClient.invalidateQueries({ queryKey: ['wizard-email-templates'] });
            if (!name) {
                toast.error('No sample template available for this recipe yet.');
                return;
            }
            if (target === 'primary') setPrimaryTemplate(name);
            else setSlotAnswers((prev) => ({ ...prev, [target]: name }));
            toast.success(`Added "${name}" to your template library.`);
        } catch {
            toast.error('Could not add the sample template. Please try again.');
        } finally {
            setCreatingSampleKey(null);
        }
    };

    const isValid = (() => {
        const templateOk = recipe.templateSlots && recipe.templateSlots.length > 0
            ? recipe.templateSlots.every((s) => (slotAnswers[s.answerKey] ?? '').length > 0)
            : primaryTemplate.length > 0;
        if (!templateOk) return false;
        if (recipe.target && selectedBatches.length === 0) return false;
        return true;
    })();

    const handleSave = async () => {
        if (!isValid) return;
        const instituteId = getInstituteId();
        if (!instituteId) {
            toast.error('Could not determine your institute. Please reload and try again.');
            return;
        }
        const form: RecipeFormAnswers = {
            templateName: primaryTemplate || undefined,
            templateSlotAnswers: recipe.templateSlots ? slotAnswers : undefined,
            schedule:
                recipe.mode === 'scheduled'
                    ? { frequency, timeOfDay, dayOfWeek }
                    : undefined,
            daysAfterSubmission: recipe.extraQuestions?.includes('days_after_submission')
                ? daysAfter
                : undefined,
            daysBeforeExpiry: recipe.extraQuestions?.includes('days_before_expiry')
                ? daysBefore
                : undefined,
            batchIds: recipe.target ? selectedBatches : undefined,
        };
        setSaving(true);
        try {
            const dto = buildRecipeWorkflow(recipe, form, instituteId);
            await createWorkflow(dto, getUserId());
            await queryClient.invalidateQueries({
                queryKey: ['GET_ACTIVE_WORKFLOWS_WITH_SCHEDULES'],
                refetchType: 'all',
            });
            toast.success('Automation turned on.');
            onSaved();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            toast.error(`Could not turn on the automation: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    const renderTemplateDropdown = (
        value: string,
        onChange: (val: string) => void,
        sampleKey: string | undefined,
        targetKey: 'primary' | string,
    ) => {
        const hasSample = !!(sampleKey && SAMPLE_TEMPLATES[sampleKey]);
        const isEmpty = !templateLoading && !templateError && templateOptions.length === 0;

        return (
            <div className="space-y-2">
                {templateError ? (
                    // Fetch failed — surface the error and give a retry button so
                    // the user isn't left wondering why the dropdown is blank.
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                        <div className="font-semibold">Couldn’t load your email templates.</div>
                        <div className="mt-0.5 text-red-500">
                            This might be a network issue or your session has expired.
                        </div>
                        <button
                            type="button"
                            className="mt-2 rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                            onClick={() => refetchTemplates()}
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-50"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={templateLoading || isEmpty}
                    >
                        <option value="">
                            {templateLoading
                                ? 'Loading your messages…'
                                : isEmpty
                                    ? 'No messages yet — use the sample below'
                                    : '— Pick a message —'}
                        </option>
                        {templateOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                )}

                {/* Empty-state hint: when the user has no templates AND a sample
                    exists, make it obvious the sample button is the next step. */}
                {isEmpty && hasSample && (
                    <p className="text-[11px] text-gray-500">
                        You haven’t created any email messages yet — that’s fine, click below to
                        add a ready-made one to your library.
                    </p>
                )}

                {hasSample && (
                    <button
                        type="button"
                        disabled={creatingSampleKey !== null}
                        className={`flex w-full items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                            isEmpty
                                ? 'border-primary-400 bg-primary-50 hover:border-primary-500 hover:bg-primary-100'
                                : 'border-primary-200 bg-primary-50/50 hover:border-primary-400 hover:bg-primary-50'
                        }`}
                        onClick={() => handleUseSample(sampleKey!, targetKey)}
                    >
                        <Sparkle size={16} weight="fill" className="shrink-0 text-primary-500" />
                        <div className="flex-1">
                            <div className="text-xs font-semibold text-primary-700">
                                {creatingSampleKey === targetKey
                                    ? 'Adding…'
                                    : isEmpty
                                        ? `Add sample message: "${SAMPLE_TEMPLATES[sampleKey!]!.name}"`
                                        : `Don’t have one? Use our sample: "${SAMPLE_TEMPLATES[sampleKey!]!.name}"`}
                            </div>
                            <div className="mt-0.5 text-[10px] text-primary-400">
                                We’ll add it to your template library — you can edit it later.
                            </div>
                        </div>
                    </button>
                )}

                {/* No sample available and no templates — tell the user where to
                    create one so they aren't stuck. */}
                {isEmpty && !hasSample && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                        You have no email messages saved yet. Go to{' '}
                        <a href="/settings?selectedTab=templates" className="font-semibold underline">
                            Settings → Template Settings
                        </a>{' '}
                        to create one, then come back here.
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="rounded-lg border border-primary-200 bg-primary-50/40 p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-800">
                Configure: {recipe.label}
            </div>

            {/* Batch picker — only when the recipe actually needs a target */}
            {recipe.target === 'batch_single' && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                        Which batch should this apply to?
                    </Label>
                    <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        value={selectedBatches[0] ?? ''}
                        onChange={(e) => setSelectedBatches(e.target.value ? [e.target.value] : [])}
                    >
                        <option value="">— Pick a batch —</option>
                        {batchLoading && <option disabled>Loading batches…</option>}
                        {batchOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {recipe.target === 'batch_multi' && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                        Which batches should this apply to? (Pick one or more)
                    </Label>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2">
                        {batchLoading && <p className="px-2 py-1 text-xs text-gray-400">Loading batches…</p>}
                        {!batchLoading && batchOptions.length === 0 && (
                            <p className="px-2 py-1 text-xs text-gray-400">No batches found yet.</p>
                        )}
                        {batchOptions.map((opt) => {
                            const checked = selectedBatches.includes(opt.value);
                            return (
                                <label
                                    key={opt.value}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50"
                                >
                                    <input
                                        type="checkbox"
                                        className="size-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                                        checked={checked}
                                        onChange={(e) =>
                                            setSelectedBatches((prev) =>
                                                e.target.checked
                                                    ? [...prev, opt.value]
                                                    : prev.filter((id) => id !== opt.value),
                                            )
                                        }
                                    />
                                    <span className="text-gray-700">{opt.label || 'Untitled batch'}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Template question(s) */}
            {recipe.templateSlots && recipe.templateSlots.length > 0 ? (
                recipe.templateSlots.map((slot) => (
                    <div key={slot.answerKey} className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-700">
                            {slot.label}
                        </Label>
                        {renderTemplateDropdown(
                            slotAnswers[slot.answerKey] ?? '',
                            (val) => setSlotAnswers((prev) => ({ ...prev, [slot.answerKey]: val })),
                            slot.sampleTemplateKey,
                            slot.answerKey,
                        )}
                    </div>
                ))
            ) : (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                        Which message to send?
                    </Label>
                    {renderTemplateDropdown(
                        primaryTemplate,
                        setPrimaryTemplate,
                        recipe.defaultSampleTemplateKey ?? recipe.useCaseTemplateId,
                        'primary',
                    )}
                </div>
            )}

            {/* Days-after for delayed lead follow-ups */}
            {recipe.extraQuestions?.includes('days_after_submission') && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                        Send the follow-up how many days after someone fills the form?
                    </Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min={1}
                            max={365}
                            value={daysAfter}
                            onChange={(e) => setDaysAfter(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24"
                        />
                        <span className="text-xs text-gray-500">day(s) later</span>
                    </div>
                </div>
            )}

            {/* Days-before for membership expiry */}
            {recipe.extraQuestions?.includes('days_before_expiry') && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                        How many days before expiry should we send the reminder?
                    </Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min={1}
                            max={90}
                            value={daysBefore}
                            onChange={(e) => setDaysBefore(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24"
                        />
                        <span className="text-xs text-gray-500">day(s) before</span>
                    </div>
                </div>
            )}

            {/* Schedule question (only for scheduled recipes) */}
            {recipe.mode === 'scheduled' && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                        When should this run?
                    </Label>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gray-600">Every</span>
                        <select
                            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm"
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                        >
                            <option value="daily">day</option>
                            <option value="weekly">week</option>
                        </select>
                        {frequency === 'weekly' && (
                            <>
                                <span className="text-gray-600">on</span>
                                <select
                                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm"
                                    value={dayOfWeek}
                                    onChange={(e) => setDayOfWeek(e.target.value)}
                                >
                                    {DAY_OPTIONS.map((d) => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        <span className="text-gray-600">at</span>
                        <select
                            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm"
                            value={timeOfDay}
                            onChange={(e) => setTimeOfDay(e.target.value)}
                        >
                            {HOUR_OPTIONS.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <p className="text-[11px] text-gray-400">Time zone: India Standard Time (IST)</p>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
                    Cancel
                </Button>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    disabled={!isValid || saving}
                    onClick={handleSave}
                >
                    {saving ? 'Turning on…' : 'Turn on automation'}
                </MyButton>
            </div>
        </div>
    );
}
