import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft, FloppyDisk, CheckCircle, Play, MagicWand,
    CalendarBlank, Lightning, CaretDown, CaretUp, PencilSimple, GearSix,
} from '@phosphor-icons/react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createWorkflow, testRunWorkflow, validateWorkflow, getTriggerEventsCatalogQuery } from '@/services/workflow-service';
import { WorkflowBuilderDTO } from '@/types/workflow/workflow-types';
import { getUserId } from '@/utils/userDetails';
import { useWorkflowBuilderStore } from '../-stores/workflow-builder-store';
import { WorkflowCustomNode } from './workflow-custom-node';
import { NodePalette } from './node-palette';
import { NodeConfigPanel } from './node-config-panel';
import { TemplateGallery } from './template-gallery';
import { NodeSuggestions } from './node-suggestions';
import { WorkflowWizard } from './workflow-wizard';
import { EventEntityPicker } from './event-entity-picker';

const nodeTypes = { workflowNode: WorkflowCustomNode };

// ─── Grouped trigger events for cleaner display ───
function groupCatalogByCategory(items: Array<{ key: string; label: string; category: string; event_applied_type?: string }>) {
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
        const cat = item.category || 'General';
        if (!groups[cat]) groups[cat] = [];
        groups[cat]!.push(item);
    });
    return groups;
}

// ═══════════════════════════════════════════════════
// SCHEDULE PICKER — Human-readable frequency picker
// ═══════════════════════════════════════════════════

type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'INTERVAL' | 'CUSTOM';

const WEEKDAYS = [
    { value: '1', label: 'Mon', short: 'M' },
    { value: '2', label: 'Tue', short: 'T' },
    { value: '3', label: 'Wed', short: 'W' },
    { value: '4', label: 'Thu', short: 'T' },
    { value: '5', label: 'Fri', short: 'F' },
    { value: '6', label: 'Sat', short: 'S' },
    { value: '0', label: 'Sun', short: 'S' },
];

function parseCronToFrequency(cron: string): { frequency: ScheduleFrequency; hour: number; minute: number; weekdays: string[]; dayOfMonth: number } {
    const defaults = { frequency: 'DAILY' as ScheduleFrequency, hour: 9, minute: 0, weekdays: [] as string[], dayOfMonth: 1 };
    if (!cron) return defaults;

    const parts = cron.trim().split(/\s+/);
    if (parts.length < 6) return { ...defaults, frequency: 'CUSTOM' };

    const [sec, min, hr, dom, , dow] = parts;
    const hour = parseInt(hr!) || 0;
    const minute = parseInt(min!) || 0;

    // Daily: 0 0 9 * * ?
    if (dom === '*' && dow === '?') {
        return { frequency: 'DAILY', hour, minute, weekdays: [], dayOfMonth: 1 };
    }
    // Weekly: 0 0 9 ? * 1,3,5
    if (dom === '?' && dow !== '*' && dow !== '?') {
        const weekdays = dow!.split(',');
        return { frequency: 'WEEKLY', hour, minute, weekdays, dayOfMonth: 1 };
    }
    // Monthly: 0 0 9 15 * ?
    if (dom !== '*' && dom !== '?' && dow === '?') {
        return { frequency: 'MONTHLY', hour, minute, weekdays: [], dayOfMonth: parseInt(dom!) || 1 };
    }

    return { ...defaults, frequency: 'CUSTOM', hour, minute };
}

function buildCron(frequency: ScheduleFrequency, hour: number, minute: number, weekdays: string[], dayOfMonth: number): string {
    switch (frequency) {
        case 'DAILY':
            return `0 ${minute} ${hour} * * ?`;
        case 'WEEKLY':
            return `0 ${minute} ${hour} ? * ${weekdays.length > 0 ? weekdays.join(',') : '1'}`;
        case 'MONTHLY':
            return `0 ${minute} ${hour} ${dayOfMonth} * ?`;
        default:
            return `0 ${minute} ${hour} * * ?`;
    }
}

