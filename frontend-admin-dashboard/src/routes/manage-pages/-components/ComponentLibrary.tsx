import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getComponentTemplate, buildComponentTemplates } from '../-utils/component-templates';
import { componentLabel } from '../-utils/component-labels';
import { useEditorStore } from '../-stores/editor-store';
import { useDraggable } from '@dnd-kit/core';
import {
    Columns,
    ColumnsPlusLeft,
    TextColumns,
    GridFour,
    DotsSixVertical,
    SquaresFour,
    Plus,
} from '@phosphor-icons/react';

// Layout presets — each maps a human label to the template key
const LAYOUT_PRESETS = [
    {
        key: 'columnLayout2',
        label: '2 Columns',
        description: '50 / 50',
        icon: <Columns className="size-4 shrink-0 text-teal-500" />,
    },
    {
        key: 'columnLayout2asymLeft',
        label: '2 Columns',
        description: '1/3 + 2/3',
        icon: <ColumnsPlusLeft className="size-4 shrink-0 text-teal-500" />,
    },
    {
        key: 'columnLayout3',
        label: '3 Columns',
        description: '33 / 33 / 33',
        icon: <TextColumns className="size-4 shrink-0 text-teal-500" />,
    },
    {
        key: 'columnLayout4',
        label: '4 Columns',
        description: '25 / 25 / 25 / 25',
        icon: <GridFour className="size-4 shrink-0 text-teal-500" />,
    },
] as const;

// Template keys that are layout containers — excluded from the content list
const LAYOUT_KEYS = new Set<string>(LAYOUT_PRESETS.map((p) => p.key));

/** Each component in the library is individually draggable */
const DraggableComponentItem = ({
    templateKey,
    label,
    description,
    onAdd,
    disabled,
    icon,
}: {
    templateKey: string;
    label: string;
    description: string;
    onAdd: (key: string) => void;
    disabled: boolean;
    icon?: React.ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `library-${templateKey}`,
        data: { type: templateKey },
        disabled,
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`flex items-center rounded border bg-white transition-opacity cursor-grab touch-none active:cursor-grabbing ${isDragging ? 'opacity-40' : 'opacity-100'}`}
        >
            {/* Drag handle icon */}
            <div className="px-2 py-3 text-gray-300">
                <DotsSixVertical className="size-4" />
            </div>

            {/* Click to add */}
            <button
                className="flex flex-1 items-start gap-2 px-2 py-3 text-left"
                onClick={(e) => { e.stopPropagation(); onAdd(templateKey); }}
                disabled={disabled}
            >
                {icon}
                <div className="flex flex-col items-start">
                    <span className="font-medium capitalize text-sm">{label}</span>
                    <span className="text-xs font-normal text-gray-400">
                        {disabled ? 'Select a page first' : description}
                    </span>
                </div>
            </button>

            {/* Quick-add button */}
            <button
                onClick={(e) => { e.stopPropagation(); onAdd(templateKey); }}
                disabled={disabled}
                className="px-2 py-3 text-gray-400 hover:text-gray-600 disabled:opacity-40"
                aria-label={`Add ${label}`}
            >
                <Plus className="size-4" />
            </button>
        </div>
    );
};

export const ComponentLibrary = () => {
    const { t } = useTranslation('managePagesComponentTemplates');
    const { addComponent, selectedPageId } = useEditorStore();

    const handleAdd = (templateKey: string) => {
        if (!selectedPageId) return;
        const component = getComponentTemplate(templateKey, t);
        addComponent(selectedPageId, component);
    };

    const contentTypes = useMemo(
        () => Object.keys(buildComponentTemplates(t)).filter((k) => !LAYOUT_KEYS.has(k)),
        [t]
    );


    return (
        <div className="flex flex-col gap-1.5 overflow-y-auto p-3">
            {/* ── Layout containers ── */}
            <p className="mb-1 mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-600">
                <SquaresFour className="size-3.5" /> Layout
            </p>
            {LAYOUT_PRESETS.map((preset) => (
                <DraggableComponentItem
                    key={preset.key}
                    templateKey={preset.key}
                    label={preset.label}
                    description={preset.description}
                    icon={preset.icon}
                    onAdd={handleAdd}
                    disabled={!selectedPageId}
                />
            ))}

            {/* ── Content components ── */}
            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Components
            </p>
            {contentTypes.map((type) => (
                <DraggableComponentItem
                    key={type}
                    templateKey={type}
                    label={componentLabel(type)}
                    description="Click or drag"
                    onAdd={handleAdd}
                    disabled={!selectedPageId}
                />
            ))}
        </div>
    );
};
