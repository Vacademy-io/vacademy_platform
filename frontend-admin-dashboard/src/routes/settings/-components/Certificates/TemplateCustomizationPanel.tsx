import { ArrowCounterClockwise, Palette, TextT } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type {
    BuiltinCertificateTemplate,
    TemplateCustomizations,
} from '../../-utils/builtin-certificate-templates';

interface TemplateCustomizationPanelProps {
    template: BuiltinCertificateTemplate;
    customizations: TemplateCustomizations;
    onChange: (next: TemplateCustomizations) => void;
    onResetToDefaults: () => void;
    disabled?: boolean;
}

interface FieldDef {
    key: keyof TemplateCustomizations;
    label: string;
    type: 'color' | 'text' | 'number';
    hint?: string;
    min?: number;
    max?: number;
    group: 'colors' | 'text' | 'layout';
}

const FIELDS: FieldDef[] = [
    { key: 'primaryColor', label: 'Primary Color', type: 'color', group: 'colors' },
    { key: 'secondaryColor', label: 'Secondary Color', type: 'color', group: 'colors' },
    { key: 'backgroundColor', label: 'Background', type: 'color', group: 'colors' },
    { key: 'titleText', label: 'Main Title', type: 'text', group: 'text' },
    { key: 'subtitleText', label: 'Subtitle', type: 'text', group: 'text' },
    { key: 'presentedText', label: 'Presented-to Line', type: 'text', group: 'text' },
    {
        key: 'forCompletionText',
        label: 'Completion Line',
        type: 'text',
        group: 'text',
    },
    {
        key: 'borderWidth',
        label: 'Border / Accent Width',
        type: 'number',
        min: 0,
        max: 30,
        group: 'layout',
        hint: 'Border thickness (or accent-stripe width for Modern Minimal).',
    },
];

export const TemplateCustomizationPanel = ({
    template,
    customizations,
    onChange,
    onResetToDefaults,
    disabled,
}: TemplateCustomizationPanelProps) => {
    const hiddenKeys = new Set(template.hiddenCustomizationKeys ?? []);
    const visibleFields = FIELDS.filter((f) => !hiddenKeys.has(f.key));

    const setField = <K extends keyof TemplateCustomizations>(
        key: K,
        value: TemplateCustomizations[K]
    ) => {
        onChange({ ...customizations, [key]: value });
    };

    const groups: { id: FieldDef['group']; label: string; icon: JSX.Element }[] = [
        { id: 'colors', label: 'Colors', icon: <Palette size={14} /> },
        { id: 'text', label: 'Text', icon: <TextT size={14} /> },
        { id: 'layout', label: 'Layout', icon: <Palette size={14} /> },
    ];

    return (
        <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-neutral-800">
                        Customize "{template.name}"
                    </h3>
                    <p className="text-xs text-neutral-500">
                        Edit colors and text on the template. The canvas updates live.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onResetToDefaults}
                    disabled={disabled}
                    className={cn(
                        'flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50',
                        disabled && 'cursor-not-allowed opacity-50'
                    )}
                    title="Restore this template's default colors and text"
                >
                    <ArrowCounterClockwise size={12} />
                    Reset
                </button>
            </div>

            <div className="space-y-4">
                {groups.map((group) => {
                    const fieldsInGroup = visibleFields.filter((f) => f.group === group.id);
                    if (fieldsInGroup.length === 0) return null;
                    return (
                        <div key={group.id}>
                            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                                {group.icon}
                                {group.label}
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {fieldsInGroup.map((field) => (
                                    <div key={field.key}>
                                        <label className="mb-1 block text-xs font-medium text-neutral-700">
                                            {field.label}
                                        </label>
                                        {field.type === 'color' && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={
                                                        (customizations[field.key] as string) ||
                                                        '#000000'
                                                    }
                                                    onChange={(e) =>
                                                        setField(field.key, e.target.value as never)
                                                    }
                                                    disabled={disabled}
                                                    className="h-8 w-12 cursor-pointer rounded border border-neutral-200 bg-white p-0.5"
                                                />
                                                <input
                                                    type="text"
                                                    value={customizations[field.key] as string}
                                                    onChange={(e) =>
                                                        setField(field.key, e.target.value as never)
                                                    }
                                                    disabled={disabled}
                                                    placeholder="#000000"
                                                    className="flex-1 rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-xs"
                                                />
                                            </div>
                                        )}
                                        {field.type === 'text' && (
                                            <input
                                                type="text"
                                                value={customizations[field.key] as string}
                                                onChange={(e) =>
                                                    setField(field.key, e.target.value as never)
                                                }
                                                disabled={disabled}
                                                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
                                            />
                                        )}
                                        {field.type === 'number' && (
                                            <input
                                                type="number"
                                                min={field.min}
                                                max={field.max}
                                                value={customizations[field.key] as number}
                                                onChange={(e) =>
                                                    setField(
                                                        field.key,
                                                        Math.max(
                                                            field.min ?? 0,
                                                            Math.min(
                                                                field.max ?? 999,
                                                                Number(e.target.value) || 0
                                                            )
                                                        ) as never
                                                    )
                                                }
                                                disabled={disabled}
                                                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
                                            />
                                        )}
                                        {field.hint && (
                                            <p className="mt-1 text-[10px] text-neutral-400">
                                                {field.hint}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