function SchedulePickerSection({ scheduleConfig, setScheduleConfig }: {
    scheduleConfig: { scheduleType: string; cronExpression: string; intervalMinutes: number; timezone: string; startDate: string; endDate: string };
    setScheduleConfig: (config: Record<string, unknown>) => void;
}) {
    const parsed = parseCronToFrequency(scheduleConfig.cronExpression);
    const [frequency, setFrequency] = useState<ScheduleFrequency>(
        scheduleConfig.scheduleType === 'INTERVAL' ? 'INTERVAL' : parsed.frequency
    );
    const [hour, setHour] = useState(parsed.hour);
    const [minute, setMinute] = useState(parsed.minute);
    const [weekdays, setWeekdays] = useState<string[]>(parsed.weekdays);
    const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth);

    const updateCron = (freq: ScheduleFrequency, h: number, m: number, wd: string[], dom: number) => {
        if (freq === 'INTERVAL') {
            setScheduleConfig({ scheduleType: 'INTERVAL' });
        } else if (freq === 'CUSTOM') {
            setScheduleConfig({ scheduleType: 'CRON' });
        } else {
            const cron = buildCron(freq, h, m, wd, dom);
            setScheduleConfig({ scheduleType: 'CRON', cronExpression: cron });
        }
    };

    const handleFrequency = (f: ScheduleFrequency) => {
        setFrequency(f);
        // Set sensible defaults per frequency
        if (f === 'WEEKLY' && weekdays.length === 0) {
            const defaultDays = ['1', '3', '5']; // Mon, Wed, Fri
            setWeekdays(defaultDays);
            updateCron(f, hour, minute, defaultDays, dayOfMonth);
        } else {
            updateCron(f, hour, minute, weekdays, dayOfMonth);
        }
    };

    const handleTime = (h: number, m: number) => {
        setHour(h);
        setMinute(m);
        updateCron(frequency, h, m, weekdays, dayOfMonth);
    };

    const toggleWeekday = (day: string) => {
        const updated = weekdays.includes(day)
            ? weekdays.filter((d) => d !== day)
            : [...weekdays, day];
        setWeekdays(updated);
        updateCron(frequency, hour, minute, updated, dayOfMonth);
    };

    const handleDayOfMonth = (d: number) => {
        setDayOfMonth(d);
        updateCron(frequency, hour, minute, weekdays, d);
    };

    // Quick presets for weekday selection
    const applyWeekdayPreset = (preset: string[]) => {
        setWeekdays(preset);
        updateCron(frequency, hour, minute, preset, dayOfMonth);
    };

    // Human-readable summary
    const getSummary = () => {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        switch (frequency) {
            case 'DAILY': return `Runs every day at ${timeStr}`;
            case 'WEEKLY': {
                const dayNames = weekdays
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
                    .filter(Boolean);
                if (dayNames.length === 0) return 'Select at least one day';
                if (dayNames.length === 5 && !weekdays.includes('6') && !weekdays.includes('0')) return `Runs weekdays (Mon-Fri) at ${timeStr}`;
                if (dayNames.length === 7) return `Runs every day at ${timeStr}`;
                return `Runs every ${dayNames.join(', ')} at ${timeStr}`;
            }
            case 'MONTHLY': {
                const suffix = dayOfMonth === 1 ? 'st' : dayOfMonth === 2 ? 'nd' : dayOfMonth === 3 ? 'rd' : 'th';
                return `Runs on the ${dayOfMonth}${suffix} of every month at ${timeStr}`;
            }
            case 'INTERVAL': return `Runs every ${scheduleConfig.intervalMinutes} minutes`;
            case 'CUSTOM': return scheduleConfig.cronExpression || 'Enter cron expression';
        }
    };

    const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string; desc: string }[] = [
        { value: 'DAILY', label: 'Daily', desc: 'Every day' },
        { value: 'WEEKLY', label: 'Weekly', desc: 'Pick specific days' },
        { value: 'MONTHLY', label: 'Monthly', desc: 'Once a month' },
        { value: 'INTERVAL', label: 'Repeating', desc: 'Every X minutes' },
        { value: 'CUSTOM', label: 'Custom', desc: 'Cron expression' },
    ];

    return (
        <div className="space-y-5 rounded-xl border bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Step 3 — Set the schedule</h2>

            {/* Frequency selector — highlighted cards */}
            <div>
                <Label className="text-xs font-medium text-gray-600">How often should it run?</Label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                    {FREQUENCY_OPTIONS.map(({ value, label, desc }) => (
                        <button
                            key={value}
                            className={`rounded-xl border-2 px-2 py-3 text-center transition-all ${
                                frequency === value
                                    ? 'border-primary-600 bg-primary-600 shadow-md'
                                    : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
                            }`}
                            onClick={() => handleFrequency(value)}
                        >
                            <div className={`text-xs font-semibold ${frequency === value ? 'text-white' : 'text-gray-700'}`}>
                                {label}
                            </div>
                            <div className={`mt-0.5 text-[10px] ${frequency === value ? 'text-primary-100' : 'text-gray-400'}`}>{desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Configuration area — highlighted container */}
            {frequency !== 'CUSTOM' && frequency !== 'INTERVAL' && (
                <div className={`space-y-4 rounded-xl border-2 p-4 transition-all ${
                    frequency === 'DAILY' ? 'border-primary-200 bg-primary-50/30' :
                    frequency === 'WEEKLY' ? 'border-violet-200 bg-violet-50/30' :
                    'border-amber-200 bg-amber-50/30'
                }`}>
                    {/* Time picker */}
                    <div>
                        <Label className="text-xs font-medium text-gray-600">At what time?</Label>
                        <div className="mt-1.5 flex items-center gap-2">
                            <Input
                                type="time"
                                value={`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`}
                                onChange={(e) => {
                                    const [h, m] = e.target.value.split(':').map(Number);
                                    handleTime(h ?? 9, m ?? 0);
                                }}
                                className="w-36"
                            />
                        </div>
                    </div>

                    {/* Weekday selector — for WEEKLY */}
                    {frequency === 'WEEKLY' && (
                        <div>
                            <Label className="text-xs font-medium text-gray-600">On which days?</Label>
                            <div className="mt-2 flex gap-2">
                                {WEEKDAYS.map((day) => (
                                    <button
                                        key={day.value}
                                        className={`h-10 w-10 rounded-full border-2 text-xs font-bold transition-all ${
                                            weekdays.includes(day.value)
                                                ? 'border-primary-600 bg-primary-600 text-white shadow-md'
                                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-100'
                                        }`}
                                        onClick={() => toggleWeekday(day.value)}
                                        title={day.label}
                                    >
                                        {day.short}
                                    </button>
                                ))}
                            </div>
                            {/* Quick presets */}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                    onClick={() => applyWeekdayPreset(['1', '2', '3', '4', '5'])}
                                >
                                    Weekdays
                                </button>
                                <button
                                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                    onClick={() => applyWeekdayPreset(['6', '0'])}
                                >
                                    Weekends
                                </button>
                                <button
                                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                    onClick={() => applyWeekdayPreset(['1', '3', '5'])}
                                >
                                    Mon, Wed, Fri
                                </button>
                                <button
                                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                    onClick={() => applyWeekdayPreset(['2', '4'])}
                                >
                                    Tue, Thu
                                </button>
                                <button
                                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                    onClick={() => applyWeekdayPreset(['0', '1', '2', '3', '4', '5', '6'])}
                                >
                                    Every day
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Day of month — for MONTHLY */}
                    {frequency === 'MONTHLY' && (
                        <div>
                            <Label className="text-xs font-medium text-gray-600">On which day of the month?</Label>
                            <div className="mt-2 grid grid-cols-7 gap-1.5">
                                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                    <button
                                        key={d}
                                        className={`h-9 rounded-lg border-2 text-xs font-semibold transition-all ${
                                            dayOfMonth === d
                                                ? 'border-primary-600 bg-primary-600 text-white shadow-md'
                                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-100'
                                        }`}
                                        onClick={() => handleDayOfMonth(d)}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Interval config */}
            {frequency === 'INTERVAL' && (
                <div className="rounded-xl border-2 border-green-200 bg-green-50/30 p-4">
                    <Label className="text-xs font-medium text-gray-600">Run every</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                        <Input
                            type="number"
                            value={scheduleConfig.intervalMinutes}
                            onChange={(e) => setScheduleConfig({ intervalMinutes: parseInt(e.target.value) || 60 })}
                            className="w-24"
                            min={1}
                        />
                        <span className="text-sm text-gray-600">minutes</span>
                    </div>
                    {/* Quick presets */}
                    <div className="mt-2 flex gap-1.5">
                        {[
                            { label: '15 min', value: 15 },
                            { label: '30 min', value: 30 },
                            { label: '1 hour', value: 60 },
                            { label: '2 hours', value: 120 },
                            { label: '6 hours', value: 360 },
                            { label: '12 hours', value: 720 },
                        ].map(({ label, value }) => (
                            <button
                                key={value}
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                                    scheduleConfig.intervalMinutes === value
                                        ? 'border-primary-600 bg-primary-600 text-white'
                                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                                onClick={() => setScheduleConfig({ intervalMinutes: value })}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Custom cron */}
            {frequency === 'CUSTOM' && (
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50/50 p-4">
                    <Label className="text-xs font-medium text-gray-600">Cron Expression (Quartz format)</Label>
                    <Input
                        value={scheduleConfig.cronExpression}
                        onChange={(e) => setScheduleConfig({ cronExpression: e.target.value })}
                        className="mt-1.5 font-mono"
                        placeholder="0 0 9 * * ?"
                    />
                    <p className="mt-1 text-[10px] text-gray-400">
                        Format: sec min hr day month weekday. E.g. "0 0 9 * * ?" = daily 9 AM
                    </p>
                </div>
            )}

            {/* Summary banner */}
            <div className="rounded-lg bg-primary-50 border border-primary-100 px-4 py-2.5 flex items-center gap-2">
                <CalendarBlank size={16} weight="fill" className="text-primary-500 shrink-0" />
                <span className="text-sm text-primary-600 font-medium">{getSummary()}</span>
            </div>

            {/* Timezone + dates */}
            <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div>
                    <Label className="text-xs font-medium text-gray-600">Timezone</Label>
                    <select
                        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={scheduleConfig.timezone}
                        onChange={(e) => setScheduleConfig({ timezone: e.target.value })}
                    >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    </select>
                </div>
                <div>
                    <Label className="text-xs font-medium text-gray-600">Start Date</Label>
                    <Input
                        type="datetime-local"
                        value={scheduleConfig.startDate}
                        onChange={(e) => setScheduleConfig({ startDate: e.target.value })}
                        className="mt-1.5 text-xs"
                    />
                </div>
            </div>
            <div>
                <Label className="text-xs font-medium text-gray-600">End Date (optional)</Label>
                <Input
                    type="datetime-local"
                    value={scheduleConfig.endDate}
                    onChange={(e) => setScheduleConfig({ endDate: e.target.value })}
                    className="mt-1.5 text-xs"
                />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// SETUP STEP — Shown before the canvas
// ═══════════════════════════════════════════════════
function WorkflowSetupStep({ onComplete, triggerEventsCatalog, instituteId }: {
    onComplete: () => void;
    triggerEventsCatalog: Array<{ key: string; label: string; description: string; category: string; event_applied_type?: string }>;
    instituteId: string;
}) {
    const navigate = useNavigate();
    const {
        workflowName, workflowDescription, workflowType,
        scheduleConfig, triggerConfig,
        setWorkflowName, setWorkflowDescription, setWorkflowType,
        setScheduleConfig, setTriggerConfig,
    } = useWorkflowBuilderStore();

    const [currentStep, setCurrentStep] = useState(1);

    const handleContinue = () => {
        if (workflowType === 'EVENT_DRIVEN' && triggerConfig.eventName) {
            const store = useWorkflowBuilderStore.getState();
            const existingTrigger = store.nodes.find((n) => n.data.nodeType === 'TRIGGER');
            if (!existingTrigger) {
                store.addNode('TRIGGER', `Trigger: ${triggerConfig.eventName.replace(/_/g, ' ').toLowerCase()}`, { x: 250, y: 50 });
                const newTrigger = useWorkflowBuilderStore.getState().nodes.find((n) => n.data.nodeType === 'TRIGGER');
                if (newTrigger) {
                    store.updateNodeConfig(newTrigger.id, { triggerEvent: triggerConfig.eventName });
                }
            }
        }
        onComplete();
    };

    const groupedEvents = groupCatalogByCategory(triggerEventsCatalog);

    // Step validation
    const canGoToStep2 = workflowName.trim().length > 0;
    const canGoToStep3 = canGoToStep2; // Step 2 is just selecting type, always valid
    const canFinish =
        canGoToStep2 &&
        (workflowType === 'SCHEDULED'
            ? (scheduleConfig.scheduleType === 'CRON' ? scheduleConfig.cronExpression.trim().length > 0 : scheduleConfig.intervalMinutes > 0)
            : triggerConfig.eventName.length > 0);

    const totalSteps = 3;

    const STEPS = [
        { num: 1, label: 'Name' },
        { num: 2, label: 'Trigger Type' },
        { num: 3, label: workflowType === 'EVENT_DRIVEN' ? 'Event Setup' : 'Schedule' },
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] flex-col bg-gray-50">
            {/* Header */}
            <div className="flex items-center gap-3 border-b bg-white px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/workflow/list' })}>
                    <ArrowLeft size={16} />
                </Button>
                <h1 className="text-lg font-semibold text-gray-800">Create New Workflow</h1>
            </div>

            {/* Progress bar */}
            <div className="border-b bg-white px-6 py-4">
                <div className="mx-auto max-w-2xl">
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, i) => (
                            <div key={step.num} className="flex items-center gap-2 flex-1">
                                <button
                                    onClick={() => {
                                        if (step.num === 1 || (step.num === 2 && canGoToStep2) || (step.num === 3 && canGoToStep3)) {
                                            setCurrentStep(step.num);
                                        }
                                    }}
                                    className={`flex items-center gap-2 ${step.num <= currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                        currentStep === step.num
                                            ? 'bg-primary-600 text-white shadow-md'
                                            : currentStep > step.num
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-200 text-gray-500'
                                    }`}>
                                        {currentStep > step.num ? <CheckCircle size={16} weight="bold" /> : step.num}
                                    </div>
                                    <span className={`text-xs font-medium hidden sm:block ${
                                        currentStep === step.num ? 'text-primary-600' : currentStep > step.num ? 'text-green-600' : 'text-gray-400'
                                    }`}>
                                        {step.label}
                                    </span>
                                </button>
                                {i < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.num ? 'bg-green-400' : 'bg-gray-200'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-2xl py-8 px-4">

                    {/* ─── STEP 1: Name ─── */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">What should we call this workflow?</h2>
                                <p className="mt-1 text-sm text-gray-500">Give it a name that describes its purpose.</p>
                            </div>
                            <div className="rounded-xl border bg-white p-6 space-y-4">
                                <div>
                                    <Label className="text-sm font-medium text-gray-700">Workflow Name <span className="text-red-400">*</span></Label>
                                    <Input
                                        value={workflowName}
                                        onChange={(e) => setWorkflowName(e.target.value)}
                                        placeholder="e.g. Welcome Email after Enrollment"
                                        className="mt-2 h-12 text-base"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm font-medium text-gray-700">Description <span className="text-gray-300 text-xs">(optional)</span></Label>
                                    <textarea
                                        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                                        rows={2}
                                        value={workflowDescription}
                                        onChange={(e) => setWorkflowDescription(e.target.value)}
                                        placeholder="Briefly describe what this workflow does"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button size="lg" onClick={() => setCurrentStep(2)} disabled={!canGoToStep2} className="gap-2 px-8">
                                    Next: Choose Trigger Type
                                    <ArrowLeft size={16} className="rotate-180" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP 2: Type selection ─── */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">When should this workflow run?</h2>
                                <p className="mt-1 text-sm text-gray-500">Choose what starts the workflow — an event or a schedule.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    className={`group relative rounded-xl border-2 p-6 text-left transition-all ${
                                        workflowType === 'EVENT_DRIVEN'
                                            ? 'border-primary-600 bg-primary-50 shadow-md ring-1 ring-primary-200'
                                            : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
                                    }`}
                                    onClick={() => setWorkflowType('EVENT_DRIVEN')}
                                >
                                    <div className={`mb-3 inline-flex rounded-lg p-3 ${workflowType === 'EVENT_DRIVEN' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        <Lightning size={28} weight="fill" />
                                    </div>
                                    <h3 className={`text-base font-semibold ${workflowType === 'EVENT_DRIVEN' ? 'text-primary-600' : 'text-gray-800'}`}>When something happens</h3>
                                    <p className={`mt-1.5 text-sm ${workflowType === 'EVENT_DRIVEN' ? 'text-primary-500' : 'text-gray-500'}`}>
                                        Runs when a student enrolls, fills a form, payment fails, etc.
                                    </p>
                                    {workflowType === 'EVENT_DRIVEN' && (
                                        <div className="absolute top-3 right-3"><CheckCircle size={22} weight="fill" className="text-primary-600" /></div>
                                    )}
                                </button>

                                <button
                                    className={`group relative rounded-xl border-2 p-6 text-left transition-all ${
                                        workflowType === 'SCHEDULED'
                                            ? 'border-primary-600 bg-primary-50 shadow-md ring-1 ring-primary-200'
                                            : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
                                    }`}
                                    onClick={() => setWorkflowType('SCHEDULED')}
                                >
                                    <div className={`mb-3 inline-flex rounded-lg p-3 ${workflowType === 'SCHEDULED' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        <CalendarBlank size={28} weight="fill" />
                                    </div>
                                    <h3 className={`text-base font-semibold ${workflowType === 'SCHEDULED' ? 'text-primary-600' : 'text-gray-800'}`}>On a schedule</h3>
                                    <p className={`mt-1.5 text-sm ${workflowType === 'SCHEDULED' ? 'text-primary-500' : 'text-gray-500'}`}>
                                        Runs at fixed times — daily, weekly, monthly, or custom.
                                    </p>
                                    {workflowType === 'SCHEDULED' && (
                                        <div className="absolute top-3 right-3"><CheckCircle size={22} weight="fill" className="text-primary-600" /></div>
                                    )}
                                </button>
                            </div>
                            <div className="flex justify-between">
                                <Button variant="outline" size="lg" onClick={() => setCurrentStep(1)} className="gap-2">
                                    <ArrowLeft size={16} /> Back
                                </Button>
                                <Button size="lg" onClick={() => setCurrentStep(3)} className="gap-2 px-8">
                                    Next: {workflowType === 'EVENT_DRIVEN' ? 'Choose Event' : 'Set Schedule'}
                                    <ArrowLeft size={16} className="rotate-180" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP 3: Configuration ─── */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            {workflowType === 'EVENT_DRIVEN' ? (
                                <>
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-800">Which event should trigger this workflow?</h2>
                                        <p className="mt-1 text-sm text-gray-500">Pick the event, then optionally restrict it to a specific entity.</p>
                                    </div>
                                    <div className="rounded-xl border bg-white p-6 space-y-5">
                                        {/* Event selector */}
                                        <div>
                                            <Label className="text-sm font-medium text-gray-700">Select Event <span className="text-red-400">*</span></Label>
                                            <select
                                                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                                value={triggerConfig.eventName}
                                                onChange={(e) => {
                                                    const eventName = e.target.value;
                                                    const catalogItem = triggerEventsCatalog.find((c) => c.key === eventName);
                                                    const appliedType = catalogItem?.event_applied_type ?? '';
                                                    setTriggerConfig({ eventName, eventAppliedType: appliedType, eventId: undefined });
                                                }}
                                            >
                                                <option value="">-- Select an event --</option>
                                                {Object.entries(groupedEvents).map(([category, items]) => (
                                                    <optgroup key={category} label={category}>
                                                        {items.map((item) => (
                                                            <option key={item.key} value={item.key}>{item.label}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Event description */}
                                        {triggerConfig.eventName && (() => {
                                            const selected = triggerEventsCatalog.find((c) => c.key === triggerConfig.eventName);
                                            return selected ? (
                                                <div className="rounded-lg bg-primary-50 border border-primary-100 px-4 py-3 text-sm text-primary-600">
                                                    {selected.description}
                                                </div>
                                            ) : null;
                                        })()}

                                        {/* Entity picker — clearly separated */}
                                        {triggerConfig.eventAppliedType && (
                                            <div className="border-t pt-5 space-y-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-gray-700">Scope (optional)</h3>
                                                    <p className="mt-0.5 text-xs text-gray-400">
                                                        Choose a specific {triggerConfig.eventAppliedType.replace(/_/g, ' ').toLowerCase()} or leave it as "All" to fire for every one.
                                                    </p>
                                                </div>
                                                <EventEntityPicker
                                                    eventAppliedType={triggerConfig.eventAppliedType}
                                                    value={triggerConfig.eventId}
                                                    onChange={(id) => setTriggerConfig({ eventId: id })}
                                                    instituteId={instituteId}
                                                />
                                            </div>
                                        )}

                                        {/* Description */}
                                        <div className="border-t pt-5">
                                            <Label className="text-sm font-medium text-gray-700">Trigger description <span className="text-gray-300 text-xs">(optional)</span></Label>
                                            <Input
                                                value={triggerConfig.description}
                                                onChange={(e) => setTriggerConfig({ description: e.target.value })}
                                                className="mt-2"
                                                placeholder="e.g. Send welcome email when new student enrolls"
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-800">Set up the schedule</h2>
                                        <p className="mt-1 text-sm text-gray-500">Choose how often and when this workflow should run.</p>
                                    </div>
                                    <SchedulePickerSection
                                        scheduleConfig={scheduleConfig}
                                        setScheduleConfig={setScheduleConfig}
                                    />
                                </>
                            )}

                            <div className="flex justify-between">
                                <Button variant="outline" size="lg" onClick={() => setCurrentStep(2)} className="gap-2">
                                    <ArrowLeft size={16} /> Back
                                </Button>
                                <Button size="lg" onClick={handleContinue} disabled={!canFinish} className="gap-2 px-8">
                                    Continue to Builder
                                    <ArrowLeft size={16} className="rotate-180" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// COMPACT CONFIG SUMMARY — Always visible at top of right panel
// ═══════════════════════════════════════════════════
function WorkflowConfigSummary({ triggerEventsCatalog, onEdit }: {
    triggerEventsCatalog: Array<{ key: string; label: string; event_applied_type?: string }>;
    onEdit: () => void;
}) {
    const { workflowType, scheduleConfig, triggerConfig } = useWorkflowBuilderStore();
    const [expanded, setExpanded] = useState(false);

    const selectedEvent = triggerEventsCatalog.find((c) => c.key === triggerConfig.eventName);

    return (
        <div className="border-b bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {workflowType === 'EVENT_DRIVEN' ? (
                        <Lightning size={14} weight="fill" className="text-amber-500" />
                    ) : (
                        <CalendarBlank size={14} weight="fill" className="text-primary-500" />
                    )}
                    <span className="text-xs font-semibold text-gray-700 uppercase">
                        {workflowType === 'EVENT_DRIVEN' ? 'Event Trigger' : 'Schedule'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onEdit} className="rounded p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="Edit setup">
                        <PencilSimple size={12} />
                    </button>
                    <button onClick={() => setExpanded(!expanded)} className="rounded p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                        {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
                    </button>
                </div>
            </div>

            {/* Compact summary (always visible) */}
            <div className="mt-1.5 text-xs text-gray-600">
                {workflowType === 'EVENT_DRIVEN' ? (
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="font-medium">{selectedEvent?.label ?? triggerConfig.eventName}</span>
                        {triggerConfig.eventAppliedType && (
                            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                                {triggerConfig.eventAppliedType.replace(/_/g, ' ')}
                            </span>
                        )}
                        {triggerConfig.eventId && (
                            <span className="text-gray-400">ID: {triggerConfig.eventId}</span>
                        )}
                        {!triggerConfig.eventId && (
                            <span className="text-gray-400">(all)</span>
                        )}
                    </div>
                ) : (
                    <div>
                        {scheduleConfig.scheduleType === 'CRON'
                            ? <span className="font-mono">{scheduleConfig.cronExpression}</span>
                            : <span>Every {scheduleConfig.intervalMinutes} min</span>
                        }
                        <span className="ml-1.5 text-gray-400">({scheduleConfig.timezone})</span>
                    </div>
                )}
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="mt-3 space-y-2 border-t pt-2 text-xs text-gray-500">
                    {workflowType === 'EVENT_DRIVEN' && triggerConfig.description && (
                        <div>{triggerConfig.description}</div>
                    )}
                    {workflowType === 'SCHEDULED' && (
                        <>
                            {scheduleConfig.startDate && <div>Starts: {scheduleConfig.startDate}</div>}
                            {scheduleConfig.endDate && <div>Ends: {scheduleConfig.endDate}</div>}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════
// BUILDER CANVAS — Main workflow building interface
// ═══════════════════════════════════════════════════
function WorkflowBuilderCanvas({ triggerEventsCatalog, instituteId }: {
    triggerEventsCatalog: Array<{ key: string; label: string; description: string; category: string; event_applied_type?: string }>;
    instituteId: string;
}) {
    const navigate = useNavigate();
    const {
        nodes, edges, workflowName, workflowDescription, workflowType,
        scheduleConfig, triggerConfig, isSaving, selectedNodeId,
        onNodesChange, onEdgesChange, onConnect, selectNode,
        setWorkflowName, setWorkflowDescription, setIsSaving, setSetupComplete,
    } = useWorkflowBuilderStore();

    const [testRunResult, setTestRunResult] = useState<Record<string, unknown> | null>(null);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const addNode = useWorkflowBuilderStore((s) => s.addNode);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: { id: string }) => selectNode(node.id),
        [selectNode]
    );

    const onPaneClick = useCallback(() => selectNode(null), [selectNode]);

    const buildDTO = (status: string): WorkflowBuilderDTO => ({
        name: workflowName,
        description: workflowDescription,
        status,
        workflow_type: workflowType,
        institute_id: instituteId,
        nodes: nodes.map((n, i) => ({
            id: n.id,
            name: n.data.name,
            node_type: n.data.nodeType,
            config: n.data.config ?? {},
            position_x: n.position.x,
            position_y: n.position.y,
            is_start_node: n.data.isStartNode ?? i === 0,
            is_end_node: n.data.isEndNode ?? false,
        })),
        edges: edges.map((e) => ({
            id: e.id,
            source_node_id: e.source,
            target_node_id: e.target,
            label: (e.label as string) ?? '',
        })),
        ...(workflowType === 'SCHEDULED' && {
            schedule: {
                schedule_type: scheduleConfig.scheduleType,
                cron_expression: scheduleConfig.scheduleType === 'CRON' ? scheduleConfig.cronExpression : undefined,
                interval_minutes: scheduleConfig.scheduleType === 'INTERVAL' ? scheduleConfig.intervalMinutes : undefined,
                timezone: scheduleConfig.timezone,
                start_date: scheduleConfig.startDate || undefined,
                end_date: scheduleConfig.endDate || undefined,
            },
        }),
        ...(workflowType === 'EVENT_DRIVEN' && triggerConfig.eventName && {
            trigger: {
                trigger_event_name: triggerConfig.eventName,
                description: triggerConfig.description || undefined,
                event_applied_type: triggerConfig.eventAppliedType || undefined,
                event_id: triggerConfig.eventId || undefined,
            },
        }),
    });

    const runClientValidation = (): string[] => {
        const errors: string[] = [];
        if (!workflowName.trim()) errors.push('Workflow name is required');
        if (nodes.length === 0) errors.push('Add at least one node');
        if (workflowType === 'EVENT_DRIVEN' && !triggerConfig.eventName) {
            errors.push('Select a trigger event for event-driven workflows');
        }
        if (workflowType === 'SCHEDULED' && !scheduleConfig.cronExpression && scheduleConfig.scheduleType === 'CRON') {
            errors.push('Enter a cron expression for scheduled workflows');
        }
        if (nodes.length > 1) {
            const connectedIds = new Set<string>();
            edges.forEach((e) => { connectedIds.add(e.source); connectedIds.add(e.target); });
            const disconnected = nodes.filter((n) => !connectedIds.has(n.id));
            if (disconnected.length > 0) {
                errors.push(`${disconnected.length} node(s) not connected: ${disconnected.map((n) => n.data.name).join(', ')}`);
            }
        }
        return errors;
    };

    const handleSave = async (status: string) => {
        const errors = runClientValidation();
        if (errors.length > 0) {
            setValidationErrors(errors);
            return;
        }
        setValidationErrors([]);
        setIsSaving(true);
        try {
            const dto = buildDTO(status);
            if (status === 'ACTIVE') {
                try {
                    const serverErrors = await validateWorkflow(dto);
                    if (serverErrors && serverErrors.length > 0) {
                        setValidationErrors(serverErrors.map((e: { message?: string; field?: string }) =>
                            `${e.field ? e.field + ': ' : ''}${e.message ?? 'Validation error'}`
                        ));
                        setIsSaving(false);
                        return;
                    }
                } catch { /* proceed */ }
            }
            await createWorkflow(dto, getUserId());
            navigate({ to: '/workflow/list' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setValidationErrors([`Failed to save: ${msg}`]);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestRun = async () => {
        if (nodes.length === 0) {
            setValidationErrors(['Add at least one node before testing']);
            return;
        }
        setIsTestRunning(true);
        setTestRunResult(null);
        setValidationErrors([]);
        try {
            const dto = buildDTO('DRAFT');
            const saved = await createWorkflow(dto, getUserId());
            if (saved.id) {
                const result = await testRunWorkflow(saved.id);
                setTestRunResult(result);
            }
        } catch (err) {
            console.error('Test run failed:', err);
            alert('Test run failed. Check console for details.');
        } finally {
            setIsTestRunning(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] flex-col">
            {/* Toolbar — clean and minimal */}
            <div className="flex items-center gap-3 border-b bg-white px-4 py-2">
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/workflow/list' })}>
                    <ArrowLeft size={16} />
                </Button>

                <Input
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="Workflow name..."
                    className="h-8 w-64 text-sm font-medium"
                />

                {/* Type badge (non-interactive — edit via setup) */}
                <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-gray-600">
                    {workflowType === 'EVENT_DRIVEN' ? (
                        <><Lightning size={12} weight="fill" className="text-amber-500" /> Event-Driven</>
                    ) : (
                        <><CalendarBlank size={12} weight="fill" className="text-primary-500" /> Scheduled</>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)} className="gap-1.5">
                        <MagicWand size={14} /> Wizard
                    </Button>
                    <TemplateGallery instituteId={instituteId} />
                    <Button variant="outline" size="sm" onClick={handleTestRun} disabled={isTestRunning || nodes.length === 0} className="gap-1.5">
                        <Play size={14} /> {isTestRunning ? 'Running...' : 'Test Run'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSave('DRAFT')} disabled={isSaving} className="gap-1.5">
                        <FloppyDisk size={14} /> Save Draft
                    </Button>
                    <Button size="sm" onClick={() => handleSave('ACTIVE')} disabled={isSaving} className="gap-1.5">
                        <CheckCircle size={14} /> Publish
                    </Button>
                </div>
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                            {validationErrors.map((err, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <span className="text-red-500">&#x2022;</span> {err}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setValidationErrors([])} className="text-red-400 hover:text-red-600 text-xs">Dismiss</button>
                    </div>
                </div>
            )}

            {/* Main layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Node palette */}
                <div className="w-56 border-r bg-gray-50">
                    <NodePalette />
                </div>

                {/* Center: ReactFlow canvas */}
                <div className="flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        deleteKeyCode="Backspace"
                        fitView
                        className="bg-gray-100"
                    >
                        <Background gap={20} size={1} />
                        <Controls />
                        <MiniMap nodeStrokeWidth={3} zoomable pannable className="!bg-white !border !border-gray-200 !rounded-lg" />
                    </ReactFlow>
                </div>

                {/* Right: Config summary + Node config */}
                <div className="w-72 border-l bg-white flex flex-col">
                    {/* Always-visible workflow config summary */}
                    <WorkflowConfigSummary
                        triggerEventsCatalog={triggerEventsCatalog}
                        onEdit={() => setSetupComplete(false)}
                    />

                    {/* Node config or workflow info */}
                    <div className="flex-1 overflow-y-auto">
                        {selectedNodeId ? (
                            <NodeConfigPanel />
                        ) : (
                            <div className="flex flex-col gap-4 p-4">
                                <div>
                                    <Label className="text-xs">Description</Label>
                                    <textarea
                                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        rows={2}
                                        value={workflowDescription}
                                        onChange={(e) => setWorkflowDescription(e.target.value)}
                                        placeholder="Describe what this workflow does..."
                                    />
                                </div>
                                <div className="rounded-lg border bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">
                                        <strong>{nodes.length}</strong> nodes, <strong>{edges.length}</strong> connections
                                    </p>
                                </div>
                                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                                    <GearSix size={24} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-xs text-gray-400">
                                        Click a node to configure it, or drag nodes from the left palette to build your workflow.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Node suggestions */}
            {selectedNodeId && (() => {
                const selectedNode = nodes.find((n) => n.id === selectedNodeId);
                return selectedNode ? (
                    <div className="border-t px-4 py-2">
                        <NodeSuggestions
                            currentNodeType={selectedNode.data.nodeType}
                            onAddNode={(type) => {
                                const meta = nodes.find((n) => n.id === selectedNodeId);
                                const pos = meta ? { x: meta.position.x, y: meta.position.y + 180 } : undefined;
                                addNode(type, type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), pos);
                            }}
                        />
                    </div>
                ) : null;
            })()}

            {/* Wizard dialog */}
            <WorkflowWizard
                open={wizardOpen}
                onOpenChange={setWizardOpen}
                instituteId={instituteId}
                onApplyTemplate={(templateJson, name) => {
                    try {
                        const parsed = JSON.parse(templateJson);
                        if (parsed.nodes) {
                            const { setNodes, setEdges, setWorkflowName } = useWorkflowBuilderStore.getState();
                            setWorkflowName(name);
                            const rfNodes = parsed.nodes.map((n: Record<string, unknown>) => ({
                                id: n.id ?? `node-${Math.random().toString(36).slice(2)}`,
                                type: 'workflowNode',
                                position: { x: (n.position_x as number) ?? 0, y: (n.position_y as number) ?? 0 },
                                data: { name: n.name ?? n.node_type, nodeType: n.node_type, config: n.config ?? {}, isStartNode: n.is_start_node ?? false },
                            }));
                            const rfEdges = (parsed.edges ?? []).map((e: Record<string, unknown>) => ({
                                id: e.id ?? `edge-${Math.random().toString(36).slice(2)}`,
                                source: e.source_node_id, target: e.target_node_id,
                                label: e.label ?? '', type: 'smoothstep', animated: true,
                            }));
                            setNodes(rfNodes);
                            setEdges(rfEdges);
                        }
                    } catch (err) {
                        console.error('Failed to parse template:', err);
                    }
                }}
            />

            {testRunResult && (
                <div className="border-t bg-gray-50 p-4 max-h-48 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Test Run Results (Dry Run)</h4>
                        <Button variant="ghost" size="sm" onClick={() => setTestRunResult(null)}>Dismiss</Button>
                    </div>
                    <pre className="text-xs bg-white rounded border p-3 overflow-x-auto">
                        {JSON.stringify(testRunResult, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT — Routes between setup and builder
// ═══════════════════════════════════════════════════
function WorkflowBuilderInner() {
    const { setNavHeading } = useNavHeadingStore();
    const { data: instituteData } = useSuspenseQuery(useInstituteQuery());
    const instituteId = instituteData?.id ?? '';
    const { data: triggerEventsCatalog = [] } = useSuspenseQuery(getTriggerEventsCatalogQuery());

    const setupComplete = useWorkflowBuilderStore((s) => s.setupComplete);
    const setSetupComplete = useWorkflowBuilderStore((s) => s.setSetupComplete);
    const reset = useWorkflowBuilderStore((s) => s.reset);
    const isDirty = useWorkflowBuilderStore((s) => s.isDirty);

    useEffect(() => {
        setNavHeading('Create Workflow');
        return () => reset();
    }, []);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    if (!setupComplete) {
        return (
            <WorkflowSetupStep
                onComplete={() => setSetupComplete(true)}
                triggerEventsCatalog={triggerEventsCatalog}
                instituteId={instituteId}
            />
        );
    }

    return (
        <WorkflowBuilderCanvas
            triggerEventsCatalog={triggerEventsCatalog}
            instituteId={instituteId}
        />
    );
}

export function WorkflowBuilder() {
    return (
        <ReactFlowProvider>
            <WorkflowBuilderInner />
        </ReactFlowProvider>
    );
}
