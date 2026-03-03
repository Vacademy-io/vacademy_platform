import { Button } from '@/components/ui/button';
import { getComponentTemplate, componentTemplates } from '../-utils/component-templates';
import { useEditorStore } from '../-stores/editor-store';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Plus } from 'lucide-react';

/** Each component in the library is individually draggable */
const DraggableComponentItem = ({
    type,
    onAdd,
    disabled,
}: {
    type: string;
    onAdd: (type: string) => void;
    disabled: boolean;
}) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `library-${type}`,
        data: { type },
        disabled,
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex items-center rounded border bg-white transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
        >
            {/* Drag handle */}
            <button
                {...listeners}
                {...attributes}
                className="cursor-grab touch-none px-2 py-3 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
                aria-label="Drag to insert"
            >
                <GripVertical className="size-4" />
            </button>

            {/* Click to add button */}
            <Button
                variant="ghost"
                className="flex-1 h-auto justify-start px-2 py-3 text-left"
                onClick={() => onAdd(type)}
                disabled={disabled}
            >
                <div className="flex flex-col items-start">
                    <span className="font-medium capitalize text-sm">
                        {type.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-xs font-normal text-gray-400">
                        {disabled ? 'Select a page first' : 'Click or drag'}
                    </span>
                </div>
            </Button>

            {/* Quick-add button */}
            <button
                onClick={() => onAdd(type)}
                disabled={disabled}
                className="px-2 py-3 text-gray-400 hover:text-gray-600 disabled:opacity-40"
                aria-label={`Add ${type}`}
            >
                <Plus className="size-4" />
            </button>
        </div>
    );
};

export const ComponentLibrary = () => {
    const { addComponent, selectedPageId } = useEditorStore();

    const handleAdd = (type: string) => {
        if (!selectedPageId) return;
        const component = getComponentTemplate(type);
        addComponent(selectedPageId, component);
    };

    return (
        <div className="flex flex-col gap-1.5 overflow-y-auto p-3">
            <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Drag or click to add
            </p>
            {Object.keys(componentTemplates).map((type) => (
                <DraggableComponentItem
                    key={type}
                    type={type}
                    onAdd={handleAdd}
                    disabled={!selectedPageId}
                />
            ))}
        </div>
    );
};
